import { describe, expect, it } from "vitest";
import {
  applicationAge,
  byNewest,
  inboxError,
  isActionable,
  splitByOwner,
  staffTransitions,
} from "./applicationView";
import type { Application } from "../types";

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
