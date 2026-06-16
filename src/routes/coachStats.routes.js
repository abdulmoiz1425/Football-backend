// src/routes/coachStats.routes.js
import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  addPlayerStats,
  getPlayerStatsList,
  getSinglePlayerStats,
  getPlayerStatsAverage,
  updatePlayerStats,
  updateTeamStats,
  getExpectedGoals,
  getStatProbabilities,
  sendStatsLinkToPlayer
} from "../controllers/coachStats.controller.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(["COACH", "ADMIN"]));

// Add stats
router.post("/add/:playerId", addPlayerStats);

// List stats for player
router.get("/list/:playerId", getPlayerStatsList);

// View single stats (modal)
router.get("/view/:statsId", getSinglePlayerStats);

router.get("/stats/avg/:playerId", getPlayerStatsAverage);

router.put("/stats/update/:playerId", updatePlayerStats);

router.put("/stats/update-team/:teamId", updateTeamStats);

// Expected goals via regression model fitted on current player_stats data
router.get("/expected-goals/:playerId", getExpectedGoals);

// Poisson probability distribution (player vs team, per stat)
router.get("/probability/:playerId", getStatProbabilities);

// Email the player a one-time link to fill in their own stats
router.post("/send-stats-link/:playerId", sendStatsLinkToPlayer);

export default router;
