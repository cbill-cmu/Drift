# Backend — 4-Person Split

Scope: everything under `backend/src`. Contract stays locked (`shared/api-contract.md`,
`shared/mongodb-schema.js`) — if a task needs a shape change, Slack the team before editing
either file.

**Prerequisite (blocks Person A):** confirm the Auth0 API audience is fully set up —
`shared/auth0-setup.md` currently marks "API audience created / SPA authorized" as `[~]`.
Without this, JWKS verification has nothing valid to check against. Whoever owns Auth0
(Person 3 in the wider team) should close this out first.

---

## Person A — Auth hardening

**Owns:** `src/middleware/auth.js`, auth wiring in `src/server.js` and `src/routes/*.js`

**Problem today:** `requireAuth` only base64-decodes the JWT payload — no signature,
issuer, audience, or expiry check. Anyone can forge a token with any `sub`/`email`.
`routes/graph.js` has no auth at all, including the member/friend-graph route, which
leaks any user's personal trip data to anyone who knows their user id.

**Tasks:**
1. Replace the decode-only stub with real Auth0 JWKS verification (`express-oauth2-jwt-bearer`,
   or `jsonwebtoken` + `jwks-rsa`), validating signature, `iss`, `aud`, and expiry against
   `AUTH0_DOMAIN` / `AUTH0_AUDIENCE`.
2. Add `requireAuth` to `GET /api/groups/:groupId/graph` and
   `GET /api/groups/:groupId/members/:userId/graph`.
3. Add a group-membership check: the requesting user (`req.auth.sub`) must be a member of
   `:groupId` before either graph route returns data.
4. Make sure a bad/missing/expired token returns `401 { success: false, error: "..." }`
   per contract, not a 500.

**Depends on:** Auth0 audience prerequisite above.
**Touches:** no other person's files — safe to start immediately once the prereq is done.

---

## Person B — User profile + recommendation engine

**Owns:** `src/services/recommendationService.js` (currently `return []` stub), new
`src/routes/users.js`, hook into `src/services/tripService.js`

**Problem today:** `GET /api/users/:userId/profile` is contracted in
`shared/api-contract.md` but doesn't exist as a route. `UserPlaceTypeProfile` is never
computed or persisted.

**Tasks:**
1. Implement `recommendationService.js`: given a user's trips/nodes, compute
   `place_type` frequency distribution (`UserPlaceTypeProfile` per schema).
2. Wire a recompute call into `tripService.createTrip` after a trip is saved (non-blocking
   is fine — don't let a slow recompute delay the discovery response).
3. Add `GET /api/users/:userId/profile` (new `routes/users.js`, mounted in `server.js`)
   returning the shape from `shared/api-contract.md` (`place_type_preferences`,
   `total_trips`, `total_discovery`).
4. 404 if the user doesn't exist; empty preferences array (not an error) if they have no trips yet.

**Depends on:** nothing else on this list — schema and contract shape already exist.
**Touches:** new file + two services; no conflict with A, C, or D.

---

## Person C — Friends API

**Owns:** new `src/routes/friends.js`, `friends` collection queries

**Problem today:** frontend has a friends panel but "add friend" is a local stub — no
backend route exists. The `friends` collection is defined in `shared/mongodb-schema.js`
but nothing reads/writes it.

**Tasks:**
1. `POST /api/friends` — add a friend request by email (creates a `friends` doc,
   `status: "pending"`).
2. `POST /api/friends/:id/accept` — flip `status` to `"accepted"`.
3. `GET /api/friends` — list a user's accepted (and optionally pending) friends.
4. Decide + document the response shape with Person B/D since it's not in
   `shared/api-contract.md` yet — add it there once agreed (Slack ping first, it's a
   locked file).
5. Validate: can't friend yourself, can't duplicate a pending/accepted pair.

**Depends on:** nothing else on this list.
**Touches:** new file only; coordinate with Person A once graph routes are gated so
friend status can eventually restrict personal-graph visibility (stretch, not required
for MVP).

---

## Person D — Group create/join + input validation

**Owns:** new `src/routes/groups.js`, validation pass across `routes/trips.js` and
`routes/graph.js`

**Problem today:** everything assumes the single seeded demo group; there's no way to
create a new group or join one via code. `tripService`/`graph.js` also don't validate
inputs beyond what's needed for the demo path.

**Tasks:**
1. `POST /api/groups` — create a group (name, creator = `req.auth.sub`), generate a
   short invite code.
2. `POST /api/groups/join` — join a group by invite code, adds caller to `member_ids`.
3. Add input validation to `POST /api/trips`: reject missing/non-numeric `from_lat`/
   `from_lng`/`to_lat`/`to_lng`, invalid `travel_mode` enum, `duration_min` out of
   5–120 range — return `400` with a clear message instead of falling through to a 500.
4. Validate `:groupId`/`:userId` route params are well-formed before hitting Mongo in
   `graph.js` (currently a malformed id likely throws a raw 500).

**Depends on:** nothing else on this list; do the validation pass last if you want to
avoid touching files Person A is mid-edit on (`graph.js`) — otherwise fine in parallel,
different lines.
**Touches:** new file + defensive edits to existing routes; small diffs, low conflict risk.

---

## Suggested order

1. Close the Auth0 audience prerequisite (blocks A only).
2. A and B start immediately in parallel (different files, no overlap).
3. C starts immediately (new file, zero overlap with anyone).
4. D starts immediately on `routes/groups.js`; holds the `graph.js`/`trips.js`
   validation edits until A has landed its auth changes to those same files, to avoid
   a merge fight over a few lines.

## Merge rule

Each person opens a small PR against their own files first (`middleware/auth.js` for A,
`services/recommendationService.js` + `routes/users.js` for B, `routes/friends.js` for C,
`routes/groups.js` for D). Only D's validation pass touches shared route files
(`trips.js`, `graph.js`) — land that last and rebase on whatever A merged.
