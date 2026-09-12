import { ObjectId } from "mongodb";
import { Router } from "express";
import { COLLECTIONS } from "../models/index.js";
import { getDb } from "../services/mongoService.js";

const router = Router();

const HOOD_TOTALS = {
  Oakland: 9,
  Shadyside: 10,
  "Squirrel Hill": 11,
  "East Liberty": 10,
  "South Side": 9,
  Lawrenceville: 11,
  Downtown: 11,
  Bloomfield: 9,
};

function asString(value) {
  if (value == null) return "";
  return String(value);
}

function idVariants(id) {
  const variants = [id];
  if (typeof id === "string" && ObjectId.isValid(id)) {
    variants.push(new ObjectId(id));
  }
  return variants;
}

function matchGroupId(field, groupId) {
  return { $or: idVariants(groupId).map((value) => ({ [field]: value })) };
}

function buildNeighborhoods(nodes) {
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

function serializeNode(node) {
  return {
    id: asString(node._id),
    name: node.name,
    neighborhood: node.neighborhood,
    lat: Number(node.lat),
    lng: Number(node.lng),
    place_type: node.place_type || "unknown",
    visits: node.visit_count ?? node.visits ?? 0,
  };
}

function serializeEdge(edge) {
  return {
    id: asString(edge._id),
    from: asString(edge.from_node_id ?? edge.from),
    to: asString(edge.to_node_id ?? edge.to),
    count: edge.traversal_count ?? edge.count ?? 1,
    avg_duration: edge.avg_duration_min ?? edge.avg_duration ?? 0,
    travel_mode: edge.travel_mode || "walk",
  };
}

async function loadGroupGraph(groupId) {
  const db = getDb();
  const group = await db.collection(COLLECTIONS.GROUPS).findOne({
    $or: idVariants(groupId).map((value) => ({ _id: value })),
  });
  if (!group) return null;

  const gid = group._id;
  const nodeDocs = await db
    .collection(COLLECTIONS.NODES)
    .find(matchGroupId("group_id", gid))
    .toArray();
  const edgeDocs = await db
    .collection(COLLECTIONS.EDGES)
    .find(matchGroupId("group_id", gid))
    .toArray();
  const heatDocs = await db
    .collection(COLLECTIONS.HEATPOINTS)
    .find(matchGroupId("group_id", gid))
    .toArray();

  const memberIds = (group.member_ids || []).flatMap((id) => idVariants(id));
  const users = memberIds.length
    ? await db
        .collection(COLLECTIONS.USERS)
        .find({ $or: [{ _id: { $in: memberIds } }, { auth0_id: { $in: memberIds.map(asString) } }] })
        .toArray()
    : [];

  const nodes = nodeDocs.map(serializeNode);
  return {
    success: true,
    group_id: asString(gid),
    group_name: group.name || "Group",
    nodes,
    edges: edgeDocs.map(serializeEdge),
    heatpoints: heatDocs.map((h) => ({
      lat: Number(h.lat),
      lng: Number(h.lng),
      weight: Number(h.weight) || 1,
    })),
    neighborhoods: buildNeighborhoods(nodes),
    members: users.map((u) => ({
      id: asString(u._id),
      display_name: u.display_name || u.email || "Member",
      email: u.email || "",
    })),
  };
}

/**
 * GET /api/groups/:groupId/graph
 * Contract: shared/api-contract.md
 */
router.get("/:groupId/graph", async (req, res) => {
  try {
    const graph = await loadGroupGraph(req.params.groupId);
    if (!graph) {
      return res.status(404).json({ success: false, error: "Unknown group" });
    }
    return res.json(graph);
  } catch (err) {
    console.error("[graph]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to load graph",
    });
  }
});

/**
 * GET /api/groups/:groupId/members/:userId/graph
 * Personal graph for a group member (friend map). Same shape as group graph.
 */
router.get("/:groupId/members/:userId/graph", async (req, res) => {
  try {
    const db = getDb();
    const { groupId, userId } = req.params;
    const groupGraph = await loadGroupGraph(groupId);
    if (!groupGraph) {
      return res.status(404).json({ success: false, error: "Unknown group" });
    }

    const userVariants = idVariants(userId);
    const trips = await db
      .collection(COLLECTIONS.TRIPS)
      .find({
        $and: [matchGroupId("group_id", groupId), { $or: userVariants.map((v) => ({ user_id: v })) }],
      })
      .toArray();

    const heatDocs = await db
      .collection(COLLECTIONS.USER_HEATPOINTS)
      .find({
        $and: [matchGroupId("group_id", groupId), { $or: userVariants.map((v) => ({ user_id: v })) }],
      })
      .toArray();

    const usedNodeIds = new Set();
    for (const trip of trips) {
      usedNodeIds.add(asString(trip.from_node_id));
      usedNodeIds.add(asString(trip.to_node_id));
    }

    const nodes =
      usedNodeIds.size > 0
        ? groupGraph.nodes.filter((n) => usedNodeIds.has(n.id))
        : groupGraph.nodes;
    const nodeSet = new Set(nodes.map((n) => n.id));
    const edges = groupGraph.edges.filter((e) => nodeSet.has(e.from) && nodeSet.has(e.to));

    const member = groupGraph.members.find((m) => m.id === asString(userId));
    const heatpoints =
      heatDocs.length > 0
        ? heatDocs.map((h) => ({
            lat: Number(h.lat),
            lng: Number(h.lng),
            weight: Number(h.weight) || 1,
          }))
        : nodes.map((n) => ({ lat: n.lat, lng: n.lng, weight: Math.max(0.4, (n.visits || 1) / 10) }));

    return res.json({
      success: true,
      user_id: asString(userId),
      display_name: member?.display_name || "Friend",
      group_id: groupGraph.group_id,
      group_name: `${member?.display_name || "Friend"}'s map`,
      nodes,
      edges,
      heatpoints,
      neighborhoods: buildNeighborhoods(nodes),
    });
  } catch (err) {
    console.error("[member-graph]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to load friend graph",
    });
  }
});

export default router;
