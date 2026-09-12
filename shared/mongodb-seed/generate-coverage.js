import { latLngToCell } from "h3-js";
import { VISITED_CELL_RESOLUTION } from "../mongodb-schema.js";

/**
 * Synthetic GPS traces + visited H3 cells for the fog-of-war demo.
 *
 * Geography (matches DRIFT_PROJECT_GUIDE Critical Path):
 *   everyone — CMU / Oakland campus + Schenley (all members)
 *   some     — Shadyside, Bloomfield, Strip (subsets of members)
 *   no one   — Lawrenceville, South Side (left fogged for suggestion cards)
 *
 * A small pocket east of campus (Craig St) is also left unseeded so a
 * live "Start exploring" walk can still punch new holes.
 */

const STEP_M = 35;

const CAMPUS_LOOP = [
  [40.4425, -79.9435],
  [40.4432, -79.9462],
  [40.444, -79.9495],
  [40.4443, -79.9532],
  [40.4432, -79.9564],
  [40.4418, -79.9538],
  [40.4416, -79.9488],
  [40.4425, -79.9435],
];

const SCHENLEY = [
  [40.4346, -79.9426],
  [40.4368, -79.9452],
  [40.439, -79.948],
];

const SHADYSIDE = [
  [40.451, -79.9335],
  [40.4522, -79.9349],
  [40.453, -79.9365],
];

const BLOOMFIELD = [
  [40.461, -79.9465],
  [40.462, -79.945],
  [40.4632, -79.9432],
];

const STRIP = [
  [40.4492, -79.9865],
  [40.45, -79.985],
  [40.4512, -79.9832],
];

const PRECISION = 1e5;

function encodeSignedNumber(num) {
  let sgnNum = num << 1;
  if (num < 0) sgnNum = ~sgnNum;
  let value = "";
  while (sgnNum >= 0x20) {
    value += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
    sgnNum >>= 5;
  }
  value += String.fromCharCode(sgnNum + 63);
  return value;
}

function encodePolyline(points) {
  let output = "";
  let prevLat = 0;
  let prevLng = 0;
  for (const [lat, lng] of points) {
    const lat5 = Math.round(lat * PRECISION);
    const lng5 = Math.round(lng * PRECISION);
    output += encodeSignedNumber(lat5 - prevLat);
    output += encodeSignedNumber(lng5 - prevLng);
    prevLat = lat5;
    prevLng = lng5;
  }
  return output;
}

function haversineMeters(aLat, aLng, bLat, bLng) {
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

function interpolateRoute(route, stepM = STEP_M) {
  const points = [];
  for (let i = 0; i < route.length - 1; i++) {
    const [aLat, aLng] = route[i];
    const [bLat, bLng] = route[i + 1];
    const dist = haversineMeters(aLat, aLng, bLat, bLng);
    const steps = Math.max(1, Math.round(dist / stepM));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      points.push([aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t]);
    }
  }
  points.push(route[route.length - 1]);
  return points;
}

function pathDistance(points) {
  let meters = 0;
  for (let i = 1; i < points.length; i++) {
    meters += haversineMeters(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return meters;
}

function routesForIndex(i, n) {
  const routes = [CAMPUS_LOOP, SCHENLEY];
  const shadysideCut = Math.max(1, Math.floor(n * 0.4));
  const bloomCut = Math.max(shadysideCut + 1, Math.floor(n * 0.7));
  if (i < shadysideCut) routes.push(SHADYSIDE);
  if (i >= shadysideCut && i < bloomCut) routes.push(BLOOMFIELD);
  if (i < Math.min(2, n)) routes.push(STRIP);
  return routes;
}

function userKey(user, index) {
  return user._localId || user.id || `user_${index}`;
}

/**
 * @param {Array<{ _localId?: string }>} users demo users in member order
 */
export function generateCoverage(users = []) {
  const now = Date.now();
  const traces = [];
  const cellMap = new Map();

  users.forEach((user, index) => {
    const uid = userKey(user, index);
    const routes = routesForIndex(index, users.length);
    routes.forEach((route, r) => {
      const points = interpolateRoute(route);
      if (points.length < 2) return;
      const distance_m = Math.round(pathDistance(points));
      const ended = new Date(now - index * 3600_000 - r * 600_000);
      const started = new Date(ended.getTime() - Math.max(180_000, distance_m * 80));
      traces.push({
        _localId: `trace_${uid}_${r}`,
        user_id: uid,
        started_at: started.toISOString(),
        ended_at: ended.toISOString(),
        polyline: encodePolyline(points),
        point_count: points.length,
        distance_m,
        source: "seed",
      });
      for (const [lat, lng] of points) {
        const h3_cell = latLngToCell(lat, lng, VISITED_CELL_RESOLUTION);
        const key = `${uid}|${h3_cell}`;
        const prev = cellMap.get(key);
        if (!prev) {
          cellMap.set(key, {
            user_id: uid,
            h3_cell,
            visit_count: 1,
            first_visited_at: started.toISOString(),
            last_visited_at: ended.toISOString(),
            source: "seed",
          });
        } else {
          prev.visit_count += 1;
          if (ended.toISOString() > prev.last_visited_at) prev.last_visited_at = ended.toISOString();
        }
      }
    });
  });

  return {
    location_traces: traces,
    user_visited_cells: [...cellMap.values()],
  };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  const { generateUsers } = await import("./generate-users.js");
  const coverage = generateCoverage(generateUsers());
  console.log({
    traces: coverage.location_traces.length,
    cells: coverage.user_visited_cells.length,
    users: new Set(coverage.user_visited_cells.map((c) => c.user_id)).size,
  });
}
