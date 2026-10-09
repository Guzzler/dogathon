import { describe, expect, it } from "vitest";
import {
  APPLICATION_STAGES,
  activeStage,
  agreedPickup,
  applicationAge,
  canConfirmPickup,
  pickupAskedToMove,
  pickupAwaitingShelter,
  pickupState,
  approvalBadge,
  approvalDecision,
  releasesFoster,
  byNewest,
  composeApprovalChecklist,
  inboxError,
  isActionable,
  splitByOwner,
  staffTransitions,
  withdrawnAfterHandoff,
  heldByAnother,
  pickupHolder,
  placedElsewhere,
  offRoster,
  unlisted,
  confirmedHolder,
  takenDownAfterConfirm,
} from "./applicationView";
import type { Application, ApplicationStatus, ChecklistItem, DogStatus, Pickup } from "../types";

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

/* ---------- RS-14: the pickup request and the shelter's answer ---------- */

const SLOT: Pickup = { date: "2099-06-12", time: "1:30 PM", location: "201 Alabama St" };
const STAMP = { toMillis: () => 1 };

describe("pickupState", () => {
  it("is none without a request, whatever the application says", () => {
    expect(pickupState(null, { pickup: SLOT, pickupConfirmedAt: STAMP })).toBe("none");
    expect(pickupState(undefined, null)).toBe("none");
  });

  it("is requested until the shelter stamps it", () => {
    expect(pickupState(SLOT, { pickup: SLOT, pickupConfirmedAt: null })).toBe("requested");
    // Applications written before RS-14 have no field at all.
    expect(pickupState(SLOT, { pickup: SLOT })).toBe("requested");
  });

  it("is confirmed only when the shelter stamped the slot the foster holds", () => {
    expect(pickupState(SLOT, { pickup: { ...SLOT }, pickupConfirmedAt: STAMP })).toBe("confirmed");
  });

  it("fails safe to requested when the two copies disagree", () => {
    // Drift between the foster's copy and the shelter's: asking again beats showing up
    // on a day nobody agreed to.
    for (const other of [
      { ...SLOT, date: "2099-06-13" },
      { ...SLOT, time: "2:00 PM" },
      { ...SLOT, location: "elsewhere" },
    ]) {
      expect(pickupState(SLOT, { pickup: other, pickupConfirmedAt: STAMP })).toBe("requested");
    }
    expect(pickupState(SLOT, { pickup: null, pickupConfirmedAt: STAMP })).toBe("requested");
  });

  it("can never be confirmed without an application -- there is nobody to confirm", () => {
    expect(pickupState(SLOT, null)).toBe("requested");
    expect(pickupState(SLOT, undefined)).toBe("requested");
  });
});

describe("pickupState, once the shelter asks for another time (RS-15)", () => {
  it("is declined for the slot the shelter turned down", () => {
    expect(pickupState(SLOT, { pickup: { ...SLOT }, pickupDeclinedAt: STAMP })).toBe("declined");
  });

  it("goes back to requested once the foster asks again -- the new request clears the stamp", () => {
    const next = { ...SLOT, date: "2026-10-09" };
    expect(pickupState(next, { pickup: next, pickupConfirmedAt: null, pickupDeclinedAt: null })).toBe("requested");
  });

  it("fails safe to requested when the declined slot isn't the one the foster holds", () => {
    const other = { ...SLOT, time: "4:00 PM" };
    expect(pickupState(SLOT, { pickup: other, pickupDeclinedAt: STAMP })).toBe("requested");
  });

  it("reaches Pickup requested on the timeline without ticking it", () => {
    expect(APPLICATION_STAGES[activeStage(true, "declined")]).toBe("Pickup requested");
  });
});

describe("agreedPickup", () => {
  it("is the foster's slot only once the shelter confirmed it", () => {
    expect(agreedPickup(SLOT, { pickup: SLOT, pickupConfirmedAt: STAMP })).toEqual(SLOT);
    expect(agreedPickup(SLOT, { pickup: SLOT, pickupConfirmedAt: null })).toBeNull();
    expect(agreedPickup(SLOT, { pickup: SLOT, pickupDeclinedAt: STAMP })).toBeNull();
  });

  it("lets the request stand when there is no application -- nobody could answer it", () => {
    expect(agreedPickup(SLOT, null)).toEqual(SLOT);
  });

  it("agrees to nothing while the application is still loading, or with no request", () => {
    expect(agreedPickup(SLOT, null, true)).toBeNull();
    expect(agreedPickup(null, { pickup: SLOT, pickupConfirmedAt: STAMP })).toBeNull();
  });

  it("agrees to nothing on a dog the shelter retired after confirming (RS-21)", () => {
    const confirmed = { pickup: SLOT, pickupConfirmedAt: STAMP };
    expect(agreedPickup(SLOT, confirmed, false, "retired")).toBeNull();
    // Adopted is the holder's finished journey, not a withdrawal.
    expect(agreedPickup(SLOT, confirmed, false, "adopted")).toEqual(SLOT);
    expect(agreedPickup(SLOT, confirmed, false, "foster")).toEqual(SLOT);
    // No application (LOCAL_MODE): nobody retired anything on the foster's behalf.
    expect(agreedPickup(SLOT, null, false, "retired")).toEqual(SLOT);
  });
});

describe("activeStage", () => {
  it("reaches Pickup requested without ticking it, and ticks every stage once confirmed", () => {
    expect(activeStage(false, "none")).toBe(1);
    expect(activeStage(true, "none")).toBe(2);
    expect(APPLICATION_STAGES[activeStage(true, "requested")]).toBe("Pickup requested");
    expect(activeStage(true, "confirmed")).toBe(APPLICATION_STAGES.length);
    expect(APPLICATION_STAGES.at(-1)).toBe("Pickup confirmed");
  });
});

describe("the shelter's side of a pickup", () => {
  const app = (status: ApplicationStatus, pickup: Pickup | null, confirmed = false) =>
    ({ status, pickup, pickupConfirmedAt: confirmed ? STAMP : null }) as Application;

  it("flags a requested, unconfirmed slot on a live application", () => {
    for (const status of ["submitted", "in_review", "approved"] as ApplicationStatus[]) {
      expect(pickupAwaitingShelter(app(status, SLOT))).toBe(true);
    }
  });

  it("stops flagging once confirmed, or when there is nothing requested", () => {
    expect(pickupAwaitingShelter(app("approved", SLOT, true))).toBe(false);
    expect(pickupAwaitingShelter(app("approved", null))).toBe(false);
  });

  it("never asks staff to act on a pickup for a declined or withdrawn application", () => {
    for (const status of ["declined", "withdrawn"] as ApplicationStatus[]) {
      expect(pickupAwaitingShelter(app(status, SLOT))).toBe(false);
      expect(canConfirmPickup(app(status, SLOT))).toBe(false);
    }
  });

  it("swaps the Pickup requested pill for Asked for another time once staff answer", () => {
    const asked = { ...app("approved", SLOT), pickupDeclinedAt: STAMP } as Application;
    expect(pickupAwaitingShelter(asked)).toBe(false);
    expect(pickupAskedToMove(asked)).toBe(true);
    expect(pickupAskedToMove(app("approved", SLOT))).toBe(false);
    expect(pickupAskedToMove({ ...asked, status: "withdrawn" } as Application)).toBe(false);
  });

  it("offers confirm only when there is a slot to confirm", () => {
    expect(canConfirmPickup(app("approved", SLOT))).toBe(true);
    expect(canConfirmPickup(app("approved", null))).toBe(false);
  });
});

describe("withdrawnAfterHandoff (RS-17)", () => {
  const stamp = { toMillis: () => 1 };
  const app = (status: ApplicationStatus, confirmed: boolean) =>
    ({ status, pickupConfirmedAt: confirmed ? stamp : null }) as Application;

  it("flags a withdrawal after confirmation that left the dog in foster", () => {
    expect(withdrawnAfterHandoff(app("withdrawn", true), "foster")).toBe(true);
  });

  it("stays quiet once the dog is listed again, or was never taken off", () => {
    expect(withdrawnAfterHandoff(app("withdrawn", true), "available")).toBe(false);
    expect(withdrawnAfterHandoff(app("withdrawn", true), undefined)).toBe(false);
  });

  it("never offers to relist a dog some other foster holds", () => {
    expect(withdrawnAfterHandoff(app("withdrawn", false), "foster")).toBe(false);
    expect(withdrawnAfterHandoff(app("approved", true), "foster")).toBe(false);
  });
});

describe("one dog, one confirmed pickup (RS-18)", () => {
  const stamp = { toMillis: () => 1 };
  const app = (id: string, status: ApplicationStatus, confirmed: boolean, dogId = "d1") =>
    ({ id, dogId, status, pickupConfirmedAt: confirmed ? stamp : null }) as Application;

  it("holds the dog for a live application with a confirmed pickup", () => {
    const a = app("a", "approved", true);
    const b = app("b", "approved", false);
    expect(heldByAnother(b, [a, b])).toBe(true);
    expect(pickupHolder(b, [a, b])?.id).toBe("a");
  });

  it("never counts the application itself as another", () => {
    const a = app("a", "approved", true);
    expect(heldByAnother(a, [a])).toBe(false);
  });

  it("does not hold for a withdrawn or declined holder, or a different dog", () => {
    const b = app("b", "approved", false);
    expect(heldByAnother(b, [app("a", "withdrawn", true), b])).toBe(false);
    expect(heldByAnother(b, [app("a", "declined", true), b])).toBe(false);
    expect(heldByAnother(b, [app("a", "approved", true, "d2"), b])).toBe(false);
    expect(heldByAnother(b, [app("a", "approved", false), b])).toBe(false);
  });

  it("tells the foster the dog went elsewhere only while their own application is open and unconfirmed", () => {
    expect(placedElsewhere(app("b", "approved", false), "foster")).toBe(true);
    expect(placedElsewhere(app("b", "submitted", false), "foster")).toBe(true);
    // Their own confirmed pickup: `foster` is their dog.
    expect(placedElsewhere(app("b", "approved", true), "foster")).toBe(false);
    expect(placedElsewhere(app("b", "approved", false), "available")).toBe(false);
    expect(placedElsewhere(app("b", "withdrawn", false), "foster")).toBe(false);
    expect(placedElsewhere(app("b", "declined", false), "foster")).toBe(false);
    // No application (LOCAL_MODE, guests): nobody to have placed the dog.
    expect(placedElsewhere(null, "foster")).toBe(false);
  });
});

describe("a dog off the roster (RS-20)", () => {
  const stamp = { toMillis: () => 1 };
  const app = (status: ApplicationStatus, confirmed = false) =>
    ({ status, pickupConfirmedAt: confirmed ? stamp : null }) as Application;
  const ALL: DogStatus[] = ["available", "foster", "medical_hold", "adopted", "ready_for_adoption", "retired"];

  it("counts only retired and adopted as off the roster", () => {
    expect(ALL.filter(offRoster)).toEqual(["adopted", "retired"]);
    expect(offRoster(undefined)).toBe(false);
  });

  it("tells a live applicant the dog isn't listed, for every off-roster status and no other", () => {
    for (const s of ALL) {
      expect(unlisted(app("submitted"), s)).toBe(s === "retired" || s === "adopted");
      expect(unlisted(app("in_review"), s)).toBe(s === "retired" || s === "adopted");
      expect(unlisted(app("approved"), s)).toBe(s === "retired" || s === "adopted");
    }
  });

  it("says nothing on an application that is no longer open, or that doesn't exist", () => {
    expect(unlisted(app("withdrawn"), "retired")).toBe(false);
    expect(unlisted(app("declined"), "retired")).toBe(false);
    expect(unlisted(null, "retired")).toBe(false);
  });

  it("never tells a confirmed holder the shelter hasn't answered (RS-21)", () => {
    expect(unlisted(app("approved", true), "adopted")).toBe(false);
    // RS-20 told a confirmed holder of a *retired* dog "they haven't answered" -- false, since
    // staff confirmed. That state is takenDownAfterConfirm() now.
    expect(unlisted(app("approved", true), "retired")).toBe(false);
  });
});

describe("a confirmed pickup taken back where it was given (RS-21)", () => {
  const stamp = { toMillis: () => 1 };
  const app = (id: string, status: ApplicationStatus, confirmed: boolean, dogId = "d1") =>
    ({ id, dogId, status, pickupConfirmedAt: confirmed ? stamp : null }) as Application;

  it("finds the live, confirmed application on the dog", () => {
    expect(confirmedHolder("d1", [app("a", "approved", false), app("b", "approved", true)])?.id).toBe("b");
    expect(confirmedHolder("d1", [app("a", "submitted", true)])?.id).toBe("a");
  });

  it("ignores withdrawn and declined stamps, unconfirmed applications and other dogs", () => {
    expect(confirmedHolder("d1", [app("a", "withdrawn", true)])).toBeNull();
    expect(confirmedHolder("d1", [app("a", "declined", true)])).toBeNull();
    expect(confirmedHolder("d1", [app("a", "approved", false)])).toBeNull();
    expect(confirmedHolder("d1", [app("a", "approved", true, "d2")])).toBeNull();
    expect(confirmedHolder("d1", [])).toBeNull();
  });

  it("is what pickupHolder asks, minus the application itself", () => {
    const a = app("a", "approved", true);
    expect(pickupHolder(a, [a])).toBeNull();
    expect(confirmedHolder("d1", [a])?.id).toBe("a");
  });

  it("flags a live confirmed application on a retired dog, and nothing else", () => {
    expect(takenDownAfterConfirm(app("a", "approved", true), "retired")).toBe(true);
    expect(takenDownAfterConfirm(app("a", "submitted", true), "retired")).toBe(true);
    expect(takenDownAfterConfirm(app("a", "approved", true), "adopted")).toBe(false);
    expect(takenDownAfterConfirm(app("a", "approved", true), "foster")).toBe(false);
    expect(takenDownAfterConfirm(app("a", "approved", false), "retired")).toBe(false);
    expect(takenDownAfterConfirm(app("a", "withdrawn", true), "retired")).toBe(false);
    expect(takenDownAfterConfirm(null, "retired")).toBe(false);
  });
});
