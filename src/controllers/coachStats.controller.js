// src/controllers/coachStats.controller.js
import crypto from "crypto";
import { pool } from "../../config/db.js";
import { mailer } from "../../utils/mailer.js";
import { poissonDistribution } from "../utils/mathStats.js";

// Stats tracked per player/team that the probability framework can be generalized to
const PROBABILITY_STAT_KEYS = [
  "goals",
  "assists",
  "shots",
  "shots_on_goal",
  "big_chances",
  "key_passes",
  "tackles",
  "cautions",
  "ejections",
  "progressive_carries",
  "defensive_actions",
];


// export const addPlayerStats = async (req, res) => {
//   try {
//     const coachId = req.user.id;
//     const playerId = req.params.playerId;

//     // Map frontend → backend fields
//     const {
//       year = new Date().getFullYear(),
//       matches = 0,
//       goals = 0,
//       assists = 0,
//       shots = 0,
//       shots_on_goal = 0,
//       big_chances = 0,
//       key_passes = 0,
//       tackles = 0,

//       // ⭐ FIXED FIELD NAMES ⭐
//       pass_completion: pass_completion_pct = null,   // frontend: pass_completion
//       minutes_played: minutes = 0,                   // frontend: minutes_played

//       cautions = 0,
//       ejections = 0,
//       progressive_carries = 0,
//       defensive_actions = 0,
//     } = req.body || {};

//     const sql = `
//       INSERT INTO player_stats
//       (
//         player_id, year, matches, goals, assists, shots, shots_on_goal,
//         big_chances, key_passes, tackles, pass_completion_pct, minutes,
//         cautions, ejections, progressive_carries, defensive_actions, created_at
//       )
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//     `;

//     const params = [
//       playerId,
//       year,
//       matches,
//       goals,
//       assists,
//       shots,
//       shots_on_goal,
//       big_chances,
//       key_passes,
//       tackles,
//       pass_completion_pct,
//       minutes,
//       cautions,
//       ejections,
//       progressive_carries,
//       defensive_actions,
//     ];

//     const [result] = await pool.query(sql, params);

//     return res.status(201).json({
//       success: true,
//       message: "Player stats saved",
//       id: result.insertId,
//     });

//   } catch (err) {
//     console.error("addPlayerStats error:", err);
//     return res.status(500).json({ message: "Failed to save stats" });
//   }
// };

export const addPlayerStats = async (req, res) => {
  try {
    const playerId = req.params.playerId;

    const [[player]] = await pool.query(
      "SELECT team_id FROM players WHERE p_id = ?",
      [playerId]
    );

    if (!player || !player.team_id) {
      return res.status(400).json({ message: "Player team not found" });
    }

    const teamId = player.team_id;

    // Incoming fields
    let {
      year = new Date().getFullYear(),
      matches = 0, // team matches
      goals = 0,
      assists = 0,
      shots = 0,
      shots_on_goal = 0,
      big_chances = 0,
      key_passes = 0,
      tackles = 0,
      pass_completion: pass_completion_pct = null,
      minutes_played,
      cautions = 0,
      ejections = 0,
      progressive_carries = 0,
      defensive_actions = 0,
    } = req.body || {};

    // ⭐ minutes = matches × 90
    const minutes = matches * 90;

    // SAVE PLAYER STATS
    await pool.query(
      `
      INSERT INTO player_stats
      (
        player_id, year, matches, goals, assists, shots, shots_on_goal,
        big_chances, key_passes, tackles, pass_completion_pct, minutes,
        cautions, ejections, progressive_carries, defensive_actions, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        playerId, year, matches, goals, assists, shots, shots_on_goal,
        big_chances, key_passes, tackles, pass_completion_pct, minutes,
        cautions, ejections, progressive_carries, defensive_actions
      ]
    );

    // ⭐ TEAM STATS (minutes SUM removed)
    await pool.query(
      `
      INSERT INTO team_stats (
        team_id, year, matches, goals, assists, shots, shots_on_goal,
        big_chances, key_passes, tackles, pass_completion_pct, minutes,
        cautions, ejections, progressive_carries, defensive_actions, created_at
      )
      SELECT 
        p.team_id,
        ps.year,

        -- EXACT matches
        ? AS matches,

        -- SUM other stats
        SUM(ps.goals),
        SUM(ps.assists),
        SUM(ps.shots),
        SUM(ps.shots_on_goal),
        SUM(ps.big_chances),
        SUM(ps.key_passes),
        SUM(ps.tackles),

        AVG(ps.pass_completion_pct),

        -- ⭐ EXACT minutes, no SUM
        (? * 90) AS minutes,

        SUM(ps.cautions),
        SUM(ps.ejections),
        SUM(ps.progressive_carries),
        SUM(ps.defensive_actions),

        NOW()
      FROM players p
      JOIN player_stats ps ON ps.player_id = p.p_id
      WHERE p.team_id = ? AND ps.year = ?
      GROUP BY p.team_id, ps.year
      `,
      [matches, matches, teamId, year]
    );

    return res.status(201).json({
      success: true,
      message: "Player + team stats updated successfully",
    });

  } catch (err) {
    console.error("addPlayerStats error:", err);
    return res.status(500).json({ message: "Failed to save stats" });
  }
};





export const getPlayerStatsList = async (req, res) => {
  try {
    const playerId = req.params.playerId;

    const [rows] = await pool.query(
      `SELECT
         ps_id, player_id, year, matches, goals, assists, shots, shots_on_goal,
         big_chances, key_passes, tackles, pass_completion_pct, minutes,
         cautions, ejections, progressive_carries, defensive_actions,
         created_at
       FROM player_stats
       WHERE player_id = ?
       ORDER BY created_at DESC`,
      [playerId]
    );

    return res.json({ stats: rows });
  } catch (err) {
    console.error("getPlayerStatsList error:", err);
    return res.status(500).json({ message: "Failed to load stats list" });
  }
};


export const getSinglePlayerStats = async (req, res) => {
  try {
    const statsId = req.params.statsId;

    const [rows] = await pool.query(
      `SELECT
         ps_id, player_id, year, matches, goals, assists, shots, shots_on_goal,
         big_chances, key_passes, tackles, pass_completion_pct, minutes,
         cautions, ejections, progressive_carries, defensive_actions,
         created_at
       FROM player_stats
       WHERE ps_id = ?`,
      [statsId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Stats record not found" });
    }

    return res.json({ stats: rows[0] });
  } catch (err) {
    console.error("getSinglePlayerStats error:", err);
    return res.status(500).json({ message: "Failed to load stats" });
  }
};



// export const getPlayerStatsAverage = async (req, res) => {
//   try {
//     const playerId = req.params.playerId;

//     // 1) Get team id
//     const [playerRow] = await pool.query(
//       `SELECT team_id FROM players WHERE p_id = ?`,
//       [playerId]
//     );

//     if (playerRow.length === 0) {
//       return res.status(404).json({ message: "Player not found" });
//     }

//     const teamId = playerRow[0].team_id;

//     // 2) Get latest player stat
//     const [rows] = await pool.query(
//       `
//       SELECT *
//       FROM player_stats
//       WHERE player_id = ?
//       ORDER BY created_at DESC
//       LIMIT 1
//       `,
//       [playerId]
//     );

//     if (rows.length === 0) {
//       return res.json({ success: true, player: null, team: null });
//     }

//     const p = rows[0];
//     const pm = p.matches || 0;

//     const playerStats = {
//       matches: pm,
//       goals: pm ? p.goals / pm : 0,
//       assists: pm ? p.assists / pm : 0,
//       shots: pm ? p.shots / pm : 0,
//       shots_on_goal: pm ? p.shots_on_goal / pm : 0,
//       big_chances: pm ? p.big_chances / pm : 0,
//       key_passes: pm ? p.key_passes / pm : 0,
//       tackles: pm ? p.tackles / pm : 0,
//       pass_completion_pct: pm ? p.pass_completion_pct / pm : 0,
//       minutes: pm ? p.minutes / pm : 0,
//       cautions: pm ? p.cautions / pm : 0,
//       ejections: pm ? p.ejections / pm : 0,
//       progressive_carries: pm ? p.progressive_carries / pm : 0,
//       defensive_actions: pm ? p.defensive_actions / pm : 0
//     };

//     // 3) Latest team stat
//     const [teamRows] = await pool.query(
//       `
//       SELECT *
//       FROM team_stats
//       WHERE team_id = ?
//       ORDER BY created_at DESC
//       LIMIT 1
//       `,
//       [teamId]
//     );

//     const t = teamRows[0] || {};
//     const tm = t.matches || 0;

//     const teamStats = {
//       matches: tm,
//       goals: tm ? t.goals / tm : 0,
//       assists: tm ? t.assists / tm : 0,
//       shots: tm ? t.shots / tm : 0,
//       shots_on_goal: tm ? t.shots_on_goal / tm : 0,
//       big_chances: tm ? t.big_chances / tm : 0,
//       key_passes: tm ? t.key_passes / tm : 0,
//       tackles: tm ? t.tackles / tm : 0,
//       pass_completion_pct: tm ? t.pass_completion_pct / tm : 0,
//       minutes: tm ? t.minutes / tm : 0,
//       cautions: tm ? t.cautions / tm : 0,
//       ejections: tm ? t.ejections / tm : 0,
//       progressive_carries: tm ? t.progressive_carries / tm : 0,
//       defensive_actions: tm ? t.defensive_actions / tm : 0
//     };

//     return res.json({
//       success: true,
//       player: playerStats,
//       team: teamStats
//     });

//   } catch (err) {
//     console.error("getPlayerStatsAverage error:", err);
//     return res.status(500).json({ message: "Failed to load averages" });
//   }
// };

export const getPlayerStatsAverage = async (req, res) => {
  try {
    const playerId = req.params.playerId;

    // 1) Get team id and player name
    const [playerRow] = await pool.query(
      `SELECT team_id, p_name FROM players WHERE p_id = ?`,
      [playerId]
    );

    if (playerRow.length === 0) {
      return res.status(404).json({ message: "Player not found" });
    }

    const teamId = playerRow[0].team_id;

    // 2) Get latest player stat
    const [rows] = await pool.query(
      `
      SELECT *
      FROM player_stats
      WHERE player_id = ?
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [playerId]
    );

    if (rows.length === 0) {
      return res.json({ success: true, player: null, team: null, rawPlayer: null, rawTeam: null });
    }

    const p = rows[0];
    const pm = p.matches || 0;

    // ⭐ Player per-match averages
    const playerStats = {
      matches: pm,
      goals: pm ? p.goals / pm : 0,
      assists: pm ? p.assists / pm : 0,
      shots: pm ? p.shots / pm : 0,
      shots_on_goal: pm ? p.shots_on_goal / pm : 0,
      big_chances: pm ? p.big_chances / pm : 0,
      key_passes: pm ? p.key_passes / pm : 0,
      tackles: pm ? p.tackles / pm : 0,
      pass_completion_pct: pm ? p.pass_completion_pct / pm : 0,
      minutes: pm ? p.minutes / pm : 0,
      cautions: pm ? p.cautions / pm : 0,
      ejections: pm ? p.ejections / pm : 0,
      progressive_carries: pm ? p.progressive_carries / pm : 0,
      defensive_actions: pm ? p.defensive_actions / pm : 0
    };

    // ⭐ Raw player values (actual stored values, no averaging)
    const rawPlayer = { ...p };

    // 3) Latest team stat
    const [teamRows] = await pool.query(
      `
      SELECT *
      FROM team_stats
      WHERE team_id = ?
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [teamId]
    );

    const t = teamRows[0] || {};
    const tm = t.matches || 0;

    // ⭐ Team per-match averages
    const teamStats = {
      matches: tm,
      goals: tm ? t.goals / tm : 0,
      assists: tm ? t.assists / tm : 0,
      shots: tm ? t.shots / tm : 0,
      shots_on_goal: tm ? t.shots_on_goal / tm : 0,
      big_chances: tm ? t.big_chances / tm : 0,
      key_passes: tm ? t.key_passes / tm : 0,
      tackles: tm ? t.tackles / tm : 0,
      pass_completion_pct: tm ? t.pass_completion_pct / tm : 0,
      minutes: tm ? t.minutes / tm : 0,
      cautions: tm ? t.cautions / tm : 0,
      ejections: tm ? t.ejections / tm : 0,
      progressive_carries: tm ? t.progressive_carries / tm : 0,
      defensive_actions: tm ? t.defensive_actions / tm : 0
    };

    // ⭐ Raw team values
    const rawTeam = { ...t };

    return res.json({
      success: true,
      player: playerStats,
      team: teamStats,
      rawPlayer,
      rawTeam,
      playerName: playerRow[0].p_name || "",
    });

  } catch (err) {
    console.error("getPlayerStatsAverage error:", err);
    return res.status(500).json({ message: "Failed to load averages" });
  }
};


// export const updatePlayerStats = async (req, res) => {
//   try {
//     const playerId = req.params.playerId;
//     const updatedStats = req.body;

//     console.log("Received update request for player:", playerId);
//     console.log("Update data:", updatedStats);

//     // Get the latest stats record for this player
//     const [existingStats] = await pool.query(
//       `SELECT * FROM player_stats WHERE player_id = ? ORDER BY created_at DESC LIMIT 1`,
//       [playerId]
//     );

//     if (existingStats.length === 0) {
//       return res.status(404).json({ message: "No stats found for this player" });
//     }

//     const currentStatPsId = existingStats[0].ps_id;
//     console.log("Updating record with ps_id:", currentStatPsId);

//     // Update the stats using ps_id - remove updated_at
//     const updateQuery = `
//       UPDATE player_stats 
//       SET 
//         matches = ?, goals = ?, assists = ?, shots = ?, shots_on_goal = ?,
//         big_chances = ?, key_passes = ?, tackles = ?, pass_completion_pct = ?,
//         minutes = ?, cautions = ?, ejections = ?, progressive_carries = ?,
//         defensive_actions = ?
//       WHERE ps_id = ?
//     `;

//     const values = [
//       updatedStats.matches || 0,
//       updatedStats.goals || 0,
//       updatedStats.assists || 0,
//       updatedStats.shots || 0,
//       updatedStats.shots_on_goal || 0,
//       updatedStats.big_chances || 0,
//       updatedStats.key_passes || 0,
//       updatedStats.tackles || 0,
//       updatedStats.pass_completion_pct || 0,
//       updatedStats.minutes || 0,
//       updatedStats.cautions || 0,
//       updatedStats.ejections || 0,
//       updatedStats.progressive_carries || 0,
//       updatedStats.defensive_actions || 0,
//       currentStatPsId  // Use ps_id here
//     ];

//     const [result] = await pool.query(updateQuery, values);
//     console.log("Update result:", result);

//     res.json({
//       success: true,
//       message: "Player statistics updated successfully",
//       updatedId: currentStatPsId
//     });

//   } catch (err) {
//     console.error("updatePlayerStats error:", err);
//     return res.status(500).json({ message: "Failed to update player statistics" });
//   }
// };

// Shared logic: updates the player's latest player_stats record with the
// given fields, then recomputes the matching team_stats row from all of
// that team's players for the same year. Used by both the coach-authenticated
// update endpoint and the public (token-based) player submission endpoint.
const applyStatsUpdate = async (playerId, data) => {
  // 1️⃣ Get player's team
  const [[player]] = await pool.query(
    `SELECT team_id FROM players WHERE p_id = ?`,
    [playerId]
  );

  if (!player || !player.team_id) {
    throw { status: 400, message: "Player team not found" };
  }

  const teamId = player.team_id;

  // 2️⃣ Latest stats record (if any)
  const [statsRows] = await pool.query(
    `SELECT * FROM player_stats
     WHERE player_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [playerId]
  );

  const stat = statsRows[0];
  const year = stat?.year ?? new Date().getFullYear();

  // 3️⃣ Derived values
  const matches = data.matches ?? stat?.matches ?? 0;
  const minutes = matches * 90;
  const field = (key) => data[key] ?? stat?.[key] ?? 0;

  let psId;

  if (!stat) {
    // First-ever stats record for this player
    const [result] = await pool.query(
      `
      INSERT INTO player_stats (
        player_id, year, matches, goals, assists, shots, shots_on_goal,
        big_chances, key_passes, tackles, pass_completion_pct, minutes,
        cautions, ejections, progressive_carries, defensive_actions, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        playerId, year, matches, field("goals"), field("assists"), field("shots"),
        field("shots_on_goal"), field("big_chances"), field("key_passes"), field("tackles"),
        field("pass_completion_pct"), minutes, field("cautions"), field("ejections"),
        field("progressive_carries"), field("defensive_actions")
      ]
    );
    psId = result.insertId;
  } else {
    psId = stat.ps_id;

    // 4️⃣ UPDATE player_stats (✅ SAME RECORD)
    await pool.query(
      `
      UPDATE player_stats SET
        matches = ?, goals = ?, assists = ?, shots = ?, shots_on_goal = ?,
        big_chances = ?, key_passes = ?, tackles = ?, pass_completion_pct = ?,
        minutes = ?, cautions = ?, ejections = ?, progressive_carries = ?,
        defensive_actions = ?
      WHERE ps_id = ?
      `,
      [
        matches, field("goals"), field("assists"), field("shots"), field("shots_on_goal"),
        field("big_chances"), field("key_passes"), field("tackles"), field("pass_completion_pct"),
        minutes, field("cautions"), field("ejections"), field("progressive_carries"),
        field("defensive_actions"), psId
      ]
    );
  }

  // 5️⃣ Recalculate team_stats for this team/year (insert if missing, else update)
  const [[existingTeamStats]] = await pool.query(
    `SELECT ts_id FROM team_stats WHERE team_id = ? AND year = ?`,
    [teamId, year]
  );

  if (!existingTeamStats) {
    await pool.query(
      `
      INSERT INTO team_stats (
        team_id, year, matches, goals, assists, shots, shots_on_goal,
        big_chances, key_passes, tackles, pass_completion_pct, minutes,
        cautions, ejections, progressive_carries, defensive_actions, created_at
      )
      SELECT
        p.team_id, ps.year,
        ? AS matches,
        SUM(ps.goals), SUM(ps.assists), SUM(ps.shots), SUM(ps.shots_on_goal),
        SUM(ps.big_chances), SUM(ps.key_passes), SUM(ps.tackles),
        AVG(ps.pass_completion_pct),
        (? * 90) AS minutes,
        SUM(ps.cautions), SUM(ps.ejections), SUM(ps.progressive_carries), SUM(ps.defensive_actions),
        NOW()
      FROM players p
      JOIN player_stats ps ON ps.player_id = p.p_id
      WHERE p.team_id = ? AND ps.year = ?
      GROUP BY p.team_id, ps.year
      `,
      [matches, matches, teamId, year]
    );
  } else {
    await pool.query(
      `
      UPDATE team_stats ts
      JOIN (
        SELECT
          p.team_id,
          ps.year,
          SUM(ps.goals) AS goals,
          SUM(ps.assists) AS assists,
          SUM(ps.shots) AS shots,
          SUM(ps.shots_on_goal) AS shots_on_goal,
          SUM(ps.big_chances) AS big_chances,
          SUM(ps.key_passes) AS key_passes,
          SUM(ps.tackles) AS tackles,
          AVG(ps.pass_completion_pct) AS pass_completion_pct,
          (? * 90) AS minutes,
          SUM(ps.cautions) AS cautions,
          SUM(ps.ejections) AS ejections,
          SUM(ps.progressive_carries) AS progressive_carries,
          SUM(ps.defensive_actions) AS defensive_actions
        FROM players p
        JOIN player_stats ps ON ps.player_id = p.p_id
        WHERE p.team_id = ? AND ps.year = ?
        GROUP BY p.team_id, ps.year
      ) x
      ON ts.team_id = x.team_id AND ts.year = x.year
      SET
        ts.matches = ?,
        ts.goals = x.goals,
        ts.assists = x.assists,
        ts.shots = x.shots,
        ts.shots_on_goal = x.shots_on_goal,
        ts.big_chances = x.big_chances,
        ts.key_passes = x.key_passes,
        ts.tackles = x.tackles,
        ts.pass_completion_pct = x.pass_completion_pct,
        ts.minutes = x.minutes,
        ts.cautions = x.cautions,
        ts.ejections = x.ejections,
        ts.progressive_carries = x.progressive_carries,
        ts.defensive_actions = x.defensive_actions
      `,
      [matches, teamId, year, matches]
    );
  }

  return { psId };
};

export const updatePlayerStats = async (req, res) => {
  try {
    const playerId = req.params.playerId;
    const { psId } = await applyStatsUpdate(playerId, req.body);

    return res.json({
      success: true,
      message: "Player & Team stats updated successfully",
      ps_id: psId,
    });

  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("updatePlayerStats error:", err);
    res.status(500).json({ message: "Failed to update stats" });
  }
};

// ===========================================================================
// "Send Link to Player" feature — lets a coach email a player a one-time
// link so the player can fill in their own stats without logging in.
// ===========================================================================

// Coach-authenticated: generates a one-time token and emails the player a
// link to the public stats form.
export const sendStatsLinkToPlayer = async (req, res) => {
  try {
    const coachId = req.user.id;
    const playerId = req.params.playerId;

    const [rows] = await pool.query(
      `SELECT p_email, p_name FROM players WHERE p_id = ? AND p_added_by = ?`,
      [playerId, coachId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Player not found" });
    }

    const player = rows[0];

    if (!player.p_email) {
      return res.status(400).json({ message: "This player has no email on file" });
    }

    const token = crypto.randomBytes(32).toString("hex");

    await pool.query(
      `INSERT INTO stats_tokens (player_id, token, is_used) VALUES (?, ?, 0)`,
      [playerId, token]
    );

    const statsLink = `${process.env.BASE_FRONTEND_URL}/player-stats/${playerId}?token=${token}`;

    await mailer.sendMail({
      from: `"Football Stats" <${process.env.SMTP_USER}>`,
      to: player.p_email,
      subject: "Update Your Player Stats",
      html: `
        <p>Hi <strong>${player.p_name}</strong>,</p>
        <p>Your coach has requested that you fill in your latest match stats. Please use the link below:</p>
        <p>
          <a href="${statsLink}"
             style="padding:10px 20px;background:#007bff;color:#fff;text-decoration:none;border-radius:5px;">
             Update My Stats
          </a>
        </p>
        <br />
        <p>If the button doesn't work, use this link:</p>
        <p>${statsLink}</p>
      `,
    });

    return res.json({
      success: true,
      message: "Stats link sent successfully",
      email: player.p_email,
      link: statsLink,
    });

  } catch (err) {
    console.error("sendStatsLinkToPlayer error:", err);
    return res.status(500).json({ message: "Failed to send stats link" });
  }
};

// Public: verifies a stats token and returns the player's current stats so
// the form can be pre-filled.
export const verifyStatsToken = async (req, res) => {
  try {
    const { player, token } = req.query;

    const [[tokenRow]] = await pool.query(
      "SELECT * FROM stats_tokens WHERE player_id = ? AND token = ?",
      [player, token]
    );

    if (!tokenRow) {
      return res.status(400).json({ message: "Invalid or expired link" });
    }

    if (tokenRow.is_used === 1) {
      return res.status(400).json({ message: "This link has already been used" });
    }

    const [[playerRow]] = await pool.query(
      `SELECT p_name FROM players WHERE p_id = ?`,
      [player]
    );

    const [statsRows] = await pool.query(
      `SELECT * FROM player_stats WHERE player_id = ? ORDER BY created_at DESC LIMIT 1`,
      [player]
    );

    return res.json({
      success: true,
      playerName: playerRow?.p_name || "",
      stats: statsRows[0] || null,
    });
  } catch (err) {
    console.error("verifyStatsToken error:", err);
    return res.status(500).json({ message: "Failed to verify link" });
  }
};

// Public: player submits their own stats using the one-time token.
export const publicSubmitPlayerStats = async (req, res) => {
  try {
    const { player_id, token, ...data } = req.body;

    if (!player_id || !token) {
      return res.status(400).json({ message: "Missing player_id or token" });
    }

    const [[tokenRow]] = await pool.query(
      "SELECT * FROM stats_tokens WHERE player_id = ? AND token = ?",
      [player_id, token]
    );

    if (!tokenRow) {
      return res.status(400).json({ message: "Invalid or expired link" });
    }

    if (tokenRow.is_used === 1) {
      return res.status(400).json({ message: "This link has already been used" });
    }

    await applyStatsUpdate(player_id, data);

    await pool.query(
      "UPDATE stats_tokens SET is_used = 1 WHERE player_id = ? AND token = ?",
      [player_id, token]
    );

    return res.json({
      success: true,
      message: "Stats submitted successfully. Link expired.",
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("publicSubmitPlayerStats error:", err);
    return res.status(500).json({ message: "Failed to submit stats" });
  }
};


// Predicts a player's expected goals using Shots on Goal conversion rate.
// Expected Goals = Player's Shots on Goal × (Team Goals / Team Shots on Goal)
export const getExpectedGoals = async (req, res) => {
  try {
    const playerId = req.params.playerId;

    // Get player's team
    const [[playerRow]] = await pool.query(
      `SELECT team_id FROM players WHERE p_id = ?`,
      [playerId]
    );
    if (!playerRow) {
      return res.status(404).json({ message: "Player not found" });
    }
    const teamId = playerRow.team_id;

    // Get player's latest stats
    const [[playerStats]] = await pool.query(
      `SELECT goals, shots_on_goal FROM player_stats WHERE player_id = ? ORDER BY created_at DESC LIMIT 1`,
      [playerId]
    );
    if (!playerStats) {
      return res.status(404).json({ message: "No stats found for this player" });
    }

    // Get team's latest stats
    const [[teamStats]] = await pool.query(
      `SELECT goals, shots_on_goal FROM team_stats WHERE team_id = ? ORDER BY created_at DESC LIMIT 1`,
      [teamId]
    );
    if (!teamStats || !teamStats.shots_on_goal) {
      return res.status(400).json({ message: "No team stats available to calculate conversion rate" });
    }

    const teamConversionRate = teamStats.goals / teamStats.shots_on_goal;
    const expectedGoals = (playerStats.shots_on_goal || 0) * teamConversionRate;

    return res.json({
      success: true,
      playerId,
      actualGoals: playerStats.goals || 0,
      expectedGoals,
      conversionRate: (teamConversionRate * 100).toFixed(1),
    });
  } catch (err) {
    console.error("getExpectedGoals error:", err);
    return res.status(500).json({ message: "Failed to calculate expected goals" });
  }
};

// Poisson probability distribution (P(X = 0..maxK)) for every tracked stat,
// comparing the player's per-match rate against their team's per-match rate.
export const getStatProbabilities = async (req, res) => {
  try {
    const playerId = req.params.playerId;
    const maxK = Math.min(Math.max(parseInt(req.query.maxK) || 5, 1), 20);

    const [playerRow] = await pool.query(`SELECT team_id FROM players WHERE p_id = ?`, [playerId]);
    if (playerRow.length === 0) {
      return res.status(404).json({ message: "Player not found" });
    }
    const teamId = playerRow[0].team_id;

    const [pRows] = await pool.query(
      `SELECT * FROM player_stats WHERE player_id = ? ORDER BY created_at DESC LIMIT 1`,
      [playerId]
    );

    if (pRows.length === 0) {
      return res.json({ success: true, matches: { player: 0, team: 0 }, stats: {} });
    }

    const p = pRows[0];
    const pm = p.matches || 0;

    const [tRows] = await pool.query(
      `SELECT * FROM team_stats WHERE team_id = ? ORDER BY created_at DESC LIMIT 1`,
      [teamId]
    );
    const t = tRows[0] || {};
    const tm = t.matches || 0;

    const stats = {};
    for (const key of PROBABILITY_STAT_KEYS) {
      const playerLambda = pm ? (p[key] || 0) / pm : 0;
      const teamLambda = tm ? (t[key] || 0) / tm : 0;

      stats[key] = {
        player: { lambda: playerLambda, distribution: poissonDistribution(playerLambda, maxK) },
        team: { lambda: teamLambda, distribution: poissonDistribution(teamLambda, maxK) },
      };
    }

    return res.json({
      success: true,
      matches: { player: pm, team: tm },
      stats,
    });
  } catch (err) {
    console.error("getStatProbabilities error:", err);
    return res.status(500).json({ message: "Failed to calculate stat probabilities" });
  }
};

export const updateTeamStats = async (req, res) => {
  try {
    const teamId = req.params.teamId;
    const updatedStats = req.body;

    console.log("Received update request for team:", teamId);
    console.log("Update data:", updatedStats);

    // Get the latest stats record for this team
    const [existingStats] = await pool.query(
      `SELECT * FROM team_stats WHERE team_id = ? ORDER BY created_at DESC LIMIT 1`,
      [teamId]
    );

    if (existingStats.length === 0) {
      return res.status(404).json({ message: "No stats found for this team" });
    }

    const currentStatId = existingStats[0].ts_id; // team_stats table ki primary key
    console.log("Updating team record with ts_id:", currentStatId);

    // Update the team stats
    const updateQuery = `
      UPDATE team_stats 
      SET 
        matches = ?, goals = ?, assists = ?, shots = ?, shots_on_goal = ?,
        big_chances = ?, key_passes = ?, tackles = ?, pass_completion_pct = ?,
        minutes = ?, cautions = ?, ejections = ?, progressive_carries = ?,
        defensive_actions = ?
      WHERE ts_id = ?
    `;

    const values = [
      updatedStats.matches || 0,
      updatedStats.goals || 0,
      updatedStats.assists || 0,
      updatedStats.shots || 0,
      updatedStats.shots_on_goal || 0,
      updatedStats.big_chances || 0,
      updatedStats.key_passes || 0,
      updatedStats.tackles || 0,
      updatedStats.pass_completion_pct || 0,
      updatedStats.minutes || 0,
      updatedStats.cautions || 0,
      updatedStats.ejections || 0,
      updatedStats.progressive_carries || 0,
      updatedStats.defensive_actions || 0,
      currentStatId  // Use ts_id here
    ];

    const [result] = await pool.query(updateQuery, values);
    console.log("Team update result:", result);

    res.json({
      success: true,
      message: "Team statistics updated successfully",
      updatedId: currentStatId
    });

  } catch (err) {
    console.error("updateTeamStats error:", err);
    return res.status(500).json({ message: "Failed to update team statistics" });
  }
};