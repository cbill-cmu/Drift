import { Router } from "express";

const router = Router();

/**
 * POST /api/trips
 * Contract: shared/api-contract.md
 */
router.post("/", (_req, res) => {
  res.status(501).json({
    success: false,
    error: "Not implemented — Person 1: implement POST /api/trips",
  });
});

export default router;
