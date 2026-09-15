/**
 * One way of saying "nobody recorded this", for the nine places a derived dog value used to be
 * printed as a fact (PH-22).
 *
 * It exists as a component rather than as nine inline ternaries for the reason
 * `design-consistency.md` was opened (PR #11): the copy drifts, and then two screens disagree
 * about whether a shelter answered a question. `ProfileAttribution` (PH-21) was checked first
 * and is a different thing — it attributes one *paragraph* whose author is in doubt, as a block
 * under the text. This is an inline stand-in for a *value* that was never supplied, so it sits
 * where the value would have sat and carries no authorship claim.
 *
 * `what` names the field when the surrounding markup doesn't already ("Foster length not
 * recorded" on a chip that is only a chip); omit it inside a labelled row, where the label has
 * already said which question this answers.
 */
export function Unrecorded({ what }: { what?: string }) {
  return <span className="unrecorded">{what ? `${what} not recorded` : "Not recorded"}</span>;
}
