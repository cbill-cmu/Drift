# Drift — Requirements (Revised)

Hackathon build. Time limit: 24 hours. Pittsburgh / CMU scoped.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[cut]` descoped

---

## 0. One-sentence product definition

Movement → Nodes/Edges → Shared group graph → "someone unlocked something" moment → **recommendations based on your taste**.

If a feature doesn't serve this sentence, it is out of scope for the 24-hour build.

---

## 1. Core concept constraints (do not violate these)

- The product is a **knowledge graph of places and connections** rendered on top of a cumulative activity heat map. The heat map alone is not the product — it's texture/background (density of time spent). The graph (nodes + edges) is what makes it Drift and not just Strava heatmap. Never ship a screen where the heat map is the only layer with no graph on it.
- **Nodes** = areas/stops the group has actually spent time in (not businesses, not addresses). Each node has an inferred type tag (see §3).
- **Edges** = a journey between two nodes that someone in the group has actually made. No edge exists until someone travels it.
- The graph is **shared per-group and per-user** ("multiplayer"):
  - **Group view**: everyone's contributions merge into one collective world.
  - **Individual view**: only your trips + your discovered nodes/edges, visible to you always. Your personal heat map (density) is private to friends only. But which neighborhoods you've *visited* (existence, not heat) is visible to all group members.
- Behavior generates content automatically — no manual reviews, posts, or itineraries required from the user (Strava principle: the activity IS the content).
- "% explored" is a **derived stat** off the graph (not a separately built feature). Don't build two systems for this.
- **Recommendation engine**: passively infer user's place-type preferences (urban, parks, food, commercial, etc.) from their historical trips. When they visit a new area/neighborhood, surface top recommendations matching their taste profile.

---

## 2. Explicit scope cuts (locked — do not relitigate mid-hackathon)

**Not building:**
- [cut] Real passive background location tracking (battery-safe, always-on GPS)
- [cut] Place metadata / reviews / hours / categories (that's Yelp)
- [cut] Multi-city support beyond Pittsburgh — hardcoded neighborhoods
- [cut] Real-time multiplayer cursors / live presence
- [cut] Social following / friending UI beyond a basic friends list (no private messages, no feeds)
- [cut] Complex ML recommendation model — simple heuristic is enough (frequency of place type in user's history)

**Building instead:**
- [ ] Manual or semi-manual trip logging (see §4)
- [ ] Auth0 integration for real user accounts
- [ ] Predefined Pittsburgh neighborhood/area node list + place-type taxonomy (urban, park, food, shopping, residential, etc.)
- [ ] Preloaded fake trip history so the graph isn't empty on stage
- [ ] Basic friends list (add via email or code)
- [ ] Basic group creation / join via code
- [ ] Heuristic recommendation: surface nodes in user's visited neighborhoods that match their top 3 place types

---

## 3. Data model

```
User       { id (auth0), email, display_name, created_at }

Friend     { id, user_id_1, user_id_2, status }
           -- bidirectional; status = pending / accepted / blocked

Group      { id, name, creator_id, member_ids[], created_at }
           -- manually created, invite-only. Members can add trips to group.

Node       { id, group_id, name, neighborhood, lat, lng,
             place_type, visit_count, first_discovered_by,
             first_discovered_at }
           -- place_type one of: urban_core, park, food, shopping,
           -- residential, transit, mixed_use, unknown
           -- inferred from location clustering / manual seed data

Edge       { id, group_id, from_node_id, to_node_id,
             travel_mode, avg_duration_min, traversal_count,
             first_traveled_by, first_traveled_at }

Trip       { id, group_id, user_id, from_node_id, to_node_id,
             started_at, ended_at, duration_min, travel_mode,
             polyline_geojson?, user_created_at }
           -- each trip contributes to nodes/edges and heat maps

HeatPoint  { id, group_id, lat, lng, weight, recorded_at }
           -- cumulative GROUP heat map (all users)

UserHeatPoint { id, group_id, user_id, lat, lng, weight,
                recorded_at }
           -- individual user's heat map (private to friends + self only)

UserPlaceTypeProfile { id, user_id, place_type, frequency_pct,
                       last_updated }
           -- derived: % of user's trips by place type.
           -- e.g., { user_id: 42, place_type: urban_core, frequency: 65% }
           -- recomputed after each new trip
```

Notes:
- [x] **Place type taxonomy**: using Google Places API types. Heuristic: map Place Type categories to 6-8 main types:
  - `urban_core`: premise_type=locality + high density
  - `park`: parks, nature_reserves, campgrounds, etc.
  - `food`: restaurants, cafes, food courts
  - `shopping`: shopping_mall, supermarket, retail
  - `transit`: bus_station, subway_station, train_station, airport
  - `residential`: residential_area, neighborhood
  - `entertainment`: museum, theater, stadium, library
  - `unknown`: anything else or uncategorized
- [ ] **Google Places API integration**: on node creation, reverse geocode lat/lng to get Place details, extract category/type, assign to node.
- [ ] **Privacy model**: `HeatPoint` is group-shared. `UserHeatPoint` filtered by friendship: only visible to user + their friends. Node/Edge existence is always group-visible (which neighborhoods you've been to), but your personal density is private.
- [ ] **Coarse grid snapping vs. curated list**: lean curated list (~40–60 predefined Pittsburgh micro-areas).

---

## 4. Authentication & users

- [x] **Auth0 integration** — real user login, no fake accounts. Use Auth0 login page + JWT tokens.
- [ ] First-time user flow: sign up → create or join a group.
- [ ] User profile: display name, email, friends list, groups list.

---

## 5. Trip logging (input method)

Pick one primary method, ideally both if time allows:

- [ ] **Simulated/manual entry**: click-to-click on a map UI ("I went from here to here"), or a form (from, to, mode, duration).
- [ ] **Live demo mode**: single button "start trip" / "end trip" using browser/phone geolocation, logs a real edge live on stage.
- [ ] **Preloaded dataset**: script to generate ~2 weeks of fake trips across 10 fake users (via Auth0 test accounts or synthetic data) so the group graph looks populated.

---

## 6. Discovery logic & stats computation

- [ ] On new trip submit: resolve from/to raw coords to nearest Node (existing or new).
- [ ] If Node doesn't exist for this group:
  - Call **Google Places API** (reverse geocode + place details) at lat/lng
  - Extract place name + category/type
  - Map API category to one of 8 place types (urban_core, park, food, shopping, transit, residential, entertainment, unknown)
  - Create Node with inferred `place_type`
  - Mark `first_discovered_by`, fire "new place" event
- [ ] If Edge (from_node, to_node) doesn't exist for this group → create it, mark `first_traveled_by`, fire **"new connection discovered"** event.
- [ ] If Node/Edge exists → increment `visit_count` / `traversal_count`, update rolling `avg_duration_min`.
- [ ] **Recompute stats after each trip**:
  - % explored per neighborhood
  - Total city exploration % (how much of Pittsburgh has the group been to)
  - User's `UserPlaceTypeProfile` (% trips to urban vs. park vs. food, etc.)
- [ ] Log `HeatPoint` (group) and `UserHeatPoint` (individual) for visualization.

**Note**: Google Places API calls are rate-limited and have per-query costs. For hackathon demo, consider pre-seeding nodes (avoid repeat API calls) or caching results. ~100–200 nodes over 24 hours should be fine on free tier.

---

## 7. Recommendation engine (heuristic version)

- [ ] After each trip, recompute `UserPlaceTypeProfile`: what are the user's top 3 place types by frequency?
- [ ] **Recommendation trigger**: when user opens group map, if there are unvisited nodes in any visited neighborhood, surface top 3–5 recommendations:
  - Filter unvisited nodes by place type (prioritize user's top 3 types)
  - Rank by: (1) match to user's type preference, (2) proximity to user's last location, (3) random tie-breaker
  - Show as a card: "We think you'd like this" + node name + place type + distance
- [ ] **Cross-city recommendation** (stretch): if user visits a new city in future, seed recommendations by their type profile learned from Pittsburgh.

---

## 8. Privacy model

- [ ] `UserHeatPoint` (individual density) is **private to user + their friends only**. Visible as a layer in individual view or in group view if viewing a friend's data.
- [ ] Node/Edge existence is **always visible** to group members (which neighborhoods have been visited).
- [ ] User's trip history (individual `Trip` records) is **private to user + friends only**.
- [ ] Public leaderboard (if built): total nodes discovered, total edges traveled — aggregated across group, not per-user.

---

## 9. UI / screens

- [ ] **Group graph view** — single screen, two layers:
  - **Background**: cumulative group heat map (Strava-style) showing density of everywhere the group has been.
  - **Foreground**: force-directed-ish graph of nodes/edges (positioned at real lat/lng, so it aligns with heat map), sized/weighted by visit or traversal count.
  - Neighborhood % bars alongside (like the CMU CREW mock).
  - Recommendation card overlay (if applicable).
  - Tab/button to switch to individual view or friends list.

- [ ] **Individual view** (separate tab/screen from group view) — shows:
  - Same map base as group view (group heat map + group graph).
  - Overlay: user's personal trip history as a colored polyline (e.g., red lines).
  - User's personal heat map (cumulative density of their own activity, visible only to them).
  - Stats: total miles/trips logged, % of group discoveries attributed to them, most-visited personal node.
  - Option to view a friend's individual heat map (if friend relationship exists).

- [ ] **Discovery reveal moment** — animated toast/card on new node or new edge:
  - "Fabio expanded your Drift."
  - "Lawrenceville 13% → 18%"
  - "New connection: CMU → Lawrenceville, 31 min"
  - New edge draws itself on the graph.
  - **This is the single highest-priority UI element. Spend disproportionate design time here.**

- [ ] **Friends list** — simple screen:
  - My friends (accepted)
  - Pending friend requests (sent/received)
  - Add friend by email or friend code
  - Option to view friend's individual heat map

- [ ] **Groups list** — simple screen:
  - My groups
  - Group members + stats (total nodes, edges, exploration %)
  - Create new group
  - Join group via code

- [ ] **Trip logging screen** (whichever input method from §5).

- [ ] **Auth0 login** — redirect to Auth0 login page, handle callback.

---

## 10. Nice-to-haves (only after §1–§9 are demoable end-to-end)

- [ ] **Frontier** view — nearest unvisited node matching user's type profile.
- [ ] **Leaderboard** — most nodes/edges discovered per member (group-scoped, privacy-respecting).
- [ ] Travel-mode-specific edges (walk vs. bus vs. Uber) shown differently on graph.
- [ ] Sound/haptic on discovery moment.
- [ ] Place-type filters: show only urban nodes, only parks, etc.
- [ ] Time-series stats: "this week you explored 3 new neighborhoods."

---

## 11. Demo script (target)

1. Log in with Auth0 (or preloaded demo account).
2. Open group graph — dense heat/graph core around CMU, Oakland, Shadyside, sparse heat/edges toward periphery.
3. Trigger a trip (live phone demo or "Fabio did this yesterday").
4. Reveal animation plays: new node/edge, % updates, discovery toast.
5. Recommendation card appears: "We think you'd like this neighborhood — lots of urban areas here, matches your taste."
6. (Optional) Switch to individual view: show personal polyline + heat map, personal stats.
7. (Optional) Open friends list: show who has access to your data, view a friend's heat map.
8. Narrate: "Your personal data is private to friends. The group sees where you've been, but not the density. The more you explore, the better our recommendations get."

---

## 12. Open decisions

- [x] **Base map**: Google Maps API (tiles + heatmap layer)
- [x] **Place-type inference**: Google Places API (reverse geocode + categorize)
- [ ] Heat map rendering: Google Maps heatmap layer (native) or custom canvas overlay?
- [ ] Graph overlay: d3-force vs. just plot at real coords + straight lines/curves on top of Google Map?
- [ ] Individual view polyline: full geojson vs. just from/to nodes connected by straight line?
- [ ] Recommendation algorithm: frequency-based (simplest) or also incorporate distance/recency?
- [ ] **Critical**: Who owns the Google API integration (reverse geocoding + category mapping)? Should be tightly coupled with backend discovery logic.
- [ ] **Team split**: Frontend (map UI + graph viz) / Backend (discovery logic + Google API calls + MongoDB) / Demo data (pre-seed nodes + fake trips) / Auth (Auth0 setup)?

---

## 13. Tech stack (LOCKED)

- **Frontend**: TBD (React? Vue? Next.js?)
- **Backend**: TBD (Node/Express? Python? Go?)
- **Database**: MongoDB (Atlas or self-hosted)
- **Auth**: Auth0 + JWT tokens
- **Maps**: Google Maps API (tiles + heatmap layer)
- **Place type inference**: Google Places API (reverse geocoding + place details for categorization)
- **Hosting**: Vultr (or deploy backend to Vultr VPS)
- **Graph visualization**: d3-force or custom canvas (TBD)

---

## 14. API setup & cost notes

**Google Lab API credits:**
- [ ] Enable Google Maps API (JS SDK) for tiles + heatmap layer
- [ ] Enable Google Places API (Reverse Geocoding + Place Details) for place-type inference on node creation
- [ ] Set API key quotas to avoid surprise overages during demo
- [ ] Estimate: ~50–200 reverse geocode calls + place details calls over 24 hours should be well within free tier / lab credits

**Auth0:**
- [ ] Create Auth0 tenant + application (OAuth2 flow)
- [ ] Whitelist redirect URIs for localhost + production deploy URL
- [ ] Set up test accounts for demo day

**MongoDB:**
- [ ] Create cluster (Atlas free tier or Vultr-hosted)
- [ ] Define collections: users, groups, nodes, edges, trips, heatpoints, user_heatpoints, user_place_type_profiles, friends
- [ ] Index on: (group_id, user_id, lat/lng) for fast queries

**Vultr:**
- [ ] Deploy backend API (Node/Express or Python/Flask)
- [ ] Deploy frontend (static hosting or Node server)
- [ ] Consider: Can fit both on one $5–10/month Vultr instance for a hackathon

---

## 15. Minimum viable scope (if running behind)

If you're behind schedule, cut in this order (preserving the core):

**CORE (MUST SHIP):**
- Group graph view + Google heat map layer
- Discovery reveal animation ("new connection discovered")
- Trip logging (even if just fake demo data)
- Auth (even if simplified)

**Cut if behind (priority order):**
1. **Recommendation engine** → just show all unvisited nodes (skip Google Places API categorization, hardcode all nodes as "unknown")
2. **Individual views** → group view only, remove personal heat maps
3. **Friends list** → group members only, no friend privacy checks
4. **Google Places API** → skip reverse geocoding, hardcode place types or leave null
5. **Custom polylines** → just show from/to nodes as points, no path visualization
6. **Live trip logging** → preloaded demo data only (fake trips for demo account)
7. **Stats recomputation** → hardcode stats for demo data instead of computing dynamically

**If you have time (add in this order):**
1. Recommendation engine + Google Places categorization
2. Individual views + personal heat maps
3. Friends list + privacy filtering
4. Custom polylines / path visualization
5. Leaderboard / stats per member
