import { Router } from "express";

import { COLLECTIONS } from "../models/index.js";
import { asString, idVariants } from "../services/ids.js";
import { getDb } from "../services/mongoService.js";
import { HttpError, deleteCurrentUser, publicUser, updateCurrentUser, upsertCurrentUser } from "../services/userService.js";

const router = Router();

/**
 * POST /api/users/me
 * Create (or return) the Mongo user for the Auth0 token.
 */
router.post("/me", async (req, res) => {
  try {
    const { user, created } = await upsertCurrentUser(req.auth || {});
    return res.status(created ? 201 : 200).json({
      success: true,
      created,
      user: publicUser(user),
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    if (err?.message?.includes("Mongo not connected")) {
      return res.status(500).json({ success: false, error: "Mongo not connected" });
    }
    console.error("[users] POST /me failed:", err);
    return res.status(500).json({ success: false, error: "Failed to create user" });
  }
});

/**
 * GET /api/users/me
 */
router.get("/me", async (req, res) => {
  try {
    const { user, created } = await upsertCurrentUser(req.auth || {});
    return res.json({
      success: true,
      created,
      user: publicUser(user),
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    console.error("[users] GET /me failed:", err);
    return res.status(500).json({ success: false, error: "Failed to load user" });
  }
});

/**
 * PATCH /api/users/me
 */
router.patch("/me", async (req, res) => {
  try {
    const { user } = await updateCurrentUser(req.auth || {}, req.body || {});
    return res.json({
      success: true,
      created: false,
      user: publicUser(user),
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    if (err?.message?.includes("Mongo not connected")) {
      return res.status(500).json({ success: false, error: "Mongo not connected" });
    }
    console.error("[users] PATCH /me failed:", err);
    return res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

/**
 * DELETE /api/users/me
 */
router.delete("/me", async (req, res) => {
  try {
    const result = await deleteCurrentUser(req.auth || {});
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    if (err?.message?.includes("Mongo not connected")) {
      return res.status(500).json({ success: false, error: "Mongo not connected" });
    }
    console.error("[users] DELETE /me failed:", err);
    return res.status(500).json({ success: false, error: "Failed to delete account" });
  }
});

/**
 * GET /api/users/:userId/profile
 * Contract: shared/api-contract.md
 *
 * :userId may be either a Mongo _id (ObjectId hex) or an Auth0 sub
 * (e.g. "auth0|..."), same dual-lookup convention resolveActor() uses
 * in tripService.js.
 */
router.get("/:userId/profile", async (req, res) => {
  try {
    const db = getDb();
    const { userId } = req.params;

    const user = await findUser(db, userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "Unknown user" });
    }

    const [profileDocs, totalTrips, discoveredNodes, discoveredEdges] = await Promise.all([
      db
        .collection(COLLECTIONS.USER_PLACE_TYPE_PROFILES)
        .find({ user_id: user._id })
        .toArray(),
      db.collection(COLLECTIONS.TRIPS).countDocuments({
        $or: idVariants(user._id).map((value) => ({ user_id: value })),
      }),
      db.collection(COLLECTIONS.NODES).countDocuments({
        $or: idVariants(user._id).map((value) => ({ first_discovered_by: value })),
      }),
      db.collection(COLLECTIONS.EDGES).countDocuments({
        $or: idVariants(user._id).map((value) => ({ first_traveled_by: value })),
      }),
    ]);

    const place_type_preferences = profileDocs
      .map((p) => ({ place_type: p.place_type, frequency_pct: p.frequency_pct }))
      .sort((a, b) => b.frequency_pct - a.frequency_pct);

    return res.json({
      success: true,
      user_id: asString(user._id),
      display_name: user.display_name || user.email || "Traveler",
      place_type_preferences,
      total_trips: totalTrips,
      total_discovery: discoveredNodes + discoveredEdges,
    });
  } catch (err) {
    console.error("[users] GET /:userId/profile failed:", err);
    return res.status(500).json({ success: false, error: "Failed to load profile" });
  }
});

async function findUser(db, userId) {
  const users = db.collection(COLLECTIONS.USERS);
  const byId = await users.findOne({
    $or: idVariants(userId).map((value) => ({ _id: value })),
  });
  if (byId) return byId;
  return users.findOne({ auth0_id: userId });
}

export default router;
