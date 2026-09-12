# Seed handoff (Person 3 → team)

Loaded into MongoDB Atlas DB `drift` on free M0.

> If someone runs `npm run load` again, **ObjectIds change**. Re-run `npm run verify` and update this file + `VITE_DEMO_GROUP_ID`.

## IDs for frontend / backend (current seed)

| Key | Value |
|-----|--------|
| `group_id` | `6aa4d5b78c6341a27ed90e4b` |
| `group_name` | `CMU CREW` |
| `fabio_user_id` | `6aa4d5b78c6341a27ed90e41` |

Person 2: `VITE_DEMO_GROUP_ID=6aa4d5b78c6341a27ed90e4b` (also default in `App.jsx`).

## Demo baseline

- Dense: Oakland / Shadyside / Bloomfield
- Sparse: Lawrenceville (room for live CMU → Lawrenceville discovery)
- Prefer not pre-seeding the hero CMU→Lawrenceville edge

## Commands

```bash
cd shared/mongodb-seed
npm run generate
npm run load      # wipes + re-inserts
npm run verify    # prints group_id + refreshes shared/fixtures/
```
