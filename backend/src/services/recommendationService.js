/**
 * Recommendation / taste heuristics (Person B).
 */
import { asString } from "./ids.js";

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

/**
 * Recommendation heuristic stub (lower priority — Task 4/stretch).
 */
export function topPlaceTypes(_profiles, _limit = 3) {
  return [];
}
