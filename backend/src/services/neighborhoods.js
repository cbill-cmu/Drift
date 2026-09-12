import { COLLECTIONS } from "../models/index.js";
import { matchGroupId } from "./ids.js";

/** Keep in sync with graph neighborhood bars. */
export const HOOD_TOTALS = {
  Oakland: 9,
  Shadyside: 10,
  "Squirrel Hill": 11,
  "East Liberty": 10,
  "South Side": 9,
  Lawrenceville: 11,
  Downtown: 11,
  Bloomfield: 9,
};

export const HOOD_CENTROIDS = [
  { name: "Oakland", lat: 40.4425, lng: -79.9435 },
  { name: "Shadyside", lat: 40.4522, lng: -79.9349 },
  { name: "Squirrel Hill", lat: 40.438, lng: -79.922 },
  { name: "East Liberty", lat: 40.461, lng: -79.924 },
  { name: "South Side", lat: 40.428, lng: -79.974 },
  { name: "Lawrenceville", lat: 40.4501, lng: -79.9585 },
  { name: "Downtown", lat: 40.441, lng: -80.002 },
  { name: "Bloomfield", lat: 40.462, lng: -79.949 },
];

export function haversineMeters(aLat, aLng, bLat, bLng) {
  const R = 6_371_000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function inferNeighborhood(lat, lng) {
  let best = HOOD_CENTROIDS[0];
  let bestMeters = Infinity;
  for (const hood of HOOD_CENTROIDS) {
    const meters = haversineMeters(lat, lng, hood.lat, hood.lng);
    if (meters < bestMeters) {
      best = hood;
      bestMeters = meters;
    }
  }
  return best.name;
}

export function buildNeighborhoods(nodes) {
  const byHood = {};
  for (const node of nodes) {
    const hood = node.neighborhood || "Unknown";
    if (!byHood[hood]) byHood[hood] = [];
    byHood[hood].push(node);
  }
  const neighborhoods = {};
  for (const [hood, list] of Object.entries(byHood)) {
    const discovered = list.length;
    const total = Math.max(discovered, HOOD_TOTALS[hood] || discovered);
    neighborhoods[hood] = {
      pct: Math.round((100 * discovered) / total),
      discovered,
      total,
    };
  }
  return neighborhoods;
}

export async function neighborhoodPct(db, groupId, neighborhood) {
  if (!neighborhood) return 0;
  const discovered = await db.collection(COLLECTIONS.NODES).countDocuments({
    $and: [matchGroupId("group_id", groupId), { neighborhood }],
  });
  const total = Math.max(discovered, HOOD_TOTALS[neighborhood] || discovered || 1);
  return Math.round((100 * discovered) / total);
}
