# Drift API Contract (DRAFT — lock with Person 1 + 2 in Hour 0)

Base URL (local): `http://localhost:3000`  
Auth: `Authorization: Bearer <Auth0 access token>` on all `/api/*` routes  
Errors: `{ "success": false, "error": "string" }` with 400 / 401 / 500 as appropriate

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
| 404 | Unknown group/user |
| 501 | Stub not implemented yet |
| 500 | Mongo / Google Places / unexpected |

---

## Lock rule

Once Person 1 + 2 agree this file is locked, change it only via Slack ping + PR. Backend implements it; frontend consumes it; Person 3 seeds data that matches these shapes.
