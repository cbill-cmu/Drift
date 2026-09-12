/**
 * Drift MongoDB schema constants (Person 1 + Person 3 lock).
 * Backend imports these for collection names / enums.
 * Seed scripts use the same names so Atlas data matches the API.
 */

export const DB_NAME = "drift";

export const COLLECTIONS = {
  USERS: "users",
  GROUPS: "groups",
  NODES: "nodes",
  EDGES: "edges",
  TRIPS: "trips",
  HEATPOINTS: "heatpoints",
  USER_HEATPOINTS: "user_heatpoints",
  USER_PLACE_TYPE_PROFILES: "user_place_type_profiles",
  FRIENDS: "friends",
  GROUP_INVITES: "group_invites",
  LOCATION_TRACES: "location_traces",
  USER_VISITED_CELLS: "user_visited_cells",
};

/** H3 resolution used for the base "visited" unit (~0.1 km², city-block
 * scale). Resolution 7 (~5 km²) is used only for zoomed-out rendering,
 * derived on the fly via h3.cellToParent — never stored separately. */
export const VISITED_CELL_RESOLUTION = 9;

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

export const FRIEND_STATUSES = ["pending", "accepted", "blocked"];

export const GROUP_INVITE_STATUSES = ["pending", "accepted", "declined"];

/**
 * Document shapes (reference only — Mongo is schemaless).
 *
 * users: {
 *   auth0_id, email, display_name, created_at, groups: [ObjectId],
 *   contributes_to: [ObjectId]  // optional allowlist of groups that may
 *                               // include this user's visited cells in
 *                               // GET /coverage. Omitted/null = share
 *                               // with every current membership (legacy
 *                               // default). An explicit array is the
 *                               // source of truth — opt-out removes a
 *                               // group_id; opt-in adds it back. Cells
 *                               // are never deleted.
 * }
 * groups: {
 *   name, creator_id, member_ids: [ObjectId], created_at,
 *   total_nodes_discovered, total_edges_discovered
 * }
 * nodes: {
 *   group_id, name, neighborhood, lat, lng, place_type,
 *   visit_count, first_discovered_by, first_discovered_at, created_at
 * }
 * edges: {
 *   group_id, from_node_id, to_node_id, travel_mode,
 *   avg_duration_min, traversal_count, first_traveled_by, first_traveled_at, created_at
 * }
 * trips: {
 *   group_id, user_id, from_node_id, to_node_id,
 *   started_at, ended_at, duration_min, travel_mode, user_created_at
 * }
 * heatpoints: { group_id, lat, lng, weight, recorded_at }
 * user_heatpoints: { group_id, user_id, lat, lng, weight, recorded_at }
 * user_place_type_profiles: {
 *   user_id, place_type, frequency_pct, trip_count, last_updated
 * }
 * friends: { user_id_1, user_id_2, status, created_at }
 * group_invites: {
 *   group_id, inviter_id, invitee_id, status, created_at, updated_at
 * }
 *
 * --- Location tracking + fog-of-war (see requirements.md §3, §5-6) ---
 *
 * location_traces: {
 *   user_id, started_at, ended_at,
 *   polyline,       // encoded string of accepted [lat,lng] fixes
 *   point_count, distance_m, created_at
 * }
 * // Personal, never group_id-scoped. Rolling 30-day retention — this is
 * // raw history, not what group overlays read from (see below).
 *
 * user_visited_cells: {
 *   user_id, h3_cell,   // H3 cell at VISITED_CELL_RESOLUTION
 *   first_visited_at, last_visited_at, visit_count
 * }
 * // The durable, privacy-safe derivative of location_traces. Kept
 * // indefinitely — one doc per hex a user has ever entered, not per GPS
 * // ping, so this stays small. Never stores group_id: group membership
 * // is applied at aggregation time (GET /api/groups/:groupId/coverage),
 * // not baked into the row, so leaving a group needs no data rewrite.
 */

export const INDEXES = {
  nodes: [
    { key: { group_id: 1, lat: 1, lng: 1 } },
    { key: { group_id: 1, place_type: 1 } },
    { key: { group_id: 1, neighborhood: 1 } },
  ],
  edges: [{ key: { group_id: 1, from_node_id: 1, to_node_id: 1 } }],
  trips: [
    { key: { group_id: 1, user_id: 1 } },
    { key: { group_id: 1, started_at: -1 } },
  ],
  heatpoints: [{ key: { group_id: 1, lat: 1, lng: 1 } }],
  user_heatpoints: [{ key: { group_id: 1, user_id: 1 } }],
  users: [{ key: { auth0_id: 1 }, unique: true }, { key: { email: 1 } }],
  groups: [{ key: { name: 1 } }],
  user_place_type_profiles: [{ key: { user_id: 1, place_type: 1 }, unique: true }],
  group_invites: [
    { key: { group_id: 1, invitee_id: 1 }, unique: true },
    { key: { invitee_id: 1, status: 1 } },
  ],
  location_traces: [{ key: { user_id: 1, started_at: -1 } }],
  user_visited_cells: [{ key: { user_id: 1, h3_cell: 1 }, unique: true }],
};
