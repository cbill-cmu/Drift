/**
 * Wipe + load seed JSON from output/ into MongoDB Atlas.
 * Remaps _localId strings to ObjectIds. Re-run verify after load (IDs change).
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient, ObjectId } from "mongodb";
import { COLLECTIONS, DB_NAME, INDEXES } from "../mongodb-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "output");

function read(name) {
  const file = path.join(outDir, name);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file} — run npm run generate first`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function oid() {
  return new ObjectId();
}

async function ensureIndexes(db) {
  for (const [coll, specs] of Object.entries(INDEXES)) {
    const collectionName = COLLECTIONS[coll.toUpperCase()] || coll;
    const collection = db.collection(collectionName);
    for (const spec of specs) {
      try {
        await collection.createIndex(spec.key, {
          unique: Boolean(spec.unique),
        });
      } catch (err) {
        // Index already exists under another name — fine
        if (err?.code !== 85 && err?.codeName !== "IndexOptionsConflict") {
          throw err;
        }
      }
    }
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Set MONGODB_URI in shared/mongodb-seed/.env (see atlas-setup.md)");
    process.exit(1);
  }

  const usersIn = read("users.json");
  const groupIn = read("group.json");
  const nodesIn = read("nodes.json");
  const tripsIn = read("trips.json");
  const edgesIn = read("edges.json");
  const heatIn = read("heatpoints.json");
  const userHeatIn = read("user_heatpoints.json");
  const profilesIn = read("profiles.json");

  const userIds = new Map();
  for (const u of usersIn) userIds.set(u._localId, oid());
  const groupId = oid();
  const nodeIds = new Map();
  for (const n of nodesIn) nodeIds.set(n._localId, oid());

  const users = usersIn.map((u) => {
    const { _localId, ...rest } = u;
    return {
      ...rest,
      _id: userIds.get(_localId),
      groups: [groupId],
      created_at: new Date(rest.created_at),
    };
  });

  const group = {
    _id: groupId,
    name: groupIn.name,
    creator_id: userIds.get(groupIn.creator_id),
    member_ids: groupIn.member_ids.map((id) => userIds.get(id)),
    created_at: new Date(groupIn.created_at),
    total_nodes_discovered: groupIn.total_nodes_discovered,
    total_edges_discovered: groupIn.total_edges_discovered,
    neighborhood_totals: groupIn.neighborhood_totals || {},
  };

  const nodes = nodesIn.map((n) => {
    const { _localId, ...rest } = n;
    return {
      ...rest,
      _id: nodeIds.get(_localId),
      group_id: groupId,
      first_discovered_by: userIds.get(rest.first_discovered_by),
      first_discovered_at: new Date(rest.first_discovered_at),
      created_at: new Date(rest.created_at),
    };
  });

  const edges = edgesIn.map((e) => {
    const { _localId, ...rest } = e;
    return {
      ...rest,
      _id: oid(),
      group_id: groupId,
      from_node_id: nodeIds.get(rest.from_node_id),
      to_node_id: nodeIds.get(rest.to_node_id),
      first_traveled_by: userIds.get(rest.first_traveled_by),
      first_traveled_at: new Date(rest.first_traveled_at),
      created_at: new Date(rest.created_at),
    };
  });

  const trips = tripsIn.map((t) => {
    const { _localId, ...rest } = t;
    return {
      ...rest,
      _id: oid(),
      group_id: groupId,
      user_id: userIds.get(rest.user_id),
      from_node_id: nodeIds.get(rest.from_node_id),
      to_node_id: nodeIds.get(rest.to_node_id),
      started_at: new Date(rest.started_at),
      ended_at: new Date(rest.ended_at),
      user_created_at: new Date(rest.user_created_at),
    };
  });

  const heatpoints = heatIn.map((h) => ({
    ...h,
    _id: oid(),
    group_id: groupId,
    recorded_at: new Date(h.recorded_at),
  }));

  const user_heatpoints = userHeatIn.map((h) => ({
    ...h,
    _id: oid(),
    group_id: groupId,
    user_id: userIds.get(h.user_id),
    recorded_at: new Date(h.recorded_at),
  }));

  const profiles = profilesIn.map((p) => ({
    ...p,
    _id: oid(),
    user_id: userIds.get(p.user_id),
    last_updated: new Date(p.last_updated),
  }));

  // Simple accepted friendships: Fabio friends with everyone else
  const fabioId = userIds.get("user_0");
  const friends = usersIn.slice(1).map((u) => ({
    _id: oid(),
    user_id_1: fabioId,
    user_id_2: userIds.get(u._localId),
    status: "accepted",
    created_at: new Date(),
  }));

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || DB_NAME);
  console.log("[load] Connected to", db.databaseName);
  console.log("[load] Wiping seed collections…");

  const names = Object.values(COLLECTIONS);
  for (const name of names) {
    await db.collection(name).deleteMany({});
  }

  await db.collection(COLLECTIONS.USERS).insertMany(users);
  await db.collection(COLLECTIONS.GROUPS).insertOne(group);
  await db.collection(COLLECTIONS.NODES).insertMany(nodes);
  await db.collection(COLLECTIONS.EDGES).insertMany(edges);
  await db.collection(COLLECTIONS.TRIPS).insertMany(trips);
  await db.collection(COLLECTIONS.HEATPOINTS).insertMany(heatpoints);
  if (user_heatpoints.length) {
    await db.collection(COLLECTIONS.USER_HEATPOINTS).insertMany(user_heatpoints);
  }
  if (profiles.length) {
    await db.collection(COLLECTIONS.USER_PLACE_TYPE_PROFILES).insertMany(profiles);
  }
  if (friends.length) {
    await db.collection(COLLECTIONS.FRIENDS).insertMany(friends);
  }

  await ensureIndexes(db);

  console.log("[load] Inserted:", {
    users: users.length,
    groups: 1,
    nodes: nodes.length,
    edges: edges.length,
    trips: trips.length,
    heatpoints: heatpoints.length,
    user_heatpoints: user_heatpoints.length,
    profiles: profiles.length,
    friends: friends.length,
  });
  console.log("[load] group_id:", groupId.toHexString());
  console.log("[load] fabio_user_id:", fabioId.toHexString());
  console.log("[load] Next: npm run verify  (then update HANDOFF.md + VITE_DEMO_GROUP_ID)");

  await client.close();
}

main().catch((err) => {
  console.error("[load] FAILED:", err);
  process.exit(1);
});
