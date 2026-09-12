# Backend (Person 1)

Express API for Drift. Talks to **MongoDB Atlas** and validates Auth0 JWTs.

## Setup

```bash
cp .env.example .env
# fill MONGODB_URI, AUTH0_DOMAIN, AUTH0_AUDIENCE
npm install
npm run dev
```

Server defaults to `http://localhost:3000`.

## Ownership

Edit only under `backend/`. Read `shared/api-contract.md` and `shared/mongodb-schema.js` — do not change those without team agreement.

## Stubs included

- `GET /` — health check
- `src/middleware/auth.js` — JWT middleware stub (implement against Auth0 JWKS)
- `src/routes/trips.js`, `graph.js` — empty routers matching the contract
- `src/services/mongoService.js` — Atlas connection helper stub
