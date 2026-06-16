import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  addTeamStats,
  getTeamStatsList,
  getSingleTeamStats,
  getTeamStatsAverage,
  getTeamPlayersStats
} from "../controllers/teamStats.controller.js";


const router = express.Router();

router.post("/stats/add/:teamId",  addTeamStats);
router.get("/stats/list/:teamId",  getTeamStatsList);
router.get("/stats/view/:statsId",  getSingleTeamStats);
router.get("/stats/average/:teamId",  getTeamStatsAverage);
router.get("/stats/players/:teamId", requireAuth, getTeamPlayersStats);

export default router;
