# Auth0 setup (Person 3)

Cap dashboard setup at **~45–60 minutes**. Never commit secrets.

## Status

- [x] Tenant created (example Domain: `dev-fgoc1y6zx1wjf88u.us.auth0.com` — confirm in your dashboard)
- [x] SPA app + localhost callbacks for `http://localhost:5173`
- [x] Frontend login works with `VITE_AUTH0_*` env
- [~] API audience `https://api.drift.local` (confirm SPA authorized for API)
- [~] Test users (Fabio + backups) — keep passwords out of git
- [ ] Production callback / logout / web origins — add the Render origin from [`deployment/render-setup.md`](deployment/render-setup.md) (keep localhost)

## Goal

Teammates can:

1. Log in on the frontend (`localhost:5173`)
2. Send `Authorization: Bearer <token>` to the backend (`localhost:3000`)
3. Use demo users that match seed data (especially **Fabio**)

## Steps (Auth0 dashboard)

### 1. Create tenant

1. Sign up / log in at [auth0.com](https://auth0.com)
2. Create a tenant (e.g. `drift-hackathon`)
3. Note **Domain**: `YOUR_TENANT.us.auth0.com` (or `.eu.auth0.com`, etc.)

### 2. Create API (for JWT audience)

1. Applications → APIs → Create API
2. Name: `Drift API`
3. Identifier (Audience): `https://api.drift.local`  
   (must match `AUTH0_AUDIENCE` / `VITE_AUTH0_AUDIENCE`)
4. Signing: RS256

### 3. Create Single Page Application

1. Applications → Create Application → **Single Page Web Applications**
2. Name: `Drift Web`
3. Settings → fill:

| Setting | Value |
|---------|--------|
| Allowed Callback URLs | `http://localhost:5173`, `http://localhost:3000` |
| Allowed Logout URLs | `http://localhost:5173`, `http://localhost:3000` |
| Allowed Web Origins | `http://localhost:5173`, `http://localhost:3000` |

Add production Vultr/Vercel URLs later (Hour 20+).

4. Copy **Client ID** (and Domain). Client Secret is usually not needed for SPA + API.

### 4. Create test users (Authentication → Database → Users)

Create at least:

| Email | Role in demo |
|-------|----------------|
| `fabio@test.com` | Hero narrator / discovery toast |
| `alice@test.com` | Backup demo account |
| `bob@test.com` | Extra group member |
| `cara@test.com` | Extra |
| `devon@test.com` | Extra |
| `elena@test.com` | Extra |
| `frank@test.com` | Extra |
| `grace@test.com` | Extra |
| `hiro@test.com` | Extra |
| `ivy@test.com` | Extra |

Use a shared hackathon password stored securely (not in git). After creation, copy each user’s `user_id` (`auth0|...`) into seed config if you want exact Auth0 linkage.

### 5. Env vars to share with the team

**Frontend** (`frontend/.env`):

```
VITE_AUTH0_DOMAIN=YOUR_TENANT.us.auth0.com
VITE_AUTH0_CLIENT_ID=...
VITE_AUTH0_AUDIENCE=https://api.drift.local
```

**Backend** (`backend/.env`):

```
AUTH0_DOMAIN=YOUR_TENANT.us.auth0.com
AUTH0_AUDIENCE=https://api.drift.local
```

### 6. Smoke test

1. Person 2: `npm run dev` → Log in → land back on `localhost:5173`
2. Browser: access token present (Auth0 SDK / Network tab)
3. Person 1: call `GET /` then a protected route with `Authorization: Bearer ...`
4. Invalid token → `401 { "success": false, "error": "..." }`

## Ownership split

| Piece | Owner |
|-------|--------|
| This doc + tenant + test users | Person 3 |
| JWT middleware (`backend/src/middleware/auth.js`) | Person 1 |
| Auth0 React provider / login UI | Person 2 |

## Checklist

- [x] Tenant created
- [~] API audience created / SPA authorized
- [x] SPA app + localhost redirect URIs
- [~] Test users (Fabio + backup)
- [x] Env values shared securely (not in git)
- [x] Login smoke test passed (localhost)
- [ ] Production URLs added before demo day
