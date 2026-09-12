# Drift — Requirements (Revised)

Hackathon build. Pittsburgh / CMU scoped.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[cut]` descoped

**Last synced to `main` for a 4-person team.** Code wins over this file if they disagree — update checkboxes when you merge.

---

## 0. One-sentence product definition

Movement → Nodes/Edges → Shared group graph → "someone unlocked something" moment → **recommendations based on your taste**.

If a feature doesn't serve this sentence, it is out of scope for the hackathon build.

---

## Team (4 people)

| Person | Role | Status focus |
|--------|------|----------------|
| 1 | Backend | JWKS auth, profile/recs, API hardening |
| 2 | Frontend | Discovery polish, trip→toast→refresh loop |
| 3 | Auth + seed | Keep Atlas/Auth0 healthy; prod Auth0 URLs |
| 4 | Integration + deploy | E2E critical path, then Vultr |

---

## 1. Core concept constraints (do not violate)

Unchanged: knowledge graph on heat texture; nodes/edges from real trips; group + individual views; behavior-as-content; derived % explored; heuristic taste recommendations.

---

## 2. Explicit scope cuts (locked)

**Not building:**
- [cut] Real passive background location tracking
- [cut] Place metadata / reviews / hours (Yelp)
- [cut] Multi-city beyond Pittsburgh
- [cut] Real-time multiplayer cursors
- [cut] Complex ML recommendations
- [cut] Full Google Maps JS base map *(canvas map ships instead unless P2 adds tiles)*

**Building instead — status:**
- [x] Manual trip logging (form)
- [x] Auth0 integration (login/logout; server JWT verify still `[~]`)
- [x] Pittsburgh nodes + place-type taxonomy (seeded; Places API optional on create)
- [x] Preloaded fake trip history (Atlas seed)
- [~] Basic friends list (UI + fixtures; no real Friends API)
- [ ] Basic group create/join via code
- [ ] Heuristic recommendation cards in UI

---

## 3. Data model

Collections live in Atlas `drift` per `shared/mongodb-schema.js` (users, groups, nodes, edges, trips, heatpoints, user_heatpoints, user_place_type_profiles, friends).

Notes:
- [x] Place type taxonomy (8 types)
- [~] Google Places on node create (backend; needs API key; else `unknown`)
- [~] Privacy model (member graph exists; full friend privacy not enforced)
- [x] Curated / seeded Pittsburgh micro-areas (~95 discovered nodes)

---

## 4. Authentication & users

- [x] Auth0 SPA login + frontend callback
- [~] Backend JWT — Bearer present + decode; **JWKS signature verify TODO**
- [ ] First-time flow: sign up → create/join group
- [~] User profile fields on Auth0 user object; in-app profile screen incomplete

---

## 5. Trip logging

- [x] Manual form (from/to from graph, mode, duration)
- [cut] Live geolocation start/end (unless time remains)
- [x] Preloaded dataset (seed)

---

## 6. Discovery logic & stats

- [x] Resolve coords → nearest node / create node
- [~] Google Places categorize on create (optional key)
- [x] Create edge + discovery payload on new connection
- [x] Increment visit/traversal counts
- [~] Neighborhood % from totals + discovered counts
- [~] UserPlaceTypeProfile (seeded / partial on trip path)
- [x] HeatPoint writes on trips
- [~] UserHeatPoint (seeded; UI emphasis is group heat)

---

## 7. Recommendation engine

- [ ] Recompute profile after each trip (complete)
- [ ] Surface recommendation cards on map
- [cut] Cross-city stretch

---

## 8. Privacy model

- [~] Personal/member graph route exists
- [x] Node/edge existence group-visible
- [ ] Strict trip/heat privacy vs friends only
- [ ] Leaderboard

---

## 9. UI / screens

- [x] Group graph view — canvas heat + nodes/edges + neighborhood bars
- [~] Individual / friend map (member route + fixtures)
- [~] Discovery reveal — basic toast (**polish is P2 top priority**)
- [~] Friends list UI (add stubbed)
- [ ] Groups list create/join
- [x] Trip logging UI
- [x] Auth0 login / logout

---

## 10. Nice-to-haves

All still `[ ]` / cut until E2E + discovery polish are solid.

---

## 11. Demo script (target)

Still valid. Current blockers to a clean demo: **local E2E with API up**, **discovery polish**, **optional deploy**.

---

## 12. Open decisions (resolved vs open)

- [x] Stack: React/Vite + Express + Atlas + Auth0
- [x] Map rendering: **custom canvas** heatmap/graph (Google Maps JS optional later)
- [x] Graph positions: real lat/lng projection
- [x] Places ownership: **Person 1 backend**
- [x] Team split: **4 people** (see README)
- [ ] Recommendation ranking details
- [ ] Whether graph routes require JWT for demo

---

## 13. Tech stack (LOCKED)

- Frontend: React + Vite
- Backend: Node/Express
- Database: MongoDB Atlas
- Auth: Auth0 + JWT
- Maps UI: canvas overlay
- Place inference: Google Places (backend, optional key)
- Hosting: Vultr planned (Person 4); DB on Atlas

---

## 14. API / infra checklist

**Google:**
- [~] Places enabled for backend key (team-dependent)
- [ ] Maps JS SDK (only if P2 adds tiles)

**Auth0:**
- [x] Tenant + SPA + localhost callbacks
- [ ] Production URLs when deployed

**MongoDB:**
- [x] Atlas M0 + collections + seed + indexes

**Vultr:**
- [ ] Deploy API + frontend (Person 4)

---

## 15. Minimum viable scope (if behind)

**CORE (must demo):**
- [x] Group graph + heat (canvas)
- [~] Discovery reveal (exists; polish)
- [x] Trip logging + seed data
- [x] Auth0 login

**Cut order if needed:** recommendations → strict privacy → friends API → Places key → Maps JS → live geo → fancy stats.
