import { Router } from "express";

import { upsertCurrentUser } from "../services/userService.js";
import { buildRecommendations } from "../services/recommendationService.js";
import { getDb } from "../services/mongoService.js";
import { ensurePlacesCatalog } from "../services/placesCatalogService.js";

const router = Router();

/**
 * GET /api/recommendations?group_id=
 * Three activity types with named places + locations from the city catalog.
 */
router.get("/", async (req, res) => {
  try {
    await ensurePlacesCatalog();
    const { user } = await upsertCurrentUser(req.auth || {});
    const groupId = typeof req.query.group_id === "string" ? req.query.group_id.trim() : "";
    if (!groupId) {
      return res.status(400).json({ success: false, error: "group_id is required" });
    }
    const payload = await buildRecommendations(getDb(), {
      userId: user._id,
      groupId,
    });
    return res.json(payload);
  } catch (err) {
    if (err?.status === 401) {
      return res.status(401).json({ success: false, error: err.message });
    }
    if (err?.message?.includes("Mongo not connected")) {
      return res.status(500).json({ success: false, error: "Mongo not connected" });
    }
    console.error("[recommendations] GET / failed:", err);
    return res.status(500).json({ success: false, error: "Failed to load recommendations" });
  }
});

export default router;
