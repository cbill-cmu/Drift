# shared/ — Person 3 (Auth + seed) + Person 4 (deployment)

| Path | Owner | Purpose |
|------|-------|---------|
| `api-contract.md` | Team lock (P1+P2) | HTTP request/response shapes |
| `mongodb-schema.js` | Team lock (P1+P3) | Collections, enums, indexes |
| `auth0-setup.md` | Person 3 | Auth0 tenant checklist |
| `atlas-setup.md` | Person 3 | MongoDB Atlas checklist |
| `mongodb-seed/` | Person 3 | Generate / load / verify Pittsburgh demo data |
| `fixtures/` | Person 3 | Graph + discovery JSON for mocks / verify output |
| `PERSON3_RUNBOOK.md` | Person 3 | Seed + Auth0 health |
| `PERSON4_RUNBOOK.md` | Person 4 | E2E + Vultr deploy |
| `deployment/` | Person 4 | Vultr + PM2 |

Person 1 and 2: treat contract + schema as **read-only** unless the team agrees to change them.

## Seed commands (Person 3)

```bash
cd shared/mongodb-seed
npm install
npm run generate   # writes output/*.json
npm run load       # inserts into Atlas (wipes collections — new IDs!)
npm run verify     # prints group_id + refreshes fixtures/
```

After every `load`, Slack the new `group_id` to Person 2 (`VITE_DEMO_GROUP_ID`).
