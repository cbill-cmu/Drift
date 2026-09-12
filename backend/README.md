# Backend (Person 1)

Express API for Drift. Talks to **MongoDB Atlas**. Auth0 JWTs are accepted on trips (decode today; JWKS verify still TODO).

## Setup

```bash
cp .env.example .env
# MONGODB_URI, AUTH0_DOMAIN, AUTH0_AUDIENCE, optional GOOGLE_PLACES_API_KEY
npm install
npm run dev
```

Server: `http://localhost:3000`

## Ownership

Edit only under `backend/` unless pairing with Person 4 on an E2E fix. Follow [`shared/api-contract.md`](../shared/api-contract.md) and [`shared/mongodb-schema.js`](../shared/mongodb-schema.js).

## Implemented (current `main`)

| Route / piece | Status |
|---------------|--------|
| `GET /` | Health check |
| `POST /api/trips` | Live — resolve/create nodes, edges, trips, heatpoints, discovery payload |
| `GET /api/groups/:groupId/graph` | Live — nodes, edges, heat, neighborhoods, members |
| `GET /api/groups/:groupId/members/:userId/graph` | Live — personal/friend filtered graph |
| Mongo (`mongoService.js`) | Live Atlas connection |
| Google Places (`googlePlacesService.js`) | Live when key set; else `unknown` |
| Auth (`middleware/auth.js`) | Bearer required on trips; **payload decode only** (no JWKS yet) |

## Still TODO (Person 1)

- [ ] Verify JWT via Auth0 JWKS (`AUTH0_DOMAIN` + `AUTH0_AUDIENCE`)
- [ ] Apply auth consistently to graph routes (team decision)
- [ ] `GET /api/users/:userId/profile` (contracted; used by frontend client)
- [ ] Recompute / expose taste recommendations (service is stub)
- [ ] Harden error cases for missing `group_id` / bad coords

## Env

See `.env.example`. Share Atlas URI with Person 3’s seed env (same cluster).
