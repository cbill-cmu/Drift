import { COLLECTIONS, INDEXES, TRAVEL_MODES } from "../models/index.js";
import { reverseGeocodePlaceType } from "./googlePlacesService.js";
import { asString, idVariants, matchGroupId, sameId } from "./ids.js";
import { getDb } from "./mongoService.js";
import { haversineMeters, inferNeighborhood, neighborhoodPct } from "./neighborhoods.js";
import { recomputeUserPlaceTypeProfile } from "./recommendationService.js";

export const NODE_MATCH_METERS = 500;

let indexesReady = false;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export function validateTripBody(body) {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Request body is required");
  }

  const group_id = typeof body.group_id === "string" ? body.group_id.trim() : "";
  if (!group_id) {
    throw new HttpError(400, "group_id is required");
  }

  const from_lat = toNumber(body.from_lat, "from_lat");
  const from_lng = toNumber(body.from_lng, "from_lng");
  const to_lat = toNumber(body.to_lat, "to_lat");
  const to_lng = toNumber(body.to_lng, "to_lng");
  assertLatLng(from_lat, from_lng, "from");
  assertLatLng(to_lat, to_lng, "to");

  const duration_min = toNumber(body.duration_min, "duration_min");
  if (!Number.isFinite(duration_min) || duration_min < 5 || duration_min > 120) {
    throw new HttpError(400, "duration_min must be a number between 5 and 120");
  }

  const travel_mode = body.travel_mode;
  if (!TRAVEL_MODES.includes(travel_mode)) {
    throw new HttpError(400, `travel_mode must be one of: ${TRAVEL_MODES.join(", ")}`);
  }

  return { group_id, from_lat, from_lng, to_lat, to_lng, duration_min, travel_mode };
}

export async function createTrip(rawBody, auth = {}) {
  const input = validateTripBody(rawBody);
  const db = getDb();
  await ensureIndexes(db);

  const group = await db.collection(COLLECTIONS.GROUPS).findOne({
    $or: idVariants(input.group_id).map((value) => ({ _id: value })),
  });
  if (!group) {
    throw new HttpError(404, "Unknown group");
  }

  const actor = await resolveActor(db, group, auth);
  const destNeighborhood = inferNeighborhood(input.to_lat, input.to_lng);
  const neighborhoodPctBefore = await neighborhoodPct(db, group._id, destNeighborhood);

  const fromNode = await resolveNode(db, {
    groupId: group._id,
    lat: input.from_lat,
    lng: input.from_lng,
    actor,
  });
  const toNode = await resolveNode(db, {
    groupId: group._id,
    lat: input.to_lat,
    lng: input.to_lng,
    actor,
  });

  const edge = await upsertEdge(db, {
    groupId: group._id,
    fromNode,
    toNode,
    travelMode: input.travel_mode,
    durationMin: input.duration_min,
    actor,
  });

  const now = new Date();
  await db.collection(COLLECTIONS.TRIPS).insertOne({
    group_id: group._id,
    user_id: actor._id,
    from_node_id: fromNode.doc._id,
    to_node_id: toNode.doc._id,
    started_at: new Date(now.getTime() - input.duration_min * 60_000),
    ended_at: now,
    duration_min: input.duration_min,
    travel_mode: input.travel_mode,
    user_created_at: now,
  });

  if (actor._id) {
    try {
      await recomputeUserPlaceTypeProfile(db, actor._id);
    } catch (err) {
      console.warn("[trips] recomputeUserPlaceTypeProfile:", err.message);
    }
  }

  await bumpHeatpoint(db, COLLECTIONS.HEATPOINTS, {
    groupId: group._id,
    lat: fromNode.doc.lat,
    lng: fromNode.doc.lng,
    recordedAt: now,
  });
  await bumpHeatpoint(db, COLLECTIONS.HEATPOINTS, {
    groupId: group._id,
    lat: toNode.doc.lat,
    lng: toNode.doc.lng,
    recordedAt: now,
  });
  if (actor._id) {
    await bumpHeatpoint(db, COLLECTIONS.USER_HEATPOINTS, {
      groupId: group._id,
      lat: fromNode.doc.lat,
      lng: fromNode.doc.lng,
      recordedAt: now,
      userId: actor._id,
    });
    await bumpHeatpoint(db, COLLECTIONS.USER_HEATPOINTS, {
      groupId: group._id,
      lat: toNode.doc.lat,
      lng: toNode.doc.lng,
      recordedAt: now,
      userId: actor._id,
    });
  }

  const inc = {};
  if (fromNode.created) inc.total_nodes_discovered = 1;
  if (toNode.created && !sameId(fromNode.doc._id, toNode.doc._id)) {
    inc.total_nodes_discovered = (inc.total_nodes_discovered || 0) + 1;
  }
  if (edge.created) inc.total_edges_discovered = 1;
  if (Object.keys(inc).length) {
    await db.collection(COLLECTIONS.GROUPS).updateOne({ _id: group._id }, { $inc: inc });
  }

  const discoveredNode = toNode.created ? toNode.doc : fromNode.created ? fromNode.doc : null;
  const neighborhoodPctAfter = await neighborhoodPct(db, group._id, destNeighborhood);

  return {
    success: true,
    actor_name: actor.display_name,
    new_node: discoveredNode
      ? {
          id: asString(discoveredNode._id),
          name: discoveredNode.name,
          place_type: discoveredNode.place_type,
        }
      : null,
    new_edge: edge.created
      ? {
          id: asString(edge.doc._id),
          from: fromNode.doc.name,
          to: toNode.doc.name,
          duration_min: input.duration_min,
        }
      : null,
    neighborhood_pct_before: neighborhoodPctBefore,
    neighborhood_pct_after: neighborhoodPctAfter,
  };
}

async function ensureIndexes(db) {
  if (indexesReady) return;
  try {
    await Promise.all([
      db.collection(COLLECTIONS.NODES).createIndexes(INDEXES.nodes),
      db.collection(COLLECTIONS.EDGES).createIndexes(INDEXES.edges),
      db.collection(COLLECTIONS.TRIPS).createIndexes(INDEXES.trips),
      db.collection(COLLECTIONS.HEATPOINTS).createIndexes(INDEXES.heatpoints),
      db.collection(COLLECTIONS.USER_HEATPOINTS).createIndexes(INDEXES.user_heatpoints),
      db.collection(COLLECTIONS.USERS).createIndexes(INDEXES.users),
      db.collection(COLLECTIONS.GROUPS).createIndexes(INDEXES.groups),
    ]);
  } catch (err) {
    console.warn("[mongo] ensureIndexes:", err.message);
  }
  indexesReady = true;
}

async function resolveActor(db, group, auth) {
  const users = db.collection(COLLECTIONS.USERS);
  const authSub = auth.sub || null;

  if (authSub) {
    const byAuth = await users.findOne({ auth0_id: authSub });
    if (byAuth) return normalizeActor(byAuth);

    const now = new Date();
    const doc = {
      auth0_id: authSub,
      email: auth.email || "",
      display_name: auth.name || auth.email || "Traveler",
      created_at: now,
      groups: [group._id],
    };
    try {
      const { insertedId } = await users.insertOne(doc);
      doc._id = insertedId;
      await db.collection(COLLECTIONS.GROUPS).updateOne(
        { _id: group._id },
        { $addToSet: { member_ids: insertedId } }
      );
      return normalizeActor(doc);
    } catch (err) {
      const again = await users.findOne({ auth0_id: authSub });
      if (again) return normalizeActor(again);
      console.warn("[trips] user upsert:", err.message);
    }
  }

  if (Array.isArray(group.member_ids) && group.member_ids.length) {
    const member = await users.findOne({
      $or: idVariants(group.member_ids[0]).map((value) => ({ _id: value })),
    });
    if (member) return normalizeActor(member);
  }

  const fabio = await users.findOne({ display_name: "Fabio" });
  if (fabio) return normalizeActor(fabio);

  const any = await users.findOne({});
  if (any) return normalizeActor(any);

  return { _id: null, display_name: auth.name || "Fabio" };
}

function normalizeActor(user) {
  return {
    _id: user._id,
    display_name: user.display_name || user.email || "Unknown",
  };
}

async function resolveNode(db, { groupId, lat, lng, actor }) {
  const nodes = db.collection(COLLECTIONS.NODES);
  const existing = await findNearestNode(db, groupId, lat, lng);
  const now = new Date();

  if (existing) {
    await nodes.updateOne({ _id: existing._id }, { $inc: { visit_count: 1 } });
    existing.visit_count = (existing.visit_count || 0) + 1;
    return { doc: existing, created: false };
  }

  const place = await reverseGeocodePlaceType(lat, lng);
  const neighborhood = inferNeighborhood(lat, lng);
  const name = place?.name || neighborhood || `Place ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  const doc = {
    group_id: groupId,
    name,
    neighborhood,
    lat,
    lng,
    place_type: place?.place_type || "unknown",
    visit_count: 1,
    first_discovered_by: actor._id,
    first_discovered_at: now,
    created_at: now,
  };
  const { insertedId } = await nodes.insertOne(doc);
  doc._id = insertedId;
  return { doc, created: true };
}

async function findNearestNode(db, groupId, lat, lng) {
  const deg = NODE_MATCH_METERS / 111_320;
  const candidates = await db
    .collection(COLLECTIONS.NODES)
    .find({
      $and: [
        matchGroupId("group_id", groupId),
        { lat: { $gte: lat - deg, $lte: lat + deg } },
        { lng: { $gte: lng - deg, $lte: lng + deg } },
      ],
    })
    .toArray();

  let best = null;
  let bestMeters = Infinity;
  for (const node of candidates) {
    const meters = haversineMeters(lat, lng, Number(node.lat), Number(node.lng));
    if (meters <= NODE_MATCH_METERS && meters < bestMeters) {
      best = node;
      bestMeters = meters;
    }
  }
  return best;
}

async function upsertEdge(db, { groupId, fromNode, toNode, travelMode, durationMin, actor }) {
  const edges = db.collection(COLLECTIONS.EDGES);
  const existing = await edges.findOne({
    $and: [
      matchGroupId("group_id", groupId),
      { $or: idVariants(fromNode.doc._id).map((value) => ({ from_node_id: value })) },
      { $or: idVariants(toNode.doc._id).map((value) => ({ to_node_id: value })) },
    ],
  });

  const now = new Date();
  if (existing) {
    const count = existing.traversal_count || 0;
    const prevAvg = existing.avg_duration_min || durationMin;
    const avg = (prevAvg * count + durationMin) / (count + 1);
    await edges.updateOne(
      { _id: existing._id },
      { $set: { avg_duration_min: avg }, $inc: { traversal_count: 1 } }
    );
    existing.avg_duration_min = avg;
    existing.traversal_count = count + 1;
    return { doc: existing, created: false };
  }

  const doc = {
    group_id: groupId,
    from_node_id: fromNode.doc._id,
    to_node_id: toNode.doc._id,
    travel_mode: travelMode,
    avg_duration_min: durationMin,
    traversal_count: 1,
    first_traveled_by: actor._id,
    first_traveled_at: now,
    created_at: now,
  };
  const { insertedId } = await edges.insertOne(doc);
  doc._id = insertedId;
  return { doc, created: true };
}

async function bumpHeatpoint(db, collectionName, { groupId, lat, lng, recordedAt, userId }) {
  const roundedLat = roundCoord(lat);
  const roundedLng = roundCoord(lng);
  const heat = db.collection(collectionName);
  const filter = {
    $and: [matchGroupId("group_id", groupId), { lat: roundedLat }, { lng: roundedLng }],
  };
  if (userId) {
    filter.$and.push({ $or: idVariants(userId).map((value) => ({ user_id: value })) });
  }
  const existing = await heat.findOne(filter);
  if (existing) {
    await heat.updateOne(
      { _id: existing._id },
      { $inc: { weight: 1 }, $set: { recorded_at: recordedAt } }
    );
    return;
  }
  const doc = {
    group_id: groupId,
    lat: roundedLat,
    lng: roundedLng,
    weight: 1,
    recorded_at: recordedAt,
  };
  if (userId) doc.user_id = userId;
  await heat.insertOne(doc);
}

function toNumber(value, field) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  throw new HttpError(400, `${field} must be a number`);
}

function assertLatLng(lat, lng, label) {
  if (lat < -90 || lat > 90) throw new HttpError(400, `${label}_lat must be between -90 and 90`);
  if (lng < -180 || lng > 180) throw new HttpError(400, `${label}_lng must be between -180 and 180`);
}

function roundCoord(value) {
  return Math.round(Number(value) * 10_000) / 10_000;
}

export { haversineMeters };
