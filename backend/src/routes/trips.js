import { Router } from "express";

import { createTrip, HttpError } from "../services/tripService.js";

const router = Router();

/**
 * POST /api/trips
 * Contract: shared/api-contract.md
 */
router.post("/", async (req, res) => {
  try {
    const payload = await createTrip(req.body, req.auth || {});
    return res.status(200).json(payload);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    if (err?.message?.includes("Mongo not connected")) {
      return res.status(500).json({ success: false, error: "Mongo not connected" });
    }
    console.error("[trips] POST / failed:", err);
    return res.status(500).json({ success: false, error: "Internal error" });
  }
});

export default router;
