import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { patchFoster, useFoster } from "../../hooks/useFoster";
import { useApplication } from "../../hooks/useApplication";
import { useDogs } from "../../hooks/useDogs";
import { PickupScheduler } from "../../components/PickupScheduler";
import { requestPickup } from "../../lib/applications";
import { DemoShelterPanel } from "../../components/DemoShelterPanel";
import { DEFAULT_APPROVAL_CHECKLIST, DEFAULT_PREP_CHECKLIST, checklistOwner } from "../../checklists";
import { APPLICATION_STAGES, activeStage, approvalBadge, approvalDecision, composeApprovalChecklist, pickupState } from "../../lib/applicationView";
import { normalizeDog, thumbBackground } from "../../lib/dog";
import { downloadIcs } from "../../lib/calendar";
import { DEMO_MODE } from "../../lib/demoMode";
import type { ChecklistItem, Pickup } from "../../types";


export function MatchView() {
  const navigate = useNavigate();
  const { foster, loading } = useFoster();
  const { dogs } = useDogs();
  // The shelter's own ticks live on the application, not here -- see composeApprovalChecklist.
  const { application } = useApplication(foster?.matchedDogId);
  const [pickupFailed, setPickupFailed] = useState(false);

  const raw = dogs.find((d) => d.id === foster?.matchedDogId);
  const dog = raw ? normalizeDog(raw) : null;

  useEffect(() => {
    if (!foster) return;
    const patch: Record<string, unknown> = {};
    if (!foster.approvalChecklist?.length) patch.approvalChecklist = DEFAULT_APPROVAL_CHECKLIST;
    if (!foster.prepChecklist?.length) patch.prepChecklist = DEFAULT_PREP_CHECKLIST;
    if (Object.keys(patch).length) patchFoster(patch);
  }, [foster]);

  if (loading) return <p className="pw-loading">Loading…</p>;
  if (!foster || !foster.matchedDogId || !dog) {
    return (
      <div className="screen pad" style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ fontSize: 44 }}>📋</div>
        <h3 style={{ marginTop: 14 }}>No match yet</h3>
        <p className="sub" style={{ marginTop: 8, fontSize: 14 }}>
          Apply to foster a dog from Saved or a dog's profile to start the approval process here.
        </p>
        <button className="btn outline sm" style={{ margin: "20px auto 0" }} onClick={() => navigate("/discovery")}>
          Find dogs
        </button>
      </div>
    );
  }

  // `stored` is what this screen may write; `approval` is what it may show. Keeping them
  // separate is the whole point of RS-10: composing the shelter's ticks in and then writing
  // the composed list back would mirror their copy into ours, which the rules and the design
  // both forbid.
  const stored = foster.approvalChecklist ?? DEFAULT_APPROVAL_CHECKLIST;
  const approval = composeApprovalChecklist(stored, application?.checklist ?? null);
  const prep = foster.prepChecklist ?? DEFAULT_PREP_CHECKLIST;
  const ownerOf = (i: ChecklistItem) => i.owner ?? checklistOwner(i.id);
  const yourSteps = approval.filter((i) => ownerOf(i) === "foster");
  const shelterSteps = approval.filter((i) => ownerOf(i) === "shelter");
  // The badge tracks only the shelter's own review; scheduling needs both sides finished.
  const shelterApproved = shelterSteps.length > 0 && shelterSteps.every((i) => i.done);
  const approved = approval.length > 0 && approval.every((i) => i.done);
  // RS-14: "confirmed" only on the shelter's own write, and only for the slot the foster holds.
  const pickup = pickupState(foster.pickup, application);
  const activeIdx = activeStage(approved, pickup);
  // The shelter's verdict, which is a different question from "is the paperwork finished".
  // It replaces the badge, and `declined` replaces the whole screen below it -- but it never
  // unlocks the scheduler and never ticks anybody's boxes. See approvalDecision().
  const decision = approvalDecision(application?.status);
  const badge = approvalBadge(decision, dog.shelter.short, {
    tone: shelterApproved ? "sage" : "butter",
    label: shelterApproved ? "✓ Shelter approved you as a foster" : "⏳ Waiting on shelter review",
  });

  function setApprovalItem(id: string, done: boolean) {
    const items = stored.map((i) => (i.id === id ? { ...i, done } : i));
    patchFoster({ approvalChecklist: items });
  }
  function setAllShelterItems(done: boolean) {
    const items = stored.map((i) => ((i.owner ?? checklistOwner(i.id)) === "shelter" ? { ...i, done } : i));
    patchFoster({ approvalChecklist: items });
  }
  function togglePrep(id: string, done: boolean) {
    const items = prep.map((i) => (i.id === id ? { ...i, done } : i));
    patchFoster({ prepChecklist: items });
  }
  /**
   * RS-14: the request goes to the application first -- the copy the shelter reads -- and only
   * then to the foster's own record. If the shelter's copy can't be written, the foster's isn't
   * either: a request shown on this screen that the shelter can't see is the exact bug this
   * fixes. No application (LOCAL_MODE, guests, older records) writes the foster record alone,
   * as before; `fosters/{uid}.pickup` stays because five other screens read it.
   */
  async function writePickup(next: Pickup | null) {
    setPickupFailed(false);
    if (application) {
      try {
        await requestPickup(application.id, next);
      } catch {
        setPickupFailed(true);
        return;
      }
    }
    await patchFoster({ pickup: next });
  }
  async function goToCarePlan() {
    await patchFoster({ phase: "care_plan" });
    navigate("/care-plan");
  }

  const pickupDateLabel = foster.pickup
    ? new Date(foster.pickup.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : null;

  return (
    <div className="screen">
      <div className="topbar"><h3>Match &amp; pickup</h3></div>

      <div className="scroll pad" style={{ paddingTop: 6, paddingBottom: 34, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Dog header */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="row" style={{ gap: 13 }}>
          <div style={{ width: 56, height: 56, borderRadius: 17, flexShrink: 0, background: thumbBackground(dog, 300, 300) }} />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 20 }}>You matched with {dog.name}!</h2>
            <p className="muted" style={{ marginTop: 2 }}>{dog.shelter.name}</p>
          </div>
        </motion.div>

        {/* Approval badge + timeline */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: .05 }} className="card" style={{ padding: 15 }}>
          <div className={`chip ${badge.tone}`} style={{ fontWeight: 800 }}>{badge.label}</div>
          {decision !== "declined" && (
            <div className="tl">
              {APPLICATION_STAGES.map((label, n) => (
                <div key={label} className="tl-step" data-done={n < activeIdx} data-now={n === activeIdx}>
                  <span className="tl-dot">{n < activeIdx ? "✓" : ""}</span>
                  <small>{label}</small>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {decision === "declined" ? (
          <DeclinedNotice dogName={dog.name} shelterShort={dog.shelter.short} onBrowse={() => navigate("/discovery")} />
        ) : (<>
        <ChecklistSection title="Your steps" items={yourSteps} onToggle={setApprovalItem} />
        <ChecklistSection title={`What ${dog.shelter.short} handles`} items={shelterSteps} locked />
        <ChecklistSection title="Get ready at home" items={prep} onToggle={togglePrep} />

        {/* Pickup */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 9 }}>
            {pickup === "confirmed" ? "Pickup confirmed" : pickup === "requested" ? "Pickup requested" : "Request a pickup"}
          </div>
          {!approved ? (
            <>
              <button className="btn" disabled>🔒 Request a pickup</button>
              <p className="muted" style={{ textAlign: "center", marginTop: 8, fontSize: 12 }}>
                {shelterApproved
                  ? "Finish your own steps to unlock this."
                  : `Unlocks once ${dog.shelter.short} finishes their review.`}
              </p>
            </>
          ) : foster.pickup ? (
            <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card" style={{ padding: 15 }}>
              <div className="row" style={{ gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 13, background: "var(--sage-soft)", display: "grid", placeItems: "center", flexShrink: 0, fontSize: 17 }}>🗓️</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5 }}>{pickupDateLabel}</div>
                  <div className="muted" style={{ marginTop: 2 }}>{foster.pickup.time} · {foster.pickup.location}</div>
                </div>
              </div>
              {/* PH-23 made this a request; RS-14 gave it an addressee. Only staff confirming it
                  on the application turns it green -- this screen never says so on its own. */}
              {pickup === "confirmed" ? (
                <p style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: "var(--sage)" }}>
                  ✓ {dog.shelter.short} confirmed this time.
                </p>
              ) : (
                <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                  You asked for this time. {dog.shelter.short} hasn't confirmed it yet
                  {application ? " — it shows here as soon as they do." : "."}
                </p>
              )}
              <div className="row" style={{ gap: 8, marginTop: 13 }}>
                <button
                  type="button"
                  className="btn outline sm"
                  style={{ flex: 1, margin: 0 }}
                  onClick={() => downloadIcs({
                    dogName: dog.name,
                    shelterName: dog.shelter.name,
                    date: foster.pickup!.date,
                    time: foster.pickup!.time,
                    location: foster.pickup!.location,
                  })}
                >
                  Add to calendar
                </button>
                <button
                  type="button"
                  className="btn outline sm"
                  style={{ flex: 1, margin: 0 }}
                  onClick={() => writePickup(null)}
                >
                  Change request
                </button>
              </div>
            </motion.div>
          ) : (
            <PickupScheduler shelter={dog.shelter} onConfirm={writePickup} />
          )}
          {pickupFailed && (
            <p role="alert" style={{ marginTop: 8, fontSize: 12, color: "var(--coral-dk)", fontWeight: 700, textAlign: "center" }}>
              That didn't reach {dog.shelter.short}, so nothing changed. Check your connection and try again.
            </p>
          )}
        </div>

        {/* Chat once a pickup is requested. It gets its own screen — embedded, it was
            a scroller inside a scroller and long answers ran under the tab bar. It is
            Pawthway's assistant, not the shelter (RS-14): nothing typed there reaches them. */}
        {foster.pickup && (
          <button type="button" className="card chat-entry" onClick={() => navigate("/match/chat")}>
            <div className="chat-entry__icon" aria-hidden="true">💬</div>
            <div className="chat-entry__body">
              <div className="chat-entry__title">Ask Pawthway about pickup</div>
              <div className="chat-entry__sub">What to bring, how long it takes, what goes home with {dog.name}</div>
            </div>
            <span className="chat-entry__chevron" aria-hidden="true">›</span>
          </button>
        )}

        <button
          className="btn sm"
          style={{ margin: "2px auto 0" }}
          disabled={!foster.pickup}
          title={!foster.pickup ? "Request a pickup first" : undefined}
          onClick={goToCarePlan}
        >
          I've got {dog.name} → start Care Plan
        </button>
        </>)}
      </div>

      {/* Only where nothing real is driving the shelter's side. With an application present
          those ticks come from staff, and the panel would write into a field this screen no
          longer reads -- a fake dashboard silently doing nothing is worse than no panel. */}
      {DEMO_MODE && !application && (
        <DemoShelterPanel items={shelterSteps} onToggle={setApprovalItem} onSetAll={setAllShelterItems} />
      )}
    </div>
  );
}

/**
 * What a declined application replaces the checklist and the scheduler with: what happened,
 * and one way forward. Deliberately not a dead end and deliberately not a relocation -- the
 * foster is still on this screen, still matched to this dog on their own record, and free to
 * apply elsewhere because `activeApplication()` has released them.
 */
function DeclinedNotice({ dogName, shelterShort, onBrowse }: {
  dogName: string;
  shelterShort: string;
  onBrowse: () => void;
}) {
  return (
    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="card" style={{ padding: 18, textAlign: "center" }}>
      <div style={{ fontSize: 34 }}>💛</div>
      <h3 style={{ marginTop: 10 }}>{shelterShort} said no this time</h3>
      <p className="sub" style={{ marginTop: 8, fontSize: 14 }}>
        They've decided not to move forward with your application for {dogName}. It isn't a
        judgement on you as a foster — shelters weigh a lot of things, and most of them are
        about the dog. You can apply for another dog right away.
      </p>
      <button className="btn" style={{ marginTop: 18 }} onClick={onBrowse}>Browse other dogs</button>
    </motion.div>
  );
}

/**
 * Collapses itself once every item is ticked, so a finished checklist stops eating
 * the screen and the pickup section stays reachable without a long scroll. An
 * explicit tap always wins over that default.
 */
function ChecklistSection({ title, items, onToggle, locked }: {
  title: string;
  items: ChecklistItem[];
  onToggle?: (id: string, done: boolean) => void;
  locked?: boolean;
}) {
  const [override, setOverride] = useState<boolean | null>(null);
  if (!items.length) return null;

  const doneCount = items.filter((i) => i.done).length;
  const complete = doneCount === items.length;
  const open = override ?? !complete;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOverride(!open)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "0 2px 9px", textAlign: "left" }}
      >
        <span className="eyebrow">{title}</span>
        <span className="sp" />
        <span className="muted" style={{ fontSize: 11.5, fontWeight: 800, color: complete ? "var(--sage)" : undefined }}>
          {complete ? "✓ all done" : `${doneCount}/${items.length}`}
        </span>
        <span style={{ fontSize: 13, lineHeight: 1, color: "var(--ink-3)", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}>⌄</span>
      </button>

      {open && (
        <div className="card" style={{ padding: 6 }}>
          {items.map((item, i) => (
            <StepRow
              key={item.id}
              item={item}
              last={i === items.length - 1}
              locked={locked}
              onToggle={onToggle ? (done) => onToggle(item.id, done) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StepRow({ item, onToggle, locked, last }: { item: ChecklistItem; onToggle?: (done: boolean) => void; locked?: boolean; last?: boolean }) {
  const clickable = !locked && !!onToggle;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => onToggle?.(!item.done)}
      style={{
        display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
        padding: "10px 11px", borderRadius: 14, cursor: clickable ? "pointer" : "default",
        borderBottom: last ? "none" : "1px solid var(--line)",
      }}
    >
      <span style={{
        width: 21, height: 21, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 12,
        background: item.done ? "var(--sage)" : locked ? "var(--cream-2)" : "#fff",
        color: item.done ? "#fff" : "var(--ink-3)",
        border: item.done ? "none" : locked ? "none" : "2px solid var(--line)",
      }}>
        {item.done ? "✓" : locked ? "⏳" : ""}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 700, opacity: item.done ? .55 : 1, textDecoration: item.done ? "line-through" : "none" }}>
        {item.label}
      </span>
      <span className="sp" />
      {locked && !item.done && <span className="muted" style={{ fontSize: 11 }}>Shelter</span>}
    </button>
  );
}
