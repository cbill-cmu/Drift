/**
 * Write full Pittsburgh demo dataset to output/*.json for load-to-db.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateUsers } from "./generate-users.js";
import { generateNodes } from "./generate-nodes.js";
import { generateTrips } from "./generate-trips.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "output");

function write(name, data) {
  const file = path.join(outDir, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log("[seed] wrote", file);
}

console.log("[seed] Generating Pittsburgh demo dataset...");

const users = generateUsers();
const { group, nodes } = generateNodes(users);
const { trips, edges, heatpoints, user_heatpoints, profiles } = generateTrips(
  users,
  group,
  nodes
);

fs.mkdirSync(outDir, { recursive: true });
write("users.json", users);
write("group.json", group);
write("nodes.json", nodes);
write("trips.json", trips);
write("edges.json", edges);
write("heatpoints.json", heatpoints);
write("user_heatpoints.json", user_heatpoints);
write("profiles.json", profiles);

const lawrenceville = nodes.filter((n) => n.neighborhood === "Lawrenceville");
console.log("[seed] counts:", {
  users: users.length,
  nodes: nodes.length,
  trips: trips.length,
  edges: edges.length,
  heatpoints: heatpoints.length,
  user_heatpoints: user_heatpoints.length,
  profiles: profiles.length,
  lawrenceville_nodes: lawrenceville.length,
});
console.log("[seed] Next: npm run load");
