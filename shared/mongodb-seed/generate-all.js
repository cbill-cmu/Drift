/**
 * Seed orchestration stub.
 * Person 3: implement generate-all to write output/*.json then run load-to-db.js
 */
import { generateUsers } from "./generate-users.js";
import { generateNodes } from "./generate-nodes.js";
import { generateTrips } from "./generate-trips.js";

console.log("[seed] Generating demo dataset (stub — replace with full Pittsburgh data)...");

const users = generateUsers();
const { group, nodes } = generateNodes(users);
const { trips, edges, heatpoints, profiles } = generateTrips(users, group, nodes);

console.log("[seed] Stub counts:", {
  users: users.length,
  nodes: nodes.length,
  trips: trips.length,
  edges: edges.length,
  heatpoints: heatpoints.length,
  profiles: profiles.length,
});
console.log("[seed] Next: implement writers to output/ then npm run load");
