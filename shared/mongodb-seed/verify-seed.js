/**
 * Person 3 helper: read Atlas seed and print/write a GET /graph-shaped payload.
 * Unblocks Person 1 (compare their endpoint) and Person 2 (fixture for map UI).
 *
 * Usage: npm run verify
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient, ObjectId } from "mongodb";
import { COLLECTIONS, DB_NAME } from "../mongodb-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "..", "fixtures");

function pct(discovered, total) {
  if (!total) return 0;
  return Math.round((discovered / total) * 100);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Set MONGODB_URI in shared/mongodb-seed/.env");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || DB_NAME);

  const group = await db.collection(COLLECTIONS.GROUPS).findOne({ name: "CMU CREW" });
  if (!group) {
    console.error('No group named "CMU CREW" — run npm run load first');
    process.exit(1);
  }

  const groupId = group._id;
  const [nodes, edges, heatpoints, users, trips] = await Promise.all([
    db.collection(COLLECTIONS.NODES).find({ group_id: groupId }).toArray(),
    db.collection(COLLECTIONS.EDGES).find({ group_id: groupId }).toArray(),
    db.collection(COLLECTIONS.HEATPOINTS).find({ group_id: groupId }).toArray(),
    db.collection(COLLECTIONS.USERS).find({}).toArray(),
    db.collection(COLLECTIONS.TRIPS).countDocuments({ group_id: groupId }),
  ]);

  const totals = group.neighborhood_totals || {};
  const discoveredByHood = {};
  for (const n of nodes) {
    discoveredByHood[n.neighborhood] = (discoveredByHood[n.neighborhood] || 0) + 1;
  }

  const neighborhoods = {};
  const hoodNames = new Set([...Object.keys(totals), ...Object.keys(discoveredByHood)]);
  for (const name of hoodNames) {
    const discovered = discoveredByHood[name] || 0;
    const total = totals[name] || discovered;
    neighborhoods[name] = {
      pct: pct(discovered, total),
      discovered,
      total,
    };
  }

  const payload = {
    success: true,
    group_id: groupId.toHexString(),
    group_name: group.name,
    nodes: nodes.map((n) => ({
      id: n._id.toHexString(),
      name: n.name,
      neighborhood: n.neighborhood,
      lat: n.lat,
      lng: n.lng,
      place_type: n.place_type,
      visits: n.visit_count,
    })),
    edges: edges.map((e) => ({
      id: e._id.toHexString(),
      from: e.from_node_id.toHexString(),
      to: e.to_node_id.toHexString(),
      count: e.traversal_count,
      avg_duration: e.avg_duration_min,
      travel_mode: e.travel_mode,
    })),
    heatpoints: heatpoints.map((h) => ({
      lat: h.lat,
      lng: h.lng,
      weight: h.weight,
    })),
    neighborhoods,
  };

  // Demo trip fixture for Person 2 animation work (no backend required)
  const discoveryFixture = {
    success: true,
    actor_name: "Fabio",
    new_node: null,
    new_edge: {
      id: "demo-edge",
      from: "CMU",
      to: "Lawrenceville",
      duration_min: 31,
    },
    neighborhood_pct_before: neighborhoods.Lawrenceville?.pct ?? 9,
    neighborhood_pct_after: Math.min(
      100,
      (neighborhoods.Lawrenceville?.pct ?? 9) + 9
    ),
  };

  fs.mkdirSync(fixturesDir, { recursive: true });
  const graphPath = path.join(fixturesDir, "graph-response.json");
  const discoveryPath = path.join(fixturesDir, "discovery-response.json");
  fs.writeFileSync(graphPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(discoveryPath, JSON.stringify(discoveryFixture, null, 2));

  console.log("[verify] Atlas OK");
  console.log({
    group_id: payload.group_id,
    users: users.length,
    nodes: nodes.length,
    edges: edges.length,
    heatpoints: heatpoints.length,
    trips,
    lawrenceville: neighborhoods.Lawrenceville,
  });
  console.log("[verify] Wrote", graphPath);
  console.log("[verify] Wrote", discoveryPath);
  console.log("\nSlack Person 2: use shared/fixtures/graph-response.json to mock the map.");
  console.log("Slack Person 1: GET /api/groups/" + payload.group_id + "/graph should match this shape.");

  await client.close();
}

main().catch((err) => {
  console.error("[verify] FAILED:", err.message);
  process.exit(1);
});
