/**
 * Load seed JSON into MongoDB Atlas.
 * Stub: prints instructions until Person 3 finishes output writers + insert logic.
 */
import "dotenv/config";
import { MongoClient } from "mongodb";
import { COLLECTIONS, DB_NAME, INDEXES } from "../mongodb-schema.js";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Set MONGODB_URI in shared/mongodb-seed/.env (see atlas-setup.md)");
    process.exit(1);
  }

  console.log("[load] Stub — connect check only. Full insert comes after generate writes output/.");
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || DB_NAME);
    console.log("[load] Connected to", db.databaseName);
    console.log("[load] Collections expected:", Object.values(COLLECTIONS).join(", "));
    console.log("[load] Indexes defined for:", Object.keys(INDEXES).join(", "));
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
