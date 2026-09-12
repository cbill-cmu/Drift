# Drift — Location Tracking + Fog-of-War: Task Breakdown

Derived from `requirements.md` (full spec) and `DRIFT_PROJECT_GUIDE.md` (architecture/demo).
Sequenced per the guide's own rule: **prove one user's personal fog-of-war end-to-end
before touching group merge.** Don't skip ahead — each phase depends on the previous
one actually working, not just existing.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Phase 0 — Setup (do first, ~30 min) ✅ done

- [x] Add `h3-js` to `backend/package.json` and `frontend/package.json` (`^4.5.0`, both installed)
- [x] Add new Mongo collections/indexes to `shared/mongodb-schema.js`:
  - `LOCATION_TRACES: "location_traces"`
  - `USER_VISITED_CELLS: "user_visited_cells"`
  - Index: `user_visited_cells { user_id: 1, h3_cell: 1 } unique`
  - Index: `location_traces { user_id: 1, started_at: -1 }`
  - Also added `VISITED_CELL_RESOLUTION = 9` constant, re-exported from `backend/src/models/index.js`
- [x] Add `location_traces` and `user_visited_cells` document shapes to the schema reference comment block (mirrors the existing style for `heatpoints`, etc.)

**Done when:** both `package.json`s list `h3-js`; `npm install` succeeds in both; `mongodb-schema.js` exports the two new collection names + indexes.

**Verified:** `h3.latLngToCell(40.4425, -79.9435, 9)` against real CMU coordinates returns a real cell with a 6-point boundary; `cellToParent(cell, 7)` correctly derives the zoomed-out cell. Backend and frontend both boot cleanly with the new dependency and schema changes.

---

## Phase 1 — Client-side location tracking (frontend)

- [ ] New hook: `frontend/src/hooks/useLocationTracking.js`
  - Requests `Geolocation` permission on first call, not on cold app launch
  - Runs `navigator.geolocation.watchPosition({ enableHighAccuracy: false, maximumAge: 15000, timeout: 10000 })`
  - Applies the accept filter: only keep a fix if **≥25m moved OR ≥30s elapsed** since the last accepted fix (haversine distance — reuse `haversineMeters` from `backend/src/services/tripService.js` logic, ported client-side or duplicated as a small util)
  - Pauses the watch on `document.visibilitychange` → hidden (`clearWatch`), resumes on visible
  - Buffers accepted fixes in memory; flushes every 60s **and** on visibility-hidden (so nothing is lost when the tab backgrounds)
- [ ] Polyline encoding util: `frontend/src/utils/polyline.js` — encode buffered `[lat,lng]` fixes into a compressed string (standard Google polyline algorithm; small, no new dependency needed — implement directly, it's ~20 lines)
- [ ] Wire the hook into `Layout.jsx`: a "Start exploring" control that requests permission and begins tracking; a live indicator (dot/pulse) while active

**Done when:** opening the app, granting permission, and moving around (or simulating movement via browser dev tools' geolocation override) produces a buffered, filtered set of fixes in memory, confirmed via `console.log` before wiring up the network call in Phase 2.

---

## Phase 2 — Backend ingestion + cell derivation

- [ ] New route: `POST /api/location/traces` (`backend/src/routes/location.js`, mounted in `server.js` behind `requireAuth`)
  - Body: `{ polyline: string, started_at, ended_at, point_count, distance_m }`
  - Decode the polyline server-side (same algorithm, decode direction)
- [ ] New service: `backend/src/services/locationService.js`
  - `recordTrace(db, userId, body)` — inserts one `location_traces` doc (raw, for the 30-day-retention window)
  - `deriveVisitedCells(db, userId, points)` — for each decoded point, `h3.latLngToCell(lat, lng, 9)`, then bulk-upsert into `user_visited_cells`: `$inc: { visit_count: 1 }`, `$max: { last_visited_at }`, `$setOnInsert: { first_visited_at }`
- [ ] Call `deriveVisitedCells` from the route handler after `recordTrace` succeeds — same non-blocking-try/catch pattern already used elsewhere (see `tripService.js`'s `recomputeUserPlaceTypeProfile` call for the exact pattern to copy)

**Done when:** POSTing a real encoded polyline (curl/Postman, or from Phase 1's flush) produces real `user_visited_cells` documents in Atlas — verify directly in Atlas or via a small script, same way Person B's Task 2 was verified against real data.

---

## Phase 3 — Personal fog-of-war rendering (single user, no group yet)

**Do not start Phase 4 until this works and looks right on screen.**

- [ ] New route: `GET /api/users/me/visited-cells` — returns the current user's `user_visited_cells` as `[{ h3_cell, visit_count }]`
- [ ] New component: `frontend/src/components/FogOverlayLayer.jsx`
  - For each returned cell, `h3.cellToBoundary(cell)` → GeoJSON polygon
  - Render as a Leaflet `GeoJSON` layer on top of the existing map
  - Personal view: visited cells rendered clear/normal map; a semi-opaque gray fog layer covers everything else (invert the usual "highlight visited" pattern — the *unvisited* area gets the overlay treatment)
- [ ] Wire into `GroupMapView.jsx` alongside the existing graph/heat rendering

**Done when:** after Phase 1+2 produce real visited cells for your own account, loading the map shows your own explored area revealed and everything else fogged — confirmed visually, not just via API response shape.

---

## Phase 4 — Group coverage aggregation (backend)

- [ ] New route: `GET /api/groups/:groupId/coverage` (behind `requireAuth` + `requireGroupMember`, per Person A's existing middleware pattern)
- [ ] Aggregation in `locationService.js`:
  ```js
  db.collection(COLLECTIONS.USER_VISITED_CELLS).aggregate([
    { $match: { user_id: { $in: group.member_ids } } },
    { $group: { _id: "$h3_cell", visitors: { $addToSet: "$user_id" } } },
    { $project: { h3_cell: "$_id", visitor_count: { $size: "$visitors" } } },
  ]);
  ```
- [ ] Classify each result: `visitor_count === member_ids.length` → `"everyone"`, else `"some"`. Cells absent from the result are implicitly `"no one"` — don't enumerate them.
- [ ] Response shape: `{ success: true, group_id, everyone: [cells], some: [cells] }` (no-one is everything else, computed client-side as "not in either list")

**Done when:** a curl against a seeded group with 2+ members who both have visited cells returns correct tier classification — verify the arithmetic by hand against a couple of real `user_visited_cells` docs, same rigor as the earlier sub-agent assessments in this session.

---

## Phase 5 — Group overlay rendering (three tiers)

- [ ] Extend `FogOverlayLayer.jsx` to accept a `mode: "personal" | "group"` prop
- [ ] Group mode: three fill styles — solid mint for "everyone," lighter/hatched mint for "some," translucent gray fog for "no one" (reuse `--mint` / `--mint-deep` tokens already in `styles/index.css`)
- [ ] Toggle in `Layout.jsx` or `GroupMapView.jsx` to switch personal ↔ group view (can reuse the existing `activeFriend`/group-switch UI patterns already in place)

**Done when:** viewing a group with mixed member coverage visibly shows the three-tier distinction on screen — take a screenshot and confirm the tiers are actually distinguishable, not just three shades of the same color.

---

## Phase 6 — Coverage-gap suggestions

- [ ] New route: `GET /api/groups/:groupId/suggestions`
- [ ] Logic: take the "no one" cells (city bounding box minus everyone+some from Phase 4), intersect against the existing Pittsburgh places catalog (`backend/src/services/placesCatalogService.js` — already built by Person D, reuse it) by mapping each catalogued place's lat/lng to its H3 cell and checking membership
- [ ] Return top N uncovered-but-populated cells with their place info
- [ ] New component: `frontend/src/components/SuggestionCards.jsx` — simple card list, similar structure to the existing `RecommendationsPanel.jsx`

**Done when:** suggestions returned are real, named places from the catalog that are genuinely outside the group's visited cells — spot-check a few by hand.

---

## Phase 7 — Privacy controls

- [ ] Add `contributes_to: [group_id]` (or an exclusion list — pick one, document the choice) to the `users` collection
- [ ] Toggle in `ProfileModal.jsx`: "Share my exploration with [group name]"
- [ ] Phase 4's aggregation query filters `user_id` by both `group.member_ids` **and** the contribution allowlist/denylist

**Done when:** toggling the setting off for a test user makes their cells disappear from that group's `/coverage` response on the next call, with no data deleted (personal fog-of-war map is unaffected).

---

## Phase 8 — Zoom-level resolution switching

- [ ] Listen for Leaflet zoom events; below a threshold zoom, re-request/re-render cells at H3 resolution 7 instead of 9 (either a separate backend param `?resolution=7|9` on the coverage/visited-cells routes, or compute the coarser view client-side via `h3.cellToParent(cell, 7)` and de-dupe)
- [ ] Confirm resolution-7 hexes render as visibly larger city-scale regions, not a broken/overlapping mess

**Done when:** zooming out smoothly transitions from block-level hexes to neighborhood-level hexes without visual glitches.

---

## Phase 9 — Demo polish

- [ ] Rehearse the exact demo script from `DRIFT_PROJECT_GUIDE.md`'s Critical Path section
- [ ] Seed script update: generate synthetic `location_traces` / `user_visited_cells` for demo accounts so the group overlay looks populated without live walking (mirrors how `shared/mongodb-seed/` already fakes trip history) — **this is now the only non-live way to populate coverage**, see the note below on the removed manual fallback

**Done when:** a cold demo run-through (login → see group's existing fog coverage → track a short new area live → watch it flip from fog to revealed → switch to group view → see a suggestion card) works without manual intervention.

---

## Cut order if behind (from `requirements.md` §15)

If time runs out, cut in this order — each cut still leaves something demoable:

1. Suggestion cards (Phase 6) — cut first, group overlay alone still tells the story
2. "Some" middle tier (Phase 4/5) — collapse to just everyone vs. no-one
3. Zoom resolution switching (Phase 8) — ship one fixed resolution (9)
4. Privacy controls (Phase 7) — ship without opt-out for the demo, add before any real deploy
5. Group merge entirely (Phase 4/5) — ship personal fog-of-war alone (Phase 1-3), narrate the group vision

**Never cut Phase 0-3.** A single user's fog-of-war revealing correctly is the entire proof of concept — per `DRIFT_PROJECT_GUIDE.md`: *"If this loop works and the fog genuinely lifts as you move, you win."*

**No fallback if live GPS fails in the room.** The manual trip-logging form (the previous cut-order item 6) has been deleted outright — GPS tracking is the only path into `user_visited_cells` now, by product decision, not an oversight. If live GPS is flaky on demo day, the only mitigation is Phase 9's seed script (pre-populated `location_traces`/`user_visited_cells` for demo accounts) — there is no live manual-entry escape hatch anymore. Budget real testing time for Phase 1's permission flow and accept filter on the actual demo device/network before the day of.
