# Vultr + PM2 deployment (Person 4 — after local E2E)

Do this only after the critical path works locally (see `PERSON4_RUNBOOK.md`). Database stays on **MongoDB Atlas**.

## Status

- [ ] VPS provisioned
- [ ] Backend under PM2
- [ ] Frontend built and hosted
- [ ] Auth0 production URLs (Person 3)
- [ ] Production E2E pass

## Checklist

- [ ] Vultr VPS created (Ubuntu), SSH key works
- [ ] Node.js LTS installed on VPS
- [ ] Clone repo, `backend/.env` with Atlas `MONGODB_URI` + Auth0
- [ ] `npm install` + `npm start` / PM2 for backend
- [ ] Frontend: build static (`npm run build`) and serve via nginx, or deploy to Vercel
- [ ] Update Auth0 callback / logout / web origins to production URLs
- [ ] Smoke-test demo script on production URL

See `pm2-config.js` for a starter ecosystem file.
