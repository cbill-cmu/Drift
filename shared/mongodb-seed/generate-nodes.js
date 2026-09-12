import { NODE_PLACE_TYPES } from "../mongodb-schema.js";

/**
 * Pittsburgh nodes stub — enough shape for P1/P2.
 * Person 3: expand to ~100 nodes; keep Lawrenceville sparse for demo %.
 */
export function generateNodes(users) {
  const creator = users[0];
  const group = {
    _localId: "group_cmu_crew",
    name: "CMU CREW",
    creator_id: creator._localId,
    member_ids: users.map((u) => u._localId),
    created_at: new Date(),
    total_nodes_discovered: 0,
    total_edges_discovered: 0,
  };

  const seedPlaces = [
    { name: "CMU", neighborhood: "Oakland", lat: 40.4425, lng: -79.9435, place_type: "urban_core" },
    { name: "Schenley Park", neighborhood: "Oakland", lat: 40.4346, lng: -79.9426, place_type: "park" },
    { name: "Shadyside Square", neighborhood: "Shadyside", lat: 40.4522, lng: -79.9349, place_type: "shopping" },
    { name: "Walnut Street", neighborhood: "Shadyside", lat: 40.451, lng: -79.9335, place_type: "food" },
    { name: "Lawrenceville Strip", neighborhood: "Lawrenceville", lat: 40.4501, lng: -79.9585, place_type: "urban_core" },
  ];

  const now = new Date();
  const nodes = seedPlaces.map((p, i) => ({
    _localId: `node_${i}`,
    group_id: group._localId,
    name: p.name,
    neighborhood: p.neighborhood,
    lat: p.lat,
    lng: p.lng,
    place_type: NODE_PLACE_TYPES.includes(p.place_type) ? p.place_type : "unknown",
    visit_count: p.neighborhood === "Lawrenceville" ? 1 : 8,
    first_discovered_by: creator._localId,
    first_discovered_at: now,
    created_at: now,
  }));

  group.total_nodes_discovered = nodes.length;
  return { group, nodes };
}
