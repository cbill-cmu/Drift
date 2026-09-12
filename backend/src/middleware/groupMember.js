/**
 * Person A — caller must belong to :groupId before graph data is returned.
 * Links Auth0 `sub` onto an existing seeded user matched by email when needed,
 * but never auto-joins strangers (Person D owns create/join).
 */
import { COLLECTIONS } from "../models/index.js";
import { asString, idVariants, sameId } from "../services/ids.js";
import { getDb } from "../services/mongoService.js";

export async function requireGroupMember(req, res, next) {
  try {
    const groupId = req.params.groupId;
    const sub = req.auth?.sub;
    if (!sub) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const db = getDb();
    const group = await db.collection(COLLECTIONS.GROUPS).findOne({
      $or: idVariants(groupId).map((value) => ({ _id: value })),
    });

    if (!group) {
      return res.status(404).json({ success: false, error: "Unknown group" });
    }

    const users = db.collection(COLLECTIONS.USERS);
    let user = await users.findOne({ auth0_id: sub });

    if (!user && req.auth?.email) {
      user = await users.findOne({ email: req.auth.email });
      if (user) {
        // Seed rows use placeholder auth0_ids — always bind the live Auth0 sub
        await users.updateOne({ _id: user._id }, { $set: { auth0_id: sub } });
        user.auth0_id = sub;
      }
    }

    if (!user) {
      return res.status(403).json({
        success: false,
        error: "Not a group member",
      });
    }

    const memberIds = group.member_ids || [];
    const isMember =
      memberIds.some((id) => sameId(id, user._id)) ||
      memberIds.some((id) => sameId(id, sub)) ||
      memberIds.some((id) => sameId(id, user.auth0_id));

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: "Not a group member",
      });
    }

    req.groupMember = user;
    req.groupDoc = group;
    return next();
  } catch (err) {
    console.error("[requireGroupMember]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to verify group membership",
    });
  }
}

/** Optional helper for logging */
export function describeCaller(req) {
  return asString(req.auth?.sub || req.groupMember?._id || "anonymous");
}
