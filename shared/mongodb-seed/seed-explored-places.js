/**
 * Drop catalog places into live visited H3 cells so Places has entries,
 * then upsert the expanded curated list. Does not wipe accounts or traces.
 *
 *   cd shared/mongodb-seed
 *   npm run seed:explored-places
 */
import dotenv from "dotenv";
import { cellToLatLng, latLngToCell } from "h3-js";
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { CURATED_PLACES } from "../pittsburgh-places/curated.js";
import { nearestNeighborhood } from "../pittsburgh-places/classify.js";
import { COLLECTIONS, DB_NAME, VISITED_CELL_RESOLUTION } from "../mongodb-schema.js";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, ".env") });
dotenv.config({ path: path.join(here, "../../backend/.env") });

const PLACE_COLLECTION = "places_catalog";
const MAX_CELL_PLACES = 36;

function haversineMeters(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(s)));
}

function nearestCurated(lat, lng) {
  let best = null;
  let bestMeters = Infinity;
  for (const place of CURATED_PLACES) {
    const meters = haversineMeters(lat, lng, place.lat, place.lng);
    if (meters < bestMeters) {
      bestMeters = meters;
      best = place;
    }
  }
  return { place: best, meters: bestMeters };
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
  const col = db.collection(PLACE_COLLECTION);
  const now = new Date();

  let curatedUpserts = 0;
  for (let i = 0; i < CURATED_PLACES.length; i += 1) {
    const place = CURATED_PLACES[i];
    await col.updateOne(
      { source: "curated", source_id: `curated-${i}` },
      {
        $setOnInsert: { visit_count: 0, created_at: now },
        $set: {
          name: place.name,
          lat: place.lat,
          lng: place.lng,
          neighborhood: place.neighborhood,
          category: place.category,
          place_type: place.place_type,
          kind: place.kind,
          source: "curated",
          source_id: `curated-${i}`,
          updated_at: now,
        },
      },
      { upsert: true }
    );
    curatedUpserts += 1;
  }

  const visited = await db
    .collection(COLLECTIONS.USER_VISITED_CELLS)
    .find({}, { projection: { h3_cell: 1 } })
    .toArray();
  const uniqueCells = [...new Set(visited.map((row) => row.h3_cell).filter(Boolean))];

  const existing = await col
    .find({ lat: { $type: "number" }, lng: { $type: "number" } })
    .project({ lat: 1, lng: 1 })
    .toArray();
  const occupied = new Set(
    existing.map((place) => latLngToCell(place.lat, place.lng, VISITED_CELL_RESOLUTION))
  );

  let planted = 0;
  for (const cell of uniqueCells) {
    if (planted >= MAX_CELL_PLACES) break;
    if (occupied.has(cell)) continue;
    let lat;
    let lng;
    try {
      [lat, lng] = cellToLatLng(cell);
    } catch {
      continue;
    }
    const { place, meters } = nearestCurated(lat, lng);
    const hood = nearestNeighborhood(lat, lng);
    const name =
      place && meters < 420 ? `${place.name}` : `${hood} hangout`;
    const sourceId = `cell-${cell}`;
    await col.updateOne(
      { source: "explored-demo", source_id: sourceId },
      {
        $setOnInsert: { visit_count: 0, created_at: now },
        $set: {
          name,
          lat,
          lng,
          neighborhood: place?.neighborhood || hood,
          category: place?.category || "hangout",
          place_type: place?.place_type || "urban_core",
          kind: place?.kind || "plaza",
          source: "explored-demo",
          source_id: sourceId,
          h3_cell: cell,
          updated_at: now,
        },
      },
      { upsert: true }
    );
    occupied.add(cell);
    planted += 1;
  }

  const total = await col.countDocuments();
  console.log("[seed:explored-places]", {
    curatedUpserts,
    visitedCells: uniqueCells.length,
    plantedInExploredCells: planted,
    catalogTotal: total,
  });
  await client.close();
}

main().catch((err) => {
  console.error("[seed:explored-places] FAILED:", err);
  process.exit(1);
});
