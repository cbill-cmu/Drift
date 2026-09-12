# Run Drift after a fresh pull

You do **not** need a hardcoded `group_id`. The old seed id `6aa507373e4c8b8fc47e6428` (**CMU CREW**) is **gone from Atlas**. Using it as `VITE_DEMO_GROUP_ID` 404s (`Unknown group`).

## First run (everyone)

1. Copy env files (Auth0 + Atlas URI come from the team, not git):

   ```bash
   cp frontend/.env.example frontend/.env
   cp backend/.env.example backend/.env
   ```

2. Fill in Auth0 (`VITE_AUTH0_*`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`) from [`../auth0-setup.md`](../auth0-setup.md) / Slack. Fill `MONGODB_URI` from [`../atlas-setup.md`](../atlas-setup.md). Fill `VITE_CARTO_API_KEY` for the basemap. **Leave `VITE_DEMO_GROUP_ID` blank.** Restart Vite after any `.env` change.

3. Start the API, then the UI:

   ```bash
   cd backend && npm install && node src/server.js
   cd frontend && npm install && npm run dev
   ```

4. Open http://localhost:5173 → **Log in with Auth0**.
5. **Profile → create a group** (any name). Invite teammates from Friends. Fog, recs, and coverage all use **that** group.

Until you belong to a group, the map may show the bundled **Local fixture** (`frontend/src/fixtures/groupGraph.json`). That is expected. It is not membership in a live Atlas group.

If you already have a `frontend/.env` with `VITE_DEMO_GROUP_ID=6aa507373e4c8b8fc47e6428`, delete that value. The app now ignores ids you are not a member of, so coverage/suggestions will stop 404ing even before you edit `.env`.

## Live Atlas (shared `drift` db)

Real Auth0 accounts live here. **Do not `npm run load`** — that wipes the database.

| Key | Value |
|-----|--------|
| Current group (Bill) | `Sleep` |
| `group_id` | `6aa5370eaa9fceef9b9eb69d` |

You will **not** see Sleep unless someone invites you. Create your own group instead.

## Seed scripts (Person 3 only — optional)

```bash
cd shared/mongodb-seed
npm install
npm run generate
# npm run load          # WIPES Atlas. Do not run this on the shared demo db.
npm run seed:coverage -- --group "Your Group Name"
npm run verify
```

Fog-of-war geography from `generate-coverage.js` / `seed:coverage`:
- **Everyone:** CMU / Oakland campus + Schenley
- **Some:** Shadyside, Bloomfield, Strip District
- **No one (suggestions):** Lawrenceville, South Side
- Live walk pocket east of campus is left unseeded

`seed:coverage` only replaces rows tagged `source: "seed"`. Real GPS traces stay.
