require("dotenv").config();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("./db");
const { sendLoginCode } = require("./mailer");

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { connectOpenF1Live, getOpenF1LiveStatus, getOpenF1LatestMessages } = require("./openf1Live");



const standingsCache = new Map();
const standingsInFlight = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min (povećaj, manje udaraš API)

// rate limit: max 3 req/sec => ~350ms razmak
let lastOpenF1CallAt = 0;
const MIN_GAP_MS = 350;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


let openf1AccessToken = null;
let openf1TokenExpiresAt = 0;


async function getOpenF1AccessToken() {
  const now = Date.now();

  if (openf1AccessToken && now < openf1TokenExpiresAt - 60_000) {
    return openf1AccessToken;
  }

  const params = new URLSearchParams();
  params.append("username", process.env.OPENF1_USERNAME);
  params.append("password", process.env.OPENF1_PASSWORD);

  const resp = await axios.post("https://api.openf1.org/token", params, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 10000,
  });

  openf1AccessToken = resp.data.access_token;
  openf1TokenExpiresAt = now + Number(resp.data.expires_in || 3600) * 1000;

  return openf1AccessToken;
}





async function openf1Get(url, config = {}) {
  const now = Date.now();
  const wait = Math.max(0, MIN_GAP_MS - (now - lastOpenF1CallAt));
  if (wait) await sleep(wait);
  lastOpenF1CallAt = Date.now();

  const token = await getOpenF1AccessToken();

  const mergedConfig = {
    timeout: 10000,
    ...config,
    headers: {
      accept: "application/json",
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  };

  try {
    return await axios.get(url, mergedConfig);
  } catch (err) {
    if (err.response?.status === 401) {
      openf1AccessToken = null;
      openf1TokenExpiresAt = 0;

      const freshToken = await getOpenF1AccessToken();

      return await axios.get(url, {
        ...mergedConfig,
        headers: {
          ...mergedConfig.headers,
          Authorization: `Bearer ${freshToken}`,
        },
      });
    }

    if (err.response?.status === 429) {
      await sleep(1200);
      return await axios.get(url, mergedConfig);
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
    await sendLoginCode(email, code);

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
  console.log(`Server running on port ${PORT}`);

  connectOpenF1Live().catch((err) => {
    console.error("[OpenF1 Live] Initial connect failed:", err.message);
  });
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
      // =========================================================
      // 1) TRY DATABASE
      // =========================================================
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

      // Dovoljno je da postoje standings; race rows su opcioni
      if (dbDrivers.length > 0 && dbTeams.length > 0) {
        const raceMap = new Map();
        for (const row of dbRaceRows) {
          if (!raceMap.has(row.session_key)) {
            raceMap.set(row.session_key, {
              session_key: row.session_key,
              code: row.race_code,
            });
          }
        }

        const races = Array.from(raceMap.values()).slice(-limit);
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

        return {
          ok: true,
          season,
          source: "database",
          drivers: dbDrivers,
          teams: dbTeams,
          races,
          driverRacePositions,
        };
      }

      // =========================================================
      // 2) DATABASE EMPTY -> OPENF1
      // =========================================================
      const sessionsResp = await openf1Get("https://api.openf1.org/v1/sessions", {
        params: { year: season, session_name: "Race" },
      });

      let sessions = sessionsResp.data || [];

      // Samo sesije koje su već počele/završene
      const now = Date.now();
      sessions = sessions.filter((s) => {
        const start = new Date(s.date_start || 0).getTime();
        return start > 0 && start <= now;
      });

      if (!sessions.length) {
        return {
          ok: true,
          season,
          source: "none",
          drivers: [],
          teams: [],
          races: [],
          driverRacePositions: {},
        };
      }

      sessions.sort((a, b) => {
        const da = new Date(a.date_start || 0).getTime();
        const dbTime = new Date(b.date_start || 0).getTime();
        return da - dbTime;
      });

      const lastRace = sessions[sessions.length - 1];
      const lastSessionKey = lastRace.session_key;

      // Poslednjih N trka za prikaz
      const races = sessions.slice(-limit).map((s) => ({
        session_key: s.session_key,
        meeting_key: s.meeting_key,
        code: null,
      }));

      // Sve odvožene trke koristimo za punjenje baze
      const allRaceSessions = sessions.map((s) => ({
        session_key: s.session_key,
        meeting_key: s.meeting_key,
      }));

      // Championship drivers + drivers metadata
      let driversResp;
      let driversMetaResp;

      try {
        driversResp = await openf1Get("https://api.openf1.org/v1/championship_drivers", {
          params: { session_key: lastSessionKey },
        });

        driversMetaResp = await openf1Get("https://api.openf1.org/v1/drivers", {
          params: { session_key: lastSessionKey },
        });
      } catch (err) {
        if (err.response?.status === 404) {
          return {
            ok: true,
            season,
            source: "none",
            drivers: [],
            teams: [],
            races: [],
            driverRacePositions: {},
          };
        }
        throw err;
      }

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

      const seasonRaceCodeMap = {};
      for (const s of allRaceSessions) {
        const name = meetingMap[s.meeting_key] || "";
        seasonRaceCodeMap[s.session_key] = makeCode(name);
      }

      // =========================================================
      // 3) ENRICH DRIVERS + DERIVE TEAMS
      // =========================================================
      const driverMetaMap = new Map();

      for (const d of driversMetaResp.data || []) {
        driverMetaMap.set(Number(d.driver_number), {
          driver_name:
            d.full_name ||
            d.broadcast_name ||
            d.name_acronym ||
            `#${d.driver_number}`,
          team_name: d.team_name || "Unknown",
        });
      }

      const enrichedDrivers = (driversResp.data || []).map((d) => {
        const meta = driverMetaMap.get(Number(d.driver_number)) || {};

        return {
          ...d,
          driver_name:
            d.driver_name ||
            d.full_name ||
            d.broadcast_name ||
            meta.driver_name ||
            `#${d.driver_number}`,
          team_name: d.team_name || meta.team_name || "Unknown",
          position_current: d.position_current ?? 0,
          points_current: d.points_current ?? d.points ?? 0,
        };
      });

      const teamTotalsMap = new Map();

      for (const d of enrichedDrivers) {
        const teamName = d.team_name || "Unknown";
        const points = Number(d.points_current ?? 0);

        if (!teamTotalsMap.has(teamName)) {
          teamTotalsMap.set(teamName, {
            team_name: teamName,
            points_current: 0,
          });
        }

        teamTotalsMap.get(teamName).points_current += points;
      }

      const derivedTeams = Array.from(teamTotalsMap.values())
        .sort((a, b) => b.points_current - a.points_current)
        .map((t, index) => ({
          ...t,
          position_current: index + 1,
        }));

      // =========================================================
      // 4) POVUCI REZULTATE ZA TRKE (opciono)
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
          const raceName = meetingMap[s.meeting_key] || "Unknown race";

          if (err.response?.status === 404) {
            console.warn(
              `No results found for ${raceName} (session_key=${s.session_key}), skipping.`
            );
            continue;
          }

          console.warn(
            `Race results fetch failed for ${raceName} (session_key=${s.session_key}) - continuing without race columns.`
          );
          continue;
        }
      }

      const validSessionKeys = new Set(allRaceResults.map((r) => r.session_key));
      const filteredRaces = races.filter((r) => validSessionKeys.has(r.session_key));

      const selectedSessionKeys = new Set(filteredRaces.map((r) => r.session_key));

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
      // 5) UPIS U BAZU
      // =========================================================
      await db.execute(`DELETE FROM season_driver_standings WHERE season = ?`, [season]);
      await db.execute(`DELETE FROM season_team_standings WHERE season = ?`, [season]);
      await db.execute(`DELETE FROM season_race_results WHERE season = ?`, [season]);

      for (const d of enrichedDrivers) {
        await db.execute(
          `
          INSERT INTO season_driver_standings
            (season, driver_number, driver_name, team_name, position_current, points_current)
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            season,
            d.driver_number ?? 0,
            d.driver_name || `#${d.driver_number ?? "?"}`,
            d.team_name || "Unknown",
            d.position_current ?? 0,
            d.points_current ?? 0,
          ]
        );
      }

      for (const t of derivedTeams) {
        await db.execute(
          `
          INSERT INTO season_team_standings
            (season, team_name, position_current, points_current)
          VALUES (?, ?, ?, ?)
          `,
          [
            season,
            t.team_name || "Unknown",
            t.position_current ?? 0,
            t.points_current ?? 0,
          ]
        );
      }

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
            [season, race.session_key, raceCode, row.driver_number, pos]
          );
        }
      }

      return {
        ok: true,
        season,
        source: "openf1",
        last_session_key: lastSessionKey,
        drivers: enrichedDrivers,
        teams: derivedTeams,
        races: filteredRaces,
        driverRacePositions,
      };
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





router.get("/realtime/up-next", async (req, res) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());

    const resp = await openf1Get("https://api.openf1.org/v1/meetings", {
      params: { year },
    });

    let meetings = resp.data || [];

    meetings = meetings
      .filter((m) => m.date_start)
      .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

    const now = Date.now();

    const nextMeeting =
      meetings.find((m) => new Date(m.date_start).getTime() > now) || null;

    return res.json({
      ok: true,
      year,
      nextMeeting,
    });
  } catch (err) {
    console.error("==== REALTIME UP NEXT ERROR ====");
    console.error("Message:", err.message);

    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    }

    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: err.message,
    });
  }
});





router.get("/realtime/live-status", async (req, res) => {
  try {
    await connectOpenF1Live();
    return res.json({
      ok: true,
      ...getOpenF1LiveStatus(),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Failed to connect to OpenF1 live stream",
      details: err.message,
    });
  }
});

router.get("/realtime/live-snapshot", async (req, res) => {
  try {
    await connectOpenF1Live();
    return res.json({
      ok: true,
      ...getOpenF1LiveStatus(),
      latest: getOpenF1LatestMessages(),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Failed to get live snapshot",
      details: err.message,
    });
  }
});




async function getTelemetryStatusSnapshot() {
  const resp = await axios.get("https://mqtt.telemetry.zone/api/status", {
    headers: {
      "x-api-key": process.env.TELEMETRY_API_KEY,
    },
    timeout: 4000,
  });

  return resp.data;
}

function normalizeMeeting(rawMeeting) {
  if (!rawMeeting) return null;

  return {
    meeting_key:
      rawMeeting.meeting_key ??
      rawMeeting.key ??
      null,

    meeting_name:
      rawMeeting.meeting_name ??
      rawMeeting.name ??
      rawMeeting.meeting_official_name ??
      rawMeeting.official_name ??
      null,

    meeting_official_name:
      rawMeeting.meeting_official_name ??
      rawMeeting.official_name ??
      rawMeeting.meeting_name ??
      rawMeeting.name ??
      null,

    country_name:
      rawMeeting.country_name ??
      rawMeeting.country ??
      null,

    country_code:
      rawMeeting.country_code ??
      rawMeeting.countryCode ??
      null,

    circuit_short_name:
      rawMeeting.circuit_short_name ??
      rawMeeting.circuit_name ??
      rawMeeting.circuit ??
      rawMeeting.track_name ??
      null,

    location:
      rawMeeting.location ??
      null,

    date_start:
      rawMeeting.date_start ??
      rawMeeting.start_time ??
      rawMeeting.start ??
      null,

    date_end:
      rawMeeting.date_end ??
      rawMeeting.end_time ??
      rawMeeting.end ??
      null,
  };
}

function normalizeSession(rawSession) {
  if (!rawSession) return null;

  return {
    session_key:
      rawSession.session_key ??
      rawSession.key ??
      null,

    meeting_key:
      rawSession.meeting_key ??
      rawSession.parent_meeting_key ??
      null,

    session_name:
      rawSession.session_name ??
      rawSession.name ??
      null,

    session_type:
      rawSession.session_type ??
      rawSession.type ??
      null,

    date_start:
      rawSession.date_start ??
      rawSession.start_time ??
      rawSession.start ??
      null,

    date_end:
      rawSession.date_end ??
      rawSession.end_time ??
      rawSession.end ??
      null,
  };
}

function buildTelemetryRealtimePayload(telemetry) {
  const meeting = normalizeMeeting(telemetry?.meeting);
  const liveSession = normalizeSession(telemetry?.session);
  const replay = telemetry?.replay || null;

  if (!telemetry?.ok) return null;

  if (replay?.playing) {
    return {
      ok: true,
      mode: "live-session",
      source: telemetry?.source || "telemetry",
      meeting,
      liveSession,
      telemetryReplay: replay,
    };
  }

  if (meeting && liveSession) {
    return {
      ok: true,
      mode: "live-session",
      source: telemetry?.source || "telemetry",
      meeting,
      liveSession,
      telemetryReplay: replay,
    };
  }

  if (meeting) {
    return {
      ok: true,
      mode: "next-session",
      source: telemetry?.source || "telemetry",
      meeting,
      nextSession: liveSession,
      telemetryReplay: replay,
    };
  }

  return null;
}








router.get("/realtime/status", async (req, res) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const now = Date.now();

    // 1) TELEMETRY FIRST
    try {
      const telemetry = await getTelemetryStatusSnapshot();
      const telemetryPayload = buildTelemetryRealtimePayload(telemetry);

      if (telemetryPayload) {
        return res.json(telemetryPayload);
      }
    } catch (telemetryErr) {
      console.warn("Telemetry status unavailable:", telemetryErr.message);
    }

    // 2) OPENF1 FALLBACK
    const [meetingsResp, sessionsResp] = await Promise.all([
      openf1Get("https://api.openf1.org/v1/meetings", {
        params: { year },
      }),
      openf1Get("https://api.openf1.org/v1/sessions", {
        params: { year },
      }),
    ]);

    const meetings = (meetingsResp.data || []).sort(
      (a, b) => new Date(a.date_start || 0) - new Date(b.date_start || 0)
    );

    const sessions = (sessionsResp.data || []).sort(
      (a, b) => new Date(a.date_start || 0) - new Date(b.date_start || 0)
    );

    const activeSession = sessions.find((s) => {
      const start = new Date(s.date_start || 0).getTime();
      const end = new Date(s.date_end || 0).getTime();
      return start <= now && now <= end;
    });

    if (activeSession) {
      const meeting =
        meetings.find((m) => m.meeting_key === activeSession.meeting_key) || null;

      return res.json({
        ok: true,
        mode: "live-session",
        source: "openf1",
        meeting: normalizeMeeting(meeting),
        liveSession: normalizeSession(activeSession),
      });
    }

    const activeMeeting = meetings.find((m) => {
      const start = new Date(m.date_start || 0).getTime();
      const end = new Date(m.date_end || 0).getTime();
      return start <= now && now <= end;
    });

    if (activeMeeting) {
      const nextSession =
        sessions.find((s) => {
          const start = new Date(s.date_start || 0).getTime();
          return s.meeting_key === activeMeeting.meeting_key && start > now;
        }) || null;

      return res.json({
        ok: true,
        mode: "next-session",
        source: "openf1",
        meeting: normalizeMeeting(activeMeeting),
        nextSession: normalizeSession(nextSession),
      });
    }

    const nextMeeting =
      meetings.find((m) => new Date(m.date_start || 0).getTime() > now) || null;

    return res.json({
      ok: true,
      mode: "up-next",
      source: "openf1",
      nextMeeting: normalizeMeeting(nextMeeting),
    });
  } catch (err) {
    console.error("==== REALTIME STATUS ERROR ====");
    console.error("Message:", err.message);

    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    }

    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: err.message,
    });
  }
});





router.get("/realtime/position-tower", async (req, res) => {
  try {
    const live = getOpenF1LatestMessages();
    const status = getOpenF1LiveStatus();

    const rows = live.position || [];
    const intervalRows = live.intervals || [];

    const latestByDriver = new Map();
    const latestIntervalsByDriver = new Map();

    // poslednji position zapis po vozaču
    for (const row of rows) {
      const driverNumber = Number(row.driver_number);
      if (!driverNumber) continue;

      const prev = latestByDriver.get(driverNumber);

      const currentRank = Number(row._id || 0);
      const prevRank = Number(prev?._id || 0);

      if (!prev || currentRank >= prevRank) {
        latestByDriver.set(driverNumber, row);
      }
    }

    // poslednji intervals zapis po vozaču
    for (const row of intervalRows) {
      const driverNumber = Number(row.driver_number);
      if (!driverNumber) continue;

      const prev = latestIntervalsByDriver.get(driverNumber);

      const currentRank = Number(row._id || 0);
      const prevRank = Number(prev?._id || 0);

      if (!prev || currentRank >= prevRank) {
        latestIntervalsByDriver.set(driverNumber, row);
      }
    }

    const tower = Array.from(latestByDriver.values())
      .map((row) => {
        const driverNumber = Number(row.driver_number);
        const interval = latestIntervalsByDriver.get(driverNumber);

        return {
          driver_number: row.driver_number,
          position: row.position ?? row.position_order ?? null,
          date: row.date || null,
          meeting_key: row.meeting_key || null,
          session_key: row.session_key || null,
          gap_to_leader: interval?.gap_to_leader ?? null,
          interval_to_ahead: interval?.interval ?? null,
        };
      })
      .filter((row) => row.position != null)
      .sort((a, b) => Number(a.position) - Number(b.position));

    return res.json({
      ok: true,
      connected: status.connected,
      count: tower.length,
      tower,
    });
  } catch (err) {
    console.error("==== POSITION TOWER ERROR ====");
    console.error("Message:", err.message);

    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: err.message,
    });
  }
});





router.get("/realtime/test-tower", async (req, res) => {
  try {
    const sessionKey = Number(req.query.session_key);

    if (!sessionKey) {
      return res.status(400).json({
        ok: false,
        error: "session_key required",
      });
    }

    const resp = await openf1Get(
      "https://api.openf1.org/v1/position",
      {
        params: { session_key: sessionKey },
      }
    );

    const rows = resp.data || [];

    const latestByDriver = new Map();

    for (const row of rows) {
      const dn = Number(row.driver_number);
      if (!dn) continue;

      const prev = latestByDriver.get(dn);

      const currentTime = new Date(row.date).getTime();
      const prevTime = prev ? new Date(prev.date).getTime() : 0;

      if (!prev || currentTime > prevTime) {
        latestByDriver.set(dn, row);
      }
    }

    const tower = Array.from(latestByDriver.values())
      .map((r) => ({
        driver_number: r.driver_number,
        position: r.position,
      }))
      .filter((r) => r.position != null)
      .sort((a, b) => a.position - b.position);

    res.json({
      ok: true,
      count: tower.length,
      tower,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});






router.get("/realtime/test-tower-replay", async (req, res) => {
  try {
    const sessionKey = Number(req.query.session_key);

    if (!sessionKey) {
      return res.status(400).json({
        ok: false,
        error: "session_key required",
      });
    }

    const resp = await openf1Get("https://api.openf1.org/v1/position", {
      params: { session_key: sessionKey },
    });

    return res.json({
      ok: true,
      session_key: sessionKey,
      rows: resp.data || [],
    });
  } catch (err) {
    console.error("[TEST TOWER REPLAY ERROR]", err.message);

    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});









router.get("/realtime/track-map", async (req, res) => {
  try {
    const live = getOpenF1LatestMessages();
    const status = getOpenF1LiveStatus();

    const rows = live.location || [];
    const latestByDriver = new Map();

    for (const row of rows) {
      const driverNumber = Number(row.driver_number);
      if (!driverNumber) continue;

      const prev = latestByDriver.get(driverNumber);

      const currentRank = Number(row._id || 0);
      const prevRank = Number(prev?._id || 0);

      if (!prev || currentRank >= prevRank) {
        latestByDriver.set(driverNumber, row);
      }
    }

    const points = Array.from(latestByDriver.values())
      .map((row) => ({
        driver_number: Number(row.driver_number),
        x: Number(row.x),
        y: Number(row.y),
        z: row.z != null ? Number(row.z) : null,
        date: row.date || null,
        meeting_key: row.meeting_key || null,
        session_key: row.session_key || null,
      }))
      .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y));

    const sampleRow = points[0] || null;

    let meeting = null;
    let liveSession = null;

    if (sampleRow?.meeting_key) {
      try {
        const meetingResp = await openf1Get("https://api.openf1.org/v1/meetings", {
          params: { meeting_key: sampleRow.meeting_key },
        });
        meeting = (meetingResp.data || [])[0] || null;
      } catch (err) {
        console.warn("TRACK MAP meeting lookup failed:", err.message);
      }
    }

    if (sampleRow?.session_key) {
      try {
        const sessionResp = await openf1Get("https://api.openf1.org/v1/sessions", {
          params: { session_key: sampleRow.session_key },
        });
        liveSession = (sessionResp.data || [])[0] || null;
      } catch (err) {
        console.warn("TRACK MAP session lookup failed:", err.message);
      }
    }

    return res.json({
      ok: true,
      connected: status.connected,
      count: points.length,
      points,
      meeting_key: sampleRow?.meeting_key || null,
      session_key: sampleRow?.session_key || null,
      meeting,
      liveSession,
    });
  } catch (err) {
    console.error("==== TRACK MAP ERROR ====");
    console.error("Message:", err.message);

    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: err.message,
    });
  }
});














router.get("/realtime/test-track-map", async (req, res) => {
  try {
    const sessionKey = Number(req.query.session_key);

    if (!sessionKey) {
      return res.status(400).json({
        ok: false,
        error: "session_key required",
      });
    }

    const resp = await openf1Get("https://api.openf1.org/v1/location?session_key=11234", {
      params: { session_key: sessionKey },
    });

    const rows = resp.data || [];
    const latestByDriver = new Map();

    for (const row of rows) {
      const dn = Number(row.driver_number);
      if (!dn) continue;

      const prev = latestByDriver.get(dn);

      const currentTime = new Date(row.date || 0).getTime();
      const prevTime = prev ? new Date(prev.date || 0).getTime() : 0;

      if (!prev || currentTime > prevTime) {
        latestByDriver.set(dn, row);
      }
    }

    const points = Array.from(latestByDriver.values())
      .map((row) => ({
        driver_number: Number(row.driver_number),
        x: Number(row.x),
        y: Number(row.y),
        z: row.z != null ? Number(row.z) : null,
        date: row.date || null,
        meeting_key: row.meeting_key || null,
        session_key: row.session_key || null,
      }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    return res.json({
      ok: true,
      count: points.length,
      points,
    });
  } catch (err) {
    console.error("[TEST TRACK MAP ERROR]", err.message);

    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});



router.get("/realtime/test-track-map-replay", async (req, res) => {
  try {
    const sessionKey = Number(req.query.session_key);

    if (!sessionKey) {
      return res.status(400).json({
        ok: false,
        error: "session_key required",
      });
    }

    const sessionResp = await openf1Get("https://api.openf1.org/v1/sessions", {
      params: { session_key: sessionKey },
    });

    const session = (sessionResp.data || [])[0];
    if (!session) {
      return res.status(404).json({
        ok: false,
        error: "Session not found",
      });
    }

    const start = new Date(session.date_start);
    const end = new Date(start.getTime() + 60 * 1000);

    const url =
      `https://api.openf1.org/v1/location` +
      `?session_key=${sessionKey}` +
      `&date>=${encodeURIComponent(start.toISOString())}` +
      `&date<=${encodeURIComponent(end.toISOString())}`;

    console.log("TRACK MAP URL:", url);

    const resp = await openf1Get(url);

    return res.json({
      ok: true,
      session_key: sessionKey,
      date_from: start.toISOString(),
      date_to: end.toISOString(),
      rows: resp.data || [],
    });
  } catch (err) {
    console.error("[TEST TRACK MAP REPLAY ERROR]", err.message);
    console.error("Status:", err.response?.status);
    console.error("Data:", err.response?.data);

    return res.status(500).json({
      ok: false,
      error: err.message,
      status: err.response?.status || null,
      details: err.response?.data || null,
    });
  }
});





router.get("/realtime/test-track-outline", async (req, res) => {
  try {
    const sessionKey = Number(req.query.session_key);
    const driverNumber = Number(req.query.driver_number || 1);

    if (!sessionKey) {
      return res.status(400).json({
        ok: false,
        error: "session_key required",
      });
    }

    const resp = await openf1Get("https://api.openf1.org/v1/location", {
      params: {
        session_key: sessionKey,
        driver_number: driverNumber,
      },
    });

    return res.json({
      ok: true,
      session_key: sessionKey,
      driver_number: driverNumber,
      rows: resp.data || [],
    });
  } catch (err) {
    console.error("[TEST TRACK OUTLINE ERROR]", err.message);
    console.error("Status:", err.response?.status);
    console.error("Data:", err.response?.data);

    return res.status(500).json({
      ok: false,
      error: err.message,
      status: err.response?.status || null,
      details: err.response?.data || null,
    });
  }
});









// router.get("/realtime/driver-details", async (req, res) => {
//   try {
//     const sessionKey = Number(req.query.session_key);
//     const driverNumber = Number(req.query.driver_number);

//     if (!sessionKey || !driverNumber) {
//       return res.status(400).json({
//         ok: false,
//         error: "session_key and driver_number are required",
//       });
//     }

//     const [driverResp, lapsResp] = await Promise.all([
//       openf1Get("https://api.openf1.org/v1/drivers", {
//         params: {
//           session_key: sessionKey,
//           driver_number: driverNumber,
//         },
//       }),
//       openf1Get("https://api.openf1.org/v1/laps", {
//         params: {
//           session_key: sessionKey,
//           driver_number: driverNumber,
//         },
//       }),
//     ]);

//     const driver = (driverResp.data || [])[0] || null;
//     const laps = lapsResp.data || [];

//     const latestLap =
//       laps
//         .filter((lap) => lap.lap_number != null)
//         .sort((a, b) => Number(b.lap_number) - Number(a.lap_number))[0] || null;

//     return res.json({
//       ok: true,
//       driver,
//       latestLap,
//     });
//   } catch (err) {
//     console.error("[DRIVER DETAILS ERROR]", err.message);
//     console.error("Status:", err.response?.status);
//     console.error("Data:", err.response?.data);

//     return res.status(500).json({
//       ok: false,
//       error: err.message,
//       status: err.response?.status || null,
//       details: err.response?.data || null,
//     });
//   }
// });




router.get("/realtime/driver-details", async (req, res) => {
  try {
    const sessionKey = Number(req.query.session_key);
    const driverNumber = Number(req.query.driver_number);

    if (!sessionKey || !driverNumber) {
      return res.status(400).json({
        ok: false,
        error: "session_key and driver_number are required",
      });
    }

    const lapsResp = await openf1Get("https://api.openf1.org/v1/laps", {
      params: {
        session_key: sessionKey,
        driver_number: driverNumber,
      },
    });

    const laps = lapsResp.data || [];

    const latestLap =
      laps
        .filter((lap) => lap.lap_number != null)
        .sort((a, b) => Number(b.lap_number) - Number(a.lap_number))[0] || null;

    return res.json({
      ok: true,
      latestLap,
    });
  } catch (err) {
    console.error("[DRIVER DETAILS ERROR]", err.message);
    console.error("Status:", err.response?.status);
    console.error("Data:", err.response?.data);

    return res.status(500).json({
      ok: false,
      error: err.message,
      status: err.response?.status || null,
      details: err.response?.data || null,
    });
  }
});







router.get("/realtime/drivers", async (req, res) => {
  try {
    const sessionKey = Number(req.query.session_key);

    const resp = await openf1Get("https://api.openf1.org/v1/drivers", {
      params: { session_key: sessionKey },
    });

    return res.json({
      ok: true,
      drivers: resp.data || [],
    });
  } catch (err) {
    return res.status(500).json({ ok: false });
  }
});





router.get("/realtime/test-telemetry-intervals", async (req, res) => {
  try {
    const resp = await axios.get("https://mqtt.telemetry.zone/v1/intervals", {
      headers: {
        "x-api-key": process.env.TELEMETRY_API_KEY,
      },
      params: {
        session_key: req.query.session_key,
      },
      timeout: 4000,
      maxRedirects: 0,
      validateStatus: () => true,
    });

    return res.json({
      ok: true,
      status: resp.status,
      contentType: resp.headers["content-type"] || null,
      data:
        typeof resp.data === "string"
          ? resp.data.slice(0, 500)
          : resp.data,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
      status: err.response?.status || null,
      data: err.response?.data || null,
    });
  }
});