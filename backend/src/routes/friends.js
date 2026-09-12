import { Router } from "express";
import {
  HttpError,
  acceptFriend,
  listFriends,
  requestFriend,
  unsendFriend,
} from "../services/friendsService.js";

/**
 * Friends API (Person C).
 *
 * Proposed response shapes (not yet in shared/api-contract.md — Slack
 * Person 1 + 2 before editing that locked file):
 *
 * POST /api/friends  body { email }
 *   200 { success, auto_accepted, friendship }
 *
 * POST /api/friends/:id/accept
 *   200 { success, already_accepted, friendship }
 *
 * POST /api/friends/:id/unsend
 *   200 { success, unsent, friendship }
 *
 * GET /api/friends
 *   200 { success, accepted[], incoming[], outgoing[] }
 *
 * friendship = {
 *   friendship_id, status, direction ("incoming"|"outgoing"),
 *   created_at, user: { id, display_name, email }
 * }
 *
 * user_id_1 = requester, user_id_2 = recipient.
 */
const router = Router();

function sendError(res, err) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, error: err.message });
  }
  if (err?.message?.includes("Mongo not connected")) {
    return res.status(500).json({ success: false, error: "Mongo not connected" });
  }
  console.error("[friends]", err);
  return res.status(500).json({ success: false, error: "Friends request failed" });
}

router.post("/", async (req, res) => {
  try {
    const result = await requestFriend(req.body, req.auth || {});
    return res.status(200).json(result);
  } catch (err) {
    sendError(res, err);
  }
});

router.get("/", async (req, res) => {
  try {
    const result = await listFriends(req.auth || {});
    return res.status(200).json(result);
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/:id/accept", async (req, res) => {
  try {
    const result = await acceptFriend(req.params.id, req.auth || {});
    return res.status(200).json(result);
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/:id/unsend", async (req, res) => {
  try {
    const result = await unsendFriend(req.params.id, req.auth || {});
    return res.status(200).json(result);
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
