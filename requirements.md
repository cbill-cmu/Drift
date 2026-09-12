# Drift — Requirements (Revised)

Hackathon build. Pittsburgh / CMU scoped.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[cut]` descoped

**Last synced to `main` after the location-tracking / fog-of-war pivot.** Code wins over this file if they disagree — update checkboxes when you merge.

---

## 0. One-sentence product definition

Continuous movement → per-user explored map (fog-of-war) → group overlay of who's-been-where → **surfaced unexplored suggestions for the group**.

Manual trip logging has been **removed entirely**, not kept as a fallback — GPS tracking is the only path into the system now (see §5). There is no live manual-entry escape hatch if GPS is unreliable on demo day; see §5 and `TASKS.md`'s cut-order section for the actual mitigation (pre-seeded demo data).

If a feature doesn't serve this sentence, it is out of scope for the hackathon build.

---

## Team (4 people)

| Person | Role | Status focus |
|--------|------|----------------|
| 1 | Backend | Location ingestion API, cell-coverage aggregation, JWKS auth |
| 2 | Frontend | GPS permission flow, fog-of-war overlay rendering, discovery polish |
| 3 | Auth + seed | Keep Atlas/Auth0 healthy; seed synthetic traces instead of synthetic trips |
| 4 | Integration + deploy | E2E critical path, then Vultr |

---

## 1. Core concept constraints (do not violate)

- The product is a **fog-of-war exploration map**: each user has a private "explored" surface built from where they've actually been.
- **Group overlay** merges members' explored surfaces into one shared view with three visually distinct coverage tiers (everyone / some / no one).
- **Uncovered-but-relevant areas are the point** — the app's job is to surface them as "go here next" suggestions, not just render blank fog.
- Behavior generates content automatically — no manual reviews, posts, or itineraries.
- Personal raw location history stays private; only derived, coarse **visited-cell membership** is shared into a group, never raw coordinates or timestamps (see §8).

---

## 2. Explicit scope cuts (revised for the pivot)

**No longer cut — now core:**
- [x] ~~Real passive background location tracking~~ → **foreground continuous tracking is now core** (see §5). True OS-level background tracking while the app is closed is still out of reach on the current web stack — see §5's honesty note — and stays a stretch goal pending a native (Capacitor) wrapper.

**Still not building:**
- [cut] Manual trip logging — deleted outright (`TripLoggerModal`, `useTrip.js`, dock entry point), not kept as a fallback. GPS is the only path into the product now; if live GPS fails during a demo, the mitigation is pre-seeded demo data (`TASKS.md` Phase 9), not a manual-entry escape hatch.
- [cut] True OS background tracking without a native wrapper (web `Geolocation` API cannot run once the tab/app is backgrounded on iOS Safari; documenting this honestly rather than promising it)
- [cut] Place metadata / reviews / hours (Yelp)
- [cut] Multi-city beyond Pittsburgh
- [cut] Real-time multiplayer cursors (live "who's online where")
- [cut] Complex ML recommendations — heuristic (frequency + coverage-gap) only
- [cut] Full Google Maps JS base map *(Leaflet + Esri tiles already ships; see frontend)*

**Building instead — status:**
- [ ] Continuous foreground location tracking (permission flow + `watchPosition` + distance/time throttle)
- [ ] Location trace storage (compressed polylines, bounded retention)
- [ ] Per-user visited-cell derivation (H3, resolution 9)
- [ ] Group cell-coverage aggregation (everyone / some / no one)
- [ ] Fog-of-war overlay rendering on the existing Leaflet map, zoom-dependent resolution
- [ ] Suggestion surfacing: unexplored cells that contain a catalogued place (reuse the existing Pittsburgh places catalog)
- [cut] Manual trip logging (form) — removed entirely (`TripLoggerModal`, `useTrip.js`, the dock entry point all deleted); GPS is the only path in, no fallback UI exists
- [x] Auth0 integration (login/logout; JWKS verify done)
- [x] Groups: create/switch/invite (done — Person D)
- [x] Friends API (done)
- [x] Recommendation cards in UI (done — taste-based; now complemented by coverage-gap suggestions from the overlay)
- [x] Pittsburgh places catalog (done — reused as the suggestion source for uncovered cells)

---

## 3. Data model

Existing collections (`shared/mongodb-schema.js`, unchanged): `users`, `groups`, `nodes`, `edges`, `trips`, `heatpoints`, `user_heatpoints`, `user_place_type_profiles`, `friends`, `group_invites`.

**New collections for the pivot:**

```js
// location_traces — compressed raw GPS history, bounded retention
{
  _id, user_id, group_id: null,       // traces are personal, not group-scoped
  started_at, ended_at,
  polyline: "encoded string",          // Google polyline encoding of the accepted fixes
  point_count, distance_m,
  created_at
}

// user_visited_cells — the durable, small, privacy-safe derivative of the trace
{
  _id, user_id, h3_cell: "8928308280fffff",  // H3 resolution 9
  first_visited_at, last_visited_at, visit_count
}
// unique index: { user_id: 1, h3_cell: 1 }
```

`group_cell_coverage` is **not** a stored collection for the hackathon build — computed on read via aggregation over `user_visited_cells` filtered to a group's `member_ids` (see §7). Materializing it is a stated stretch item if read latency becomes a problem, not a day-one requirement.

Notes:
- [ ] `location_traces` retention: rolling 30 days of raw polylines, then discard (keep only the derived `user_visited_cells`, which stay indefinitely — they're tiny: one doc per hex a user has ever entered, not per GPS ping).
- [ ] `user_visited_cells` never stores `group_id` — cell visitation belongs to the user; group membership is applied at aggregation time, so leaving a group doesn't require rewriting history.
- [x] Existing `nodes`/`edges`/`trips` schema and backend service are untouched — kept for edge/travel-time data H3 cells alone can't give you — but nothing currently writes to `trips` anymore since the manual-entry UI was deleted; this becomes live again only once GPS-derived edge inference (§10) is built.

---

## 4. Authentication & users

- [x] Auth0 SPA login + frontend callback
- [x] Backend JWT — JWKS signature verify (done, Person A)
- [x] Group create/join flow (done, Person D)
- [x] User profile screen (done, Person D — `ProfileModal.jsx`)

---

## 5. Location tracking

Replaces the old §5 "Trip logging." Full technical spec:

### Permission flow
- Request `Geolocation` permission on first meaningful interaction (opening the map / tapping "Start exploring"), **not** on cold app launch before the user has context — matches platform guidance and avoids an instant deny.
- **Foreground only** for the web build: `navigator.geolocation.watchPosition()` runs while the tab is open and visible. Use the Page Visibility API to pause the watch (`clearWatch`) when the tab is hidden, restart on `visibilitychange` back to visible — this is the honest ceiling for a browser tab, not real background tracking.
- **Background tracking is a stated stretch item**, not shipped in the web build: it requires wrapping the existing React app in Capacitor (or a native rewrite) to use CoreLocation (iOS) / FusedLocationProvider (Android) background location APIs. Document this explicitly wherever the feature is described — don't imply the web app does something it can't.

### Sampling interval
- `watchPosition({ enableHighAccuracy: false, maximumAge: 15000, timeout: 10000 })` — coarse (network/wifi-assisted) location is sufficient at city-block scale and meaningfully cheaper on battery than GPS-precision.
- Client-side accept filter on top of `watchPosition`'s own callback rate: only accept a new fix if **≥25m moved OR ≥30s elapsed** since the last accepted fix. This is the main lever against noisy/duplicate points, independent of the browser's own throttling.

### Storage & compression
- Fixes accumulate in an in-memory buffer client-side; flushed to the backend every ~60s (or on `visibilitychange`-to-hidden, so nothing is lost when the tab backgrounds) as one `location_traces` doc: buffered points encoded as a polyline string, not one row per point.
- Backend derives `user_visited_cells` from each flushed trace: decode the polyline, map each point to its H3 resolution-9 cell (`latLngToCell`), upsert `{user_id, h3_cell}` with `$inc: visit_count`, `$max: last_visited_at`. This is the only part of the pipeline group overlays ever read from — see §7.
- Retention: raw `location_traces` kept 30 days then dropped; `user_visited_cells` kept indefinitely (bounded size — one doc per hex ever entered, not per ping, so this stays small even for a heavy user over months).

### Battery-usage tradeoffs
| Setting | Battery cost | Precision | Chosen? |
|---|---|---|---|
| `enableHighAccuracy: true`, no throttle | Worst — continuous GPS radio | ~5-10m | No |
| `enableHighAccuracy: false`, no throttle | Moderate — frequent network location | ~50-500m | No (still noisy) |
| `enableHighAccuracy: false` + 25m/30s accept filter | **Best available on web** | ~50-500m, deduped | **Yes** |
| Native background (Capacitor + OS location API) | Tunable via OS-level "significant location change" APIs | Varies | Stretch, not this phase |

- [ ] Implement `watchPosition` + Page Visibility pause/resume
- [ ] Implement client-side distance/time accept filter
- [ ] Implement 60s flush → `location_traces`
- [ ] Implement server-side H3 cell derivation → `user_visited_cells`
- [cut] Manual trip form — deleted, not kept as a fallback. If live GPS is unreliable in the demo room, the mitigation is pre-seeded `user_visited_cells` for demo accounts (`TASKS.md` Phase 9), not a manual-entry form.

---

## 6. Overlay maps (fog-of-war)

### Spatial representation
- **H3 hexagons**, not geohash or a raw lat/lng grid. Reasoning: uniform cell area (geohash rectangles distort, especially noticeable if the product ever leaves one city), clean parent/child resolution hierarchy for zoom-dependent rendering, and fast neighbor lookups if the suggestion logic later wants "adjacent to explored" reasoning.
- Resolution 9 (~0.1 km², roughly a city block) for the base "visited" unit — matches §5's storage. Resolution 7 (~5 km², roughly a neighborhood) for the zoomed-out group view — see rendering below.

### Server-side merge
Computed on read, not stored, for the hackathon build:

```js
// Pseudocode: group_id -> group.member_ids -> aggregate user_visited_cells
db.user_visited_cells.aggregate([
  { $match: { user_id: { $in: group.member_ids } } },
  { $group: { _id: "$h3_cell", visitors: { $addToSet: "$user_id" } } },
  { $project: { h3_cell: "$_id", visitor_count: { $size: "$visitors" } } },
]);
```
Classify each returned cell against `group.member_ids.length`:
- `visitor_count === member_count` → **everyone**
- `0 < visitor_count < member_count` → **some**
- cell absent from the result set entirely → **no one** (never enumerated explicitly — "no one" is the default render state for any cell not returned)

### Per-user privacy when sharing into a group
- Only the **cell ID** (a coarse ~0.1 km² area) is shared into group aggregation — never the raw trace, timestamps, or visit order. A group member can see "someone in the group has been in this hex," never "who, when, or in what path."
- A user can opt a specific group out of receiving their `user_visited_cells` contribution (a `contributes_to: [group_id]` allowlist on the user doc, or its inverse) while still keeping their own personal fog-of-war map intact — same privacy posture Drift already documents for heat density (personal data private to self, coarse existence signal group-visible).
- Leaving a group requires no data rewrite — coverage is computed live from current `member_ids`, so a departed member's cells simply stop being included next time the aggregation runs.

### Rendering at different zoom levels
| Zoom | H3 resolution | Rationale |
|---|---|---|
| City-wide (zoomed out) | 7 (~5 km²) | Coarse enough not to render thousands of hexes; matches "which neighborhoods" framing |
| Street-level (zoomed in) | 9 (~0.1 km²) | Matches the stored resolution directly, block-level fog reveal |

- Convert visible H3 cells to GeoJSON polygons (`cellToBoundary`) and render as a Leaflet layer, styled by tier: solid mint fill for "everyone," lighter/hatched mint for "some," a translucent gray fog fill for "no one."
- **Suggestion surfacing**: among "no one" cells, filter to those that intersect a catalogued place (reusing the existing Pittsburgh places catalog service) and surface the top few as explicit "go here next" cards — an empty hex alone isn't a suggestion, an empty hex with a real place in it is.

- [ ] H3 cell → GeoJSON boundary rendering layer
- [ ] Three-tier styling (everyone / some / no one)
- [ ] Zoom-to-resolution switch (7 ↔ 9)
- [ ] Suggestion cards: uncovered cell ∩ places catalog

---

## 7. Recommendation engine

- [x] Taste-based recommendation cards (place-type frequency) — done, Person B
- [ ] Coverage-gap suggestions from the fog-of-war overlay (§6) — new, complements taste-based recs rather than replacing them
- [cut] Cross-city stretch

---

## 8. Privacy model

- [x] Node/edge existence group-visible (unchanged)
- [ ] Visited-cell membership group-visible; raw trace/timestamps never leave the user's own account (§6, new)
- [ ] Per-group opt-out of contributing cell data, independent of leaving the group
- [ ] Strict personal heat/trace privacy vs. friends-only (still open, unchanged from before the pivot)
- [ ] Leaderboard (still cut)

---

## 9. UI / screens

- [x] Group graph view — Leaflet map + nodes/edges (done)
- [x] Groups panel (create/switch) — done, Person D
- [x] Friends panel + group invites — done
- [x] Recommendations panel (taste-based) — done
- [x] Profile modal — done
- [ ] Fog-of-war overlay layer on the map (new, §6)
- [ ] "Start exploring" GPS permission prompt + live tracking indicator (new, §5)
- [ ] Coverage-gap suggestion cards (new, §6)
- [cut] Manual trip logging UI — deleted, not kept
- [x] Discovery reveal — auto-dismiss + transitions (done; not currently triggered by anything until the GPS pipeline wires it up, see `TASKS.md`)
- [x] Auth0 login / logout

---

## 10. Nice-to-haves

- [ ] Native wrapper (Capacitor) for true background tracking
- [ ] Materialized `group_cell_coverage` collection if live aggregation gets slow
- [ ] Path-based (not just cell-based) edge inference directly from traces — `edges` currently has no active source at all since manual trip entry was removed; this is the eventual replacement

---

## 11. Demo script (target)

1. Open the map — group's fog-of-war overlay shows dense "everyone" coverage around campus, sparse "some"/"no one" further out.
2. Tap "Start exploring" — grant location permission, watch a live dot move as the demo walks a short loop.
3. A cell flips from fog to "you've been here" the moment it's crossed.
4. Switch to group view — that same cell shows as "some" (just this user) until teammates' traces also cover it.
5. Suggestion card surfaces an uncovered, catalogued place nearby — "the group hasn't been to X yet."
6. No live fallback exists if GPS is unreliable in the room — the manual trip form was removed. Mitigate by pre-seeding `user_visited_cells` for demo accounts ahead of time (`TASKS.md` Phase 9) and testing the permission/accept-filter flow on the actual demo device beforehand.

---

## 12. Open decisions

- [x] Stack: React/Vite + Express + Atlas + Auth0 (unchanged)
- [x] Map rendering: Leaflet + Esri tiles (already shipped)
- [x] Spatial index: **H3**, resolution 9 base / 7 zoomed-out
- [ ] Materialize `group_cell_coverage` vs. compute-on-read (leaning compute-on-read for hackathon scope)
- [ ] Exact accept-filter thresholds (25m/30s proposed, needs live-testing tuning)
- [ ] Whether trip-derived edges (`edges` collection) get supplemented or eventually replaced by trace-derived path inference

---

## 13. Tech stack (updated)

- Frontend: React + Vite, Leaflet (Esri tiles)
- Geolocation: browser `Geolocation` API (`watchPosition`), no native wrapper this phase
- Spatial indexing: **H3** (`h3-js` on both client for local fog rendering and server for cell derivation/aggregation)
- Backend: Node/Express
- Database: MongoDB Atlas
- Auth: Auth0 + JWT (JWKS verified)
- Place inference: Google Places (optional key) + curated Pittsburgh catalog
- Hosting: Vultr planned; DB on Atlas

**Deliverable for this pivot:** architecture sketch + API design (this document + `shared/api-contract.md` additions) first, working prototype of tracking + overlay second — do not attempt both simultaneously with the time remaining; land the ingestion pipeline and prove one user's fog reveals correctly before building the group-merge and rendering layer on top of it.

---

## 14. API / infra checklist

**Google:**
- [~] Places enabled for backend key (team-dependent)
- [x] Places catalog (curated, done)

**Auth0:**
- [x] Tenant + SPA + JWKS verify
- [ ] Production URLs when deployed

**MongoDB:**
- [x] Atlas M0 + collections + seed + indexes (existing)
- [ ] New indexes: `user_visited_cells { user_id: 1, h3_cell: 1 } unique`, `location_traces { user_id: 1, started_at: -1 }`

**H3:**
- [ ] Add `h3-js` dependency (frontend + backend)

**Vultr:**
- [ ] Deploy API + frontend (Person 4)

---

## 15. Minimum viable scope (if behind)

**CORE (must demo):**
- [ ] One user's location tracked live and rendered as personal fog reveal
- [ ] Group overlay showing at least "everyone" vs "no one" (skip the "some" middle tier first if truly pressed for time)
- [x] Auth0 login
- [x] Groups + friends (already done)

**Cut order if needed:** suggestion cards → "some" middle tier → group merge (ship personal fog-of-war alone) → H3 zoom-level switching (ship one fixed resolution). Live GPS itself is never a cuttable item anymore — there is no manual-form fallback to fall back to; if GPS genuinely can't be demoed live, the mitigation is pre-seeded `user_visited_cells` (`TASKS.md` Phase 9), not a code path in the app.
