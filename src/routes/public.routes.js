import express from "express";
import { verifyEvaluationToken } from "../controllers/coachPlayers.controller.js";
import { verifyStatsToken, publicSubmitPlayerStats } from "../controllers/coachStats.controller.js";

const router = express.Router();

// PUBLIC Token Verify Route
router.get("/verify", verifyEvaluationToken);

// PUBLIC Stats Link Routes
router.get("/stats/verify", verifyStatsToken);
router.post("/stats/submit", publicSubmitPlayerStats);

export default router;
