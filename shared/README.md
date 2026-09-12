# shared/ — Person 3 (Auth + Demo + Deploy docs)

Read-only for Person 1 and 2 after Hour 0 locks (except agreed contract changes).

| File / folder | Purpose |
|---------------|---------|
| `api-contract.md` | Locked HTTP request/response shapes |
| `mongodb-schema.js` | Collection names, enums, indexes |
| `auth0-setup.md` | Auth0 tenant checklist |
| `atlas-setup.md` | MongoDB Atlas checklist |
| `mongodb-seed/` | Generate + load Pittsburgh demo data |
| `deployment/` | Vultr + PM2 (later) |

Kickoff: merge this folder, then P1/P2 implement against the contract while Person 3 finishes Auth0 console + seed generation.
