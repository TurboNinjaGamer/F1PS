require("dotenv").config();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("./db");

const express = require("express");
const cors = require("cors");
const axios = require("axios");

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
  try {
    const season = Number(req.query.season || 2026);

    // 1️⃣ Nađi poslednju Race session za tu godinu
    const sessionsResp = await axios.get("https://api.openf1.org/v1/sessions", {
      params: {
        year: season,
        session_name: "Race"
      }
    });

    const sessions = sessionsResp.data;

    if (!sessions.length) {
      return res.json({ ok: false, error: "No sessions found" });
    }

    // uzmi poslednju race
    const lastRace = sessions[sessions.length - 1];
    const sessionKey = lastRace.session_key;

    // 2️⃣ Drivers championship
    const driversResp = await axios.get("https://api.openf1.org/v1/championship_drivers", {
      params: { session_key: sessionKey }
    });

    // 3️⃣ Teams championship
    const teamsResp = await axios.get("https://api.openf1.org/v1/championship_teams", {
      params: { session_key: sessionKey }
    });

    res.json({
      ok: true,
      season,
      drivers: driversResp.data,
      teams: teamsResp.data
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "Server error",
      details: err.message
    });
  }
});