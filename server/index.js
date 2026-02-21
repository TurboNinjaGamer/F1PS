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

app.get("/health", (req, res) => {
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

app.post("/auth/request-code", async (req, res) => {
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

app.post("/auth/verify-code", async (req, res) => {
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
app.get("/api/laps", async (req, res) => {
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

app.get("/me", requireAuth, async (req, res) => {
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

app.put("/me/favorite-team", requireAuth, async (req, res) => {
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








app.get("/results/standings", async (req, res) => {
  const season = Number(req.query.season || 2026);
  const limit = Math.min(Number(req.query.limit || 10), 24); // max 24

  const cacheKey = `${season}:${limit}`;

  try {
    // 0) Cache hit
    const cached = standingsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    // 0.5) In-flight dedup (ako je isti upit već u toku, sačekaj)
    if (standingsInFlight.has(cacheKey)) {
      const data = await standingsInFlight.get(cacheKey);
      return res.json(data);
    }

    // 1) Work promise (sve ide unutra)
    const workPromise = (async () => {
      // 1) Nađi sve Race sesije za sezonu
      const sessionsResp = await openf1Get("https://api.openf1.org/v1/sessions", {
        params: { year: season, session_name: "Race" },
      });

      let sessions = sessionsResp.data || [];
      if (!sessions.length) {
        return { ok: false, error: "No sessions found" };
      }

      // Sort po datumu
      sessions = sessions.sort((a, b) => {
        const da = new Date(a.date_start || 0).getTime();
        const db = new Date(b.date_start || 0).getTime();
        return da - db;
      });

      const lastRace = sessions[sessions.length - 1];
      const lastSessionKey = lastRace.session_key;

      // Poslednjih N trka
      const races = sessions.slice(-limit).map((s) => ({
        session_key: s.session_key,
        meeting_key: s.meeting_key,
        code: null,
      }));

      // 2) Championship (koristi poslednju trku)
      const driversResp = await openf1Get("https://api.openf1.org/v1/championship_drivers", {
        params: { session_key: lastSessionKey },
      });

      const teamsResp = await openf1Get("https://api.openf1.org/v1/championship_teams", {
        params: { session_key: lastSessionKey },
      });

      // 3) Meetings map (meeting_key -> name)
      let meetingMap = {};
      const meetingsResp = await openf1Get("https://api.openf1.org/v1/meetings", {
        params: { year: season },
      });

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

        // npr "Abu Dhabi" => AD, "Las Vegas" => LV
        if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
        if (words.length === 2) return (words[0][0] + words[1][0]).toUpperCase();

        // 3+ reči -> prva slova prve 3
        const code = words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
        return code || cleaned.slice(0, 3).toUpperCase();
      }

      for (const r of races) {
        const name = meetingMap[r.meeting_key] || "";
        r.code = makeCode(name);
      }

      // 4) Session results za svaku trku (sekvencijalno, rate-limit radi globalno)
      const raceResults = [];
      for (const r of races) {
        const rr = await openf1Get("https://api.openf1.org/v1/session_result", {
          params: { session_key: r.session_key },
        });
        raceResults.push({ session_key: r.session_key, rows: rr.data || [] });
      }

      // driver_number -> { session_key: position }
      const driverRacePositions = {};
      for (const race of raceResults) {
        for (const row of race.rows) {
          const dn = String(row.driver_number);
          if (!driverRacePositions[dn]) driverRacePositions[dn] = {};

          const pos =
            row.position ??
            row.position_order ??
            row.position_finish ??
            row.classified_position ??
            null;

          if (pos != null) {
            driverRacePositions[dn][race.session_key] = Number(pos);
          }
        }
      }

      return {
        ok: true,
        season,
        last_session_key: lastSessionKey,
        drivers: driversResp.data,
        teams: teamsResp.data,
        races, // [{session_key, meeting_key, code}]
        driverRacePositions,
      };
    })();

    // stavi in-flight pre await
    standingsInFlight.set(cacheKey, workPromise);

    // sačekaj rezultat
    const payload = await workPromise;

    // snimi u cache samo ako je ok
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

app.get("/teams/drivers", async (req, res) => {
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
