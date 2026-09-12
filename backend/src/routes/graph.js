import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireGroupMember } from "../middleware/groupMember.js";
import { COLLECTIONS } from "../models/index.js";
import { asString, idVariants, matchGroupId } from "../services/ids.js";
import {
  getCoverageGapSuggestions,
  getGroupCoverage,
  getVisitedCatalogPlaces,
} from "../services/locationService.js";
import { getDb } from "../services/mongoService.js";
import { buildNeighborhoods } from "../services/neighborhoods.js";

const router = Router();

const HEX_ID = /^[a-fA-F0-9]{24}$/;
const AUTH0_SUB = /^auth0\|[\w.-]{1,128}$/;

function wellFormedId(value) {
  const raw = String(value || "").trim();
  return HEX_ID.test(raw) || AUTH0_SUB.test(raw);
}

function requireWellFormedParams(req, res, next) {
  const { groupId, userId } = req.params;
  if (groupId !== undefined && !HEX_ID.test(String(groupId).trim())) {
    return res.status(400).json({ success: false, error: "Invalid groupId" });
  }
  if (userId !== undefined && !wellFormedId(userId)) {
    return res.status(400).json({ success: false, error: "Invalid userId" });
  }
  return next();
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
 * Person A: Auth0 JWT + group membership required.
 */
router.get("/:groupId/graph", requireAuth, requireWellFormedParams, requireGroupMember, async (req, res) => {
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
 * GET /api/groups/:groupId/coverage
 * Personal cells merged for the group: everyone / some. "No one" is
 * every other cell, computed client-side.
 */
router.get("/:groupId/coverage", requireAuth, requireWellFormedParams, requireGroupMember, async (req, res) => {
  try {
    const group = req.groupDoc;
    const coverage = await getGroupCoverage(getDb(), group);
    return res.json({
      success: true,
      group_id: asString(group._id),
      everyone: coverage.everyone,
      some: coverage.some,
    });
  } catch (err) {
    console.error("[coverage]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to load group coverage",
    });
  }
});

/**
 * GET /api/groups/:groupId/suggestions
 * Catalog places in cells nobody in the group has visited.
 */
router.get("/:groupId/suggestions", requireAuth, requireWellFormedParams, requireGroupMember, async (req, res) => {
  try {
    const group = req.groupDoc;
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) ? Math.min(80, Math.max(1, Math.floor(rawLimit))) : 48;
    const suggestions = await getCoverageGapSuggestions(getDb(), group, { limit });
    return res.json({
      success: true,
      group_id: asString(group._id),
      suggestions,
    });
  } catch (err) {
    console.error("[suggestions]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to load suggestions",
    });
  }
});

/**
 * GET /api/groups/:groupId/visited-places
 * Catalog places sitting inside cells the group HAS visited (unshaded,
 * revealed hexes) — feeds the Places tab so these count as places
 * visited, distinct from /suggestions (unvisited, feeds Recs).
 */
router.get(
  "/:groupId/visited-places",
  requireAuth,
  requireWellFormedParams,
  requireGroupMember,
  async (req, res) => {
    try {
      const group = req.groupDoc;
      const rawLimit = Number(req.query.limit);
      const limit = Number.isFinite(rawLimit) ? Math.min(60, Math.max(1, Math.floor(rawLimit))) : 40;
      const places = await getVisitedCatalogPlaces(getDb(), group, { limit });
      return res.json({
        success: true,
        group_id: asString(group._id),
        places,
      });
    } catch (err) {
      console.error("[visited-places]", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to load visited places",
      });
    }
  }
);

/**
 * GET /api/groups/:groupId/members/:userId/graph
 * Personal graph for a group member (friend map). Same shape as group graph.
 * Person A: Auth0 JWT + group membership required.
 */
router.get(
  "/:groupId/members/:userId/graph",
  requireAuth,
  requireWellFormedParams,
  requireGroupMember,
  async (req, res) => {
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
  }
);

export default router;
