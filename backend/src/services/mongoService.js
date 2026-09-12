import { MongoClient } from "mongodb";

let client;
let db;

/**
 * Connect to MongoDB Atlas using MONGODB_URI.
 * Collection names: import from shared/mongodb-schema.js when wiring queries.
 */
export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGODB_DB || "drift");
  console.log("[mongo] Connected to Atlas db:", db.databaseName);
  return db;
}

export function getDb() {
  if (!db) throw new Error("Mongo not connected — call connectMongo() first");
  return db;
}

export async function closeMongo() {
  if (client) await client.close();
  client = undefined;
  db = undefined;
}
