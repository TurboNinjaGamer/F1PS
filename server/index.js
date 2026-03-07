require("dotenv").config();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("./db");

const express = require("express");
const cors = require("cors");
const axios = require("axios");



const standingsCache = new Map();
const standingsInFlight = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min (povećaj, manje udaraš API)

// rate limit: max 3 req/sec => ~350ms razmak
let lastOpenF1CallAt = 0;
const MIN_GAP_MS = 350;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openf1Get(url, config) {
  // obezbedi razmak između poziva
  const now = Date.now();
  const wait = Math.max(0, MIN_GAP_MS - (now - lastOpenF1CallAt));
  if (wait) await sleep(wait);
  lastOpenF1CallAt = Date.now();

  try {
    return await axios.get(url, config);
  } catch (err) {
    // retry na 429
    if (err.response?.status === 429) {
      await sleep(1200);
      return await axios.get(url, config);
    }
    throw err;
  }
}

const app = express();
app.use(cors());
app.use(express.json());

const router = express.Router();
app.use("/api", router);

router.get("/health", (req, res) => {
  res.json({ ok: true, message: "Server is running" });
});

function hashCode(email, code) {
  // vezujemo hash za email da ne može isti kod da se koristi za drugi email
  return crypto.createHash("sha256").update(`${email}:${code}`).digest("hex");
}

function makeCode() {
  // 6-cifreni kod
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

router.post("/auth/request-code", async (req, res) => {
  try {
    const emailRaw = req.body?.email || "";
    const email = String(emailRaw).trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }

    const code = makeCode();
    const codeHash = hashCode(email, code);

    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await db.execute(
      "INSERT INTO login_codes (email, code_hash, expires_at) VALUES (?, ?, ?)",
      [email, codeHash, expires]
    );

    // ZA SADA: samo ispiši kod u konzoli (demo)
    // Kasnije: pošalji mail preko SMTP (Nodemailer)
    console.log(`LOGIN CODE for ${email}: ${code}`);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Server error", details: e.message });
  }
});

router.post("/auth/verify-code", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const code = String(req.body?.code || "").trim();

    if (!email || !code || code.length !== 6) {
      return res.status(400).json({ error: "Invalid email or code" });
    }

    const codeHash = hashCode(email, code);

    const [rows] = await db.execute(
      `
      SELECT id, expires_at, used_at
      FROM login_codes
      WHERE email = ? AND code_hash = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [email, codeHash]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Wrong code" });
    }

    const record = rows[0];
    if (record.used_at) {
      return res.status(401).json({ error: "Code already used" });
    }

    const expiresAt = new Date(record.expires_at).getTime();
    if (Date.now() > expiresAt) {
      return res.status(401).json({ error: "Code expired" });
    }

    // označi kao iskorišćen
    await db.execute("UPDATE login_codes SET used_at = NOW() WHERE id = ?", [
      record.id,
    ]);

    // kreiraj user-a ako ne postoji
    const [existing] = await db.execute(
      "SELECT id, email, favorite_team_id FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    let user;
    if (existing.length === 0) {
      const [ins] = await db.execute(
        "INSERT INTO users (email) VALUES (?)",
        [email]
      );
      user = { id: ins.insertId, email, favorite_team_id: null };
    } else {
      user = existing[0];
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ ok: true, token, user });
  } catch (e) {
    res.status(500).json({ error: "Server error", details: e.message });
  }
});

// Proxy ka OpenF1 (primer: lapovi)
router.get("/api/laps", async (req, res) => {
  try {
    const { session_key, driver_number, lap_number } = req.query;

    const response = await axios.get("https://api.openf1.org/v1/laps", {
      params: {
        session_key,
        driver_number,
        lap_number,
      },
      timeout: 10000,
    });

    res.json(response.data);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch OpenF1 data",
      details: err.message,
    });
  }
});



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});





function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, email, favorite_team_id FROM users WHERE id = ? LIMIT 1",
      [req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ ok: true, user: rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Server error", details: e.message });
  }
});

router.put("/me/favorite-team", requireAuth, async (req, res) => {
  try {
    const favorite_team_id = req.body?.favorite_team_id ?? null;

    // dozvoli null ili broj
    if (favorite_team_id !== null && !Number.isInteger(favorite_team_id)) {
      return res.status(400).json({ error: "favorite_team_id must be int or null" });
    }

    await db.execute("UPDATE users SET favorite_team_id = ? WHERE id = ?", [
      favorite_team_id,
      req.user.userId,
    ]);

    const [rows] = await db.execute(
      "SELECT id, email, favorite_team_id FROM users WHERE id = ? LIMIT 1",
      [req.user.userId]
    );

    res.json({ ok: true, user: rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Server error", details: e.message });
  }
});








router.get("/results/standings", async (req, res) => {
  const season = Number(req.query.season || 2026);
  const limit = Math.min(Number(req.query.limit || 10), 24);

  const cacheKey = `${season}:${limit}`;

  try {
    // 0) Memory cache
    const cached = standingsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    // 0.5) In-flight dedup
    if (standingsInFlight.has(cacheKey)) {
      const data = await standingsInFlight.get(cacheKey);
      return res.json(data);
    }

    const workPromise = (async () => {
      
      // 1) TRY DATABASE
      
      const [dbDrivers] = await db.execute(
        `
        SELECT
          driver_number,
          driver_name,
          team_name,
          position_current,
          points_current
        FROM season_driver_standings
        WHERE season = ?
        ORDER BY position_current ASC
        `,
        [season]
      );

      const [dbTeams] = await db.execute(
        `
        SELECT
          team_name,
          position_current,
          points_current
        FROM season_team_standings
        WHERE season = ?
        ORDER BY position_current ASC
        `,
        [season]
      );

      const [dbRaceRows] = await db.execute(
        `
        SELECT
          session_key,
          race_code,
          driver_number,
          position_finish
        FROM season_race_results
        WHERE season = ?
        ORDER BY session_key ASC, driver_number ASC
        `,
        [season]
      );

      // Ako imamo sve tri grupe podataka, koristimo bazu
      if (dbDrivers.length > 0 && dbTeams.length > 0 && dbRaceRows.length > 0) {
        // izdvoji poslednjih N trka iz baze
        const raceMap = new Map();
        for (const row of dbRaceRows) {
          if (!raceMap.has(row.session_key)) {
            raceMap.set(row.session_key, {
              session_key: row.session_key,
              code: row.race_code,
            });
          }
        }

        let races = Array.from(raceMap.values());

        // uzmi poslednjih N trka
        races = races.slice(-limit);

        const selectedSessionKeys = new Set(races.map((r) => r.session_key));

        const driverRacePositions = {};
        for (const row of dbRaceRows) {
          if (!selectedSessionKeys.has(row.session_key)) continue;

          const dn = String(row.driver_number);
          if (!driverRacePositions[dn]) driverRacePositions[dn] = {};

          if (row.position_finish != null) {
            driverRacePositions[dn][row.session_key] = Number(row.position_finish);
          }
        }

        const payload = {
          ok: true,
          season,
          source: "database",
          drivers: dbDrivers,
          teams: dbTeams,
          races,
          driverRacePositions,
        };

        return payload;
      }

      
      // DATABASE EMPTY -> OPEN F1
      
      const sessionsResp = await openf1Get("https://api.openf1.org/v1/sessions", {
        params: { year: season, session_name: "Race" },
      });

      let sessions = sessionsResp.data || [];
      if (!sessions.length) {
        return { ok: false, error: "No sessions found" };
      }

      sessions = sessions.sort((a, b) => {
        const da = new Date(a.date_start || 0).getTime();
        const dbTime = new Date(b.date_start || 0).getTime();
        return da - dbTime;
      });

      const lastRace = sessions[sessions.length - 1];
      const lastSessionKey = lastRace.session_key;

      // poslednjih N trka za prikaz
      const races = sessions.slice(-limit).map((s) => ({
        session_key: s.session_key,
        meeting_key: s.meeting_key,
        code: null,
      }));

      // sve race sesije se koriste da napuniš bazu za sezonu
      const allRaceSessions = sessions.map((s) => ({
        session_key: s.session_key,
        meeting_key: s.meeting_key,
      }));

      const driversResp = await openf1Get("https://api.openf1.org/v1/championship_drivers", {
        params: { session_key: lastSessionKey },
      });

      const teamsResp = await openf1Get("https://api.openf1.org/v1/championship_teams", {
        params: { session_key: lastSessionKey },
      });

      const meetingsResp = await openf1Get("https://api.openf1.org/v1/meetings", {
        params: { year: season },
      });

      const meetingMap = {};
      for (const m of meetingsResp.data || []) {
        meetingMap[m.meeting_key] = m.meeting_name || m.meeting_official_name || "";
      }

      function makeCode(name) {
        if (!name) return "RACE";
        const cleaned = name
          .replace(/Grand Prix/gi, "")
          .replace(/FORMULA 1/gi, "")
          .trim();

        const words = cleaned.split(/\s+/).filter(Boolean);

        if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
        if (words.length === 2) return (words[0][0] + words[1][0]).toUpperCase();

        const code = words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
        return code || cleaned.slice(0, 3).toUpperCase();
      }

      for (const r of races) {
        const name = meetingMap[r.meeting_key] || "";
        r.code = makeCode(name);
      }

      // mapa svih trka u sezoni: session_key -> race_code
      const seasonRaceCodeMap = {};
      for (const s of allRaceSessions) {
        const name = meetingMap[s.meeting_key] || "";
        seasonRaceCodeMap[s.session_key] = makeCode(name);
      }

      // =========================================================
      // 3) POVUCI REZULTATE ZA SVE TRKE U SEZONI I UPISI U BAZU
      // =========================================================
      const allRaceResults = [];
      for (const s of allRaceSessions) {
  try {
    const rr = await openf1Get("https://api.openf1.org/v1/session_result", {
      params: { session_key: s.session_key },
    });

    allRaceResults.push({
      session_key: s.session_key,
      rows: rr.data || [],
    });
  } catch (err) {
    if (err.response?.status === 404) {
      const raceName = meetingMap[s.meeting_key] || "Unknown race";

console.warn(
  `No results found for ${raceName} (session_key=${s.session_key}), skipping.`
);
      continue;
    }
    throw err;
  }
}

      // za frontend: samo poslednjih N trka
      const selectedSessionKeys = new Set(races.map((r) => r.session_key));

      const driverRacePositions = {};
      for (const race of allRaceResults) {
        for (const row of race.rows) {
          const dn = String(row.driver_number);
          const pos =
            row.position ??
            row.position_order ??
            row.position_finish ??
            row.classified_position ??
            null;

          if (selectedSessionKeys.has(race.session_key)) {
            if (!driverRacePositions[dn]) driverRacePositions[dn] = {};
            if (pos != null) {
              driverRacePositions[dn][race.session_key] = Number(pos);
            }
          }
        }
      }

      // =========================================================
      // 4) UPIS U BAZU
      // =========================================================

      // obriši staro za tu sezonu, pa upiši novo
      await db.execute(`DELETE FROM season_driver_standings WHERE season = ?`, [season]);
      await db.execute(`DELETE FROM season_team_standings WHERE season = ?`, [season]);
      await db.execute(`DELETE FROM season_race_results WHERE season = ?`, [season]);

      // driver standings
      for (const d of driversResp.data || []) {
        await db.execute(
          `
          INSERT INTO season_driver_standings
            (season, driver_number, driver_name, team_name, position_current, points_current)
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            season,
            d.driver_number,
            d.driver_name || d.full_name || d.broadcast_name || `#${d.driver_number}`,
            d.team_name || "",
            d.position_current,
            d.points_current,
          ]
        );
      }

      // team standings
      for (const t of teamsResp.data || []) {
        await db.execute(
          `
          INSERT INTO season_team_standings
            (season, team_name, position_current, points_current)
          VALUES (?, ?, ?, ?)
          `,
          [
            season,
            t.team_name,
            t.position_current,
            t.points_current,
          ]
        );
      }

      // race results za celu sezonu
      for (const race of allRaceResults) {
        const raceCode = seasonRaceCodeMap[race.session_key] || "RACE";

        for (const row of race.rows) {
          const pos =
            row.position ??
            row.position_order ??
            row.position_finish ??
            row.classified_position ??
            null;

          await db.execute(
            `
            INSERT INTO season_race_results
              (season, session_key, race_code, driver_number, position_finish)
            VALUES (?, ?, ?, ?, ?)
            `,
            [
              season,
              race.session_key,
              raceCode,
              row.driver_number,
              pos,
            ]
          );
        }
      }

      const payload = {
        ok: true,
        season,
        source: "openf1",
        last_session_key: lastSessionKey,
        drivers: driversResp.data,
        teams: teamsResp.data,
        races,
        driverRacePositions,
      };

      return payload;
    })();

    standingsInFlight.set(cacheKey, workPromise);

    const payload = await workPromise;

    if (payload?.ok) {
      standingsCache.set(cacheKey, { ts: Date.now(), data: payload });
    }

    return res.json(payload);
  } catch (err) {
    console.error("==== STANDINGS ERROR ====");
    console.error("Message:", err.message);

    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    }

    console.error("Stack:", err.stack);

    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: err.message,
    });
  } finally {
    standingsInFlight.delete(cacheKey);
  }
});






const TEAMS_2026 = require("./teams2026");

router.get("/teams/drivers", async (req, res) => {
  try {
    // Teams stranica je fiksirana na 2026 u clientu,
    // ali ruta može da služi kao “preview data endpoint”.
    const season = 2026;

    const cacheKey = "teamsDrivers:2026";
    const cached = standingsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const payload = {
      ok: true,
      season,
      mode: "preview",
      teams: TEAMS_2026,
      drivers: [], // vozače za 2026 držiš u client/src/drivers2026.js
    };

    standingsCache.set(cacheKey, { ts: Date.now(), data: payload });
    return res.json(payload);
  } catch (err) {
    console.error("==== TEAMS/DRIVERS ERROR ====");
    console.error(err.message);
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: err.message,
    });
  }
});
