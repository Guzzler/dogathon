import { describe, expect, it } from "vitest";
import {
  applicationAge,
  approvalBadge,
  approvalDecision,
  releasesFoster,
  byNewest,
  composeApprovalChecklist,
  inboxError,
  isActionable,
  splitByOwner,
  staffTransitions,
} from "./applicationView";
import type { Application, ChecklistItem } from "../types";

const at = (ms: number | null) =>
  ({ id: String(ms), createdAt: ms === null ? null : { toMillis: () => ms } }) as Application;

describe("staffTransitions", () => {
  it("offers the other two statuses, never the current one", () => {
    expect(staffTransitions("submitted")).toEqual(["in_review", "approved", "declined"]);
    expect(staffTransitions("in_review")).toEqual(["approved", "declined"]);
  });

  it("never offers withdrawn, and offers nothing on a withdrawn row", () => {
    // withdrawn is the foster's action alone -- firestore.rules' foster branch is the only
    // place it can be set, so a shelter UI that offered it would just fail the write.
    for (const s of ["submitted", "in_review", "approved", "declined"] as const) {
      expect(staffTransitions(s)).not.toContain("withdrawn");
    }
    expect(staffTransitions("withdrawn")).toEqual([]);
    expect(isActionable("withdrawn")).toBe(false);
  });
});

describe("applicationAge", () => {
  const now = Date.UTC(2026, 7, 31);
  it("reads as age, not a date", () => {
    expect(applicationAge(now, now)).toBe("Today");
    expect(applicationAge(now - 86_400_000, now)).toBe("Yesterday");
    expect(applicationAge(now - 3 * 86_400_000, now)).toBe("3 days ago");
    expect(applicationAge(now - 21 * 86_400_000, now)).toBe("3 weeks ago");
    expect(applicationAge(now - 70 * 86_400_000, now)).toBe("2 months ago");
  });

  it("handles an unstamped serverTimestamp rather than rendering NaN", () => {
    expect(applicationAge(null, now)).toBe("Just now");
  });
});

describe("byNewest", () => {
  it("sorts newest first and floats an unstamped write to the top", () => {
    const sorted = [at(100), at(null), at(300)].sort(byNewest).map((a) => a.id);
    expect(sorted).toEqual(["null", "300", "100"]);
  });
});

describe("splitByOwner", () => {
  it("splits on owner, falling back to the default for records predating the field", () => {
    const { shelter, foster } = splitByOwner([
      { id: "home-check", label: "Home environment check", done: false },
      { id: "application", label: "Foster application submitted", done: true },
      { id: "custom", label: "Something a shelter added", done: false, owner: "shelter" },
    ]);
    expect(shelter.map((i) => i.id)).toEqual(["home-check", "custom"]);
    expect(foster.map((i) => i.id)).toEqual(["application"]);
  });
});

describe("inboxError", () => {
  it("tells a still-building index apart from a refusal", () => {
    expect(inboxError("failed-precondition").retryable).toBe(true);
    expect(inboxError("permission-denied").retryable).toBe(false);
    expect(inboxError(undefined).retryable).toBe(true);
  });
});

describe("composeApprovalChecklist", () => {
  // The foster document as the app writes it: the shelter's two steps are present but stale,
  // because nothing on the foster side has been allowed to tick them since RS-10.
  const fosterList: ChecklistItem[] = [
    { id: "application", label: "Foster application submitted", done: true, owner: "foster" },
    { id: "home-check", label: "Home environment check", done: false, owner: "shelter" },
    { id: "reference-check", label: "Reference check", done: false, owner: "shelter" },
    { id: "orientation", label: "Foster orientation completed", done: false, owner: "foster" },
  ];

  it("falls back to the foster document when there is no application", () => {
    // Guests, LOCAL_MODE, and anyone whose record predates the collection. This is also the
    // path the Demo Shelter panel drives, so it has to keep working unchanged.
    expect(composeApprovalChecklist(fosterList, null)).toBe(fosterList);
  });

  it("keeps foster ticks when the shelter has done nothing", () => {
    const app: ChecklistItem[] = [
      { id: "home-check", label: "Home environment check", done: false, owner: "shelter" },
      { id: "reference-check", label: "Reference check", done: false, owner: "shelter" },
    ];
    const out = composeApprovalChecklist(fosterList, app);
    expect(out.map((i) => [i.id, i.done])).toEqual([
      ["application", true],
      ["home-check", false],
      ["reference-check", false],
      ["orientation", false],
    ]);
  });

  it("takes the shelter's ticks from the application, not the foster document", () => {
    const app: ChecklistItem[] = [
      { id: "home-check", label: "Home environment check", done: true, owner: "shelter" },
      { id: "reference-check", label: "Reference check", done: true, owner: "shelter" },
      // Staff ticking their copy of a foster-owned step must not move it on the foster's side.
      { id: "orientation", label: "Foster orientation completed", done: true, owner: "foster" },
    ];
    const out = composeApprovalChecklist(fosterList, app);
    expect(out.find((i) => i.id === "home-check")?.done).toBe(true);
    expect(out.find((i) => i.id === "reference-check")?.done).toBe(true);
    expect(out.find((i) => i.id === "orientation")?.done).toBe(false);
  });

  it("joins both sides' ticks into one list without either overwriting the other", () => {
    const bothDone = fosterList.map((i) => (i.owner === "foster" ? { ...i, done: true } : i));
    const app: ChecklistItem[] = [
      { id: "home-check", label: "Home environment check", done: true, owner: "shelter" },
      { id: "reference-check", label: "Reference check", done: true, owner: "shelter" },
    ];
    const out = composeApprovalChecklist(bothDone, app);
    expect(out.every((i) => i.done)).toBe(true);
    // The pickup gate reads exactly this -- both halves finished, one list.
    expect(out).toHaveLength(4);
  });

  it("uses checklistOwner for entries written before the owner field existed", () => {
    const legacy: ChecklistItem[] = [
      { id: "application", label: "Foster application submitted", done: true },
      { id: "home-check", label: "Home environment check", done: false },
    ];
    const out = composeApprovalChecklist(legacy, [
      { id: "home-check", label: "Home environment check", done: true },
    ]);
    expect(out.find((i) => i.id === "home-check")?.done).toBe(true);
    expect(out.find((i) => i.id === "application")?.done).toBe(true);
  });

  it("appends a shelter step the foster document has never seen", () => {
    // Defaults drifting between the two writers. A step the shelter is tracking and the
    // foster can't see is the exact failure this join exists to remove, so it is shown.
    const out = composeApprovalChecklist(fosterList, [
      { id: "vet-reference", label: "Vet reference", done: false, owner: "shelter" },
    ]);
    expect(out).toHaveLength(5);
    expect(out[4].id).toBe("vet-reference");
  });

  it("does not mutate the foster document's list", () => {
    const before = JSON.stringify(fosterList);
    composeApprovalChecklist(fosterList, [
      { id: "home-check", label: "Home environment check", done: true, owner: "shelter" },
    ]);
    expect(JSON.stringify(fosterList)).toBe(before);
  });
});

/**
 * RS-11: the foster's four readings of one application. The case that forced the precedence
 * to exist is `declined` over a fully-ticked checklist -- the old code showed
 * "✓ Approved — schedule pickup" there, which is the app inviting someone to book a pickup
 * for a dog they were refused.
 */
describe("approvalDecision", () => {
  it("resolves the shelter's bookkeeping statuses to no decision at all", () => {
    expect(approvalDecision("submitted")).toBe(null);
    expect(approvalDecision("in_review")).toBe(null);
  });

  it("surfaces the three statuses that are news for the foster", () => {
    expect(approvalDecision("approved")).toBe("approved");
    expect(approvalDecision("declined")).toBe("declined");
    expect(approvalDecision("withdrawn")).toBe("withdrawn");
  });

  it("never reads absence as a decline", () => {
    // A guest, a LOCAL_MODE foster and every record predating the collection have no
    // application document. All of them fall through to today's checklist-derived behaviour.
    expect(approvalDecision(null)).toBe(null);
    expect(approvalDecision(undefined)).toBe(null);
  });
});

describe("releasesFoster", () => {
  it("frees the foster once the application is over, either way", () => {
    expect(releasesFoster("declined")).toBe(true);
    expect(releasesFoster("withdrawn")).toBe(true);
  });

  it("keeps the one-foster-at-a-time block while the application is live", () => {
    expect(releasesFoster("submitted")).toBe(false);
    expect(releasesFoster("in_review")).toBe(false);
    // Approved is the most live an application gets -- that dog is spoken for.
    expect(releasesFoster("approved")).toBe(false);
    expect(releasesFoster(null)).toBe(false);
  });
});

describe("approvalBadge", () => {
  const waiting = { tone: "butter", label: "⏳ Waiting for approval" } as const;

  it("leaves each surface its own checklist-derived badge while nothing is decided", () => {
    expect(approvalBadge(null, "SF SPCA", waiting)).toEqual(waiting);
    expect(approvalBadge(null, "SF SPCA", { tone: "sage", label: "✓ Approved — schedule pickup" }))
      .toEqual({ tone: "sage", label: "✓ Approved — schedule pickup" });
  });

  it("replaces a fully-ticked checklist's badge when the shelter declined", () => {
    const ticked = { tone: "sage", label: "✓ Approved — schedule pickup" } as const;
    expect(approvalBadge(approvalDecision("declined"), "SF SPCA", ticked)).toEqual({
      tone: "coral",
      label: "SF SPCA couldn't approve this application",
    });
  });

  it("replaces the badge on approval without claiming anything about the checklist", () => {
    expect(approvalBadge("approved", "SF SPCA", waiting)).toEqual({
      tone: "sage",
      label: "✓ SF SPCA approved your application",
    });
  });

  it("says who withdrew, since the foster did it themselves", () => {
    expect(approvalBadge("withdrawn", "SF SPCA", waiting).label).toBe("You withdrew this application");
  });
});
