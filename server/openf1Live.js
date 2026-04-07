const mqtt = require("mqtt");
const { getOpenF1Token, clearOpenF1TokenCache } = require("./openf1Auth");

let client = null;
let isConnecting = false;

const latestMessages = {
  position: [],
  location: [],
  laps: [],
  intervals: [],
  stints: [],
  race_control: []
};

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function pushLatest(bucket, msg, max = 200) {
  bucket.push(msg);
  if (bucket.length > max) {
    bucket.shift();
  }
}

function getBucketByTopic(topic) {
  if (topic === "v1/position") return latestMessages.position;
  if (topic === "v1/location") return latestMessages.location;
  if (topic === "v1/laps") return latestMessages.laps;
  if (topic === "v1/intervals") return latestMessages.intervals;
  if (topic === "v1/stints") return latestMessages.stints;
  if (topic === "v1/race_control") return latestMessages.race_control;
  return null;
}

async function connectOpenF1Live() {
  if (client?.connected || isConnecting) {
    return client;
  }

  isConnecting = true;

  try {
    // const token = await getOpenF1Token();
    const token = "cb76bdd38a24629ef00b6ef566362de0adfbd493b7194f514fb024d7f9cbcca5";
    // const brokerUrl = process.env.OPENF1_WS_URL || "wss://mqtt.openf1.org:8084/mqtt";
    const brokerUrl = "wss://mqtt.telemetry.zone/ws";

    client = mqtt.connect(brokerUrl, {
      username: process.env.OPENF1_WS_USERNAME || process.env.OPENF1_USERNAME || "f1ps",
      password: token,
      protocolVersion: 4,
      reconnectPeriod: 5000,
      connectTimeout: 15000,
      clean: true,
    });

    client.on("connect", () => {
      console.log("[OpenF1 Live] Connected");

      const topics = [
        "v1/position",
        "v1/location",
        "v1/laps",
        "v1/intervals",
        "v1/stints",
        "v1/race_control"
      ];

      for (const topic of topics) {
        client.subscribe(topic, { qos: 0 }, (err) => {
          if (err) {
            console.error(`[OpenF1 Live] Failed to subscribe to ${topic}:`, err.message);
          } else {
            console.log(`[OpenF1 Live] Subscribed to ${topic}`);
          }
        });
      }
    });

    client.on("message", (topic, payload) => {
      const text = payload.toString("utf8");
      const parsed = safeJsonParse(text);

      if (!parsed) {
        return;
      }

      const bucket = getBucketByTopic(topic);
      if (bucket) {
        pushLatest(bucket, parsed);
      }
    });

    client.on("reconnect", () => {
      console.log("[OpenF1 Live] Reconnecting...");
    });

    client.on("close", () => {
      console.log("[OpenF1 Live] Connection closed");
    });

    client.on("error", (err) => {
      console.error("[OpenF1 Live] Error:", err.message);

      if (
        err.message &&
        (err.message.toLowerCase().includes("not authorized") ||
          err.message.toLowerCase().includes("bad username or password"))
      ) {
        clearOpenF1TokenCache();
      }
    });

    return client;
  } finally {
    isConnecting = false;
  }
}

function getOpenF1LiveStatus() {
  return {
    connected: !!client?.connected,
    counts: {
      position: latestMessages.position.length,
      location: latestMessages.location.length,
      laps: latestMessages.laps.length,
      intervals: latestMessages.intervals.length,
      stints: latestMessages.stints.length,
    },
  };
}

function getOpenF1LatestMessages() {
  return latestMessages;
}

module.exports = {
  connectOpenF1Live,
  getOpenF1LiveStatus,
  getOpenF1LatestMessages,
};