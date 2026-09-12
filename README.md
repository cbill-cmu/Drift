# Drift

Hackathon build: shared group knowledge graph of Pittsburgh trips (nodes + edges) on a heat map, with Auth0 login and a discovery reveal moment.

**One sentence:** Movement → Nodes/Edges → Shared group graph → "someone unlocked something" → taste-based recommendations.

**Team size:** 4 people. See roles below. This README reflects **current `main`** (code is source of truth).

---

## Current status (as of latest `main`)

### Done

| Area | What shipped |
|------|----------------|
| **Repo scaffold** | `backend/`, `frontend/`, `shared/` on GitHub |
| **MongoDB Atlas** | Free M0 cluster; DB name `drift` |
| **Seed data** | CMU CREW group, ~95 Pittsburgh nodes, trips/edges/heat; Lawrenceville kept sparse for demo |
| **Auth0** | Tenant + SPA login on frontend; env-based Domain / Client ID / Audience |
| **Backend API** | Express on `:3000`; `POST /api/trips`; `GET /api/groups/:groupId/graph`; member graph route; Mongo reads/writes |
| **Google Places** | Backend Nearby/Geocode when API key set; otherwise `place_type: unknown` |
| **Frontend** | Auth0 login/logout; canvas heatmap + graph map; trip logger; neighborhood stats; basic discovery toast; friends panel (partial) |
| **Contracts** | `shared/api-contract.md`, `shared/mongodb-schema.js` |

### Demo group (seed)

- **group_id:** `6aa4d5b78c6341a27ed90e4b` (also `VITE_DEMO_GROUP_ID`)
- **group_name:** `CMU CREW`
- Details: [`shared/mongodb-seed/HANDOFF.md`](shared/mongodb-seed/HANDOFF.md)

### Still to do (priority order)

1. **E2E critical path** — login → live map from API → log CMU→Lawrenceville → discovery toast → data persists (Person 4 drives; all help)
2. **Auth0 JWT verify** — replace decode-only middleware with JWKS validation (Person 1)
3. **Discovery animation polish** — hero toast / edge draw (Person 2)
4. **Protect graph routes** + align Bearer tokens end-to-end (Person 1 + 2)
5. **Friends API** — add-by-email still local stub (Person 1 + 2)
6. **User profile / recommendations** — `GET /api/users/:id/profile` + taste cards (Person 1; lower priority)
7. **Deploy** — Vultr + PM2 + production Auth0 callbacks (Person 4; Person 3 updates Auth0 URLs)
8. **Google Maps JS tiles** — optional; current map is canvas (Person 2; can stay cut)

---

## Tech stack (locked)

| Layer | Choice | Notes |
|-------|--------|--------|
| Frontend | React + Vite | Canvas graph/heatmap (not Google Maps JS yet) |
| Backend API | Node.js + Express | Live trips + graph against Atlas |
| Database | **MongoDB Atlas** (M0 free) | Not self-hosted on Vultr |
| Auth | Auth0 + JWT | Login works; server-side verify still weak |
| Places | Google Places (backend) | Optional key; degrades gracefully |
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
