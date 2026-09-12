/**
 * Recommendation / taste heuristics (Person B).
 */
import { ObjectId } from "mongodb";

import { COLLECTIONS, INDEXES } from "../models/index.js";
import { asString, idVariants } from "./ids.js";

/**
 * Compute a user's place_type frequency distribution from raw trips.
 *
 * Pure function — no DB access. Counts each trip's *destination* node's
 * place_type (not both endpoints, to avoid double-counting and because
 * "where a trip took you" is the more meaningful taste signal than the
 * origin, which is often just "home"/CMU for everyone).
 *
 * @param {Array<{ to_node_id: any }>} trips - trip docs (or trip-like objects)
 * @param {Map<string, string> | Record<string, string>} nodePlaceTypeById -
 *   lookup from node id (string) -> place_type. Accepts a Map or a plain object.
 * @returns {Array<{ place_type: string, frequency_pct: number, trip_count: number }>}
 *   sorted by frequency_pct descending, summing to ~100.
 */
export function computePlaceTypeDistribution(trips, nodePlaceTypeById) {
  if (!Array.isArray(trips) || trips.length === 0) return [];

  const lookup =
    nodePlaceTypeById instanceof Map
      ? (key) => nodePlaceTypeById.get(key)
      : (key) => nodePlaceTypeById?.[key];

  const counts = new Map();
  let total = 0;

  for (const trip of trips) {
    const nodeId = asString(trip?.to_node_id);
    if (!nodeId) continue;
    const placeType = lookup(nodeId) || "unknown";
    counts.set(placeType, (counts.get(placeType) || 0) + 1);
    total += 1;
  }

  if (total === 0) return [];

  return Array.from(counts.entries())
    .map(([place_type, trip_count]) => ({
      place_type,
      trip_count,
      frequency_pct: roundPct((trip_count / total) * 100),
    }))
    .sort((a, b) => b.frequency_pct - a.frequency_pct || b.trip_count - a.trip_count);
}

function roundPct(value) {
  return Math.round(value * 10) / 10;
}

let profileIndexesReady = false;

async function ensureProfileIndexes(db) {
  if (profileIndexesReady) return;
  try {
    await db
      .collection(COLLECTIONS.USER_PLACE_TYPE_PROFILES)
      .createIndexes(INDEXES.user_place_type_profiles);
  } catch (err) {
    console.warn("[recommendation] ensureProfileIndexes:", err.message);
  }
  profileIndexesReady = true;
}

function canonicalUserId(userId) {
  if (userId instanceof ObjectId) return userId;
  if (typeof userId === "string" && ObjectId.isValid(userId)) return new ObjectId(userId);
  return userId;
}

/**
 * Recompute and persist a user's UserPlaceTypeProfile from their trip history.
 *
 * Reads all trips for the user, looks up the place_type of each trip's
 * destination node, computes the distribution (see computePlaceTypeDistribution),
 * and upserts one doc per place_type into user_place_type_profiles — matching
 * the schema: { user_id, place_type, frequency_pct, trip_count, last_updated }.
 * Any place_type no longer present in the user's history is removed so the
 * collection never holds stale entries.
 *
 * @param {import("mongodb").Db} db
 * @param {any} userId
 * @returns {Promise<Array<{ place_type: string, frequency_pct: number, trip_count: number }>>}
 */
export async function recomputeUserPlaceTypeProfile(db, userId) {
  await ensureProfileIndexes(db);

  const userVariants = idVariants(userId);
  const trips = await db
    .collection(COLLECTIONS.TRIPS)
    .find({ $or: userVariants.map((value) => ({ user_id: value })) })
    .toArray();

  const nodeIds = [...new Set(trips.map((t) => asString(t.to_node_id)).filter(Boolean))];
  const nodeObjectIds = nodeIds.flatMap((id) => idVariants(id));
  const nodes = nodeObjectIds.length
    ? await db
        .collection(COLLECTIONS.NODES)
        .find({ _id: { $in: nodeObjectIds } })
        .toArray()
    : [];
  const nodePlaceTypeById = new Map(nodes.map((n) => [asString(n._id), n.place_type || "unknown"]));

  const distribution = computePlaceTypeDistribution(trips, nodePlaceTypeById);
  const uid = canonicalUserId(userId);
  const profiles = db.collection(COLLECTIONS.USER_PLACE_TYPE_PROFILES);
  const now = new Date();

  if (distribution.length) {
    await profiles.bulkWrite(
      distribution.map((d) => ({
        updateOne: {
          filter: { user_id: uid, place_type: d.place_type },
          update: {
            $set: {
              frequency_pct: d.frequency_pct,
              trip_count: d.trip_count,
              last_updated: now,
            },
          },
          upsert: true,
        },
      }))
    );
  }

  const currentTypes = distribution.map((d) => d.place_type);
  await profiles.deleteMany({
    user_id: uid,
    place_type: { $nin: currentTypes.length ? currentTypes : ["__none__"] },
  });

  return distribution;
}

/**
 * Recommendation heuristic stub (lower priority — Task 4/stretch).
 */
export function topPlaceTypes(_profiles, _limit = 3) {
  return [];
}
