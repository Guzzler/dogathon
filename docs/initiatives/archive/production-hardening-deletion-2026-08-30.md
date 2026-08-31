# Archive — production-hardening, the account-deletion finding (2026-08-30)

Verbatim snapshot of the two sections that produced PH-14, PH-15 and PH-16: the
2026-08-30 read of `web/src/auth.ts`, `firestore.rules` and `server.py` against `main`
that found what account deletion leaves behind, and the decision about what happens to
an application when its foster deletes their account.

All three items shipped the same day (PRs #47, #48, #49), which is why this moved here:
the reasoning is settled and the working doc was over the ~400-line trigger. Kept
verbatim rather than summarised because the *why* — particularly why the `applications`
update rule has to stay loose about `fosterName` — is the part that would otherwise get
re-derived, or "fixed" by someone tightening it.

Append-only. If something below turns out to be wrong, correct
[`../production-hardening.md`](../production-hardening.md) and say so there.

---

### What deletion misses, and why nobody noticed (found 2026-08-30)

Read against `main` this run rather than taken from the ledger row.
`deleteAccount()` (`web/src/auth.ts:90-108`) deletes the `careLog` docs, then
`fosters/{uid}`, then the Auth user. Two things it gave the app are still there
afterwards, and in both cases the reason is structural rather than an oversight
someone can just patch in the same function.

**(1) The agent transcript survives, and becomes unreachable.** Deleting a
Firestore document does not delete its subcollections, so
`fosters/{uid}/agentSession/current` — a `messagesJson` dump of the whole
conversation — outlives the account. It is not the agent's private scratchpad:
it contains, verbatim, everything the foster typed, which on the Care Plan
surface is their dog's medical detail and on the Match surface is pickup
logistics. And once the Auth user is gone it can never be reached again from
the client: the read rule is `request.auth.uid == uid`, and that uid will not
exist a second time. It is a permanent orphan holding a deleted person's words.

The export's docstring says agentSession is excluded because it is *"the agent's
own reasoning, not data the foster gave us."* That is a defensible line for
**export** and the wrong line for **deletion**, and the distinction is worth
stating because the same sentence reads as settling both: what someone is
entitled to receive a copy of and what has to be destroyed on request are
different questions, and the second one is wider.

The fix is small and already exists: `agentSession/{doc}` is
`allow write: if false`, so only the Admin SDK can clear it, and `POST /reset`
(`src/agent/server.py:525`) does exactly that — `session_store.clear()` deletes
the whole document, `pendingApproval` included. It is authenticated by the
foster's own ID token and already wired into the frontend as `resetChat()`.
So this is a call-ordering fix, not new machinery. → PH-14.

**(2) The `applications` rows survive, carrying the deleted person's name.**
`exportAccountData()` queries them (`fosterId == uid`); `deleteAccount()` never
touches them, and each row carries `fosterName`, denormalised onto the
application precisely so a shelter can read it without a lookup. There is also
no way to remove them: `match /applications/{applicationId}` has `read`,
`create` and `update` rules and **no `delete` rule at all**, so a client delete
is denied by the default-deny at the bottom of the file.

## What happens to an application when its foster deletes their account (decided 2026-08-30)

**Redact, don't delete.** The row stays; `fosterName` becomes
`"(deleted account)"` and `status` becomes `withdrawn`. → PH-15.

The absent `delete` rule turns out to be right, so the fix is not to add one.
An application is not the foster's private data — it is a record of a
relationship with a shelter, the one document in the schema with two legitimate
owners. Hard-deleting it makes a row vanish out from under a staff member who
may be mid-review, which is the same failure RS-6 already decided against for
retiring a dog ("a status change, **not** a delete — a dog someone is
mid-application on must not vanish out from under them"). The shelter keeps the
fact that an application existed and was withdrawn; it loses the name, which is
the part that belongs to a person who asked to be forgotten.

**The redaction is possible today only because the update rule is loose**, and
that is not a happy accident to build on quietly. `firestore.rules:49-51`'s
foster branch permits an update whenever the *resulting* status is `withdrawn`
and constrains nothing else — so a single write can set the status and rewrite
`fosterName` in the same breath. It can also rewrite `checklist`, `createdAt`
or `shelterId`, and rewriting `shelterId` drops a withdrawn application into
another shelter's inbox, since RS-5's query filters on exactly that field. So
the same read produces a hardening item and the mechanism the redaction rides
on, which is why PH-16 pins the other fields and deliberately leaves
`fosterName` free. Tightening it without that carve-out would close the hole
and break deletion in the same PR.

**Not in scope, and stated so it doesn't get re-derived:** a shelter-side view
of a withdrawn, redacted application is RS-5's problem, not this one's. It
already has to render `withdrawn` as a status; `"(deleted account)"` is just a
name it displays.
