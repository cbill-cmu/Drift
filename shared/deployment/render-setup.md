# Render (free live demo)

Vultr is optional. This is the **free** path: one HTTPS URL serving the API and the Vite build.

Database stays on **MongoDB Atlas**. Auth stays on **Auth0**.

## Architecture

Same origin:

- `https://<service>.onrender.com/` — React app
- `https://<service>.onrender.com/api/*` — Express
- `https://<service>.onrender.com/api/health` — public health check

The free instance **sleeps after ~15 minutes**. Hit the URL once before a demo so it wakes (30–60s).

## Create the service

1. Sign up at [render.com](https://render.com) with GitHub.
2. New → Blueprint, **or** New Web Service → repo `cbill-cmu/Drift`.
3. If not using the Blueprint:
   - **Build:** `npm run build`
   - **Start:** `npm start`
   - **Health check:** `/api/health`
   - **Instance:** Free
4. Set env vars (dashboard → Environment). Never commit them.

### Build-time (Vite inlines these)

| Key | From |
|-----|------|
| `VITE_AUTH0_DOMAIN` | same as local `frontend/.env` |
| `VITE_AUTH0_CLIENT_ID` | same |
| `VITE_AUTH0_AUDIENCE` | `https://api.drift.local` |
| `VITE_CARTO_API_KEY` | same as local `frontend/.env` |
| `VITE_CARTO_STYLE` | `positron` |
| `VITE_API_BASE_URL` | leave **empty** (same origin) |
| `VITE_DEMO_GROUP_ID` | leave empty |

### Runtime (Node) — enough for login even if Vite missed Auth0 at build

| Key | From |
|-----|------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | same as local `backend/.env` |
| `MONGODB_DB` | `drift` |
| `AUTH0_DOMAIN` | same as `VITE_AUTH0_DOMAIN` |
| `AUTH0_CLIENT_ID` | same as `VITE_AUTH0_CLIENT_ID` in `frontend/.env` |
| `AUTH0_AUDIENCE` | `https://api.drift.local` |
| `PORT` | Render sets this; do not hardcode |

The SPA loads Auth0 from `GET /api/config` at runtime. After adding `AUTH0_CLIENT_ID`, click **Manual Deploy** (a full rebuild is only required for `VITE_CARTO_*`).

## Auth0 (required for login)

On the SPA app, **add** the Render origin (keep localhost):

- Allowed Callback URLs
- Allowed Logout URLs
- Allowed Web Origins

Example: `https://drift-xxxx.onrender.com`

## Atlas

Network Access: allow `0.0.0.0/0` so Render’s changing outbound IPs can connect (hackathon M0).

## Smoke test

1. `GET https://<app>/api/health` → `{ "ok": true, "service": "drift-backend" }`
2. Open `https://<app>/` → Log in (redirect must stay on Render, not localhost)
3. Map tiles load; Network tab API calls are `/api/...` on the same host
4. Create a group → Start exploring (needs HTTPS for geolocation)
5. Recs pins + Places list load

## Local production-shaped run

```bash
cd frontend && npm run build
cd ../backend
set NODE_ENV=production
node src/server.js
```

Then open http://localhost:3000 (API + built UI). Auth0 still needs `http://localhost:3000` in callbacks if you test that way.

## Later: Vultr

Same app. See [vultr-setup.md](vultr-setup.md) + `pm2-config.js` when you have credits.
