import { NODE_PLACE_TYPES } from "../mongodb-schema.js";

/**
 * Pittsburgh nodes for CMU CREW demo.
 * ~100 places: dense Oakland/Shadyside/Bloomfield/etc., sparse Lawrenceville
 * so a live CMU → Lawrenceville trip can move neighborhood %.
 */

/** Target place inventory per hood (totals used for % = discovered/total). */
export const NEIGHBORHOOD_TOTALS = {
  Oakland: 14,
  Shadyside: 12,
  Bloomfield: 11,
  "Squirrel Hill": 12,
  "East Liberty": 11,
  "Strip District": 10,
  "South Side": 12,
  Downtown: 12,
  "North Side": 10,
  "Point Breeze": 9,
  Homestead: 8,
  Lawrenceville: 11,
};

/** How many nodes to actually seed (Lawrenceville stays sparse). */
const SEED_COUNTS = {
  Oakland: 14,
  Shadyside: 12,
  Bloomfield: 10,
  "Squirrel Hill": 10,
  "East Liberty": 9,
  "Strip District": 8,
  "South Side": 8,
  Downtown: 8,
  "North Side": 6,
  "Point Breeze": 5,
  Homestead: 4,
  Lawrenceville: 1,
};

const HOOD_CENTERS = {
  Oakland: { lat: 40.4415, lng: -79.956 },
  Shadyside: { lat: 40.452, lng: -79.934 },
  Bloomfield: { lat: 40.462, lng: -79.945 },
  "Squirrel Hill": { lat: 40.438, lng: -79.923 },
  "East Liberty": { lat: 40.462, lng: -79.923 },
  "Strip District": { lat: 40.45, lng: -79.985 },
  "South Side": { lat: 40.428, lng: -79.975 },
  Downtown: { lat: 40.441, lng: -79.996 },
  "North Side": { lat: 40.453, lng: -80.01 },
  "Point Breeze": { lat: 40.447, lng: -79.905 },
  Homestead: { lat: 40.406, lng: -79.912 },
  Lawrenceville: { lat: 40.463, lng: -79.964 },
};

const NAMED = [
  { name: "CMU", neighborhood: "Oakland", lat: 40.4425, lng: -79.9435, place_type: "urban_core" },
  { name: "Schenley Park", neighborhood: "Oakland", lat: 40.4346, lng: -79.9426, place_type: "park" },
  { name: "Cathedral of Learning", neighborhood: "Oakland", lat: 40.4443, lng: -79.9532, place_type: "urban_core" },
  { name: "Phipps Conservatory", neighborhood: "Oakland", lat: 40.439, lng: -79.948, place_type: "park" },
  { name: "The O", neighborhood: "Oakland", lat: 40.444, lng: -79.96, place_type: "food" },
  { name: "Shadyside Square", neighborhood: "Shadyside", lat: 40.4522, lng: -79.9349, place_type: "shopping" },
  { name: "Walnut Street", neighborhood: "Shadyside", lat: 40.451, lng: -79.9335, place_type: "food" },
  { name: "Harris Theater", neighborhood: "Downtown", lat: 40.4426, lng: -79.997, place_type: "entertainment" },
  { name: "Market Square", neighborhood: "Downtown", lat: 40.4406, lng: -80.002, place_type: "urban_core" },
  { name: "Lawrenceville Strip", neighborhood: "Lawrenceville", lat: 40.4645, lng: -79.9628, place_type: "urban_core" },
];

function hash(i, salt) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function placeTypeFor(i, hood) {
  const pool =
    hood === "Oakland" || hood === "Downtown"
      ? ["urban_core", "food", "transit", "park", "entertainment"]
      : hood.includes("Park") || hood === "Schenley"
        ? ["park", "residential"]
        : ["food", "shopping", "entertainment", "residential", "urban_core"];
  return pool[i % pool.length];
}

export function generateNodes(users) {
  const creator = users[0];
  const now = new Date();

  const group = {
    _localId: "group_cmu_crew",
    name: "CMU CREW",
    creator_id: creator._localId,
    member_ids: users.map((u) => u._localId),
    created_at: now,
    total_nodes_discovered: 0,
    total_edges_discovered: 0,
    neighborhood_totals: { ...NEIGHBORHOOD_TOTALS },
  };

  const places = [];
  const usedNames = new Set();

  for (const p of NAMED) {
    places.push({ ...p });
    usedNames.add(p.name);
  }

  let idx = 0;
  for (const [hood, count] of Object.entries(SEED_COUNTS)) {
    const have = places.filter((p) => p.neighborhood === hood).length;
    const need = count - have;
    const center = HOOD_CENTERS[hood];
    for (let i = 0; i < need; i++) {
      const r = 0.004 + hash(idx, 1) * 0.01;
      const ang = hash(idx, 2) * Math.PI * 2;
      const name = `${hood} Spot ${have + i + 1}`;
      if (usedNames.has(name)) continue;
      usedNames.add(name);
      places.push({
        name,
        neighborhood: hood,
        lat: center.lat + Math.cos(ang) * r,
        lng: center.lng + Math.sin(ang) * r * 1.2,
        place_type: placeTypeFor(idx, hood),
      });
      idx += 1;
    }
  }

  const nodes = places.map((p, i) => {
    const sparse = p.neighborhood === "Lawrenceville";
    const dense =
      p.neighborhood === "Oakland" ||
      p.neighborhood === "Shadyside" ||
      p.neighborhood === "Bloomfield";
    return {
      _localId: `node_${i}`,
      group_id: group._localId,
      name: p.name,
      neighborhood: p.neighborhood,
      lat: p.lat,
      lng: p.lng,
      place_type: NODE_PLACE_TYPES.includes(p.place_type) ? p.place_type : "unknown",
      visit_count: sparse ? 1 : dense ? 6 + (i % 8) : 3 + (i % 5),
      first_discovered_by: creator._localId,
      first_discovered_at: new Date(now.getTime() - (14 - (i % 14)) * 86400000),
      created_at: now,
    };
  });

  group.total_nodes_discovered = nodes.length;
  return { group, nodes };
}
