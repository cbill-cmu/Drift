# Drift API Contract

**Status:** Implemented on `main` for trips + group/member graph + friends + group create/invite.  
**Owners:** Person 1 implements; Person 2 consumes; changes need team agreement.

Base URL (local): `http://localhost:3000`  
Auth: `Authorization: Bearer <Auth0 access token>` on `/api/*` routes below, except public `GET /api/health` and `GET /api/config`.  
Errors: `{ "success": false, "error": "string" }` with 400 / 401 / 403 / 404 / 409 / 500 as appropriate

### GET /api/config

Public. Returns Auth0 SPA settings so production can boot without Vite baking `VITE_AUTH0_*` at build time.

```json
{
  "ok": true,
  "auth0_domain": "YOUR_TENANT.us.auth0.com",
  "auth0_client_id": "string",
  "auth0_audience": "https://api.drift.local"
}
```

Server reads `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` / `AUTH0_AUDIENCE` (or the matching `VITE_*` names).

**Group ids** come from `GET /api/groups` after login (create in Profile, or accept an invite). Do not hardcode a seed ObjectId — the old CMU CREW id is gone from Atlas.

---

## POST /api/trips

Create a trip, resolve/create nodes + edges, return discovery payload for the frontend animation.

**Request**

```json
{
  "group_id": "string (MongoDB ObjectId hex)",
  "from_lat": 40.4425,
  "from_lng": -79.9435,
  "to_lat": 40.4501,
  "to_lng": -79.9585,
  "duration_min": 31,
  "travel_mode": "bus"
}
```

`travel_mode` enum: `walk` | `bus` | `car` | `uber` | `train`  
`duration_min`: number, 5–120

**Response (success)**

```json
{
  "success": true,
  "actor_name": "Fabio",
  "new_node": {
    "id": "string",
    "name": "Lawrenceville",
    "place_type": "urban_core"
  },
  "new_edge": {
    "id": "string",
    "from": "CMU",
    "to": "Lawrenceville",
    "duration_min": 31
  },
  "neighborhood_pct_before": 13,
  "neighborhood_pct_after": 18
}
```

Notes for implementers:

- `new_node` may be `null` if both endpoints already existed.
- `new_edge` may be `null` if the edge already existed (still return updated % if computed).
- Demo hero path: CMU `(40.4425, -79.9435)` → Lawrenceville `(40.4501, -79.9585)`, 31 min, `bus`.

**Response (error)**

```json
{
  "success": false,
  "error": "string"
}
```

---

## Groups (create + friend-only invites)

Membership is invite-only. Email is not used here — add friends via `POST /api/friends` first, then invite with their `user_id` from `GET /api/friends` → `accepted[]`.

### POST /api/groups

Create a group. Caller becomes the first member.

**Request**

```json
{ "name": "Sunday Hikers" }
```

**Response (success)**

```json
{
  "success": true,
  "group": {
    "id": "string",
    "name": "Sunday Hikers",
    "creator_id": "string",
    "member_ids": ["string"],
    "created_at": "ISO date",
    "total_nodes_discovered": 0,
    "total_edges_discovered": 0
  }
}
```

### GET /api/groups

Groups the caller belongs to.

```json
{ "success": true, "groups": [{ "id": "string", "name": "Sunday Hikers" }] }
```

### POST /api/groups/:groupId/invites

Invite an **accepted friend**. Body is `{ "user_id" }` (Mongo id, not email).

**403** if the caller is not a member, or `user_id` is not an accepted friend.  
**409** if they are already a member or a pending invite exists.

```json
{
  "success": true,
  "invite": {
    "invite_id": "string",
    "status": "pending",
    "direction": "outgoing",
    "created_at": "ISO date",
    "group": { "id": "string", "name": "Sunday Hikers" },
    "user": { "id": "string", "display_name": "Bob", "email": "bob@test.com" }
  }
}
```

### GET /api/groups/:groupId/inviteable

Accepted friends who are not members and have no pending invite. Use this to render the Invite picker.

```json
{
  "success": true,
  "group": { "id": "string", "name": "Sunday Hikers" },
  "inviteable": [{ "id": "string", "display_name": "Bob", "email": "bob@test.com" }]
}
```

### GET /api/groups/invites

Pending inbox for the caller.

```json
{
  "success": true,
  "me": { "id": "string", "display_name": "Fabio", "email": "fabio@test.com" },
  "incoming": [],
  "outgoing": []
}
```

### POST /api/groups/invites/:id/accept

Invitee only. Adds them to `member_ids` and `users.groups`.

```json
{
  "success": true,
  "already_accepted": false,
  "invite": {},
  "group": {}
}
```

### POST /api/groups/invites/:id/decline

Invitee deletes the pending row (they can be invited again).

### POST /api/groups/invites/:id/unsend

Inviter deletes the pending row (they can send again).

---

## GET /api/groups/:groupId/graph

Return everything the map needs for one group.

**Response (success)**

```json
{
  "success": true,
  "group_id": "string",
  "group_name": "CMU CREW",
  "nodes": [
    {
      "id": "string",
      "name": "CMU",
      "neighborhood": "Oakland",
      "lat": 40.4425,
      "lng": -79.9435,
      "place_type": "urban_core",
      "visits": 15
    }
  ],
  "edges": [
    {
      "id": "string",
      "from": "node_id",
      "to": "node_id",
      "count": 1,
      "avg_duration": 31,
      "travel_mode": "bus"
    }
  ],
  "heatpoints": [
    { "lat": 40.4425, "lng": -79.9435, "weight": 1.2 }
  ],
  "neighborhoods": {
    "Oakland": { "pct": 94, "discovered": 8, "total": 9 },
    "Shadyside": { "pct": 71, "discovered": 7, "total": 10 },
    "Lawrenceville": { "pct": 13, "discovered": 1, "total": 11 }
  }
}
```

---

## GET /api/users/:userId/profile

Taste profile for recommendation card (can ship after core loop).

**Response (success)**

```json
{
  "success": true,
  "user_id": "string",
  "display_name": "Fabio",
  "place_type_preferences": [
    { "place_type": "urban_core", "frequency_pct": 65 },
    { "place_type": "food", "frequency_pct": 20 },
    { "place_type": "park", "frequency_pct": 15 }
  ],
  "total_trips": 20,
  "total_discovery": 8
}
```

---

## Status codes

| Code | When |
|------|------|
| 200 | Success |
| 400 | Missing/invalid body fields |
| 401 | Missing/invalid JWT |
| 403 | Not a group member / not an accepted friend / not the invitee |
| 404 | Unknown group/user/invite |
| 409 | Already a member / invite already sent |
| 501 | Stub not implemented yet |
| 500 | Mongo / Google Places / unexpected |

---

## Lock rule

Once Person 1 + 2 agree this file is locked, change it only via Slack ping + PR. Backend implements it; frontend consumes it; Person 3 seeds data that matches these shapes.
