# Drift — Complete Project Guide for Hackathon

**Hackathon build. Pittsburgh / CMU scoped.**

> **Status sync (4-person team, current `main`):**  
> Shipped: Atlas seed, Auth0 login, Express trips + graph APIs, canvas map, trip logger, basic discovery toast.  
> Next: Person 4 drives E2E; Person 2 polishes discovery; Person 1 hardens JWT; then Vultr deploy.  
> Live checklist: root [`README.md`](README.md) + [`requirements.md`](requirements.md). This guide keeps product/demo/architecture detail.

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

**One sentence:** Movement → Nodes/Edges → Shared group graph → "someone unlocked something" moment → **recommendations based on your taste**.

**The core loop:**
1. User logs a trip (from point A to point B)
2. Backend resolves coordinates to nearest nodes + calls Google Places API to categorize them
3. System detects new nodes/edges and fires a discovery event
4. Frontend animates the reveal: "Fabio expanded your Drift. Lawrenceville 13% → 18%. New connection: CMU → Lawrenceville, 31 min"
5. User's personal heat map + taste profile get updated silently in the background

**What makes it Drift (not just Strava):**
- **Knowledge graph of connections**, not just heatmap
- **Taste-based recommendations** (learn what types of places each user likes, recommend similar ones)
- **Shared multiplayer world** (group graph is collective; personal heat maps private to friends)
- **Passive content generation** (behavior = data, no manual reviews)

---

## Requirements Summary

### Core Concept Constraints (Do Not Violate)

- The product is a **knowledge graph** (nodes + edges) rendered on top of a cumulative activity heat map.
- **Nodes** = areas/stops the group actually spent time in. Each has an inferred place type (urban, park, food, shopping, transit, residential, entertainment, unknown).
- **Edges** = journeys between nodes that someone in the group actually made.
- **Graph is shared per-group** ("multiplayer"). Individual contributions merge into one collective world.
- **Graph is also per-user** ("multiplayer privacy"):
  - **Group view**: everyone's contributions. Heat map public to group. Graph connections public to group.
  - **Individual view**: only your trips. Heat map (density) private to friends + self only. But which neighborhoods you visited is group-visible.
- Behavior generates content automatically — no manual reviews, posts, or itineraries.
- **Recommendation engine** (heuristic): infer user's place-type preferences from history; when they visit a new neighborhood, surface unvisited nodes matching their taste.

### Explicit Scope Cuts (Locked — Do Not Relitigate)

**Not building:**
- Real passive background location tracking
- Place metadata / reviews / hours (that's Yelp)
- Multi-city support beyond Pittsburgh
- Real-time multiplayer cursors / live presence
- Complex ML recommendation model

**Building instead:**
- Manual trip logging (demo data for hackathon)
- Auth0 integration (real user accounts)
- Google Places API (auto-categorization of nodes)
- Basic friends list (add via email or code)
- Basic group creation / join via code
- Heuristic recommendation (frequency-based place type matching)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
│                     (Auth0 login)                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                               │
│              React + Google Maps SDK                        │
│  ┌──────────────────┬────────────────┬────────────────┐    │
│  │   Group map      │   Trip logger  │  Discovery     │    │
│  │ Heat + graph     │  From/to       │  animation     │    │
│  │ overlay          │  picker        │  (PRIORITY)    │    │
│  └──────────────────┴────────────────┴────────────────┘    │
└─────────────────────────────────────────────────────────────┘
            ↓ (1. Log trip)           ↑ (4. Return new nodes/edges)
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API                              │
│            Node/Express on Vultr VPS                        │
│  1. Validate Auth0 JWT                                      │
│  2. Resolve trip coords → nearest nodes                     │
│  3. Call Google Places API → categorize (place_type)        │
│  4. Compute UserPlaceTypeProfile (taste)                    │
│  5. Save to MongoDB + cache heatpoints                      │
└─────────────────────────────────────────────────────────────┘
      ↓ (Save)           ↓ (Categorize)       ↓ (Retrieve)
   ┌──────────┐       ┌──────────────┐    ┌────────────────┐
   │ MongoDB  │       │ Google APIs  │    │  Auth0         │
   │ (users,  │       │ (Places +    │    │  (JWT check)   │
   │  groups, │       │   Maps)      │    └────────────────┘
   │  nodes,  │       └──────────────┘
   │  edges,  │
   │  trips)  │
   └──────────┘
```

### Critical Path (The Demo Flow)

This is what you're demoing in the final 30 seconds:

1. **Open group map** — dense heat/graph core around CMU, Oakland, Shadyside. Sparse at edges (Lawrenceville, South Side).
2. **User logs a trip** (Fabio traveled from CMU → Lawrenceville, 31 min).
3. **Backend processes**:
   - Resolves CMU & Lawrenceville to nodes
   - Calls Google Places API (Lawrenceville = urban_core)
   - Detects: new edge created (CMU → Lawrenceville)
   - Returns to frontend: `{ new_edge: true, neighborhood: "Lawrenceville", prev_pct: 13, new_pct: 18 }`
4. **Frontend animates**:
   - Toast appears: "Fabio expanded your Drift."
   - % bars update: Lawrenceville 13% → 18%
   - New edge draws on graph with smooth animation
   - Toast shows travel time + connection
5. **Graph visibly more connected** than before. Demo ends.

If this loop works and animates well, **you win**. Everything else is secondary.

---

## Tech Stack (Locked)

| Component | Decision | Why |
|-----------|----------|-----|
| **Frontend** | React + Vite or Next.js | Fast dev loop, component reusability |
| **Backend** | Node.js + Express | Fast to build, easy Google API integration |
| **Database** | MongoDB (Atlas free tier or Vultr-hosted) | Flexible schema, easy to scale, good for graph-like data |
| **Auth** | Auth0 | Production-ready, handles JWT, no auth plumbing |
| **Maps** | Google Maps API (tiles + heatmap layer) | Native heatmap rendering, no custom tile work |
| **Place categorization** | Google Places API (reverse geocoding + place details) | Automatic tagging (urban/park/food/shopping/transit/residential/entertainment) |
| **Graph visualization** | d3-force or canvas overlay on Google Map | d3-force if you want force-directed layout; canvas if you want simplicity |
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

### Skip These (Core Loop First)

- ❌ Recommendation engine (hardcode all nodes as place_type="unknown" if needed)
- ❌ Individual views / personal heat maps (group view only)
- ❌ Friends list (skip privacy filtering entirely)
- ❌ Custom polylines / trip path visualization (just show nodes as points)
- ❌ Live trip logging (use pre-seeded demo data)
- ❌ Leaderboards, frontier view, travel-mode-specific styling
- ❌ Eleven Labs audio or Solana blockchain

### Red Flags (You've Gone Off Track)

🚩 **Spending >3 hours on Auth0** — should be 30 min (create app, set redirects, add JWT middleware).

🚩 **Trying to build a custom map** — use Google Maps API, 1 hour done.

🚩 **Debating graph library for >2 hours** — pick d3-force or canvas and move on.

🚩 **Building real passive location tracking** — that's 8+ hours. Use fake trips.

🚩 **Implementing privacy / friends system before core loop works** — lock the core first.

🚩 **Spending >6 hours on animation** — if it's not smooth by hour 20, it's not the bottleneck.

🚩 **Trying to be clever with the schema** — use simple, flat tables. Denormalize if it helps queries.

---

## Data Model

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
| **Node** | An area/neighborhood the group has visited (e.g., "Oakland", "Lawrenceville") |
| **Edge** | A journey between two nodes (e.g., "CMU → Lawrenceville, 31 min") |
| **Trip** | A raw user submission of traveling from point A to point B |
| **Place type** | Category inferred from Google Places API (urban_core, park, food, shopping, transit, residential, entertainment) |
| **Heat map** | Density visualization of where the group has spent time |
| **Discovery** | Event fired when a new node or edge is created (triggers reveal animation) |
| **Taste profile** | User's inferred preference (% trips by place_type) |
| **Critical path** | The demo loop: log trip → backend processes → frontend animates |
| **MVP** | Minimum viable product: group graph + heatmap + discovery animation + trip logging |

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
