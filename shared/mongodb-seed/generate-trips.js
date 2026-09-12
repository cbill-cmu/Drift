import { TRAVEL_MODES } from "../mongodb-schema.js";

/**
 * Trip / edge / heat stub.
 * Person 3: generate ~2 weeks of trips; leave Lawrenceville edge for live demo.
 */
export function generateTrips(users, group, nodes) {
  const fabio = users[0];
  const cmu = nodes.find((n) => n.name === "CMU");
  const shadyside = nodes.find((n) => n.name === "Shadyside Square");
  const now = new Date();

  const trips = [];
  const edges = [];
  const heatpoints = [];
  const profiles = [];

  if (cmu && shadyside) {
    edges.push({
      _localId: "edge_0",
      group_id: group._localId,
      from_node_id: cmu._localId,
      to_node_id: shadyside._localId,
      travel_mode: "walk",
      avg_duration_min: 22,
      traversal_count: 5,
      first_traveled_by: fabio._localId,
      first_traveled_at: now,
      created_at: now,
    });

    for (let i = 0; i < 5; i++) {
      trips.push({
        _localId: `trip_${i}`,
        group_id: group._localId,
        user_id: fabio._localId,
        from_node_id: cmu._localId,
        to_node_id: shadyside._localId,
        started_at: new Date(now.getTime() - i * 86400000),
        ended_at: new Date(now.getTime() - i * 86400000 + 22 * 60000),
        duration_min: 22,
        travel_mode: TRAVEL_MODES[0],
        user_created_at: now,
      });
    }

    heatpoints.push(
      { group_id: group._localId, lat: cmu.lat, lng: cmu.lng, weight: 5, recorded_at: now },
      { group_id: group._localId, lat: shadyside.lat, lng: shadyside.lng, weight: 3, recorded_at: now }
    );
  }

  profiles.push({
    user_id: fabio._localId,
    place_type: "urban_core",
    frequency_pct: 65,
    trip_count: 5,
    last_updated: now,
  });

  group.total_edges_discovered = edges.length;
  return { trips, edges, heatpoints, profiles };
}
