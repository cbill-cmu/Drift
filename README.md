# Drift

Hackathon build, pivoting from manual trip logging to **continuous location tracking + a fog-of-war exploration overlay** for Pittsburgh groups, with Auth0 login.

**One sentence:** Continuous movement → private fog-of-war explored map → group overlay of who's-been-where → **surfaced suggestions for where the group hasn't gone yet**.

**Team size:** 4 people. See roles below. This README reflects **current `main`** (code is source of truth) plus the location-tracking pivot described in [`requirements.md`](requirements.md) and [`DRIFT_PROJECT_GUIDE.md`](DRIFT_PROJECT_GUIDE.md).

---

## Current status (as of latest `main`)

### Done — pre-pivot foundation (all shipped, unaffected by the pivot)

| Area | What shipped |
|------|----------------|
| **Auth0** | Tenant + SPA login; backend JWT **JWKS-verified** (not decode-only) |
| **Groups** | Create, switch, friend-only invites (`GroupsPanel`, `GroupInvitesPanel`) |
| **Friends** | Full add/accept/unsend API + UI |
| **Recommendations** | Taste-based cards (`RecommendationsPanel`) from `user_place_type_profiles` |
| **Places catalog** | Curated Pittsburgh places (`shared/pittsburgh-places/`), backend service |
| **Map** | Leaflet + Esri tiles (not canvas anymore), nodes/edges/heat overlay |
| **Profile** | `ProfileModal` — nickname (optional) + group management, no forced onboarding step |
| **Discovery reveal** | Real auto-dismiss + entrance/exit animation (not a static stub; currently untriggered until the GPS pipeline wires a caller) |

**Manual trip logging has been deleted, not kept as a fallback.** `TripLoggerModal`, `useTrip.js`, and the "Log trip" dock button are gone — GPS tracking is the only path in. `POST /api/trips` still exists on the backend (schema/service untouched) but has no frontend caller anymore.

### The pivot — status

**Done:** Phase 0 setup — `h3-js` added to both `package.json`s, `location_traces`/`user_visited_cells` collections + indexes in `shared/mongodb-schema.js`, verified working against real coordinates. See `TASKS.md` for the full phase breakdown.

**Not yet built (priority order):**

1. **Location tracking pipeline** — GPS permission flow, `watchPosition` + accept filter, buffered flush to `POST /api/location/traces` (see `requirements.md` §5)
2. **H3 cell derivation** — backend decodes traces, upserts `user_visited_cells` (§5-6)
3. **Group coverage aggregation** — `GET /api/groups/:groupId/coverage`, three-tier classification (§6)
4. **Fog-of-war rendering** — Leaflet overlay layer, H3 cell → GeoJSON, zoom-dependent resolution (§6)
5. **Coverage-gap suggestions** — uncovered cells ∩ places catalog → suggestion cards (§6)
6. **Privacy controls** — per-group opt-out of contributing cell data (§8)
7. **Deploy** — Vultr + PM2 + production Auth0 callbacks (still open, unrelated to the pivot)

### Demo group (seed)

- **group_id:** `6aa507373e4c8b8fc47e6428` (also `VITE_DEMO_GROUP_ID`) — re-check via `npm run verify` after any seed reload, IDs drift
- **group_name:** `CMU CREW`
- Details: [`shared/mongodb-seed/HANDOFF.md`](shared/mongodb-seed/HANDOFF.md)

---

## Tech stack

| Layer | Choice | Notes |
|-------|--------|--------|
| Frontend | React + Vite + Leaflet | Esri tiles, not canvas |
| Location tracking | Browser `Geolocation` API | Foreground only — no OS background tracking without a native wrapper (honest limitation, see `requirements.md` §5) |
| Spatial indexing | **H3** (`h3-js`) | New dependency for the pivot — not yet added to either `package.json` |
| Backend API | Node.js + Express | Trips + graph + groups + friends + recs against Atlas; new location/coverage endpoints pending |
| Database | **MongoDB Atlas** (M0 free) | New collections pending: `location_traces`, `user_visited_cells` |
| Auth | Auth0 + JWT | JWKS-verified |
| Places | Google Places (optional) + curated catalog | Catalog doubles as the suggestion source |
| Hosting | Vultr for API/UI later | DB stays on Atlas |

---

## Four-person ownership

| Person | Role | Owns | Does not own |
|--------|------|------|----------------|
| **1** | Backend | `backend/` | Frontend UI, Auth0 tenant console |
| **2** | Frontend | `frontend/` | Express routes, seed scripts |
| **3** | Auth + Demo data | `shared/` (Auth0/Atlas docs, seed, fixtures) | Vultr cutover (support P4), backend/frontend feature code |
| **4** | Integration + Deploy | E2E testing, cross-cutting fixes, `shared/deployment/` | Owning one vertical alone |

**Rules**

- P1/P2 treat `shared/api-contract.md` + `mongodb-schema.js` as locked unless the team agrees to change.
- P3 does not merge large edits into `backend/src` or `frontend/src` without pairing.
- P4 can open fix PRs anywhere when unblocking E2E or deploy; keep PRs small.

```
backend/   # Person 1
frontend/  # Person 2
shared/    # Person 3 (seed/docs) + Person 4 (deployment/)
```

---

## Quick start (all four)

```bash
git clone https://github.com/cbill-cmu/Drift.git
cd Drift
git pull origin main

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp shared/mongodb-seed/.env.example shared/mongodb-seed/.env
```

Fill Auth0 + `MONGODB_URI` (never commit `.env`).

| Who | Commands |
|-----|----------|
| P1 | `cd backend && npm install && npm run dev` → `:3000` |
| P2 | `cd frontend && npm install && npm run dev` → `:5173` |
| P3 | `cd shared/mongodb-seed && npm install && npm run verify` |
| P4 | Confirm both servers + login → map → trip with P1/P2 |

Frontend needs a **reachable** `VITE_API_BASE_URL` (Person 1’s machine or shared host). Empty map almost always means API not running.

---

## Docs map

| Doc | Purpose |
|-----|---------|
| [STATUS / this README](README.md) | Live status + roles |
| [requirements.md](requirements.md) | Requirements checklist with current `[x]` / `[~]` / `[ ]` |
| [GITHUB_WORKFLOW.md](GITHUB_WORKFLOW.md) | Branches, ownership, remaining work |
| [DRIFT_PROJECT_GUIDE.md](DRIFT_PROJECT_GUIDE.md) | Product, demo script, architecture |
| [shared/PERSON3_RUNBOOK.md](shared/PERSON3_RUNBOOK.md) | Auth/seed health |
| [shared/PERSON4_RUNBOOK.md](shared/PERSON4_RUNBOOK.md) | E2E + deploy |
| [shared/api-contract.md](shared/api-contract.md) | HTTP contract |
| [shared/auth0-setup.md](shared/auth0-setup.md) | Auth0 |
| [shared/atlas-setup.md](shared/atlas-setup.md) | Atlas |

## MongoDB Atlas

Primary DB is **Atlas free tier** (no GitHub Education required for M0). Keeps the project on the Atlas hackathon track.
