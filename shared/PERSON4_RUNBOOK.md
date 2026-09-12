# Person 4 — Integration + Deploy runbook

You own the **critical path working end-to-end** and **production deploy**. You may open small fix PRs across folders when blocked; prefer pairing with the folder owner.

## Done (context)

- P1: trips + graph API against Atlas exist on `main`
- P2: Auth0 UI + canvas map + trip logger exist on `main`
- P3: Auth0 tenant + Atlas seed exist

Your job is to **glue and ship**, not rebuild verticals.

## Priority 1 — Local E2E (do this before Vultr)

Checklist (facilitate with P1–P3 on a call):

1. [ ] `git pull origin main` on all machines
2. [ ] Person 1: `backend` `npm run dev` — `GET http://localhost:3000/` returns ok
3. [ ] Person 2: `frontend` `VITE_API_BASE_URL` points at that API; `npm run dev`
4. [ ] Person 3: `npm run verify` — seed healthy; `group_id` matches frontend
5. [ ] Log in with Auth0 (`fabio@test.com`)
6. [ ] Group map shows seeded Pittsburgh graph (not empty)
7. [ ] Log trip: CMU → Lawrenceville, 31 min, bus
8. [ ] Discovery toast fires; Lawrenceville % increases
9. [ ] Refresh page — new edge still present
10. [ ] Note any 401/CORS/env mismatches and file a tiny PR

## Priority 2 — Hardening before judges

- [ ] Confirm Auth0 callbacks include every URL the demo will use
- [ ] Ask Person 1 for JWKS verify if demo uses real tokens against protected routes
- [ ] Dry-run the demo script in [`DRIFT_PROJECT_GUIDE.md`](../DRIFT_PROJECT_GUIDE.md) (5–7 min)
- [ ] Backup plan: if live trip fails, narrate from seeded graph + fixture discovery toast

## Priority 3 — Deploy

**Free demo (no Vultr credits):** [`deployment/render-setup.md`](deployment/render-setup.md) — one Render URL for API + UI.

**Vultr (if you have credits):** [`deployment/vultr-setup.md`](deployment/vultr-setup.md) + `pm2-config.js`:

- [ ] VPS + Node + clone repo
- [ ] Backend `.env` with Atlas URI + Auth0
- [ ] PM2 for API
- [ ] Frontend build + static host (nginx or Vercel)
- [ ] Person 3 updates Auth0 production URLs
- [ ] Full E2E on production URL

## Ownership boundaries

| You touch | Prefer owner |
|-----------|----------------|
| Env / CORS / deploy scripts | You |
| JWT verify | Person 1 |
| Discovery animation polish | Person 2 |
| Seed reload / Auth0 console | Person 3 |

## Slack pattern

Post a short status every few hours:

```
P4: E2E [ ] map [ ] trip [ ] toast [ ] deploy
Blockers: …
```
