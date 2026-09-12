/**
 * Recommendation / taste heuristics (Person B).
 */
import { ObjectId } from "mongodb";

import { COLLECTIONS, INDEXES } from "../models/index.js";
import { asString, idVariants, matchGroupId } from "./ids.js";
import { PLACES_CATALOG } from "./placesCatalogService.js";

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

const ACTIVITY_TYPES = {
  food: {
    id: "food",
    label: "Food",
    blurb: "Meals, groceries, and casual bites.",
    categories: ["food"],
    place_types: ["food"],
  },
  recreation: {
    id: "recreation",
    label: "Recreation",
    blurb: "Games, stadiums, and active hangouts.",
    categories: ["recreation"],
    place_types: ["entertainment"],
  },
  chill: {
    id: "chill",
    label: "Chill",
    blurb: "Parks, plazas, and easy outdoor time.",
    categories: ["outdoors", "hangout"],
    place_types: ["park"],
  },
  night_life: {
    id: "night_life",
    label: "Night life",
    blurb: "Bars, music, and late spots.",
    categories: ["night_life"],
    place_types: ["entertainment"],
  },
  sights: {
    id: "sights",
    label: "Sights",
    blurb: "Landmarks, museums, and views.",
    categories: ["sights"],
    place_types: ["urban_core"],
  },
};

function activityTypeFor(place = {}) {
  const category = place.category || "";
  if (ACTIVITY_TYPES[category]) return category;
  if (category === "outdoors" || category === "hangout") return "chill";
  if (place.place_type === "food") return "food";
  if (place.place_type === "park") return "chill";
  if (place.place_type === "entertainment") {
    return category === "recreation" ? "recreation" : "night_life";
  }
  if (place.place_type === "urban_core") return "sights";
  if (place.place_type === "shopping") return "food";
  return "chill";
}

function bump(map, key, amount) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function normalizeScores(map) {
  const total = [...map.values()].reduce((sum, n) => sum + n, 0);
  if (!total) return new Map();
  return new Map([...map.entries()].map(([k, v]) => [k, v / total]));
}

export function topPlaceTypes(profiles, limit = 3) {
  return [...(profiles || [])]
    .sort((a, b) => (b.frequency_pct || 0) - (a.frequency_pct || 0))
    .slice(0, limit)
    .map((p) => p.place_type);
}

/**
 * Pick 3 activity types from personal + group history, then suggest
 * unvisited catalog places with activity type and location name.
 */
export async function buildRecommendations(db, { userId, groupId }) {

  const userTrips = userId
    ? await db
        .collection(COLLECTIONS.TRIPS)
        .find({ $or: idVariants(userId).map((value) => ({ user_id: value })) })
        .toArray()
    : [];

  const destIds = [...new Set(userTrips.map((t) => asString(t.to_node_id)).filter(Boolean))];
  const destNodes = destIds.length
    ? await db
        .collection(COLLECTIONS.NODES)
        .find({ _id: { $in: destIds.flatMap((id) => idVariants(id)) } })
        .toArray()
    : [];

  const groupNodes = groupId
    ? await db
        .collection(COLLECTIONS.NODES)
        .find(matchGroupId("group_id", groupId))
        .toArray()
    : [];

  const userScores = new Map();
  const visitedNames = new Set();
  const visitedCatalog = new Set();
  const familiarHoods = new Map();

  for (const node of destNodes) {
    bump(userScores, activityTypeFor(node), 1);
    if (node.name) visitedNames.add(node.name.toLowerCase());
    if (node.catalog_place_id) visitedCatalog.add(asString(node.catalog_place_id));
    bump(familiarHoods, node.neighborhood, 1);
  }

  const groupScores = new Map();
  for (const node of groupNodes) {
    bump(groupScores, activityTypeFor(node), Number(node.visit_count) || 1);
    bump(familiarHoods, node.neighborhood, 0.35);
  }

  const userN = normalizeScores(userScores);
  const groupN = normalizeScores(groupScores);
  const blended = new Map();
  for (const id of Object.keys(ACTIVITY_TYPES)) {
    const score = (userN.get(id) || 0) * 0.7 + (groupN.get(id) || 0) * 0.3;
    blended.set(id, score);
  }

  const ranked = [...blended.entries()].sort((a, b) => b[1] - a[1]);
  const picked = [];
  if (ranked[0] && ranked[0][1] > 0) picked.push(ranked[0][0]);

  const complement = {
    food: ["night_life", "chill"],
    night_life: ["food", "sights"],
    recreation: ["chill", "food"],
    chill: ["food", "sights"],
    sights: ["chill", "food"],
  };
  for (const next of complement[picked[0]] || ["food", "chill"]) {
    if (!picked.includes(next)) picked.push(next);
    if (picked.length === 2) break;
  }

  const stretch = ranked.map(([id]) => id).find((id) => !picked.includes(id) && (blended.get(id) || 0) < 0.22);
  if (stretch) picked.push(stretch);
  for (const id of ["food", "recreation", "chill", "night_life", "sights"]) {
    if (picked.length >= 3) break;
    if (!picked.includes(id)) picked.push(id);
  }

  const catalog = await db.collection(PLACES_CATALOG).find({}).toArray();
  const usedIds = new Set();

  const categories = picked.slice(0, 3).map((typeId) => {
    const meta = ACTIVITY_TYPES[typeId];
    const candidates = catalog
      .filter((place) => {
        if (usedIds.has(asString(place._id))) return false;
        if (visitedCatalog.has(asString(place._id))) return false;
        if (visitedNames.has(String(place.name || "").toLowerCase())) return false;
        return activityTypeFor(place) === typeId;
      })
      .sort((a, b) => {
        const aFam = familiarHoods.get(a.neighborhood) || 0;
        const bFam = familiarHoods.get(b.neighborhood) || 0;
        return bFam - aFam || String(a.name).localeCompare(String(b.name));
      });

    const places = candidates.slice(0, 3).map((place) => {
      usedIds.add(asString(place._id));
      return {
        location_name: place.name,
        activity_type: meta.label,
        activity_type_id: typeId,
        neighborhood: place.neighborhood || "Pittsburgh",
        kind: place.kind || typeId,
        lat: place.lat,
        lng: place.lng,
        place_id: asString(place._id),
      };
    });

    const why =
      (userN.get(typeId) || 0) >= 0.28
        ? `You already spend a lot of time on ${meta.label.toLowerCase()} — here are new spots in that lane.`
        : (groupN.get(typeId) || 0) >= 0.2
          ? `Your group has been around ${meta.label.toLowerCase()}. These are still unvisited.`
          : `A mix-in: ${meta.blurb}`;

    return {
      activity_type: meta.label,
      activity_type_id: typeId,
      blurb: meta.blurb,
      why,
      places,
    };
  });

  return {
    success: true,
    based_on: {
      user_trips: userTrips.length,
      group_places: groupNodes.length,
    },
    categories,
  };
}
