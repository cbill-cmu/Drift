/**
 * Pull named hangouts from OpenStreetMap (Overpass) for Pittsburgh,
 * merge curated landmarks, classify, write catalog.json.
 *
 * Run: node shared/pittsburgh-places/fetch-osm.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CURATED_PLACES } from "./curated.js";
import {
  classifyOsmTags,
  coordsFromElement,
  nearestNeighborhood,
} from "./classify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "catalog.json");
const SUMMARY = path.join(__dirname, "catalog-summary.json");

const BBOX = "40.361,-80.105,40.512,-79.830";
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const QUERY = `
[out:json][timeout:90];
(
  nwr["name"]["amenity"~"^(restaurant|cafe|fast_food|bar|pub|nightclub|biergarten|ice_cream|food_court|cinema|theatre|arts_centre|community_centre|library|university|college|marketplace|place_of_worship|fountain)$"](${BBOX});
  nwr["name"]["shop"~"^(supermarket|convenience|greengrocer|mall|department_store|bakery|clothes|books|gift|music|wine|butcher|seafood)$"](${BBOX});
  nwr["name"]["leisure"~"^(park|playground|sports_centre|fitness_centre|stadium|garden|nature_reserve|pitch|swimming_pool|ice_rink|bowling_alley|dog_park)$"](${BBOX});
  nwr["name"]["tourism"~"^(attraction|museum|viewpoint|artwork|gallery|theme_park|zoo|aquarium)$"](${BBOX});
  nwr["name"]["historic"~"^(monument|memorial|castle|landmark|yes)$"](${BBOX});
);
out center tags;
`;

async function fetchOverpass(url) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Accept: "application/json",
      "User-Agent": "DriftHackCMU/1.0 (Pittsburgh places catalog; educational)",
    },
    body: `data=${encodeURIComponent(QUERY)}`,
  });
  if (!res.ok) {
    throw new Error(`${url} HTTP ${res.status}`);
  }
  return res.json();
}

function keyOf(place) {
  const name = place.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const lat = place.lat.toFixed(4);
  const lng = place.lng.toFixed(4);
  return `${name}|${lat}|${lng}`;
}

function fromOsm(el) {
  const tags = el.tags || {};
  const name = (tags.name || "").trim();
  if (!name || name.length < 2) return null;
  const coords = coordsFromElement(el);
  if (!coords) return null;
  const { category, place_type, kind } = classifyOsmTags(tags);
  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    lat: Number(coords.lat.toFixed(6)),
    lng: Number(coords.lng.toFixed(6)),
    neighborhood: nearestNeighborhood(coords.lat, coords.lng),
    category,
    place_type,
    kind,
    source: "osm",
  };
}

function fromCurated(p, i) {
  return {
    id: `curated-${i}`,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    neighborhood: p.neighborhood,
    category: p.category,
    place_type: p.place_type,
    kind: p.kind,
    source: "curated",
  };
}

async function main() {
  let osm = { elements: [] };
  let lastErr = null;
  for (const url of OVERPASS_URLS) {
    try {
      console.log(`[places] querying ${url} …`);
      osm = await fetchOverpass(url);
      console.log(`[places] OSM elements: ${osm.elements?.length || 0}`);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      console.warn(`[places] ${err.message}`);
    }
  }
  if (lastErr && !osm.elements?.length) {
    console.warn("[places] Overpass unavailable — writing curated-only catalog.");
  }

  const merged = new Map();
  for (const el of osm.elements || []) {
    const place = fromOsm(el);
    if (!place) continue;
    merged.set(keyOf(place), place);
  }
  for (const [i, p] of CURATED_PLACES.entries()) {
    const place = fromCurated(p, i);
    merged.set(keyOf(place), place);
  }

  const places = [...merged.values()].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.neighborhood !== b.neighborhood) return a.neighborhood.localeCompare(b.neighborhood);
    return a.name.localeCompare(b.name);
  });

  const byCategory = {};
  const byNeighborhood = {};
  const byPlaceType = {};
  for (const p of places) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    byNeighborhood[p.neighborhood] = (byNeighborhood[p.neighborhood] || 0) + 1;
    byPlaceType[p.place_type] = (byPlaceType[p.place_type] || 0) + 1;
  }

  const catalog = {
    generated_at: new Date().toISOString(),
    bbox: BBOX,
    count: places.length,
    categories: byCategory,
    place_types: byPlaceType,
    neighborhoods: byNeighborhood,
    places,
  };

  fs.writeFileSync(OUT, `${JSON.stringify(catalog, null, 2)}\n`);
  fs.writeFileSync(
    SUMMARY,
    `${JSON.stringify({ count: places.length, categories: byCategory, place_types: byPlaceType, neighborhoods: byNeighborhood }, null, 2)}\n`
  );
  console.log(`[places] wrote ${places.length} records → ${OUT}`);
  console.log("[places] categories", byCategory);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
