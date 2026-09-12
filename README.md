# Drift

Hackathon build: shared group knowledge graph of Pittsburgh trips (nodes + edges) on a heat map, with Auth0 login and a discovery reveal moment.

**One sentence:** Movement → Nodes/Edges → Shared group graph → "someone unlocked something" → taste-based recommendations.

## Tech stack (locked)

| Layer | Choice |
|-------|--------|
| Frontend | React + Vite |
| Backend API | Node.js + Express |
| Database | **MongoDB Atlas** (cloud) |
| Auth | Auth0 + JWT |
| Maps / places | Google Maps + Google Places |
| Hosting | Vultr for API (DB stays on Atlas) |

## Repo layout (3-person parallel)

```
backend/   # Person 1 — Express API, Google Places, Mongo queries
frontend/  # Person 2 — React map, trip logger, discovery animation
shared/    # Person 3 — Auth0 docs, schema, seed data, deploy docs
```

**Rule:** Person 1 and 2 treat `shared/` as read-only after Hour 0 locks (except agreed contract changes). Person 3 does not edit `backend/src` or `frontend/src`.

## Hour 0 locks

1. [`shared/api-contract.md`](shared/api-contract.md) — Person 1 + 2
2. [`shared/mongodb-schema.js`](shared/mongodb-schema.js) — Person 1 + 3
3. [`shared/auth0-setup.md`](shared/auth0-setup.md) — Person 3
4. [`shared/atlas-setup.md`](shared/atlas-setup.md) — Person 3 (MongoDB Atlas)

## Quick start

### 1. Clone and env

```bash
git clone https://github.com/cbill-cmu/Drift.git
cd Drift
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp shared/mongodb-seed/.env.example shared/mongodb-seed/.env
```

Fill in Auth0 + `MONGODB_URI` (Atlas) — never commit `.env` files.

### 2. Backend (Person 1)

```bash
cd backend
npm install
npm run dev
```

### 3. Frontend (Person 2)

```bash
cd frontend
npm install
npm run dev
```

### 4. Seed Atlas (Person 3)

```bash
cd shared/mongodb-seed
npm install
npm run generate
npm run load
```

## Docs

- [DRIFT_PROJECT_GUIDE.md](DRIFT_PROJECT_GUIDE.md) — full product + demo script
- [GITHUB_WORKFLOW.md](GITHUB_WORKFLOW.md) — branches, ownership, timeline
- [requirements.md](requirements.md) — requirements checklist

## MongoDB Atlas prize note

This project uses **MongoDB Atlas** as the primary database (not self-hosted Mongo on the VPS), which keeps us eligible for Atlas hackathon tracks.
