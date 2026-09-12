import { Router } from "express";

const router = Router();

/**
 * GET /api/groups/:groupId/graph
 * Contract: shared/api-contract.md
 */
router.get("/:groupId/graph", (_req, res) => {
  res.status(501).json({
    success: false,
    error: "Not implemented — Person 1: implement GET /api/groups/:groupId/graph",
  });
});

/**
 * GET /api/users/:userId/profile lives elsewhere if needed;
 * stub kept here only for group graph MVP.
 */
export default router;
