/**
 * Wipe user-generated Atlas data so Drift can start with real Auth0 accounts.
 * Keeps the Pittsburgh places catalog (restaurants, parks, shops, …).
 *
 * Usage: npm run clear
 */
import "dotenv/config";
import { MongoClient } from "mongodb";
import { COLLECTIONS, DB_NAME, INDEXES } from "../mongodb-schema.js";

const KEEP = new Set(["places_catalog"]);

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
    console.error("Set MONGODB_URI in shared/mongodb-seed/.env");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || DB_NAME);
  console.log("[clear] Connected to", db.databaseName);

  const names = new Set(Object.values(COLLECTIONS));
  names.add("places_catalog");

  const existing = await db.listCollections().toArray();
  for (const { name } of existing) names.add(name);

  const wiped = {};
  for (const name of names) {
    if (KEEP.has(name)) continue;
    const result = await db.collection(name).deleteMany({});
    wiped[name] = result.deletedCount;
  }

  await ensureIndexes(db);

  const catalogCount = await db.collection("places_catalog").countDocuments();
  console.log("[clear] Deleted fake seed / user graph data:", wiped);
  console.log("[clear] Kept places_catalog:", catalogCount, "places");
  console.log("[clear] Next: log in with Auth0, create a group, invite friends, log real trips.");

  await client.close();
}

main().catch((err) => {
  console.error("[clear] FAILED:", err);
  process.exit(1);
});
