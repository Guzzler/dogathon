import type { Application, ApplicationStatus, ChecklistItem } from "../types";
import { checklistOwner } from "../checklists";

/**
 * The pure half of the shelter's application inbox: labels, transitions, ordering and the
 * error copy. Deliberately imports no Firebase -- everything here is unit-testable without a
 * project config, which is why it lives beside `applications.ts` rather than inside it.
 */

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "New",
  in_review: "In review",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

/**
 * What a staff member may move an application to. `withdrawn` is absent on purpose: it's the
 * foster's own action, and `firestore.rules`' foster branch is the only place it's set. A
 * withdrawn row is terminal from the shelter's side, so it offers nothing.
 */
export function staffTransitions(status: ApplicationStatus): ApplicationStatus[] {
  if (status === "withdrawn") return [];
  return (["in_review", "approved", "declined"] as ApplicationStatus[]).filter((s) => s !== status);
}

/** A withdrawn application is a record, not a task -- nothing on it is the shelter's to change. */
export function isActionable(status: ApplicationStatus): boolean {
  return status !== "withdrawn";
}

const DAY = 86_400_000;

/** "Today" / "3 days ago" / "2 weeks ago" -- how old the application is, not a precise date. */
export function applicationAge(createdAtMs: number | null, nowMs: number): string {
  if (createdAtMs === null) return "Just now";
  const days = Math.floor((nowMs - createdAtMs) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export function createdAtMillis(app: Application): number | null {
  // `serverTimestamp()` reads back null on the local echo before the server stamps it.
  return app.createdAt ? app.createdAt.toMillis() : null;
}

/**
 * Newest first, matching the `shelterId ASC, createdAt DESC` composite index the query uses.
 * Applied again client-side so a row whose `createdAt` hasn't been stamped yet (or a
 * `LOCAL_MODE`-shaped record with none at all) still lands somewhere sensible -- at the top,
 * since an unstamped write is by definition the most recent one.
 */
export function byNewest(a: Application, b: Application): number {
  const at = createdAtMillis(a);
  const bt = createdAtMillis(b);
  if (at === null && bt === null) return 0;
  if (at === null) return -1;
  if (bt === null) return 1;
  return bt - at;
}

/**
 * Splits the application's checklist the way the Match view already splits the foster's:
 * on `ChecklistItem.owner`, falling back to `checklistOwner(id)` for records seeded before
 * that field existed.
 */
export function splitByOwner(checklist: ChecklistItem[]): {
  shelter: ChecklistItem[];
  foster: ChecklistItem[];
} {
  const shelter: ChecklistItem[] = [];
  const foster: ChecklistItem[] = [];
  for (const item of checklist) {
    ((item.owner ?? checklistOwner(item.id)) === "shelter" ? shelter : foster).push(item);
  }
  return { shelter, foster };
}

export interface InboxError {
  title: string;
  body: string;
  retryable: boolean;
}

/**
 * The two failures that actually happen here want opposite advice, so they get different copy.
 * `failed-precondition` is a composite index still building -- it resolves on its own and a
 * retry genuinely helps. `permission-denied` means the rules refused this query for this
 * account; retrying it will refuse identically forever.
 */
export function inboxError(code: string | undefined): InboxError {
  if (code === "failed-precondition") {
    return {
      title: "Applications aren't ready yet.",
      body: "The database is still building the index this list needs. It usually takes a few minutes — try again shortly.",
      retryable: true,
    };
  }
  if (code === "permission-denied") {
    return {
      title: "You don't have access to these applications.",
      body: "Your account isn't authorised to read this shelter's applications. Retrying won't change that — ask whoever set up your staff account.",
      retryable: false,
    };
  }
  return {
    title: "Couldn't load applications.",
    body: "Something went wrong reaching the database. Check your connection and try again.",
    retryable: true,
  };
}

/**
 * Joins the two copies of the approval checklist into the one list a foster's screens show.
 *
 * `fosters/{uid}.approvalChecklist` and `applications/{id}.checklist` are separate documents
 * with separate writers, and RS-10 keeps them that way: **one writer per field**, split on
 * `ChecklistItem.owner`. The foster (and the agent) own the `foster` entries; shelter staff
 * own the `shelter` entries and write them on the application. Neither side ever writes the
 * other's copy, so there is nothing here that can be lost to a last-write-wins mirror.
 *
 * Ordering follows the foster document, since that is what the Match view has always
 * rendered. A shelter-owned item that exists only on the application (defaults drifting
 * between the two writers) is appended rather than dropped -- a step the shelter is tracking
 * and the foster cannot see is exactly the failure this join exists to remove.
 *
 * `null` means no application document: guests, `LOCAL_MODE`, and any foster whose record
 * predates the collection. Those fall back to the foster document alone, which is what the
 * Demo Shelter panel drives.
 */
export function composeApprovalChecklist(
  fosterList: ChecklistItem[],
  applicationList: ChecklistItem[] | null,
): ChecklistItem[] {
  if (!applicationList) return fosterList;

  const ownerOf = (i: ChecklistItem) => i.owner ?? checklistOwner(i.id);
  const fromShelter = new Map<string, ChecklistItem>();
  for (const item of applicationList) {
    if (ownerOf(item) === "shelter") fromShelter.set(item.id, item);
  }

  const composed = fosterList.map((item) => {
    if (ownerOf(item) !== "shelter") return item;
    const shelterCopy = fromShelter.get(item.id);
    if (!shelterCopy) return item;
    fromShelter.delete(item.id);
    // The foster document's label wins so the wording on screen can't change under the
    // foster mid-review; only the shelter's `done` is authoritative.
    return { ...item, done: shelterCopy.done, owner: "shelter" as const };
  });

  return [...composed, ...fromShelter.values()];
}

/* ---------- the foster's side of the same document (RS-11) ---------- */

/**
 * What the foster is told, once the shelter has actually decided.
 *
 * `null` is the important value: it means *no decision yet*, and every screen falls back to
 * what it derived from the checklist before this existed. `submitted` and `in_review` resolve
 * to `null` on purpose -- they are the shelter's own bookkeeping, not news for the foster --
 * and so does a missing application, which is the state of every guest, every `LOCAL_MODE`
 * foster and every record written before the collection existed. **Absence must never render
 * as a decline.**
 */
export type ApprovalDecision = "declined" | "withdrawn" | "approved" | null;

/**
 * Precedence is `declined` > `withdrawn` > `approved` > checklist-derived, and it is a
 * precedence rather than a mapping because the checklist and the status answer different
 * questions: the checklist says whether the paperwork is finished, `status` says whether the
 * shelter said yes. A shelter can decide before the boxes are ticked, and a foster can tick
 * every box on an application that was never accepted -- which is the case that renders wrong
 * without this: a fully-ticked checklist on a declined application used to read
 * "✓ Approved — schedule pickup", inviting someone to book a pickup for a dog they were refused.
 */
export function approvalDecision(status: ApplicationStatus | null | undefined): ApprovalDecision {
  if (status === "declined") return "declined";
  if (status === "withdrawn") return "withdrawn";
  if (status === "approved") return "approved";
  return null;
}

/**
 * Whether a status frees the foster from the one-foster-at-a-time block (`activeApplication`).
 *
 * A declined application is over, so continuing to block is the app holding someone to a
 * commitment the other side already refused. A withdrawn one is over by their own choice.
 * Neither clears `matchedDogId` or moves the phase: releasing the block lets them apply
 * elsewhere without being relocated to a screen they didn't ask for, and the record of what
 * happened stays on the Applications tab until they do.
 */
export function releasesFoster(status: ApplicationStatus | null | undefined): boolean {
  const d = approvalDecision(status);
  return d === "declined" || d === "withdrawn";
}

export interface ApprovalBadge {
  /** Matches the `.chip` modifiers in theme.css. */
  tone: "sage" | "butter" | "coral";
  label: string;
}

/**
 * The one badge both foster surfaces show, with the decision layered over whatever each
 * screen worked out from its checklist.
 *
 * The surfaces disagree about the fallback and that is deliberate, so they pass their own:
 * Match tracks only the *shelter-owned* steps ("has the shelter finished its review"), the
 * Saved timeline tracks the whole list ("can a pickup be booked"). Once `status` is decided,
 * the decision is the outcome and it wins on both.
 */
export function approvalBadge(
  decision: ApprovalDecision,
  shelterShort: string,
  fallback: ApprovalBadge,
): ApprovalBadge {
  switch (decision) {
    case "declined":
      return { tone: "coral", label: `${shelterShort} couldn't approve this application` };
    case "withdrawn":
      return { tone: "butter", label: "You withdrew this application" };
    case "approved":
      return { tone: "sage", label: `✓ ${shelterShort} approved your application` };
    default:
      return fallback;
  }
}
