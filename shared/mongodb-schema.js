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

export const FRIEND_STATUSES = ["pending", "accepted", "blocked"];

/**
 * Document shapes (reference only — Mongo is schemaless).
 *
 * users: {
 *   auth0_id, email, display_name, created_at, groups: [ObjectId]
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
};
