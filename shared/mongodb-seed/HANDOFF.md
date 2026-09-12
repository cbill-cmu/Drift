# Seed handoff (Person 3 → team)

Loaded into MongoDB Atlas DB `drift` on free M0.

> If someone runs `npm run load` again, **ObjectIds change**. Re-run `npm run verify` and update this file + `VITE_DEMO_GROUP_ID`.

## IDs for frontend / backend (current seed)

| Key | Value |
|-----|--------|
| `group_id` | `6aa507373e4c8b8fc47e6428` |
| `group_name` | `CMU CREW` |
| `fabio_user_id` | `6aa507373e4c8b8fc47e641e` |

Person 2: `VITE_DEMO_GROUP_ID=6aa507373e4c8b8fc47e6428` (also default in `App.jsx`).

## Demo baseline

- Dense: Oakland / Shadyside / Bloomfield (+ other Pittsburgh hoods)
- Sparse: Lawrenceville **1/11 discovered (~9%)** — room for live CMU → Lawrenceville discovery
- Hero CMU→Lawrenceville edge is **not** pre-seeded

## Counts (this load)

- 10 users, 95 nodes, 321 trips, 320 edges, 85 heatpoints

## Commands

```bash
cd shared/mongodb-seed
npm run generate
npm run load           # wipes seed collections + re-inserts (changes IDs!)
npm run seed:coverage  # add fog traces/cells to an existing group (keeps accounts)
npm run verify         # prints group_id + refreshes shared/fixtures/
```

Fog-of-war geography from `generate-coverage.js` / `seed:coverage`:
- **Everyone:** CMU / Oakland campus + Schenley
- **Some:** Shadyside, Bloomfield, Strip District
- **No one (suggestions):** Lawrenceville, South Side
- Live walk pocket east of campus is left unseeded

`seed:coverage` only replaces rows tagged `source: "seed"`. Real GPS traces stay.
