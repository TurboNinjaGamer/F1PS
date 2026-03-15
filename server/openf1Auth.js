const axios = require("axios");

let cachedToken = null;
let tokenExpiresAt = 0;

async function fetchOpenF1Token() {
  const username = process.env.OPENF1_USERNAME;
  const password = process.env.OPENF1_PASSWORD;

  if (!username || !password) {
    throw new Error("Missing OPENF1_USERNAME or OPENF1_PASSWORD in .env");
  }

  const body = new URLSearchParams();
  body.append("username", username);
  body.append("password", password);

  const response = await axios.post(
    "https://api.openf1.org/token",
    body.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      timeout: 15000,
    }
  );

  const data = response.data || {};

  if (!data.access_token) {
    throw new Error("OpenF1 token response did not include access_token");
  }

  const expiresInSec = Number(data.expires_in || 3600);

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (expiresInSec - 60) * 1000;

  return cachedToken;
}

async function getOpenF1Token() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  return fetchOpenF1Token();
}

function clearOpenF1TokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

module.exports = {
  getOpenF1Token,
  clearOpenF1TokenCache,
};