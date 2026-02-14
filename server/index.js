const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true, message: "Server is running" });
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