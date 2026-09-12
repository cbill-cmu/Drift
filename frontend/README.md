# Frontend (Person 2)

React + Vite UI for Drift: Auth0 login, canvas heatmap/graph map, trip logger, discovery toast, friends panel.

## Setup

```bash
cp .env.example .env
# VITE_AUTH0_*, VITE_API_BASE_URL, VITE_DEMO_GROUP_ID
npm install
npm run dev
```

App: `http://localhost:5173`

**Critical:** `VITE_API_BASE_URL` must point at a running backend (Person 1 on `:3000` or a shared URL). If the API is down, the group map will fail or show whatever fallback the team wired.

## Ownership

Edit only under `frontend/` unless pairing with Person 4. Call APIs per [`shared/api-contract.md`](../shared/api-contract.md). Auth0 values from [`shared/auth0-setup.md`](../shared/auth0-setup.md).

## Implemented (current `main`)

| Feature | Status |
|---------|--------|
| Auth0 login / logout | Working with env Domain + Client ID |
| Canvas graph + visit heatmap | Working (`GraphMap`, not Google Maps JS) |
| Group map via `GET .../graph` | Working when API is up |
| Trip logger → `POST /api/trips` | Working with Bearer token |
| Discovery toast | Basic (needs polish for demo hero) |
| Neighborhood % sidebar | Working from graph payload |
| Friends panel | Partial — members from API or fixtures; add-friend is local stub |
| Friend map fixtures | Fallback when member-graph fails |

Default group: `VITE_DEMO_GROUP_ID` or `6aa507373e4c8b8fc47e6428`.

## Still TODO (Person 2)

- [ ] Polish **discovery reveal** (animation timing, edge draw) — highest demo impact
- [ ] Ensure trip success always refreshes map + toast
- [ ] Friends UX polish once Friends API exists (or keep fixture path)
- [ ] Optional: Google Maps base tiles (`VITE_GOOGLE_MAPS_API_KEY` unused today)
- [ ] Clear empty-state when API is down (message Person 1 / set API URL)

## Env

See `.env.example`. Never commit real `.env`.
