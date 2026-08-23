# Shelter side: what to do before building it

Nothing here is built. This is the shape to build *into*, written down while the
data model is still small enough to change cheaply.

The app today models one half of a two-sided product. A foster has an account, a
journey, and a dog they applied for. The shelter — who actually reviews that
application, approves the foster, and hands over the dog — has no account, no
inbox, and no way in. `DemoShelterPanel` stands in for all of it, and the
approval steps it ticks are stored inside the foster's own private document.

## The foot-gun

> An application is a relationship between a foster and a shelter. Right now it
> is stored as fields on `fosters/{uid}` — `matchedDogId`, `approvalChecklist`,
> `pickup` — inside a document that Firestore rules scope to `request.auth.uid
> == uid`.

Two things follow, and neither gets better with time:

1. **A shelter cannot answer "who applied to us?"** There's no query for it. The
   applications are scattered across foster documents, one per user, and the
   rules correctly forbid reading someone else's. Fixing this later means
   migrating live foster records.
2. **The shelter's own steps aren't writable by the shelter.** `home-check` and
   `reference-check` are owned by the shelter (`owner: "shelter"` in
   `web/src/checklists.ts`) but live somewhere only the foster can write. Any
   real integration has to move them.

The cost of getting ahead of this is one collection.

## The shape

### `applications/{applicationId}`

A top-level collection, because it's read from both sides.

```ts
{
  fosterId: string;        // Firebase uid — the foster's account
  fosterName: string;      // denormalised for the shelter's list view
  dogId: string;
  shelterId: string;       // which shelter reviews this
  status: "submitted" | "in_review" | "approved" | "declined" | "withdrawn";
  checklist: ChecklistItem[];   // both sides' steps, `owner` says whose
  pickup: Pickup | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Queryable in both directions, which is the whole point:

- foster: `where("fosterId", "==", uid)`
- shelter: `where("shelterId", "==", shelterId).where("status", "==", "submitted")`

`fosters/{uid}` keeps what is genuinely private to the foster — intake answers,
swipes, journal, care log. The application moves out. `matchedDogId` can stay as
a convenience pointer, but the application document becomes the source of truth
for status, checklist and pickup.

### `shelters/{shelterId}`

```ts
{ name: string; address: string; staffUids: string[] }
```

`staffUids` is what lets rules express "is this person staff here" without a
custom claims setup. Custom claims are better at scale (they don't cost a
document read per rule evaluation) — switch when there are enough shelters to
care.

### `dogs/{dogId}`

Already carries an optional `shelter_id` (`web/src/types.ts`). Make it required
and it's the join key for "dogs at my shelter", which is the other half of the
dashboard — add, edit, mark adopted.

## Rules sketch

```
function isStaff(shelterId) {
  return request.auth != null &&
    request.auth.uid in get(/databases/$(database)/documents/shelters/$(shelterId)).data.staffUids;
}

match /applications/{applicationId} {
  allow read: if request.auth != null && (
    resource.data.fosterId == request.auth.uid || isStaff(resource.data.shelterId)
  );
  // A foster opens an application for themselves; only staff move it forward.
  allow create: if request.auth != null
                && request.resource.data.fosterId == request.auth.uid
                && request.resource.data.status == "submitted";
  allow update: if isStaff(resource.data.shelterId)
                || (resource.data.fosterId == request.auth.uid
                    && request.resource.data.status == "withdrawn");
}

match /dogs/{dogId} {
  allow read: if true;
  allow write: if isStaff(request.resource.data.shelter_id);
}
```

Note `dogs` is currently `allow write: if false` with the agent's Admin SDK
bypassing rules. That's correct for now and needs to change the moment a shelter
edits its own roster from a browser.

## Why not build it now

The foster journey isn't finished, and a dashboard for a role nobody occupies is
the wrong thing to spend the next day on. What matters is that the application
stops being a private field on a foster document — everything above follows from
that one move, and it is much cheaper to do before there are real journeys to
migrate.

When it does get built, the honest first version is a list of applications with a
checklist the shelter can tick, and a form to add a dog. That's it. The
`DemoShelterPanel` copy already describes what that screen does; it just has
nobody to log in as.

## While it doesn't exist

`DemoShelterPanel` (behind `?demo=1`) is the stand-in, and the shelter's steps
stay unticked until someone drives it by hand. That's deliberate — a checklist
that advances on its own reads as real progress and would be a lie about a review
that never happened.
