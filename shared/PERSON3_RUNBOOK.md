# Person 3 — Auth + Demo data runbook

You own Auth0 health, Atlas seed data, and shared fixtures. You do **not** own Vultr cutover (Person 4) or feature work in `backend/` / `frontend/`.

## Done

- [x] Auth0 tenant + SPA login working with teammates’ `.env`
- [x] Atlas M0 + `drift` database
- [x] Seed scripts + load (CMU CREW, Pittsburgh nodes, sparse Lawrenceville)
- [x] Handoff IDs documented in `mongodb-seed/HANDOFF.md`
- [x] Fixtures under `shared/fixtures/` for contract alignment

## Your ongoing loop

```powershell
cd shared\mongodb-seed
npm run verify
npm run seed:coverage
```

**Pass:** prints `group_id`, counts, fog flags (`campus_seeded`, `lawrenceville_fogged`), refreshes fixtures.  
**Do not `npm run load` on the shared Atlas** — that wipes real Auth0 accounts. Teammates should leave `VITE_DEMO_GROUP_ID` blank and create a group in Profile.  
**Demo fog without wiping accounts:** `npm run seed:coverage -- --group "Sleep"` (or the group name you belong to).

## Help teammates

| Who | You provide |
|-----|-------------|
| Person 1 | Same `MONGODB_URI`; schema + contract; seed shape for graph queries |
| Person 2 | Auth0 Domain/Client ID/Audience; fixtures if API down. **Not** a hardcoded `group_id`. |
| Person 4 | Demo accounts (`fabio@test.com`); confirm seed before E2E; Auth0 **production** callback URLs when they deploy |

## Still TODO (Person 3)

- [x] Keep seed healthy through the rest of the hackathon (fog coverage generator + `seed:coverage`)
- [ ] Align Auth0 `auth0_id`s on users with real Auth0 user ids if login→Mongo user linking is needed
- [ ] When Person 4 has a public URL: update Auth0 Allowed Callback / Logout / Web Origins
- [ ] Optional: bump Lawrenceville baseline toward ~13% if demo script needs exact numbers
- [ ] Do **not** start Vultr alone — pair with Person 4

## Demo reserve

- CMU → Lawrenceville edge should stay **available** for live discovery (seed avoids pre-creating that hero edge when possible)
- Backup login: `alice@test.com`
