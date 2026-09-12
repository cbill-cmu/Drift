# Frontend (Person 2)

React + Vite app for Drift: Google Map, graph overlay, trip logger, discovery animation.

## Setup

```bash
cp .env.example .env
# fill VITE_AUTH0_* and VITE_GOOGLE_MAPS_API_KEY, VITE_API_BASE_URL
npm install
npm run dev
```

App defaults to `http://localhost:5173`.

## Ownership

Edit only under `frontend/`. Call the API exactly as described in `shared/api-contract.md`. Use Auth0 values from `shared/auth0-setup.md`.

## Stubs included

- Vite + React entry (`main.jsx`, `App.jsx`, `Layout.jsx`)
- Placeholder components for map, trip logger, discovery reveal, neighborhood stats
- `hooks/useAuth0.js` — thin re-export / stub around Auth0
- `api/client.js` — axios instance pointing at the Express API
