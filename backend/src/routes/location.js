import { Router } from "express";

import { asString } from "../services/ids.js";
import {
  deriveVisitedCells,
  recordTrace,
  validateTraceBody,
} from "../services/locationService.js";
import { getDb } from "../services/mongoService.js";
import { HttpError, upsertCurrentUser } from "../services/userService.js";

const router = Router();

/**
 * POST /api/location/traces
 * Flush a buffered polyline of accepted GPS fixes. Derives H3 cells
 * into user_visited_cells after the raw trace is stored.
 */
router.post("/traces", async (req, res) => {
  try {
    const input = validateTraceBody(req.body);
    const { user } = await upsertCurrentUser(req.auth || {});
    const db = getDb();
    const trace = await recordTrace(db, user._id, input);

    let cells = { unique_cells: 0 };
    try {
      cells = await deriveVisitedCells(db, user._id, input.points, input.ended_at);
    } catch (err) {
      console.warn("[location] deriveVisitedCells:", err.message);
    }

    return res.status(200).json({
      success: true,
      trace_id: asString(trace._id),
      point_count: input.point_count,
      cells_upserted: cells.unique_cells || 0,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    if (err?.message?.includes("Mongo not connected")) {
      return res.status(500).json({ success: false, error: "Mongo not connected" });
    }
    console.error("[location] POST /traces failed:", err);
    return res.status(500).json({ success: false, error: "Internal error" });
  }
});

export default router;
