import { Router } from "express";
import {
  acceptGroupInvite,
  createGroup,
  declineGroupInvite,
  inviteFriendToGroup,
  listInviteableFriends,
  listMyGroupInvites,
  listMyGroups,
  unsendGroupInvite,
} from "../services/groupService.js";
import { HttpError } from "../services/friendsService.js";

/**
 * Groups + friend-only invites (Person D).
 *
 * POST /api/groups                    body { name }
 *   200 { success, group }
 *
 * GET /api/groups
 *   200 { success, groups[] }
 *
 * POST /api/groups/:groupId/invites   body { user_id }
 *   200 { success, invite }
 *   403 if caller is not a member, or user_id is not an accepted friend
 *
 * GET /api/groups/:groupId/inviteable
 *   200 { success, group, inviteable[] }
 *
 * GET /api/groups/invites
 *   200 { success, me, incoming[], outgoing[] }
 *
 * POST /api/groups/invites/:id/accept
 *   200 { success, already_accepted, invite, group }
 *
 * POST /api/groups/invites/:id/decline
 *   200 { success, declined, invite }
 *
 * POST /api/groups/invites/:id/unsend
 *   200 { success, unsent, invite }
 *
 * invite = {
 *   invite_id, status, direction ("incoming"|"outgoing"), created_at,
 *   group: { id, name },
 *   user: { id, display_name, email }
 * }
 */
const router = Router();

const HEX_ID = /^[a-fA-F0-9]{24}$/;

function requireWellFormedGroupId(req, res, next) {
  if (!HEX_ID.test(String(req.params.groupId || "").trim())) {
    return res.status(400).json({ success: false, error: "Invalid groupId" });
  }
  return next();
}

function sendError(res, err) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, error: err.message });
  }
  if (err?.message?.includes("Mongo not connected")) {
    return res.status(500).json({ success: false, error: "Mongo not connected" });
  }
  console.error("[groups]", err);
  return res.status(500).json({ success: false, error: "Groups request failed" });
}

router.post("/", async (req, res) => {
  try {
    return res.status(200).json(await createGroup(req.body, req.auth || {}));
  } catch (err) {
    sendError(res, err);
  }
});

router.get("/", async (req, res) => {
  try {
    return res.status(200).json(await listMyGroups(req.auth || {}));
  } catch (err) {
    sendError(res, err);
  }
});

router.get("/invites", async (req, res) => {
  try {
    return res.status(200).json(await listMyGroupInvites(req.auth || {}));
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/invites/:id/accept", async (req, res) => {
  try {
    return res.status(200).json(await acceptGroupInvite(req.params.id, req.auth || {}));
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/invites/:id/decline", async (req, res) => {
  try {
    return res.status(200).json(await declineGroupInvite(req.params.id, req.auth || {}));
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/invites/:id/unsend", async (req, res) => {
  try {
    return res.status(200).json(await unsendGroupInvite(req.params.id, req.auth || {}));
  } catch (err) {
    sendError(res, err);
  }
});

router.get("/:groupId/inviteable", requireWellFormedGroupId, async (req, res) => {
  try {
    return res.status(200).json(await listInviteableFriends(req.params.groupId, req.auth || {}));
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/:groupId/invites", requireWellFormedGroupId, async (req, res) => {
  try {
    return res.status(200).json(
      await inviteFriendToGroup(req.params.groupId, req.body, req.auth || {})
    );
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
