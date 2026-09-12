# MongoDB Atlas setup (Person 3)

Use **MongoDB Atlas** free M0 (GitHub Education / $50 credit optional — not required). Do **not** self-host Mongo on Vultr.

## Status

- [x] M0 cluster created
- [x] App DB user + network access configured
- [x] `MONGODB_URI` in team `.env` files (not in git)
- [x] Database `drift` seeded (see `mongodb-seed/HANDOFF.md`)
- [x] Indexes created via seed load

## Hour 0 checklist (historical)

- [ ] Create Atlas account / join team project
- [ ] Create **M0 free cluster** (or use student $50 credit if needed)
- [ ] Create database user + password
- [ ] Network Access: add teammate IPs, or `0.0.0.0/0` for short hackathon only
- [ ] Copy SRV connection string
- [ ] Database name: `drift` (see `mongodb-schema.js` → `DB_NAME`)
- [ ] Put URI in local `.env` files only — **never commit**

## Connection string shape

```
mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/drift?retryWrites=true&w=majority
```

Share as `MONGODB_URI` with Person 1 (backend) and use the same value in `shared/mongodb-seed/.env`.

## Env placement

| File | Variable |
|------|----------|
| `backend/.env` | `MONGODB_URI`, `MONGODB_DB=drift` |
| `shared/mongodb-seed/.env` | `MONGODB_URI`, `MONGODB_DB=drift` |

## After cluster is up

```bash
cd shared/mongodb-seed
cp .env.example .env   # paste Atlas URI
npm install
npm run generate       # writes JSON under output/
npm run load           # inserts into Atlas + creates indexes
```

Verify in Atlas Data Explorer or:

```js
db.nodes.find().limit(5)
db.groups.find()
```

## Prize note

Building on Atlas keeps the project aligned with MongoDB Atlas hackathon tracks (e.g. student credit / kit prizes). Mention Atlas in the README/demo if relevant.
