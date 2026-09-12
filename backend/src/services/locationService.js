import { gridDisk, latLngToCell } from "h3-js";

import {
  COLLECTIONS,
  INDEXES,
  VISITED_CELL_RESOLUTION,
} from "../models/index.js";
import { decodePolyline } from "../utils/polyline.js";
import { asString, idVariants } from "./ids.js";
import { HttpError, userSharesExploration } from "./userService.js";
import { PLACES_CATALOG, publicPlace } from "./placesCatalogService.js";

const MAX_POLYLINE_CHARS = 100_000;
const MAX_DISTANCE_M = 10_000_000;

let indexesReady = false;

export function validateTraceBody(body) {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Request body is required");
  }

  const polyline = typeof body.polyline === "string" ? body.polyline.trim() : "";
  if (!polyline) {
    throw new HttpError(400, "polyline is required");
  }
  if (polyline.length > MAX_POLYLINE_CHARS) {
    throw new HttpError(400, "polyline is too large");
  }

  const started_at = parseDate(body.started_at, "started_at");
  const ended_at = parseDate(body.ended_at, "ended_at");
  if (ended_at.getTime() < started_at.getTime()) {
    throw new HttpError(400, "ended_at must be on or after started_at");
  }

  const point_count = toInt(body.point_count, "point_count");
  if (point_count < 1) {
    throw new HttpError(400, "point_count must be a positive integer");
  }

  const distance_m = toNumber(body.distance_m, "distance_m");
  if (!Number.isFinite(distance_m) || distance_m < 0 || distance_m > MAX_DISTANCE_M) {
    throw new HttpError(400, "distance_m must be a number between 0 and 10000000");
  }

  const points = decodePolyline(polyline);
  if (!points.length) {
    throw new HttpError(400, "polyline decoded to zero points");
  }
  if (points.length !== point_count) {
    throw new HttpError(
      400,
      `point_count (${point_count}) does not match decoded polyline (${points.length} points)`
    );
  }

  for (const [lat, lng] of points) {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new HttpError(400, "polyline contains an invalid latitude");
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new HttpError(400, "polyline contains an invalid longitude");
    }
  }

  return { polyline, started_at, ended_at, point_count, distance_m, points };
}

export async function recordTrace(db, userId, body) {
  await ensureIndexes(db);
  const now = new Date();
  const doc = {
    user_id: userId,
    started_at: body.started_at,
    ended_at: body.ended_at,
    polyline: body.polyline,
    point_count: body.point_count,
    distance_m: body.distance_m,
    created_at: now,
  };
  const { insertedId } = await db.collection(COLLECTIONS.LOCATION_TRACES).insertOne(doc);
  return { ...doc, _id: insertedId };
}

/**
 * Upsert H3 resolution-9 cells for each decoded point. Same-cell points
 * in one batch are collapsed so bulkWrite does not contend on the unique
 * (user_id, h3_cell) index; visit_count still increments once per point.
 */
export async function deriveVisitedCells(db, userId, points, lastVisitedAt = new Date()) {
  await ensureIndexes(db);
  const visitedAt = lastVisitedAt instanceof Date ? lastVisitedAt : new Date(lastVisitedAt);
  const counts = new Map();

  for (const [lat, lng] of points) {
    const cell = latLngToCell(lat, lng, VISITED_CELL_RESOLUTION);
    counts.set(cell, (counts.get(cell) || 0) + 1);
  }

  const ops = [];
  for (const [h3_cell, n] of counts) {
    ops.push({
      updateOne: {
        filter: { user_id: userId, h3_cell },
        update: {
          $inc: { visit_count: n },
          $max: { last_visited_at: visitedAt },
          $setOnInsert: { first_visited_at: visitedAt, user_id: userId, h3_cell },
        },
        upsert: true,
      },
    });
  }

  if (!ops.length) return { cells_upserted: 0 };

  const result = await db.collection(COLLECTIONS.USER_VISITED_CELLS).bulkWrite(ops, {
    ordered: false,
  });
  return {
    cells_upserted: (result.upsertedCount || 0) + (result.modifiedCount || 0) + (result.matchedCount || 0),
    unique_cells: counts.size,
  };
}

export async function listVisitedCells(db, userId) {
  await ensureIndexes(db);
  const docs = await db
    .collection(COLLECTIONS.USER_VISITED_CELLS)
    .find({ $or: idVariants(userId).map((value) => ({ user_id: value })) })
    .project({ h3_cell: 1, visit_count: 1, _id: 0 })
    .toArray();

  return docs
    .filter((doc) => typeof doc.h3_cell === "string" && doc.h3_cell)
    .map((doc) => ({
      h3_cell: doc.h3_cell,
      visit_count: Number.isFinite(doc.visit_count) ? doc.visit_count : 1,
    }));
}

/**
 * Classify aggregated {h3_cell, visitors|visitor_count} rows against
 * group size. Absent cells are implicitly "no one" and are not returned.
 */
export function classifyCoverage(rows, memberCount) {
  const everyone = [];
  const some = [];
  const count = Number(memberCount) || 0;

  for (const row of rows || []) {
    const cell = row.h3_cell || row._id;
    if (!cell) continue;
    const visitors = Array.isArray(row.visitors)
      ? new Set(row.visitors.map(asString)).size
      : Number(row.visitor_count) || 0;
    if (count > 0 && visitors === count) everyone.push(cell);
    else if (visitors > 0) some.push(cell);
  }

  return { everyone, some };
}

export async function contributingMemberIds(db, group) {
  const memberIds = Array.isArray(group?.member_ids) ? group.member_ids : [];
  if (!memberIds.length) return [];

  const users = await db
    .collection(COLLECTIONS.USERS)
    .find({
      $or: memberIds.flatMap((id) => idVariants(id).map((value) => ({ _id: value }))),
    })
    .project({ _id: 1, contributes_to: 1 })
    .toArray();

  const byId = new Map(users.map((user) => [asString(user._id), user]));
  const groupId = group._id;
  return memberIds.filter((id) => {
    const user = byId.get(asString(id));
    return !user || userSharesExploration(user, groupId);
  });
}

export async function getGroupCoverage(db, group) {
  await ensureIndexes(db);
  const contributorIds = await contributingMemberIds(db, group);
  if (!contributorIds.length) {
    return { everyone: [], some: [] };
  }

  const userIds = contributorIds.flatMap((id) => idVariants(id));
  const rows = await db
    .collection(COLLECTIONS.USER_VISITED_CELLS)
    .aggregate([
      { $match: { user_id: { $in: userIds } } },
      { $group: { _id: "$h3_cell", visitors: { $addToSet: "$user_id" } } },
      {
        $project: {
          _id: 0,
          h3_cell: "$_id",
          visitors: 1,
          visitor_count: { $size: "$visitors" },
        },
      },
    ])
    .toArray();

  return classifyCoverage(rows, contributorIds.length);
}

const SUGGESTION_LIMIT = 48;

function expandVisitedCells(cellIds, ring = 1) {
  const out = new Set();
  for (const id of cellIds || []) {
    if (!id) continue;
    out.add(id);
    try {
      for (const neighbor of gridDisk(id, ring)) out.add(neighbor);
    } catch {
      /* skip invalid indexes */
    }
  }
  return out;
}

function pickSpread(places, limit) {
  const cap = Math.max(1, Number(limit) || SUGGESTION_LIMIT);
  if (places.length <= cap) return places;
  const remaining = [...places];
  const selected = [];
  const take = remaining.splice(Math.floor(remaining.length / 2), 1)[0];
  if (take) selected.push(take);
  while (selected.length < cap && remaining.length) {
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      let nearest = Infinity;
      for (const kept of selected) {
        const dLat = candidate.lat - kept.lat;
        const dLng = (candidate.lng - kept.lng) * 1.3;
        const d = dLat * dLat + dLng * dLng;
        if (d < nearest) nearest = d;
      }
      if (nearest > bestScore) {
        bestScore = nearest;
        bestIdx = i;
      }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  return selected;
}

/**
 * Catalog places whose H3 cells the group has not visited (implicit "no one").
 * One suggestion per cell so we don't stack two cafes in the same hex.
 */
export async function getCoverageGapSuggestions(db, group, { limit = SUGGESTION_LIMIT } = {}) {
  const coverage = await getGroupCoverage(db, group);
  const covered = new Set([...(coverage.everyone || []), ...(coverage.some || [])]);
  const places = await db
    .collection(PLACES_CATALOG)
    .find({ lat: { $type: "number" }, lng: { $type: "number" } })
    .toArray();

  const byCell = new Map();
  for (const place of places) {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) continue;
    const cell = latLngToCell(place.lat, place.lng, VISITED_CELL_RESOLUTION);
    if (covered.has(cell) || byCell.has(cell)) continue;
    const pub = publicPlace(place);
    if (!pub?.name) continue;
    byCell.set(cell, {
      h3_cell: cell,
      place_id: pub.id,
      name: pub.name,
      neighborhood: pub.neighborhood || "",
      place_type: pub.place_type || pub.category || "",
      lat: pub.lat,
      lng: pub.lng,
    });
  }

  return pickSpread([...byCell.values()], limit);
}

/**
 * Catalog places whose H3 cells the user has already visited.
 */
export async function getExploredCatalogPlaces(db, cellIds, { limit = 80 } = {}) {
  const exact = new Set((cellIds || []).filter(Boolean));
  const covered = expandVisitedCells(cellIds, 1);
  if (!covered.size) return [];
  const places = await db
    .collection(PLACES_CATALOG)
    .find({ lat: { $type: "number" }, lng: { $type: "number" } })
    .toArray();

  const ranked = [];
  for (const place of places) {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) continue;
    const cell = latLngToCell(place.lat, place.lng, VISITED_CELL_RESOLUTION);
    if (!covered.has(cell)) continue;
    const pub = publicPlace(place);
    if (!pub?.name) continue;
    ranked.push({
      exact: exact.has(cell) ? 1 : 0,
      h3_cell: cell,
      place_id: pub.id,
      name: pub.name,
      neighborhood: pub.neighborhood || "",
      place_type: pub.place_type || pub.category || "",
      lat: pub.lat,
      lng: pub.lng,
    });
  }

  ranked.sort((a, b) => b.exact - a.exact || a.name.localeCompare(b.name));
  const seen = new Set();
  const out = [];
  for (const place of ranked) {
    const key = place.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const { exact: _exact, ...rest } = place;
    out.push(rest);
    if (out.length >= Math.max(1, Number(limit) || 80)) break;
  }
  return out;
}

const VISITED_PLACES_LIMIT = 40;

/**
 * Catalog places whose H3 cells the group HAS visited (everyone or some
 * tier) — the mirror image of getCoverageGapSuggestions. Feeds the Places
 * tab so a place inside a revealed (unshaded) hex counts as somewhere
 * the group has actually been, rather than only ever showing up as an
 * "unexplored" suggestion.
 */
export async function getVisitedCatalogPlaces(db, group, { limit = VISITED_PLACES_LIMIT } = {}) {
  const coverage = await getGroupCoverage(db, group);
  const everyoneSet = new Set(coverage.everyone || []);
  const someSet = new Set(coverage.some || []);
  if (!everyoneSet.size && !someSet.size) return [];

  const places = await db
    .collection(PLACES_CATALOG)
    .find({ lat: { $type: "number" }, lng: { $type: "number" } })
    .toArray();

  const byCell = new Map();
  for (const place of places) {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) continue;
    const cell = latLngToCell(place.lat, place.lng, VISITED_CELL_RESOLUTION);
    const tier = everyoneSet.has(cell) ? "everyone" : someSet.has(cell) ? "some" : null;
    if (!tier || byCell.has(cell)) continue;
    const pub = publicPlace(place);
    if (!pub?.name) continue;
    byCell.set(cell, {
      h3_cell: cell,
      place_id: pub.id,
      name: pub.name,
      neighborhood: pub.neighborhood || "",
      place_type: pub.place_type || pub.category || "",
      lat: pub.lat,
      lng: pub.lng,
      coverage_tier: tier,
    });
  }

  return [...byCell.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, Math.max(1, Number(limit) || VISITED_PLACES_LIMIT));
}

async function ensureIndexes(db) {
  if (indexesReady) return;
  try {
    await Promise.all([
      db.collection(COLLECTIONS.LOCATION_TRACES).createIndexes(INDEXES.location_traces),
      db.collection(COLLECTIONS.USER_VISITED_CELLS).createIndexes(INDEXES.user_visited_cells),
    ]);
  } catch (err) {
    console.warn("[location] ensureIndexes:", err.message);
  }
  indexesReady = true;
}

function parseDate(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${field} is required`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${field} must be a valid ISO date`);
  }
  return date;
}

function toInt(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new HttpError(400, `${field} must be an integer`);
  }
  return value;
}

function toNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HttpError(400, `${field} must be a number`);
  }
  return value;
}
