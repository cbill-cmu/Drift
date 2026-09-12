/**
 * City-wide Pittsburgh place catalog (not the group graph).
 * Collection: places_catalog
 * Graph nodes are created only when a group logs a trip through a catalog place.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { CURATED_PLACES } from "../../../shared/pittsburgh-places/curated.js";
import {
  classifyFromName,
  classifyGoogleTypes,
  nearestNeighborhood,
  PITTSBURGH_HOODS,
} from "../../../shared/pittsburgh-places/classify.js";
import { reverseGeocodePlaceType } from "./googlePlacesService.js";
import { haversineMeters } from "./neighborhoods.js";
import { getDb } from "./mongoService.js";

export const PLACES_CATALOG = "places_catalog";
export const PLACE_MATCH_METERS = 120;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_JSON = path.join(__dirname, "../../../shared/pittsburgh-places/catalog.json");

let seeded = false;

export function publicPlace(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    name: doc.name,
    lat: doc.lat,
    lng: doc.lng,
    neighborhood: doc.neighborhood,
    category: doc.category,
    place_type: doc.place_type,
    kind: doc.kind,
    source: doc.source,
  };
}

export async function ensurePlacesCatalog() {
  const db = getDb();
  const col = db.collection(PLACES_CATALOG);
  try {
    await col.createIndexes([
      { key: { lat: 1, lng: 1 } },
      { key: { name: 1 } },
      { key: { category: 1 } },
    ]);
  } catch (err) {
    console.warn("[places] indexes:", err.message);
  }

  if (seeded) return;
  const seeds = loadSeedPlaces();
  for (const place of seeds) {
    await col.updateOne(
      { source: place.source, source_id: place.source_id },
      {
        $setOnInsert: {
          visit_count: 0,
          created_at: new Date(),
        },
        $set: {
          name: place.name,
          lat: place.lat,
          lng: place.lng,
          neighborhood: place.neighborhood,
          category: place.category,
          place_type: place.place_type,
          kind: place.kind,
          source: place.source,
          source_id: place.source_id,
          updated_at: new Date(),
        },
      },
      { upsert: true }
    );
  }
  seeded = true;
  const count = await col.countDocuments();
  console.log(`[places] catalog ready (${count} places)`);
}

function loadSeedPlaces() {
  const byKey = new Map();
  let jsonPlaces = [];
  try {
    if (fs.existsSync(CATALOG_JSON)) {
      const parsed = JSON.parse(fs.readFileSync(CATALOG_JSON, "utf8"));
      jsonPlaces = parsed.places || [];
    }
  } catch (err) {
    console.warn("[places] catalog.json:", err.message);
  }

  for (const p of jsonPlaces) {
    const doc = normalizeSeed(p);
    if (doc) byKey.set(`${doc.source}:${doc.source_id}`, doc);
  }
  CURATED_PLACES.forEach((p, i) => {
    const doc = normalizeSeed({ ...p, source: "curated", id: `curated-${i}` });
    if (doc) byKey.set(`${doc.source}:${doc.source_id}`, doc);
  });
  return [...byKey.values()];
}

function normalizeSeed(p) {
  if (!p?.name || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng))) return null;
  const classified = p.category && p.place_type ? p : classifyFromName(p.name);
  return {
    name: p.name.trim(),
    lat: Number(p.lat),
    lng: Number(p.lng),
    neighborhood: p.neighborhood || nearestNeighborhood(Number(p.lat), Number(p.lng)),
    category: p.category || classified.category,
    place_type: p.place_type || classified.place_type,
    kind: p.kind || classified.kind,
    source: p.source || "seed",
    source_id: String(p.id || p.source_id || `${p.name}-${p.lat}-${p.lng}`),
  };
}

export async function searchPlaces({ q = "", category = "", limit = 40 } = {}) {
  const db = getDb();
  await ensurePlacesCatalog();
  const col = db.collection(PLACES_CATALOG);
  const filter = {};
  const query = q.trim();
  if (query) {
    filter.name = { $regex: escapeRegex(query), $options: "i" };
  }
  if (category) filter.category = category;
  const docs = await col.find(filter).sort({ name: 1 }).limit(Math.min(Number(limit) || 40, 80)).toArray();
  return docs.map(publicPlace);
}

export async function getPlaceById(id) {
  const db = getDb();
  const { ObjectId } = await import("mongodb");
  if (!id || !ObjectId.isValid(id)) return null;
  return db.collection(PLACES_CATALOG).findOne({ _id: new ObjectId(id) });
}

export async function findNearestPlace(lat, lng, maxMeters = PLACE_MATCH_METERS) {
  const db = getDb();
  const deg = maxMeters / 111_320;
  const candidates = await db
    .collection(PLACES_CATALOG)
    .find({
      lat: { $gte: lat - deg, $lte: lat + deg },
      lng: { $gte: lng - deg, $lte: lng + deg },
    })
    .toArray();

  let best = null;
  let bestMeters = Infinity;
  for (const place of candidates) {
    const meters = haversineMeters(lat, lng, Number(place.lat), Number(place.lng));
    if (meters <= maxMeters && meters < bestMeters) {
      best = place;
      bestMeters = meters;
    }
  }
  return best;
}

/**
 * Map a logged visit onto the catalog, or store a newly classified place.
 */
export async function resolveOrCreatePlace({ lat, lng, name, placeId } = {}) {
  const db = getDb();
  await ensurePlacesCatalog();
  const col = db.collection(PLACES_CATALOG);

  if (placeId) {
    const existing = await getPlaceById(placeId);
    if (existing) {
      await col.updateOne({ _id: existing._id }, { $inc: { visit_count: 1 }, $set: { updated_at: new Date() } });
      return { doc: existing, created: false };
    }
  }

  const nearby = await findNearestPlace(lat, lng);
  if (nearby) {
    const sameName =
      !name ||
      nearby.name.toLowerCase() === String(name).trim().toLowerCase() ||
      nearby.name.toLowerCase().includes(String(name).trim().toLowerCase()) ||
      String(name).trim().toLowerCase().includes(nearby.name.toLowerCase());
    if (sameName || !name) {
      await col.updateOne({ _id: nearby._id }, { $inc: { visit_count: 1 }, $set: { updated_at: new Date() } });
      return { doc: nearby, created: false };
    }
  }

  const google = await reverseGeocodePlaceType(lat, lng);
  const labeled = (name && name.trim()) || google?.name || nearestNeighborhood(lat, lng);
  const classified = classifyGoogleTypes(google?.types || [], labeled);
  if (google?.place_type && classified.place_type === "unknown") {
    classified.place_type = google.place_type;
  }

  const doc = {
    name: labeled,
    lat,
    lng,
    neighborhood: nearestNeighborhood(lat, lng),
    category: classified.category,
    place_type: classified.place_type,
    kind: classified.kind,
    source: name ? "user" : google?.name ? "google" : "user",
    source_id: `user-${Date.now()}-${lat.toFixed(5)}-${lng.toFixed(5)}`,
    visit_count: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const { insertedId } = await col.insertOne(doc);
  doc._id = insertedId;
  return { doc, created: true };
}

export async function createNamedPlace({ name, neighborhood, category, lat, lng }) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    const err = new Error("name is required");
    err.status = 400;
    throw err;
  }

  let useLat = Number(lat);
  let useLng = Number(lng);
  if (!Number.isFinite(useLat) || !Number.isFinite(useLng)) {
    const hood =
      PITTSBURGH_HOODS.find((h) => h.name === neighborhood) || PITTSBURGH_HOODS[0];
    useLat = hood.lat;
    useLng = hood.lng;
  }

  const nearby = await findNearestPlace(useLat, useLng, 80);
  if (nearby && nearby.name.toLowerCase() === trimmed.toLowerCase()) {
    return { doc: nearby, created: false };
  }

  const classified = classifyFromName(trimmed);
  if (category) classified.category = category;

  const db = getDb();
  await ensurePlacesCatalog();
  const now = new Date();
  const doc = {
    name: trimmed,
    lat: useLat,
    lng: useLng,
    neighborhood: neighborhood || nearestNeighborhood(useLat, useLng),
    category: classified.category,
    place_type: classified.place_type,
    kind: classified.kind,
    source: "user",
    source_id: `user-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    visit_count: 0,
    created_at: now,
    updated_at: now,
  };
  const { insertedId } = await db.collection(PLACES_CATALOG).insertOne(doc);
  doc._id = insertedId;
  return { doc, created: true };
}

export function hoodOptions() {
  return PITTSBURGH_HOODS.map((h) => h.name);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
