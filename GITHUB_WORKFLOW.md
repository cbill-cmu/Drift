# Drift — GitHub Workflow (4-person team)

**Goal:** Low merge conflicts, clear ownership, finish E2E then deploy.

This file matches **current `main`**. Older “3-person only” language is obsolete.

---

## Ownership

| Person | Role | Primary paths |
|--------|------|----------------|
| **1** | Backend | `backend/` |
| **2** | Frontend | `frontend/` |
| **3** | Auth + demo data | `shared/` (except `deployment/` lead) |
| **4** | Integration + deploy | E2E, small cross-PRs, `shared/deployment/` |

**Conflict rule:** don’t edit another person’s primary folder without a Slack ping. Person 4 may open **small** fix PRs anywhere to unblock E2E.

Locked shared files (change only with agreement):

- `shared/api-contract.md`
- `shared/mongodb-schema.js`

---

## What’s already on `main`

- Atlas seed (CMU CREW / Pittsburgh graph)
- Auth0 login on frontend
- Express `POST /api/trips` + `GET .../graph` (+ member graph)
- Canvas map, trip logger, basic discovery toast, friends panel (partial)

See root [`README.md`](README.md) for the full done / TODO table.

---

## Remaining work by person

### Person 1 — Backend

- [ ] Auth0 **JWKS** JWT verification
- [ ] Decide + implement auth on graph routes
- [ ] `GET /api/users/:userId/profile`
- [ ] Taste / recommendation service beyond stub
- [ ] Keep Places key optional but working when present

### Person 2 — Frontend

- [ ] Discovery reveal **polish** (demo hero)
- [ ] Trip submit → refresh map + toast reliability
- [ ] Empty/error states when API URL wrong
- [ ] Friends polish when API exists
- [ ] Optional Google Maps tiles

### Person 3 — Auth + seed

- [ ] `npm run verify` health (do **not** `npm run load` on the shared Atlas)
- [ ] Production Auth0 callback URLs when P4 deploys
- [ ] Demo accounts ready (Fabio + backup)

### Person 4 — Integration + deploy

- [ ] Drive local E2E checklist ([`shared/PERSON4_RUNBOOK.md`](shared/PERSON4_RUNBOOK.md))
- [ ] Env/CORS alignment across machines
- [ ] Vultr + PM2 + frontend host
- [ ] Final demo dry-run

---

## Branch naming

```
backend/<feature>
frontend/<feature>
auth/<feature>
integrate/<fix>
deploy/<step>
```

Prefer short-lived branches and small PRs. Require 1 review when possible.

---

## Local integration (minimum)

1. P1: backend on `:3000` with Atlas URI  
2. P2: frontend `VITE_API_BASE_URL=http://localhost:3000` (or P1’s LAN/tunnel URL)  
3. P3: `npm run verify` (do **not** `npm run load` on the shared Atlas)  
4. Everyone: login → Profile → create or join a group → map

**Empty map on someone’s laptop:** almost always API not reachable — not “seed missing.”

---

## Repo layout

```
drift/
├── backend/          # Person 1
├── frontend/         # Person 2
├── shared/           # Person 3 (+ Person 4 deployment/)
│   ├── api-contract.md
│   ├── mongodb-schema.js
│   ├── auth0-setup.md
│   ├── atlas-setup.md
│   ├── mongodb-seed/
│   ├── fixtures/
│   ├── PERSON3_RUNBOOK.md
│   ├── PERSON4_RUNBOOK.md
│   └── deployment/
├── README.md
├── requirements.md
├── DRIFT_PROJECT_GUIDE.md
└── GITHUB_WORKFLOW.md
```
