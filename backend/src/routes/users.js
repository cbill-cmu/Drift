import { Router } from "express";

import { COLLECTIONS } from "../models/index.js";
import { asString, idVariants } from "../services/ids.js";
import { getDb } from "../services/mongoService.js";

const router = Router();

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
