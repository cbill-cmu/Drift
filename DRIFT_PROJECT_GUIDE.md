# Drift — Complete Project Guide for Hackathon

**Hackathon build. Pittsburgh / CMU scoped.**

> **Status sync (pivoted to continuous location tracking + fog-of-war):**  
> Shipped: Atlas seed, Auth0 (JWKS verified), groups/friends/invites, recommendations, places catalog, Leaflet map, manual trip logger (kept as fallback), discovery toast with real animation.  
> Next: build the location-tracking pipeline and fog-of-war overlay described in this guide — this is a scope pivot, not an addition; manual trip logging is no longer the primary path.  
> Live checklist: root [`README.md`](README.md) + [`requirements.md`](requirements.md), which now has the full technical spec (permission flow, sampling, storage, H3 cell merge, privacy, rendering). This guide keeps product/demo/architecture detail in sync with it.

---

## Table of Contents

1. [Core Product Definition](#core-product-definition)
2. [Requirements Summary](#requirements-summary)
3. [System Architecture](#system-architecture)
4. [Critical Path (The Only Thing That Matters)](#critical-path-the-only-thing-that-matters)
5. [Tech Stack (Locked)](#tech-stack-locked)
6. [Team Structure & Responsibilities](#team-structure--responsibilities)
7. [24-Hour Timeline](#24-hour-timeline)
8. [What to Skip / Red Flags](#what-to-skip--red-flags)
9. [Data Model](#data-model)
10. [Backend Endpoints (MVP Only)](#backend-endpoints-mvp-only)
11. [Frontend Components (MVP Only)](#frontend-components-mvp-only)
12. [Demo Script](#demo-script)
13. [Minimum Viable Scope (Emergency Cutdown)](#minimum-viable-scope-emergency-cutdown)

---

## Core Product Definition

**One sentence:** Continuous movement → private fog-of-war "explored" map → group overlay of who's-been-where → **surfaced suggestions for where the group hasn't gone yet**.

**The core loop:**
1. App tracks the user's location continuously in the foreground (GPS permission granted once, `watchPosition` running while the tab is open)
2. Each accepted GPS fix gets mapped to an H3 hex cell; the user's personal "explored" set of cells grows as they move through the city
3. Within a group, members' explored-cell sets are merged server-side into one overlay: cells everyone's visited, cells some have visited, cells no one has
4. The map renders this as fog-of-war — visited areas revealed, unexplored areas covered — with the three tiers visually distinct
5. Unexplored cells that contain a real catalogued place are surfaced as explicit "go here next" suggestions — the uncovered regions are the point, not just a visual effect

Manual trip logging (the original core loop) still exists as a fallback entry point for the same underlying `user_visited_cells` data — useful when live GPS isn't available (e.g. demoing indoors) — but it's no longer how the product primarily works.

**What makes it Drift (not just Strava or Life360):**
- **Fog-of-war framing**, not a raw heatmap — exploration is revealed, not just intensity-shaded
- **Group overlay with three-tier coverage**, not a single shared blob — "everyone," "some," and "no one" are each meaningful states that drive different suggestions
- **Suggestions tied to real places**, not empty hexes — an uncovered cell only becomes a card if it contains something in the places catalog
- **Coarse-cell privacy by construction** — only H3 cell membership crosses into group scope; raw coordinates and timestamps never leave a user's own account (see Privacy below)
- **Passive content generation** (behavior = data, no manual reviews)

---

## Requirements Summary

### Core Concept Constraints (Do Not Violate)

- The product is a **fog-of-war exploration map** built from each user's continuously-tracked location, not a manually-logged graph.
- **H3 hex cells** are the unit of "explored" — a cell is visited once any accepted GPS fix falls inside it. Resolution 9 (~0.1 km², city-block scale) is the base unit; resolution 7 (~5 km²) is used for zoomed-out group views.
- **Group overlay merges per-user explored-cell sets** server-side into three tiers: everyone-visited, some-visited, no-one-visited. Computed on read from `user_visited_cells`, not manually maintained.
- **Privacy is coarse-cell, not per-trip:**
  - **Group view**: which cells the group collectively covers, and at what tier. Never raw paths or timestamps.
  - **Individual view**: your own full-resolution fog-of-war map, private by default; you choose which groups your cell data contributes to.
- Behavior generates content automatically — no manual reviews, posts, or itineraries.
- **Suggestion engine**: uncovered ("no one") cells that intersect a catalogued place are surfaced as "go here next" cards. This runs alongside (not instead of) the existing taste-based place-type recommendation engine.
- The original node/edge knowledge-graph model (`nodes`, `edges`, `trips` collections) is kept intact for the manual-logging fallback and for travel-time/edge data that cell visitation alone doesn't capture — it is not deleted, just no longer the primary loop.

### Explicit Scope Cuts (Revised for the Pivot)

**No longer cut:**
- ~~Real passive background location tracking~~ → foreground continuous tracking is now core. True background tracking (app closed/backgrounded) is still out of reach on a plain web stack and remains a stretch item pending a native wrapper — see `requirements.md` §5 for the honest technical breakdown.

**Still not building:**
- OS-level background tracking without a native (Capacitor) wrapper
- Place metadata / reviews / hours (that's Yelp)
- Multi-city support beyond Pittsburgh
- Real-time multiplayer cursors / live presence
- Complex ML recommendation model (heuristic taste + coverage-gap only)

**Building instead:**
- Continuous foreground GPS tracking with a distance/time accept filter (§ below)
- Compressed trace storage + server-side H3 cell derivation
- Group-level cell-coverage aggregation and three-tier fog-of-war rendering
- Coverage-gap suggestion cards (uncovered cell ∩ places catalog)
- Manual trip logging, kept as a fallback path into the same cell data
- Auth0 integration, groups, friends, places catalog, taste recommendations (all already shipped, unaffected by this pivot)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
│              (Auth0 login + GPS permission)                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                               │
│              React + Leaflet + h3-js                        │
│  ┌──────────────────┬────────────────┬────────────────┐    │
│  │  Fog-of-war map  │  Live tracking │  Discovery /   │    │
│  │  personal + group│  watchPosition │  suggestion    │    │
│  │  overlay layers  │  indicator     │  cards         │    │
│  └──────────────────┴────────────────┴────────────────┘    │
└─────────────────────────────────────────────────────────────┘
     ↓ (1. Flush buffered fixes ~60s)   ↑ (4. Return cell coverage)
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API                              │
│            Node/Express on Vultr VPS                        │
│  1. Validate Auth0 JWT                                      │
│  2. Decode polyline → GPS fixes                             │
│  3. Map each fix → H3 cell (resolution 9)                   │
│  4. Upsert user_visited_cells (visit_count, last_visited_at)│
│  5. On read: aggregate group members' cells → 3-tier overlay│
│  6. Cross-reference "no one" cells against places catalog   │
│     → suggestion cards                                      │
└─────────────────────────────────────────────────────────────┘
      ↓ (Save)              ↓ (Derive)          ↓ (Retrieve)
   ┌──────────┐       ┌──────────────┐    ┌────────────────┐
   │ MongoDB  │       │ h3-js        │    │  Auth0         │
   │ (users,  │       │ (cell        │    │  (JWT check)   │
   │  groups, │       │  indexing)   │    └────────────────┘
   │  location│       └──────────────┘
   │  _traces,│
   │  visited_│
   │  cells)  │
   └──────────┘
```

Manual trip logging still exists as a parallel input into the same `user_visited_cells` derivation — it's a fallback data source, not a separate architecture.

### Critical Path (The Demo Flow)

This is what you're demoing in the final 30 seconds:

1. **Open the map** — group's fog-of-war overlay shows dense "everyone" coverage around CMU/Oakland, sparse "some"/uncovered "no one" fog further out (Lawrenceville, South Side).
2. **User taps "Start exploring"** — grants GPS permission, live tracking indicator appears.
3. **User walks/drives a short loop** (or simulates one for the demo):
   - Each accepted fix (≥25m or ≥30s since the last) maps to an H3 cell
   - That cell flips from fog to "you've been here" on the personal map in near-real-time
4. **Switch to group view** — the same cell now shows as "some" (just this user) until a teammate's trace also covers it, at which point it flips to "everyone."
5. **Suggestion card surfaces**: an uncovered cell containing a real catalogued place — "the group hasn't been to X yet."
6. **Fallback**: if live GPS is unreliable in the room, log a trip manually instead — same `user_visited_cells` pipeline updates either way, so the demo degrades gracefully.

If this loop works and the fog genuinely lifts as you move, **you win**. Everything else is secondary.

---

## Tech Stack (Locked)

| Component | Decision | Why |
|-----------|----------|-----|
| **Frontend** | React + Vite | Already shipped, fast dev loop |
| **Backend** | Node.js + Express | Fast to build, easy Google API integration |
| **Database** | MongoDB Atlas | Flexible schema; new `location_traces` / `user_visited_cells` collections alongside existing ones |
| **Auth** | Auth0 | JWT, JWKS-verified |
| **Location tracking** | Browser `Geolocation` API (`watchPosition`) | Foreground-only on web; see `requirements.md` §5 for the background-tracking honesty note |
| **Spatial indexing** | **H3** (`h3-js`, client + server) | Uniform hex cells for fog-of-war storage, merge, and rendering — see `requirements.md` §6 |
| **Maps** | Leaflet + Esri tiles | Already shipped |
| **Place categorization** | Google Places API (optional key) + curated Pittsburgh catalog | Automatic tagging; catalog doubles as the suggestion source for uncovered cells |
| **Hosting** | Vultr ($5–10/month VPS) | Backend + MongoDB both fit on one small instance |
| **Version control** | GitHub | Easy to collaborate, free tier |
| **Deployment** | GitHub → Vultr via SSH or PM2 | Simple, no container overhead needed for 24h |

---

## Team Structure & Responsibilities

**Team size: 4 people. Parallel work.**

### Person 1: Backend Lead

**What:** Trip submission, Places (optional key), node/edge/heat discovery, Mongo queries, JWT hardening.

**Already on `main`:** Express app; `POST /api/trips`; `GET /api/groups/:groupId/graph`; member graph; Mongo Atlas; Places helper with fallback.

**Still owns:** JWKS Auth0 verification; user profile endpoint; recommendation service; API hardening.

### Person 2: Frontend Lead

**What:** React app — map, trip logger, discovery animation, friends UX.

**Already on `main`:** Auth0 login/logout; canvas heatmap/graph; trip logger; neighborhood stats; basic discovery toast; friends panel (partial).

**Still owns:** Discovery reveal polish (demo hero); trip→toast→refresh reliability; optional Maps tiles.

### Person 3: Auth + Demo Data

**What:** Auth0 tenant, test accounts, Atlas seed, fixtures, handoff IDs.

**Already on `main`:** Auth0 working for login; Atlas seeded (CMU CREW); seed scripts + HANDOFF; fixtures.

**Still owns:** Seed health (`npm run verify`); production Auth0 URLs when deploying; demo account readiness. See `shared/PERSON3_RUNBOOK.md`.

### Person 4: Integration + Deploy

**What:** Glue E2E, unblock env/CORS, polish fixes, Vultr/PM2.

**Already true:** Verticals exist to integrate.

**Still owns:** Local E2E checklist; production deploy; demo dry-run. See `shared/PERSON4_RUNBOOK.md`.

---

## 24-Hour Timeline

### Hours 0–2: Setup & Planning

- [ ] Git repo initialized, everyone clones
- [ ] Auth0 tenant created, test accounts ready
- [ ] MongoDB cluster created (Atlas free or Vultr)
- [ ] Vultr VPS spun up, SSH access working
- [ ] Slack / Discord channel for comms
- [ ] **All team members read this guide top-to-bottom**

**Parallel work starts:**

### Hours 2–4: Skeleton + Seed Data

**Backend**: 
- [ ] Express app init, basic GET / route
- [ ] MongoDB connection string in .env
- [ ] Collections defined (no data yet)

**Frontend**:
- [ ] React app init (Vite or Next.js), Google Map component stubbed

**Auth + Demo**:
- [ ] Auth0: configure client, test login on localhost
- [ ] Seed script: 1 group, 10 users, 100 nodes (Pittsburgh neighborhoods), 2 weeks of fake trips
- [ ] Load seed data into MongoDB

### Hours 4–8: Backend Hotpath

**Backend (CRITICAL PATH)**:
- [ ] POST `/api/trips` endpoint skeleton
- [ ] Auth0 JWT validation middleware
- [ ] Coordinate → node resolution (find nearest existing node or create new)
- [ ] **Google Places API integration** (reverse geocode, extract place_type)
- [ ] Trip insertion + Node/Edge discovery logic
- [ ] Heat point insertion
- [ ] UserPlaceTypeProfile computation
- [ ] GET `/api/groups/:groupId/graph` endpoint (return all nodes + edges + heatpoints)
- [ ] Test with Postman or curl

**Frontend**:
- [ ] Google Map renders with basic tile layer
- [ ] d3-force initialized (or canvas setup)
- [ ] Auth0 login redirects + JWT stored in localStorage
- [ ] Call backend GET `/api/groups/:groupId/graph` on mount, display nodes + edges on map

### Hours 8–14: Frontend Integration

**Frontend (CRITICAL PATH)**:
- [ ] Trip logger form: pick from location, to location, mode, duration
- [ ] Form submit → POST `/api/trips` to backend
- [ ] Response handling: detect if new node/edge, prepare for reveal animation
- [ ] Heatmap layer visible under graph (Google Maps native heatmap layer or custom)
- [ ] Graph edges animate into place on new trip
- [ ] Stats bars update (% per neighborhood)

**Parallel**: Backend team optimizes, caches Google API responses, adds error handling.

### Hours 14–20: Discovery Reveal Animation (PRIORITY)

**Frontend (HERO MOMENT)**:
- [ ] Toast/card component for "Fabio expanded your Drift"
- [ ] Animate % bars updating
- [ ] Animate new edge drawing on the graph
- [ ] Animate toast/card slide-in + sound (optional)
- [ ] Test with demo trip → verify full animation chain fires

**Parallel**: Test team runs end-to-end tests, captures any bugs.

### Hours 20–24: Polish + Deploy

**All**:
- [ ] Fix bugs reported from end-to-end testing
- [ ] Dry-run the demo script (log a trip, watch animation)
- [ ] Deploy backend to Vultr (PM2 for process management)
- [ ] Deploy frontend (build React app, serve static on Vultr or Netlify)
- [ ] Update Auth0 redirect URIs to production (vultr IP / domain)
- [ ] Final QA: log in with test account, log a trip, watch animation
- [ ] Document any gotchas or manual steps for demo day

**By hour 24:**
- [ ] Demo script locked and rehearsed
- [ ] All endpoints working
- [ ] Animation smooth
- [ ] Backend + frontend deployed
- [ ] Prepared for 5–10 min live demo

---

## What to Skip / Red Flags

Auth0, friends, groups, recommendations, and the places catalog are already shipped — the remaining risk is entirely in the location-tracking/fog-of-war pivot. Skip list updated accordingly.

### Skip These (Core Loop First)

- ❌ True OS background tracking (native wrapper) — foreground-only is the whole hackathon scope
- ❌ The "some" middle coverage tier, if truly pressed for time — ship "everyone" vs. "no one" first, add "some" once that works
- ❌ Zoom-dependent H3 resolution switching — ship one fixed resolution (9) first, add the res-7 zoomed-out view once cells render correctly at all
- ❌ Coverage-gap suggestion cards — nice-to-have on top of a working overlay, not required for it to demo
- ❌ Materializing `group_cell_coverage` as its own collection — compute on read; only optimize if it's actually slow live

### Red Flags (You've Gone Off Track)

🚩 **Trying to get real background tracking working on web** — it doesn't exist on iOS Safari without a native wrapper. Foreground `watchPosition` + Page Visibility pause/resume is the ceiling for this phase; don't burn hours fighting the platform.

🚩 **Skipping the client-side distance/time accept filter** — raw `watchPosition` callbacks are noisy; without a 25m/30s filter you'll drown in duplicate/jittery points and the fog will flicker instead of steadily revealing.

🚩 **Storing every GPS ping as its own document** — batch and compress into `location_traces` polylines; one doc per point will blow up write volume and Atlas costs for no benefit, since only the derived `user_visited_cells` matters long-term.

🚩 **Building group merge before one user's personal fog-of-war works** — prove a single trace → single user's revealed map end-to-end before touching multi-user aggregation.

🚩 **Debating H3 vs. geohash vs. raw grid for >1 hour** — H3 is decided (see `requirements.md` §6). Move on.

🚩 **Spending >6 hours on animation** — if it's not smooth by hour 20, it's not the bottleneck.

🚩 **Trying to be clever with the schema** — use simple, flat tables. Denormalize if it helps queries.

---

## Data Model

**New for the pivot** (full spec in `requirements.md` §3 and §5-6): `location_traces` (compressed GPS polylines, personal, 30-day retention) and `user_visited_cells` (durable per-user H3 resolution-9 cell visitation — the only thing group overlays ever read). Group-level coverage is computed on read via aggregation, not its own stored collection, for this phase.

Everything below is the collection set that predates the pivot and stays as-is — `nodes`/`edges`/`trips` remain the backing for the manual-logging fallback path and for travel-time data cell visitation alone doesn't capture.

### Collections (MongoDB)

```javascript
// Users
{
  _id: ObjectId,
  auth0_id: "auth0|...",
  email: "fabio@example.com",
  display_name: "Fabio",
  created_at: Date,
  groups: [group_id, ...] // array of group IDs user is a member of
}

// Groups
{
  _id: ObjectId,
  name: "CMU CREW",
  creator_id: user_id,
  member_ids: [user_id, ...],
  created_at: Date,
  total_nodes_discovered: Number,
  total_edges_discovered: Number
}

// Nodes (Places)
{
  _id: ObjectId,
  group_id: group_id,
  name: "Lawrenceville",
  neighborhood: "Lawrenceville",
  lat: 40.4501,
  lng: -79.9585,
  place_type: "urban_core", // enum: urban_core, park, food, shopping, transit, residential, entertainment, unknown
  visit_count: 5,
  first_discovered_by: user_id,
  first_discovered_at: Date,
  created_at: Date
}

// Edges (Connections)
{
  _id: ObjectId,
  group_id: group_id,
  from_node_id: node_id,
  to_node_id: node_id,
  travel_mode: "bus", // enum: walk, bus, car, uber, train
  avg_duration_min: 31,
  traversal_count: 1,
  first_traveled_by: user_id,
  first_traveled_at: Date,
  created_at: Date
}

// Trips (Raw trip records)
{
  _id: ObjectId,
  group_id: group_id,
  user_id: user_id,
  from_node_id: node_id,
  to_node_id: node_id,
  started_at: Date,
  ended_at: Date,
  duration_min: 31,
  travel_mode: "bus",
  user_created_at: Date
}

// HeatPoints (Group heat map)
{
  _id: ObjectId,
  group_id: group_id,
  lat: 40.4501,
  lng: -79.9585,
  weight: 1.5, // cumulative dwell time or visit count
  recorded_at: Date
}

// UserHeatPoints (Individual heat map, PRIVATE)
{
  _id: ObjectId,
  group_id: group_id,
  user_id: user_id,
  lat: 40.4501,
  lng: -79.9585,
  weight: 1.5,
  recorded_at: Date
}

// UserPlaceTypeProfiles (Inferred taste)
{
  _id: ObjectId,
  user_id: user_id,
  place_type: "urban_core", // one record per place_type
  frequency_pct: 65,
  trip_count: 20,
  last_updated: Date
}

// Friends (Optional, for future)
{
  _id: ObjectId,
  user_id_1: user_id,
  user_id_2: user_id,
  status: "accepted", // enum: pending, accepted, blocked
  created_at: Date
}
```

### Indexes (Critical for Performance)

```javascript
// Nodes
db.nodes.createIndex({ group_id: 1, lat: 1, lng: 1 })
db.nodes.createIndex({ group_id: 1, place_type: 1 })

// Edges
db.edges.createIndex({ group_id: 1, from_node_id: 1, to_node_id: 1 })

// Trips
db.trips.createIndex({ group_id: 1, user_id: 1 })

// HeatPoints
db.heatpoints.createIndex({ group_id: 1, lat: 1, lng: 1 })

// UserHeatPoints
db.user_heatpoints.createIndex({ group_id: 1, user_id: 1 })
```

---

## Backend Endpoints (MVP Only)

**New for the pivot:**

- `POST /api/location/traces` — flush a buffered client-side polyline (see `requirements.md` §5). Backend decodes it, derives H3 cells, upserts `user_visited_cells`.
- `GET /api/groups/:groupId/coverage` — the three-tier fog-of-war overlay for a group: aggregates `user_visited_cells` over `member_ids`, classifies each returned cell as everyone/some (never enumerates "no one" cells explicitly — see `requirements.md` §6).
- `GET /api/groups/:groupId/suggestions` — coverage-gap suggestion cards: uncovered cells intersected with the places catalog.

Existing endpoints (`POST /api/trips`, `GET /api/groups/:groupId/graph`, friends/groups/recommendations routes) are unchanged and stay live as the fallback/complementary paths.

### POST `/api/trips`

**Request**:
```json
{
  "group_id": "507f1f77bcf86cd799439011",
  "from_lat": 40.4425,
  "from_lng": -79.9435,
  "to_lat": 40.4501,
  "to_lng": -79.9585,
  "duration_min": 31,
  "travel_mode": "bus"
}
```

**Response**:
```json
{
  "success": true,
  "new_node": { "id": "...", "name": "Lawrenceville", "place_type": "urban_core" },
  "new_edge": { "id": "...", "from": "CMU", "to": "Lawrenceville", "duration_min": 31 },
  "neighborhood_pct_before": 13,
  "neighborhood_pct_after": 18
}
```

**Logic**:
1. Validate Auth0 JWT from `Authorization: Bearer <token>` header
2. Resolve from_lat/lng to nearest existing Node (within 0.5km) or create new Node
3. Resolve to_lat/lng to nearest existing Node or create new Node
4. **Call Google Places API** for reverse geocode + place details → extract place_type
5. Check if Edge (from_node, to_node) exists for this group
   - If new: create Edge, fire discovery event
   - If exists: increment traversal_count, update avg_duration_min
6. Create Trip record
7. Insert HeatPoints for both start and end locations
8. Recompute UserPlaceTypeProfile (% of trips by place_type)
9. Recompute neighborhood % explored
10. Return response with discovery info

### GET `/api/groups/:groupId/graph`

**Request**: `GET /api/groups/507f1f77bcf86cd799439011/graph`

**Response**:
```json
{
  "nodes": [
    { "id": "...", "name": "CMU", "lat": 40.4425, "lng": -79.9435, "place_type": "urban_core", "visits": 15 },
    { "id": "...", "name": "Lawrenceville", "lat": 40.4501, "lng": -79.9585, "place_type": "urban_core", "visits": 2 }
  ],
  "edges": [
    { "id": "...", "from": "cmu_id", "to": "lawrenceville_id", "count": 1, "avg_duration": 31 }
  ],
  "heatpoints": [
    { "lat": 40.4425, "lng": -79.9435, "weight": 1.2 },
    ...
  ],
  "neighborhoods": {
    "Oakland": { "pct": 94, "discovered": 8, "total": 9 },
    "Shadyside": { "pct": 71, "discovered": 7, "total": 10 },
    "Lawrenceville": { "pct": 18, "discovered": 2, "total": 11 }
  }
}
```

**Logic**:
1. Fetch all Nodes for group_id
2. Fetch all Edges for group_id
3. Fetch all HeatPoints for group_id
4. Compute neighborhood % explored (sum discovered nodes / sum total candidate nodes per neighborhood)
5. Return all three

### GET `/api/users/:userId/profile`

**Request**: `GET /api/users/user_123/profile`

**Response**:
```json
{
  "user_id": "user_123",
  "display_name": "Fabio",
  "place_type_preferences": [
    { "place_type": "urban_core", "frequency_pct": 65 },
    { "place_type": "food", "frequency_pct": 20 },
    { "place_type": "park", "frequency_pct": 15 }
  ],
  "total_trips": 20,
  "total_discovery": 8
}
```

**Logic**:
1. Fetch UserPlaceTypeProfile records for user_id
2. Sort by frequency_pct descending
3. Return top 3 + stats

### Error Handling

- 401 Unauthorized: invalid JWT
- 400 Bad Request: missing fields (from_lat, to_lat, etc.)
- 500 Internal Server Error: Google API call failed, MongoDB error, etc.

Always return `{ success: false, error: "..." }` on failure.

---

## Frontend Components (MVP Only)

**New for the pivot:**

- **LocationTracker** (hook/provider) — requests permission, runs `watchPosition` with the accept filter, pauses/resumes on `visibilitychange`, buffers fixes, flushes to `POST /api/location/traces` every ~60s.
- **FogOverlayLayer** — a Leaflet layer rendering H3 cells (`cellToBoundary` → GeoJSON) styled by tier; swaps resolution 9 ↔ 7 on zoom.
- **SuggestionCards** — renders `GET /api/groups/:groupId/suggestions` results.

Existing components (`GroupMapView`, `TripLoggerModal`, `DiscoveryReveal`, `NeighborhoodStats`, `FriendsPanel`, `GroupsPanel`, `RecommendationsPanel`, `ProfileModal`) are all already shipped and unaffected — `TripLoggerModal` stays as the manual fallback entry point into the same cell-derivation pipeline.

### 1. GroupMapView

**Props**: `groupId` (from URL or context)

**State**: `nodes`, `edges`, `heatpoints`, `neighborhoods`, `loading`, `selectedNode`

**What it does**:
- Renders Google Map centered on Pittsburgh
- Overlays heatmap layer (HeatPoints)
- Renders d3-force graph on top (nodes as circles, edges as lines)
- Displays neighborhood % bars on sidebar
- Calls `GET /api/groups/:groupId/graph` on mount

**User interaction**:
- Click "Log trip" button → opens TripLoggerModal
- Click a node → shows stats for that node (optional)

### 2. TripLoggerModal

**Props**: `isOpen`, `onClose`, `onSubmit`, `groupId`

**State**: `fromLocation`, `toLocation`, `duration`, `travelMode`

**What it does**:
- Form with two location pickers (autocomplete or map click)
- Duration slider (5–120 min)
- Travel mode dropdown (walk, bus, car, uber, train)
- Submit button

**User interaction**:
- Click on map to select from/to locations (or type in search)
- Submit → `POST /api/trips` → on success, close modal and trigger DiscoveryReveal

### 3. DiscoveryRevealAnimation

**Props**: `discoveryData` (from trip submission response)

**What it does**:
- Toast slides in from bottom: "Fabio expanded your Drift."
- % bars animate updating: "Lawrenceville 13% → 18%"
- New edge animates drawing on graph
- Toast shows: "New connection: CMU → Lawrenceville, 31 min"
- Auto-dismisses after 5 seconds

**Animation timing**:
- 0–300ms: Toast slides in
- 300–800ms: % bar animates
- 800–1500ms: Edge draws on graph
- 1500–5000ms: Hold on screen
- 5000ms+: Fade out

This is the **hero moment**. Make it smooth.

### 4. NeighborhoodStats

**Props**: `neighborhoods` (from GroupMapView)

**What it does**:
- Sidebar showing each neighborhood: name + % explored bar + node count
- Sorted by % (highest first)
- Shows overall city exploration % at top

### 5. Layout (App.tsx)

```tsx
export default function App() {
  const { isAuthenticated, user } = useAuth0();
  
  if (!isAuthenticated) return <LoginPage />;
  
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{ flex: 1 }}>
        <GroupMapView groupId={groupId} />
      </div>
      <aside style={{ width: "300px", borderLeft: "1px solid #ccc", overflow: "auto" }}>
        <NeighborhoodStats neighborhoods={neighborhoods} />
        <button onClick={() => setShowTripLogger(true)}>Log trip</button>
      </aside>
      <TripLoggerModal
        isOpen={showTripLogger}
        onClose={() => setShowTripLogger(false)}
        onSubmit={handleLogTrip}
        groupId={groupId}
      />
    </div>
  );
}
```

---

## Demo Script

**Duration**: 5–7 minutes

**Setup** (before live demo starts):
- Browser open to localhost:3000 (or deployed Vultr URL)
- Logged in as a test user (e.g., fabio@test.com)
- GroupMapView showing ~50–60 nodes pre-seeded across Pittsburgh
- Heat map visible showing density around CMU, Oakland, Shadyside
- Graph edges visible showing major connections

**Flow**:

1. **Open**: "This is Drift. You and your friends explore a city together. The app turns your real movements into a shared map of where your group has been."

2. **Show the map** (30 sec): "Here's the CMU CREW's Pittsburgh. 31% of the city explored. Notice the dense core around CMU and Oakland — that's where we hang out. The edges show how we get between places."

3. **Show neighborhoods** (15 sec): "Each neighborhood has a % explored. We've hit Oakland hard, but Lawrenceville is pretty sparse. Let's change that."

4. **Log a trip** (2 min):
   - Click "Log trip" button
   - Modal opens
   - Select "CMU" as from, "Lawrenceville" as to
   - Duration: 31 minutes, mode: bus
   - Click submit

5. **Watch the animation** (3 min):
   - Toast slides in: "Fabio expanded your Drift."
   - % bar updates: "Lawrenceville 13% → 18%"
   - New edge draws on the graph: CMU → Lawrenceville
   - Toast shows: "New connection: CMU → Lawrenceville, 31 min"
   - Graph visibly more connected
   - (Let it sit for ~2 seconds, admire it)

6. **Narrate the insight** (1 min): "This is Drift. You don't write reviews. You don't create posts. Your behavior IS the content. Every trip you take — going to class, grabbing food, heading to a party — gets logged. Over time, you and your friends build a collective understanding of your city. And the more you explore, the better the app understands what you like, so it can recommend new places."

7. **(Optional, if time)** Open "User profile" → show your personal heat map (private to friends), your taste profile (65% urban, 20% food, 15% parks).

8. **Close**: "That's Drift. In 24 hours."

---

## Minimum Viable Scope (Emergency Cutdown)

**If you're behind schedule**, cut in this order:

### Level 1: Full MVP (Target)
- ✅ Group graph view + Google heatmap
- ✅ Discovery reveal animation
- ✅ Trip logging (demo data)
- ✅ Backend endpoints working
- ✅ Frontend-backend integration

### Level 2: Skip Recommendation Engine (–1 hour)
- ❌ Hardcode all nodes as place_type="unknown"
- ❌ Skip Google Places API categorization
- ❌ Skip UserPlaceTypeProfile computation
- ✅ Still do discovery reveal (new nodes/edges still fire)

### Level 3: Skip Individual Views (–2 hours)
- ❌ Remove user heat maps entirely
- ❌ Remove "view friend's data" option
- ✅ Keep group graph view, group heatmap

### Level 4: Skip Friends List (–1 hour)
- ❌ Remove friends management UI
- ❌ Skip privacy checks in backend
- ✅ Everyone sees all group data

### Level 5: Skip Custom Polylines (–1 hour)
- ❌ Don't store or visualize trip paths
- ✅ Just show nodes as points on map
- ✅ Edges as straight lines between points

### Level 6: Skip Live Trip Logging (–2 hours)
- ❌ Remove trip logger form
- ✅ Demo with pre-logged data only (hardcode a trip in the demo script)

### Level 7: Skip Stats Recomputation (–1 hour)
- ❌ Don't recompute % explored after each trip
- ✅ Hardcode stats for demo data
- ✅ Still show the % bars, just static

**If you hit Level 7 and still behind**: Deploy what you have. The graph + heatmap + discovery animation loop is the proof of concept. Without it, nothing else matters.

---

## Critical Paths to Monitor

**By hour 8**: Backend team should have POST `/api/trips` endpoint returning data (no Google API yet is fine).

**By hour 12**: Frontend team should have Google Map rendering + d3 graph overlaid. Backend should have Google API calls working.

**By hour 14**: Full integration test: log a trip in the UI → backend processes → response comes back → frontend re-renders.

**By hour 18**: Discovery animation smooth and tested.

**By hour 22**: Deployed to Vultr and working.

If any of these slip, you've gone off track. Escalate immediately.

---

## Comms & Standups

- **Hour 0**: 15 min kickoff (everyone reads this guide, defines blockers)
- **Hour 4**: 10 min standup (demo data loaded? Backend skeleton up? Frontend running?)
- **Hour 8**: 10 min standup (Google API working? Frontend connected?)
- **Hour 12**: 10 min standup (everything integrated? Any blocking bugs?)
- **Hour 16**: 10 min standup (animation looking good? Ready to polish?)
- **Hour 20**: 10 min standup (deployed? Any last fixes?)
- **Hour 23**: 5 min final check (demo runs top-to-bottom, no crashes)

---

## Glossary

| Term | Definition |
|------|-----------|
| **H3 cell** | A hexagonal spatial index unit (Uber's H3 library); resolution 9 (~0.1 km²) is the base "visited" unit, resolution 7 (~5 km²) is used zoomed out |
| **Fog-of-war** | The visual metaphor: unexplored cells stay covered, visited cells are revealed |
| **Visited cell** | An H3 cell a user has physically entered at least once (`user_visited_cells`) |
| **Coverage tier** | One of three group-overlay states for a cell: everyone-visited, some-visited, no-one-visited |
| **Coverage-gap suggestion** | An unvisited ("no one") cell that contains a catalogued place, surfaced as a "go here next" card |
| **Trace** | A compressed polyline of a user's accepted GPS fixes over a tracking session (`location_traces`) |
| **Accept filter** | The client-side rule (≥25m moved or ≥30s elapsed) that decides whether a raw GPS fix is kept |
| **Node** | An area/neighborhood the group has visited (e.g., "Oakland", "Lawrenceville") — kept for the manual-logging fallback path |
| **Edge** | A journey between two nodes (e.g., "CMU → Lawrenceville, 31 min") — kept for the fallback path |
| **Trip** | A raw user submission of traveling from point A to point B — now a fallback data source into `user_visited_cells`, not the primary loop |
| **Place type** | Category inferred from Google Places API or the curated catalog (urban_core, park, food, shopping, transit, residential, entertainment) |
| **Taste profile** | User's inferred preference (% trips by place_type) |
| **Critical path** | The demo loop: track location → cells reveal → group overlay merges → suggestion surfaces |
| **MVP** | Minimum viable product: one user's personal fog-of-war working end-to-end, then group merge on top |

---

## FAQ

**Q: What if Google Places API is rate-limited?**
A: Cache the responses aggressively. For each lat/lng pair, store the API response in a "google_places_cache" collection. Before calling the API, check if we've already categorized this lat/lng. For a 24-hour hackathon with ~100 nodes, you should be fine on free tier.

**Q: What if MongoDB is slow?**
A: Indexes are critical (see Data Model section). Denormalize if needed — store place_type on Node when you first categorize it, don't compute it every time.

**Q: What if the animation is janky?**
A: Use CSS transitions (`transition: all 0.5s ease`) or requestAnimationFrame. Avoid DOM thrashing (don't re-render on every animation frame). Use d3's `.transition()` for smooth graph updates.

**Q: What if we run out of time?**
A: Cut in this priority order: (1) recommendation engine, (2) individual views, (3) friends list, (4) polylines. Keep the core loop at all costs.

**Q: Can I build this alone?**
A: Possible but not recommended. The backend + Google API integration + frontend animation + deployment is 5–6 people's worth of work compressed into 24 hours. Parallelization is essential.

**Q: What if we deploy to Vercel/Netlify instead of Vultr?**
A: Frontend: totally fine, deploy to Vercel/Netlify. Backend: trickier (Vercel functions have cold-start latency, MongoDB query overhead on free tier). For a hackathon, Vultr VPS is simpler.

**Q: Should we use TypeScript?**
A: For a 24-hour build, no. Use JavaScript. TypeScript adds compile-time overhead. Focus on shipping.

---

## Go-Live Checklist (Hour 23)

- [ ] Backend deployed to Vultr (PM2 running, auto-restart on crash)
- [ ] Frontend built and deployed (static hosting or Vercel)
- [ ] Auth0 redirect URIs updated to production URLs
- [ ] MongoDB connection string using production cluster
- [ ] All API endpoints tested with Postman / curl
- [ ] Demo script rehearsed (log trip, watch animation, end-to-end)
- [ ] No console errors in browser DevTools
- [ ] No backend errors in PM2 logs
- [ ] Slow internet test (simulate 3G, verify animation still plays)
- [ ] Demo data pre-loaded (don't rely on seed script running live)
- [ ] Backup demo account ready (in case first one fails)
- [ ] Slides or talking points printed (for judges' questions)

---

**Good luck. Ship it.**
