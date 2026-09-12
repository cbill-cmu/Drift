# Drift — GitHub Workflow for 3-Person Parallel Development

**Goal**: Zero merge conflicts, clear separation of concerns, smooth integration.

---

## Repository Structure

```
drift/
├── backend/                    # Person 1: Backend Lead
│   ├── src/
│   │   ├── routes/
│   │   │   ├── trips.js        # POST /api/trips
│   │   │   ├── graph.js        # GET /api/groups/:groupId/graph
│   │   │   └── auth.js         # Auth0 middleware
│   │   ├── services/
│   │   │   ├── googlePlacesService.js  # Google API wrapper
│   │   │   ├── mongoService.js         # DB queries
│   │   │   └── recommendationService.js # (optional, lower priority)
│   │   ├── models/
│   │   │   └── index.js        # MongoDB collection schemas (reference only)
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT validation
│   │   └── server.js           # Express app entry point
│   ├── .env.example            # Environment variables (DO NOT commit .env)
│   ├── package.json
│   └── README.md               # Backend-specific setup
│
├── frontend/                   # Person 2: Frontend Lead
│   ├── src/
│   │   ├── components/
│   │   │   ├── GroupMapView.jsx         # Main map + graph overlay
│   │   │   ├── TripLoggerModal.jsx      # Trip form
│   │   │   ├── DiscoveryReveal.jsx      # Animation hero
│   │   │   ├── NeighborhoodStats.jsx    # Sidebar
│   │   │   └── Layout.jsx               # App root
│   │   ├── hooks/
│   │   │   ├── useGroupGraph.js         # Fetch graph data
│   │   │   ├── useTrip.js               # Submit trip + handle response
│   │   │   └── useAuth0.js              # Auth0 login
│   │   ├── styles/
│   │   │   └── index.css
│   │   ├── api/
│   │   │   └── client.js                # Axios instance + endpoints
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vite.config.js
│   ├── package.json
│   └── README.md
│
├── shared/                     # Person 3: Auth + Demo Data
│   ├── api-contract.md         # API endpoint specs (AGREED FIRST)
│   ├── mongodb-schema.js       # Collection definitions
│   ├── mongodb-seed/           # Demo data generation
│   │   ├── generate-users.js
│   │   ├── generate-nodes.js
│   │   ├── generate-trips.js
│   │   └── load-to-db.js
│   ├── auth0-setup.md          # Auth0 tenant config (instructions)
│   └── deployment/
│       ├── vultr-setup.md      # VPS setup (SSH, PM2, etc.)
│       └── pm2-config.js       # PM2 ecosystem file
│
├── .gitignore
├── .github/
│   └── workflows/
│       └── ci.yml              # (Optional) Basic linting on PR
└── README.md                   # Project root README
```

---

## File Ownership & No-Conflict Zones

| Person | Primary Folder | Owns | Cannot Edit Without Discussion |
|--------|---|---|---|
| **Backend (Person 1)** | `/backend/src` | routes, services, middleware, server.js | shared/api-contract.md (lock it first), shared/mongodb-schema.js |
| **Frontend (Person 2)** | `/frontend/src` | components, hooks, styles, App.jsx | shared/api-contract.md (lock it first) |
| **Auth + Demo (Person 3)** | `/shared` | All of shared/ | backend/src, frontend/src |

**Key rule**: `/shared` is READ-ONLY for Person 1 and 2 (except for api-contract.md at the start). Person 3 doesn't touch backend or frontend code.

---

## The Three Critical Locks (Do These in Hour 0)

### 1. API Contract (Shared)

**File**: `shared/api-contract.md`

**Created by**: Person 1 + Person 2 together (30 min, Hour 0)

**What it contains**: Exact request/response format for all 3 MVP endpoints. Example:

```markdown
# Drift API Contract (LOCKED)

## POST /api/trips

**Request**:
```json
{
  "group_id": "string (MongoDB ID)",
  "from_lat": "number",
  "from_lng": "number",
  "to_lat": "number",
  "to_lng": "number",
  "duration_min": "number (5-120)",
  "travel_mode": "string (walk|bus|car|uber|train)"
}
```

**Response (success)**:
```json
{
  "success": true,
  "new_node": { "id": "...", "name": "...", "place_type": "..." },
  "new_edge": { "id": "...", "from": "...", "to": "...", "duration_min": 31 },
  "neighborhood_pct_before": 13,
  "neighborhood_pct_after": 18
}
```

**Response (error)**:
```json
{
  "success": false,
  "error": "string"
}
```

---

## GET /api/groups/:groupId/graph

...etc
```

**Rule**: Once this is locked, Person 1 implements the backend exactly to this spec. Person 2 builds the frontend to call this API and handle the response. **No surprises.**

### 2. MongoDB Schema (Shared)

**File**: `shared/mongodb-schema.js`

**Created by**: Person 1 + Person 3 together (30 min, Hour 0)

**What it contains**: Collection names, field names, types, indexes. Example:

```javascript
// shared/mongodb-schema.js
export const COLLECTIONS = {
  USERS: "users",
  GROUPS: "groups",
  NODES: "nodes",
  EDGES: "edges",
  TRIPS: "trips",
  HEATPOINTS: "heatpoints",
  USER_HEATPOINTS: "user_heatpoints",
};

export const NODE_PLACE_TYPES = [
  "urban_core",
  "park",
  "food",
  "shopping",
  "transit",
  "residential",
  "entertainment",
  "unknown",
];

export const TRAVEL_MODES = ["walk", "bus", "car", "uber", "train"];

export const INDEXES = {
  nodes: [
    { fields: { group_id: 1, lat: 1, lng: 1 } },
    { fields: { group_id: 1, place_type: 1 } },
  ],
  edges: [
    { fields: { group_id: 1, from_node_id: 1, to_node_id: 1 } },
  ],
  // ...
};
```

**Rule**: Person 1 imports this in backend code. Person 3 uses it to create seed data. Changes need unanimous approval.

### 3. Auth0 Setup (Shared)

**File**: `shared/auth0-setup.md`

**Created by**: Person 3 (1 hour, Hour 0)

**What it contains**: Step-by-step: create Auth0 tenant, register app, create test accounts, set redirect URIs.

**Output**: 
- Auth0 domain (e.g., `drift-hackathon.us.auth0.com`)
- Client ID + Client Secret
- Test account credentials (fabio@test.com, password)
- Redirect URIs configured (localhost:3000, localhost:5173, vultr-ip)

**Rule**: Person 1 + 2 use these credentials in .env files. No hardcoding.

---

## Branch Strategy

Use **feature branches** with a clear naming convention. Avoid long-lived branches that cause merge hell.

### Branch Naming

```
backend/<feature>
frontend/<feature>
auth/<feature>
bugfix/<issue>
```

### Examples

```
backend/google-places-api        # Person 1: Google API integration
backend/trip-endpoint            # Person 1: POST /api/trips
frontend/map-component           # Person 2: Google Map render
frontend/discovery-animation     # Person 2: Toast animation
auth/auth0-setup                 # Person 3: Auth0 config
auth/seed-data-generation        # Person 3: Demo data script
```

### Workflow (Per Person)

**Hour 0 (Setup)**:
```bash
git clone https://github.com/your-org/drift.git
cd drift
git checkout main
git pull origin main
```

**Hour 2–8 (Development)**:
```bash
# Person 1 (Backend)
git checkout -b backend/trip-endpoint
cd backend
# ... write code ...
git add src/routes/trips.js src/services/mongoService.js
git commit -m "Implement POST /api/trips endpoint with Google Places integration"
git push origin backend/trip-endpoint
```

**Hour 8+ (Integration)**:
```bash
# Open PR on GitHub
# Title: "Backend: Trip endpoint with Google Places API"
# Description: "Implements POST /api/trips per api-contract.md. Resolves coords to nodes, calls Google Places API, returns new node/edge info."

# Person 2 reviews code (checks for obvious bugs)
# Person 1 addresses feedback
# Once approved, merge to main
git checkout main
git pull origin main
git merge backend/trip-endpoint
git push origin main
```

### PR Review Rules

- **Backend PR**: Reviewed by Person 2 or 3 (quick check: does it match api-contract.md?)
- **Frontend PR**: Reviewed by Person 1 or 3 (quick check: does it call the right endpoints?)
- **Auth/Shared PR**: Reviewed by all (these affect everyone)
- **Approval time**: 10–15 min turnaround (not hours, not days)

---

## .gitignore

```
# Node
node_modules/
*.log
npm-debug.log

# Environment variables (NEVER commit)
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Build outputs
dist/
build/
.next/

# MongoDB (if running local)
data/
```

---

## Development Flow (First 8 Hours)

### Hour 0–2: Locks + Setup

**All together (Slack/Discord screenshare)**:
1. [ ] Clone repo
2. [ ] Read api-contract.md
3. [ ] Read mongodb-schema.js
4. [ ] Confirm Auth0 setup (Person 3 demo logs in)
5. [ ] Everyone creates their own `.env` file (`.env.example` has the keys)

**Person 1**: Clone backend, test `npm install`, `npm run dev` works

**Person 2**: Clone frontend, test `npm install`, `npm run dev` works

**Person 3**: Clone shared, test seed scripts run without errors

### Hour 2–4: Skeleton + Locks

**Person 1 (Backend)**:
- [ ] Express app boots with GET / endpoint
- [ ] Auth0 middleware skeleton (validates JWT format)
- [ ] MongoDB connection string in .env works
- [ ] Create first branch: `backend/express-skeleton`
- [ ] PR + merge to main

**Person 2 (Frontend)**:
- [ ] React app boots (Vite or Next.js)
- [ ] Google Map component renders (API key in .env)
- [ ] Auth0 login redirects work (tokens stored)
- [ ] Create first branch: `frontend/google-map`
- [ ] PR + merge to main

**Person 3 (Auth + Demo)**:
- [ ] Auth0 tenant created, test accounts ready
- [ ] Seed script generates 1 group + 10 users + 100 nodes + 2 weeks trips (JSON files, not yet in DB)
- [ ] Create first branch: `auth/auth0-setup`
- [ ] PR + merge to main

### Hour 4–8: Hot Path (Parallel)

**Person 1 (Backend)** — starts `backend/trip-endpoint`:
- [ ] POST `/api/trips` endpoint accepts request
- [ ] Validates JWT
- [ ] Resolves from/to lat/lng to nodes (hardcoded for now, no Google API yet)
- [ ] Creates/updates nodes + edges
- [ ] Saves to MongoDB
- [ ] Returns response matching api-contract.md
- [ ] **Test with Postman/curl**

**Person 2 (Frontend)** — starts `frontend/trip-logger`:
- [ ] TripLoggerModal component (form + submit button)
- [ ] Call `POST /api/trips` (mock response if backend not ready)
- [ ] Handle response, prepare for DiscoveryReveal animation
- [ ] **Test with Chrome DevTools network tab (check request/response)**

**Person 3 (Auth + Demo)** — finishes `auth/seed-data-generation`:
- [ ] Load seed JSON data into MongoDB (or pre-run seed when backend starts)
- [ ] Verify data is queryable: `db.nodes.find().limit(5)`
- [ ] Create branch: `auth/seed-data-load`
- [ ] PR + merge

### Hour 8–12: Integration

**Person 1 + 2** — integration test:
- [ ] Person 2 calls Person 1's backend endpoint
- [ ] Person 1 watches the request come in (console logs)
- [ ] Response returns to frontend
- [ ] Data appears on the map

**If data doesn't match**: Check api-contract.md, fix backend or frontend accordingly. Quick PR, merge.

---

## Conflict Prevention Strategies

### Strategy 1: Separate Folders (Already Done)

- Backend code: `/backend/src/**`
- Frontend code: `/frontend/src/**`
- Shared (read-only): `/shared/**`

Git won't create conflicts between Person 1 and Person 2 because they're editing different files in different folders.

### Strategy 2: Lock Critical Files First

Files that should NEVER be edited mid-sprint:
- `shared/api-contract.md` (locked after Hour 0)
- `shared/mongodb-schema.js` (locked after Hour 0)
- `backend/package.json` (minimize package changes; add to /shared instead if needed)
- `frontend/package.json` (same)

**If someone needs to change one of these**:
- Post in Slack first: "I need to add a new API endpoint, can we update api-contract.md?"
- Get 1 approval, update, PR, merge.
- **Everyone pulls main immediately after merge.**

### Strategy 3: Frequent, Small PRs

Do NOT work for 6 hours and then PR 1000 lines.

Instead:
- Write 1 endpoint → PR → merge (1–2 hours of work per PR)
- Write 1 component → PR → merge
- Big feature? Break into sub-PRs

**Benefits**:
- Faster reviews (10–15 min, not 1 hour)
- Easier to revert if something breaks
- Main branch always deployable
- Less merge conflict risk

### Strategy 4: Communicate Async

Post updates in a Slack thread. Example:

```
@team [Hour 6 update]

✅ Backend: POST /api/trips endpoint done, tested with Postman
👍 Next: Adding Google Places API call (1 hour)
⚠️ Heads up: Will need Google API key in .env, Person 3 check docs?

🎯 Frontend: TripLoggerModal complete, mocking API response
👍 Next: Integrating with real backend (waiting for Person 1)

🔧 Auth: Seed data loading into MongoDB now
👍 Should be done by Hour 8, will ping when it's live
```

This way no one is blocked waiting for a meeting.

---

## Integration Checkpoints (Every 4 Hours)

### Hour 4 Checkpoint (After Locks)

**In a 5-min Slack call** (or message thread):

Person 1: "Backend skeleton up, Express running, auth middleware stubbed"
Person 2: "Frontend skeleton up, Google Map renders, auth flow redirects correctly"
Person 3: "Auth0 live, seed script generates data (not in DB yet), will be ready by Hour 6"

**Decision**: Proceed as planned? Any blockers?

### Hour 8 Checkpoint (After Hot Path)

Person 1: "Trip endpoint done, returns mock response, ready for integration"
Person 2: "Trip logger form done, calls backend, handles response"
Person 3: "Seed data loaded into MongoDB"

**Live integration test**:
- Person 2 opens frontend
- Person 2 logs a trip
- Watch backend console logs show request coming in
- Frontend shows response data

If it works: merge all branches, pull main, keep going.
If it breaks: quick debugging session, fix, re-test, merge.

### Hour 12 Checkpoint (Before Animation)

Entire critical path is wired:
- Frontend calls backend ✅
- Backend calls Google API ✅
- Data returns to frontend ✅
- Graph re-renders on map ✅

Now the only job is: **make the animation smooth.**

### Hour 16 Checkpoint (Animation Phase)

Person 2: "Discovery reveal animation done, tested with demo trip"
Person 1: "Any backend changes needed?" (unlikely)
Person 3: "Anything for deployment?" (unlikely)

### Hour 20 Checkpoint (Deployment)

Person 3: "Backend deployed to Vultr, running under PM2, logs look good"
Person 3: "Frontend built and deployed (Vercel or Vultr)"
Person 1: "DB connection string updated to production"
Person 2: "Auth0 redirect URIs point to production URLs"

All: Test demo script on production URL end-to-end.

---

## GitHub Settings (Prevent Accidental Damage)

In your GitHub repo settings:

### 1. Require Pull Request Reviews

- Main branch: **Require 1 approval before merge**
- Dismiss stale reviews: enabled
- Require code owners review: enabled (optional)

### 2. Branch Protection

- Main branch: Cannot push directly (must use PR)
- Require branches to be up to date: enabled
- Require status checks to pass (if you add CI): enabled

### 3. Code Owners (Optional)

**File**: `.github/CODEOWNERS`

```
# Auto-request review from person who owns the code

/backend/ @person1_github_username
/frontend/ @person2_github_username
/shared/ @person3_github_username
```

---

## Emergency Recovery (If Someone Pushes Wrong Code)

### Scenario: Person 1 Merges Broken Backend Code

```bash
# Revert the last commit on main
git log main -1  # See what was merged
git revert HEAD --no-edit  # Creates a new commit that undoes the previous one
git push origin main

# Alert team on Slack, person 1 fixes on a new branch, re-submits PR
```

### Scenario: Merge Conflict (Shouldn't Happen With This Strategy)

```bash
# If it does happen:
git checkout main
git pull origin main
git checkout <your-branch>
git rebase main
# Resolve conflicts in your editor
git add .
git rebase --continue
git push origin <your-branch> --force-with-lease

# Re-PR, get approval, merge
```

---

## Parallel Work Schedule (Optimized for 3 People)

```
Hour 0–2:   [All] Setup + Locks
            Person 1: Backend skeleton
            Person 2: Frontend skeleton
            Person 3: Auth0 + seed generation

Hour 2–4:   [Parallel]
            Person 1: Google Places API stub
            Person 2: Trip logger form stub
            Person 3: Seed data → MongoDB

Hour 4–8:   [Parallel - Hot Path]
            Person 1: POST /api/trips + Google API
            Person 2: TripLoggerModal integration
            Person 3: Edge case testing + demo data refinement

Hour 8–12:  [Integration Testing]
            All: Verify end-to-end flow
            Person 1: MongoDB query optimization
            Person 2: Graph rendering + map overlay
            Person 3: Deployment prep (Vultr, PM2)

Hour 12–16: [Animation Focus]
            Person 2: Discovery reveal animation (60% time)
            Person 1: Backend polish + caching (20% time)
            Person 3: Deployment pipeline setup (20% time)

Hour 16–20: [Polish]
            Person 2: Animation refinement + feedback
            Person 1: Bug fixes + performance
            Person 3: Deployment to Vultr

Hour 20–24: [QA + Demo]
            All: Test demo script
            Person 1: Final backend fixes
            Person 2: Final frontend polish
            Person 3: Deployment verification + rollback plan
```

---

## Checklist: Day-of Setup (Hour 0)

- [ ] Repo cloned, everyone has `git pull` working
- [ ] `.env` files created locally (from `.env.example`)
- [ ] Google Maps API key in place
- [ ] Auth0 tenant credentials shared (in 1Password or secure paste)
- [ ] MongoDB connection string shared
- [ ] Everyone can run their service locally (`npm run dev` works)
- [ ] Slack channel created + GitHub notifications enabled
- [ ] api-contract.md locked and shared
- [ ] mongodb-schema.js locked and shared
- [ ] First branches created (`backend/skeleton`, `frontend/skeleton`, etc.)
- [ ] First PR submitted (simple, just to test the review flow)

---

## Pro Tips

1. **Commit messages matter**. Write clear commit messages so you can find code later.
   ```bash
   # Good
   git commit -m "Add Google Places reverse geocoding to trip endpoint"
   
   # Bad
   git commit -m "fix"
   ```

2. **Push frequently**. Don't wait until the end of the day to push.
   ```bash
   git push origin backend/trip-endpoint
   ```
   This backs up your code and lets others see progress.

3. **Rebase before PR**. Clean up commits if needed.
   ```bash
   git rebase -i main  # Squash commits if you prefer
   git push origin <branch> --force-with-lease
   ```

4. **Test locally before PR**. Don't push broken code.
   ```bash
   npm run dev
   npm run lint  # If you have it
   # Manual testing: open browser, try the feature
   ```

5. **Use GitHub Issues for blockers**. If someone is stuck, open an issue and tag the person who can help.
   ```
   Title: "POST /api/trips returning 500 error"
   Body: "Backend throwing on Google Places API call. Error: [paste log]. Need help @person1"
   ```

---

**Go. You're ready.**
