# Person B — Task Breakdown

Companion to `BACKEND_SPLIT.md`, broken into sequenced, independently completable steps.
Work top to bottom — each step builds on the last and is small enough to test on its own.

Files you own: `src/services/recommendationService.js`, new `src/routes/users.js`.
File you touch lightly: `src/services/tripService.js` (one hook call, no logic changes to
existing behavior).

No dependency on Person A/C/D — start anytime.

---

## Task 1 — Compute a profile from trip history (pure function)

Write the core logic in `recommendationService.js` as a function that takes a user's
trips + the nodes they touched, and returns a `place_type` frequency distribution.

- Input: array of trips for one `user_id` (each has `from_node_id`/`to_node_id`), plus a
  way to look up each node's `place_type`.
- Output: array of `{ place_type, frequency_pct, trip_count }`, sorted by `frequency_pct`
  descending — matches the `place_type_preferences` shape in `shared/api-contract.md`.
- Decide the counting rule up front (recommend: count each trip's **destination**
  node's `place_type`, not both endpoints — avoids double-counting and matches "where
  did this trip take you").
- No database calls in this function — keep it pure/testable. DB access is Task 2.

**Done when:** you can feed it a fake array of trips/nodes and get back a correct,
sorted distribution that sums to ~100%.

---

## Task 2 — Persist to `user_place_type_profiles`

Wire Task 1's pure function to Mongo:

- Read: pull all trips for `user_id` from `COLLECTIONS.TRIPS` (`getDb()` from
  `mongoService.js`), then the distinct nodes referenced to get their `place_type`.
- Write: upsert one document per `(user_id, place_type)` into
  `COLLECTIONS.USER_PLACE_TYPE_PROFILES`, matching the schema:
  `{ user_id, place_type, frequency_pct, trip_count, last_updated }`.
  The collection already has a unique index on `{ user_id: 1, place_type: 1 }`
  (see `shared/mongodb-schema.js`) — use `updateOne(..., { upsert: true })` per place_type,
  or delete-all-then-insert for the user (simpler, fine at hackathon scale).
- Reuse `idVariants` / `asString` from `services/ids.js` the same way `tripService.js`
  does, so ObjectId-vs-string mismatches don't bite you.

**Done when:** calling this function for a seeded user (e.g. `fabio_user_id` from
`shared/mongodb-seed/HANDOFF.md`) creates/updates real documents you can see in Atlas
or via `mongosh`.

---

## Task 3 — Hook into trip creation

In `tripService.js`, after the trip is inserted (right after the
`db.collection(COLLECTIONS.TRIPS).insertOne(...)` call, before the function returns),
call Task 2's recompute for `actor._id`.

- Keep it non-blocking-ish: don't let a failure here throw and break the trip response.
  Wrap in try/catch and `console.warn` on error, same pattern the file already uses
  elsewhere (see `ensureIndexes`).
- This is the *only* edit to `tripService.js` — one function call + try/catch, nothing
  else in that file changes. Keeps your diff trivially reviewable.

**Done when:** logging a trip via `POST /api/trips` (Postman/curl) updates that user's
`user_place_type_profiles` documents without changing the existing trip response shape.

---

## Task 4 — `GET /api/users/:userId/profile` route

New file `src/routes/users.js`:

- Look up the user by `:userId` (support both raw ObjectId and `auth0_id`, same dual-lookup
  pattern `resolveActor` in `tripService.js` uses) — 404 if not found.
- Read their `user_place_type_profiles` docs, shape into the contracted response:

  ```json
  {
    "success": true,
    "user_id": "string",
    "display_name": "Fabio",
    "place_type_preferences": [
      { "place_type": "urban_core", "frequency_pct": 65 }
    ],
    "total_trips": 20,
    "total_discovery": 8
  }
  ```

- `total_trips`: count of that user's trips (`COLLECTIONS.TRIPS`).
- `total_discovery`: count of nodes/edges where `first_discovered_by` /
  `first_traveled_by` equals this user — two quick counts across `NODES` and `EDGES`.
- Empty `place_type_preferences: []` (not an error) if the user has no trips yet.
- Mount it in `src/server.js`: `app.use("/api/users", usersRouter);` — decide with the
  team whether this needs `requireAuth` (contract doesn't specify; reasonable default:
  yes, same as trips).

**Done when:** `GET /api/users/:userId/profile` against a seeded user returns the
correct shape end-to-end.

---

## Task 5 — Verify against the contract + a stale-seed edge case

- Cross-check your response against `shared/api-contract.md` field-by-field.
- Test the "user reloaded seed, ID changed" scenario from
  `shared/mongodb-seed/HANDOFF.md`: hit the route with a stale/unknown `userId` and
  confirm you get a clean `404 { success: false, error: "..." }`, not a 500.
- Manually poke a couple of trips for the same user and confirm `frequency_pct`
  updates and still sums to ~100 after each new trip.

**Done when:** you're confident this survives a live demo poke, including someone
fat-fingering a user id.

---

## Stretch (only if time remains, per `requirements.md` cut order — this whole feature
is first to cut, so treat stretch items as optional)

- Surface actual "recommended new nodes" (unvisited nodes in the group matching the
  user's top `place_type`) instead of just the taste breakdown — closer to the original
  "recommendation engine" framing in `DRIFT_PROJECT_GUIDE.md`.
- Hand off to Person 2 once Task 4 is live so they can build the taste-card UI, per the
  earlier discussion — not your scope, just flag it's ready.
