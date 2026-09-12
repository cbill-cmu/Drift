import { Router } from "express";

import {
  createNamedPlace,
  hoodOptions,
  publicPlace,
  searchPlaces,
} from "../services/placesCatalogService.js";

const router = Router();

/**
 * GET /api/places?q=&category=&limit=
 * City catalog — not the group graph.
 */
router.get("/", async (req, res) => {
  try {
    const places = await searchPlaces({
      q: req.query.q,
      category: req.query.category,
      limit: req.query.limit,
    });
    return res.json({
      success: true,
      neighborhoods: hoodOptions(),
      places,
    });
  } catch (err) {
    if (err?.message?.includes("Mongo not connected")) {
      return res.status(500).json({ success: false, error: "Mongo not connected" });
    }
    console.error("[places] GET / failed:", err);
    return res.status(500).json({ success: false, error: "Internal error" });
  }
});

/**
 * POST /api/places
 * Store a newly named hangout in the catalog (classified, not a graph node).
 */
router.post("/", async (req, res) => {
  try {
    const { doc, created } = await createNamedPlace(req.body || {});
    return res.status(created ? 201 : 200).json({
      success: true,
      created,
      place: publicPlace(doc),
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ success: false, error: err.message });
    }
    console.error("[places] POST / failed:", err);
    return res.status(500).json({ success: false, error: "Internal error" });
  }
});

export default router;
