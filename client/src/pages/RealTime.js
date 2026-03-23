import { useEffect, useState } from "react";
import { authFetch } from "../api";

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

function InfoRow({ label, value }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value || "—"}</div>
    </div>
  );
}

const DRIVER_MAP = {
  1: "NOR",
  81: "PIA",
  63: "RUS",
  12: "ANT",
  44: "HAM",
  16: "LEC",
  3: "VER",
  6: "HAD",
  30: "LAW",
  41: "LIN",
  10: "GAS",
  43: "COL",
  31: "OCO",
  87: "BEA",
  77: "BOT",
  11: "PER",
  5: "BOR",
  27: "HUL",
  14: "ALO",
  18: "STR",
  55: "SAI",
  23: "ALB",
};

function getDriverCode(num) {
  return DRIVER_MAP[num] || `#${num}`;
}

function buildReplayFrames(rows) {
  if (!rows?.length) return [];

  const sorted = [...rows].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
  );

  const frameMap = new Map();

  for (const row of sorted) {
    const key = row.date;
    if (!key) continue;

    if (!frameMap.has(key)) {
      frameMap.set(key, []);
    }
    frameMap.get(key).push(row);
  }

  const timestamps = Array.from(frameMap.keys()).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  const latestByDriver = new Map();
  const frames = [];

  for (const ts of timestamps) {
    const updates = frameMap.get(ts) || [];

    for (const row of updates) {
      const driverNumber = Number(row.driver_number);
      const position = Number(row.position ?? row.position_order ?? 0);

      if (!driverNumber || !position) continue;

      latestByDriver.set(driverNumber, {
        driver_number: driverNumber,
        position,
      });
    }

    const tower = Array.from(latestByDriver.values()).sort(
      (a, b) => a.position - b.position
    );

    if (tower.length > 0) {
      frames.push({
        date: ts,
        tower,
      });
    }
  }

  return frames;
}

function buildTrackReplayFrames(rows) {
  if (!rows?.length) return [];

  const sorted = [...rows].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
  );

  const frameMap = new Map();

  for (const row of sorted) {
    const key = row.date;
    if (!key) continue;

    if (!frameMap.has(key)) {
      frameMap.set(key, []);
    }

    frameMap.get(key).push(row);
  }

  const timestamps = Array.from(frameMap.keys()).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  const latestByDriver = new Map();
  const frames = [];

  for (const ts of timestamps) {
    const updates = frameMap.get(ts) || [];

    for (const row of updates) {
      const driverNumber = Number(row.driver_number);
      const x = Number(row.x);
      const y = Number(row.y);
      const z = row.z != null ? Number(row.z) : null;

      if (!driverNumber) continue;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      latestByDriver.set(driverNumber, {
        driver_number: driverNumber,
        x,
        y,
        z,
      });
    }

    const points = Array.from(latestByDriver.values());

    if (points.length > 0) {
      frames.push({
        date: ts,
        points,
      });
    }
  }

  return frames;
}

function PositionTower({ tower, frameDate, selectedDriverNumber, onSelectDriver }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 12,
        padding: 12,
        background: "#ffffff",
        color: "#111111",
        minHeight: 500,
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>Position Tower</h3>

      {frameDate && (
        <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 12 }}>
          Replay frame: {new Date(frameDate).toLocaleString()}
        </div>
      )}

      {!tower?.length && <div style={{ opacity: 0.7 }}>No position data yet.</div>}

      {!!tower?.length && (
        <div style={{ display: "grid", gap: 8 }}>
          {tower.map((row) => (
            <div
  key={row.driver_number}
  onClick={() => onSelectDriver?.(row.driver_number)}
  style={{
    display: "grid",
    gridTemplateColumns: "44px 1fr 60px",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    background:
      Number(selectedDriverNumber) === Number(row.driver_number)
        ? "#e9eefc"
        : "#f5f5f5",
    border:
      Number(selectedDriverNumber) === Number(row.driver_number)
        ? "1px solid #4c6fff"
        : "1px solid rgba(0,0,0,0.06)",
    cursor: "pointer",
  }}
>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{row.position}</div>

              <div style={{ fontWeight: 800 }}>{getDriverCode(row.driver_number)}</div>

              <div style={{ textAlign: "right", opacity: 0.75 }}>#{row.driver_number}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function normalizeTrackPoints(points, width, height, pad) {
  const validPoints = (points || []).filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y)
  );

  if (!validPoints.length) return [];

  const minX = Math.min(...validPoints.map((p) => p.x));
  const maxX = Math.max(...validPoints.map((p) => p.x));
  const minY = Math.min(...validPoints.map((p) => p.y));
  const maxY = Math.max(...validPoints.map((p) => p.y));

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  return validPoints.map((p) => {
    const renderX = pad + ((p.x - minX) / spanX) * (width - pad * 2);
    const renderY = pad + ((p.y - minY) / spanY) * (height - pad * 2);

    return {
      ...p,
      renderX,
      renderY: height - renderY,
    };
  });
}







function buildTransform(rows, width, height, pad, outlineDriverNumber = 1) {
  const valid = (rows || [])
    .filter(
      (r) =>
        Number(r.driver_number) === outlineDriverNumber &&
        Number.isFinite(Number(r.x)) &&
        Number.isFinite(Number(r.y))
    )
    .sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    );

  if (!valid.length) return null;

  const minX = Math.min(...valid.map((p) => Number(p.x)));
  const maxX = Math.max(...valid.map((p) => Number(p.x)));
  const minY = Math.min(...valid.map((p) => Number(p.y)));
  const maxY = Math.max(...valid.map((p) => Number(p.y)));

  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    pad,
  };
}

function projectPoint(x, y, transform) {
  if (!transform) return null;

  const spanX = Math.max(1, transform.maxX - transform.minX);
  const spanY = Math.max(1, transform.maxY - transform.minY);

  const renderX =
    transform.pad +
    ((Number(x) - transform.minX) / spanX) * (transform.width - transform.pad * 2);

  const renderY =
    transform.pad +
    ((Number(y) - transform.minY) / spanY) * (transform.height - transform.pad * 2);

  return {
    x: renderX,
    y: transform.height - renderY,
  };
}

function smoothPoints(points, windowSize = 2) {
  if (!points.length) return points;

  return points.map((_, index) => {
    const from = Math.max(0, index - windowSize);
    const to = Math.min(points.length - 1, index + windowSize);

    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let i = from; i <= to; i++) {
      sumX += points[i].x;
      sumY += points[i].y;
      count += 1;
    }

    return {
      x: sumX / count,
      y: sumY / count,
    };
  });
}

function buildTrackOutline(rows, transform, outlineDriverNumber = 1) {
  const filtered = (rows || [])
    .filter(
      (r) =>
        Number(r.driver_number) === outlineDriverNumber &&
        Number.isFinite(Number(r.x)) &&
        Number.isFinite(Number(r.y))
    )
    .sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    );

  const sampled = filtered.filter((_, index) => index % 4 === 0);

  const projected = sampled
    .map((p) => projectPoint(p.x, p.y, transform))
    .filter(Boolean);

  return smoothPoints(projected, 2);
}

function normalizeTrackPointsWithTransform(points, transform) {
  return (points || [])
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => {
      const projected = projectPoint(p.x, p.y, transform);
      if (!projected) return null;

      return {
        ...p,
        renderX: projected.x,
        renderY: projected.y,
      };
    })
    .filter(Boolean);
}





function TrackMapTest({ points, frameDate, outlineRows, selectedDriverNumber, onSelectDriver }) {
  const width = 700;
  const height = 500;
  const pad = 24;
  const outlineDriverNumber = 1;

  const transform = buildTransform(
    outlineRows,
    width,
    height,
    pad,
    outlineDriverNumber
  );

  const normalizedCars = normalizeTrackPointsWithTransform(points, transform);
  const outline = buildTrackOutline(
    outlineRows,
    transform,
    outlineDriverNumber
  );

  const outlinePath = outline.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 12,
        padding: 12,
        background: "#ffffff",
        color: "#111111",
        minHeight: 500,
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>Track Map Test</h3>

      {frameDate && (
        <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 12 }}>
          Replay frame: {new Date(frameDate).toLocaleString()}
        </div>
      )}

      {!normalizedCars.length && !outline.length && (
        <div style={{ opacity: 0.7 }}>No track location data yet.</div>
      )}

      {(!!normalizedCars.length || !!outline.length) && (
        <div
          style={{
            width: "100%",
            maxWidth: width,
            height,
            margin: "0 auto",
            borderRadius: 12,
            overflow: "hidden",
            background: "#f7f7f7",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: "100%", height: "100%", display: "block" }}
          >
            {!!outline.length && (
              <polyline
                points={outlinePath}
                fill="none"
                stroke="rgba(0,0,0,0.22)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {normalizedCars.map((p) => (
              <g
  key={p.driver_number}
  transform={`translate(${p.renderX}, ${p.renderY})`}
  onClick={() => onSelectDriver?.(p.driver_number)}
  style={{ cursor: "pointer" }}
>
  <circle
    r={Number(selectedDriverNumber) === Number(p.driver_number) ? "13" : "10"}
    fill={
      Number(selectedDriverNumber) === Number(p.driver_number)
        ? "#4c6fff"
        : "#151922"
    }
  />
  <text
    x="0"
    y="4"
    textAnchor="middle"
    fontSize="10"
    fontWeight="700"
    fill="#ffffff"
  >
    {getDriverCode(p.driver_number)}
  </text>
</g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}

function TrackMap({ points, circuitImage, selectedDriverNumber, onSelectDriver }) {
  const width = 700;
  const height = 500;
  const pad = 30;

  const normalized = normalizeTrackPoints(points, width, height, pad);

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 12,
        padding: 12,
        background: "#ffffff",
        color: "#111111",
        minHeight: 500,
      }}
    >
      <h3 style={{ marginTop: 0 }}>Track Map</h3>

      {!normalized.length && (
        <div style={{ opacity: 0.7 }}>No track position data yet.</div>
      )}

      {!!normalized.length && (
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: width,
            height,
            margin: "0 auto",
            borderRadius: 12,
            overflow: "hidden",
            background: "#f7f7f7",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {circuitImage && (
            <img
              src={circuitImage}
              alt="Circuit"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                opacity: 0.18,
                pointerEvents: "none",
              }}
            />
          )}

          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
          >
            {normalized.map((p) => (
              <g
  key={p.driver_number}
  transform={`translate(${p.renderX}, ${p.renderY})`}
  onClick={() => onSelectDriver?.(p.driver_number)}
  style={{ cursor: "pointer" }}
>
  <circle
    r={Number(selectedDriverNumber) === Number(p.driver_number) ? "13" : "10"}
    fill={
      Number(selectedDriverNumber) === Number(p.driver_number)
        ? "#4c6fff"
        : "#151922"
    }
  />
  <text
    x="0"
    y="4"
    textAnchor="middle"
    fontSize="10"
    fontWeight="700"
    fill="#ffffff"
  >
    {getDriverCode(p.driver_number)}
  </text>
</g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}



function formatLapTime(seconds) {
  if (seconds == null) return "—";

  const totalMs = Math.round(Number(seconds) * 1000);
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${mins}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function DriverDetails({
  selectedDriverNumber,
  tower,
  driverDetails,
}) {
  const towerRow =
    (tower || []).find(
      (row) => Number(row.driver_number) === Number(selectedDriverNumber)
    ) || null;

  if (!selectedDriverNumber) {
    return (
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12,
          padding: 12,
          background: "#ffffff",
          color: "#111111",
          minHeight: 500,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Driver Details</h3>
        <div style={{ opacity: 0.7 }}>
          Select a driver from the position tower or track map.
        </div>
      </div>
    );
  }

  const driver = driverDetails?.driver || null;
  const latestLap = driverDetails?.latestLap || null;
  const teamColor = driver?.team_colour ? `#${driver.team_colour}` : "#151922";

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 12,
        padding: 12,
        background: "#ffffff",
        color: "#111111",
        minHeight: 500,
      }}
    >
      <h3 style={{ marginTop: 0 }}>Driver Details</h3>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
          paddingBottom: 14,
          borderBottom: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        {driver?.headshot_url ? (
          <img
            src={driver.headshot_url}
            alt={driver.full_name || getDriverCode(selectedDriverNumber)}
            style={{
              width: 72,
              height: 72,
              objectFit: "cover",
              borderRadius: "50%",
              border: `3px solid ${teamColor}`,
              background: "#f3f3f3",
            }}
          />
        ) : (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "#f3f3f3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 20,
              border: `3px solid ${teamColor}`,
            }}
          >
            {getDriverCode(selectedDriverNumber)}
          </div>
        )}

        <div>
          <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.1 }}>
            {driver?.full_name || getDriverCode(selectedDriverNumber)}
          </div>
          <div style={{ marginTop: 6, opacity: 0.75, fontWeight: 700 }}>
            {driver?.team_name || "—"}
          </div>
        </div>
      </div>

      <InfoRow label="Acronym" value={driver?.name_acronym || getDriverCode(selectedDriverNumber)} />
      <InfoRow label="Driver Number" value={`#${selectedDriverNumber}`} />
      <InfoRow label="Current Position" value={towerRow?.position ?? "—"} />
      <InfoRow label="Latest Lap" value={latestLap?.lap_number ?? "—"} />
      <InfoRow label="Lap Time" value={formatLapTime(latestLap?.lap_duration)} />
      <InfoRow label="Sector 1" value={formatLapTime(latestLap?.duration_sector_1)} />
      <InfoRow label="Sector 2" value={formatLapTime(latestLap?.duration_sector_2)} />
      <InfoRow label="Sector 3" value={formatLapTime(latestLap?.duration_sector_3)} />
      <InfoRow label="I1 Speed" value={latestLap?.i1_speed != null ? `${latestLap.i1_speed} km/h` : "—"} />
      <InfoRow label="I2 Speed" value={latestLap?.i2_speed != null ? `${latestLap.i2_speed} km/h` : "—"} />
      <InfoRow label="ST Speed" value={latestLap?.st_speed != null ? `${latestLap.st_speed} km/h` : "—"} />
    </div>
  );
}






export default function RealTime() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const [towerData, setTowerData] = useState([]);
  const [trackPoints, setTrackPoints] = useState([]);

  const [replayFrames, setReplayFrames] = useState([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayFrameDate, setReplayFrameDate] = useState(null);
  const [isReplayRunning, setIsReplayRunning] = useState(false);

  const [trackReplayFrames, setTrackReplayFrames] = useState([]);
  const [trackReplayIndex, setTrackReplayIndex] = useState(0);
  const [trackReplayFrameDate, setTrackReplayFrameDate] = useState(null);
  const [isTrackReplayRunning, setIsTrackReplayRunning] = useState(false);
  const [trackOutlineRows, setTrackOutlineRows] = useState([]);

  const [showReplayTests, setShowReplayTests] = useState(true);

  const [selectedDriverNumber, setSelectedDriverNumber] = useState(null);

  const [driverDetails, setDriverDetails] = useState(null);

  const currentSessionKey = showReplayTests
  ? 11234
  : data?.liveSession?.session_key || null;

  useEffect(() => {
    setErr("");
    setData(null);

    authFetch("/api/realtime/status")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) {
          setErr(j.error || "Error loading realtime status");
          return;
        }
        setData(j);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  // ===================== TOWER REPLAY TEST =====================
  useEffect(() => {
    if (!showReplayTests) return;

    authFetch("/api/realtime/test-tower-replay?session_key=11234")
      .then((r) => r.json())
      .then((j) => {
        console.log("TEST TOWER REPLAY RESPONSE:", j);

        if (j.ok) {
          const frames = buildReplayFrames(j.rows || []);
          setReplayFrames(frames);
          setReplayIndex(0);

          if (frames.length > 0) {
            setTowerData(frames[0].tower);
            setReplayFrameDate(frames[0].date);
          }
        }
      })
      .catch((e) => {
        console.error("TEST TOWER REPLAY FETCH ERROR:", e);
      });
  }, [showReplayTests]);

  useEffect(() => {
    if (!showReplayTests || !replayFrames.length || !isReplayRunning) return;

    const id = setInterval(() => {
      setReplayIndex((prev) => (prev + 1 >= replayFrames.length ? 0 : prev + 1));
    }, 700);

    return () => clearInterval(id);
  }, [showReplayTests, replayFrames, isReplayRunning]);

  useEffect(() => {
    if (!showReplayTests || !replayFrames.length) return;

    const frame = replayFrames[replayIndex];
    if (!frame) return;

    setTowerData(frame.tower);
    setReplayFrameDate(frame.date);
  }, [showReplayTests, replayIndex, replayFrames]);

  // ===================== TRACK MAP REPLAY TEST =====================
  useEffect(() => {
    if (!showReplayTests) return;

    authFetch("/api/realtime/test-track-map-replay?session_key=11234")
      .then((r) => r.json())
      .then((j) => {
        console.log("TEST TRACK MAP REPLAY RESPONSE:", j);

        if (j.ok) {
          const frames = buildTrackReplayFrames(j.rows || []);
          console.log("TRACK REPLAY FRAMES:", frames.length);
          console.log("FIRST FRAME:", frames[0]);

          setTrackReplayFrames(frames);
          setTrackReplayIndex(0);

          if (frames.length > 0) {
            setTrackPoints(frames[0].points);
            setTrackReplayFrameDate(frames[0].date);
          }
        }
      })
      .catch((e) => {
        console.error("TEST TRACK MAP REPLAY FETCH ERROR:", e);
      });
  }, [showReplayTests]);

  useEffect(() => {
    if (!showReplayTests || !trackReplayFrames.length || !isTrackReplayRunning) return;

    const id = setInterval(() => {
      setTrackReplayIndex((prev) =>
        prev + 1 >= trackReplayFrames.length ? 0 : prev + 1
      );
    }, 700);

    return () => clearInterval(id);
  }, [showReplayTests, trackReplayFrames, isTrackReplayRunning]);

  useEffect(() => {
    if (!showReplayTests || !trackReplayFrames.length) return;

    const frame = trackReplayFrames[trackReplayIndex];
    if (!frame) return;

    console.log("CURRENT FRAME:", frame);
    console.log("TRACK POINTS:", frame.points);

    setTrackPoints(frame.points);
    setTrackReplayFrameDate(frame.date);
  }, [showReplayTests, trackReplayIndex, trackReplayFrames]);


  useEffect(() => {
  if (!showReplayTests) return;

  authFetch("/api/realtime/test-track-outline?session_key=11234&driver_number=1")
    .then((r) => r.json())
    .then((j) => {
      console.log("TEST TRACK OUTLINE RESPONSE:", j);

      if (j.ok) {
        setTrackOutlineRows(j.rows || []);
      }
    })
    .catch((e) => {
      console.error("TEST TRACK OUTLINE FETCH ERROR:", e);
    });
}, [showReplayTests]);

  // ===================== LIVE TRACK MAP =====================
  useEffect(() => {
    if (showReplayTests) return;

    if (data?.mode !== "live-session") {
      setTrackPoints([]);
      return;
    }

    let cancelled = false;

    const loadTrackMap = () => {
      authFetch("/api/realtime/track-map")
        .then((r) => r.json())
        .then((j) => {
          if (!cancelled && j.ok) {
            setTrackPoints(j.points || []);
          }
        })
        .catch(() => {});
    };

    loadTrackMap();
    const id = setInterval(loadTrackMap, 2000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [data?.mode, showReplayTests]);

  // ===================== LIVE TOWER =====================
  useEffect(() => {
    if (showReplayTests) return;

    if (data?.mode !== "live-session") {
      setTowerData([]);
      return;
    }

    let cancelled = false;

    const loadTower = () => {
      authFetch("/api/realtime/position-tower")
        .then((r) => r.json())
        .then((j) => {
          if (!cancelled && j.ok) {
            setTowerData(j.tower || []);
          }
        })
        .catch(() => {});
    };

    loadTower();
    const id = setInterval(loadTower, 2000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [data?.mode, showReplayTests]);



  useEffect(() => {
  if (!selectedDriverNumber || !currentSessionKey) {
    setDriverDetails(null);
    return;
  }

  authFetch(
    `/api/realtime/driver-details?session_key=${currentSessionKey}&driver_number=${selectedDriverNumber}`
  )
    .then((r) => r.json())
    .then((j) => {
      if (j.ok) {
        setDriverDetails(j);
      } else {
        setDriverDetails(null);
      }
    })
    .catch(() => {
      setDriverDetails(null);
    });
}, [selectedDriverNumber, currentSessionKey]);





  return (
    <div style={{ padding: "16px 18px" }}>
      <h2>Real Time</h2>

      <div style={{ marginTop: 12, marginBottom: 20 }}>
        <button
          onClick={() => setShowReplayTests((v) => !v)}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)",
            cursor: "pointer",
          }}
        >
          {showReplayTests ? "Switch to Live Mode" : "Switch to Replay Test Mode"}
        </button>
      </div>

      {showReplayTests && (
        <>
          <div style={{ marginTop: 20, marginBottom: 20 }}>
            <h3>Replay Test - Position Tower</h3>

            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <button
                onClick={() => setIsReplayRunning((v) => !v)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  cursor: "pointer",
                }}
              >
                {isReplayRunning ? "Pause" : "Play"}
              </button>

              <button
                onClick={() => {
                  setReplayIndex(0);
                  if (replayFrames[0]) {
                    setTowerData(replayFrames[0].tower);
                    setReplayFrameDate(replayFrames[0].date);
                  }
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  cursor: "pointer",
                }}
              >
                Reset
              </button>

              <div style={{ fontSize: 13, opacity: 0.75 }}>
                Frames: {replayFrames.length} | Current: {replayIndex + 1}
              </div>
            </div>

            <PositionTower
              tower={towerData}
              frameDate={replayFrameDate}
              selectedDriverNumber={selectedDriverNumber}
              onSelectDriver={setSelectedDriverNumber}  
            />
          </div>

          <div style={{ marginTop: 20, marginBottom: 20 }}>
            <h3>Replay Test - Track Map</h3>

            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <button
                onClick={() => setIsTrackReplayRunning((v) => !v)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  cursor: "pointer",
                }}
              >
                {isTrackReplayRunning ? "Pause" : "Play"}
              </button>

              <button
                onClick={() => {
                  setTrackReplayIndex(0);
                  if (trackReplayFrames[0]) {
                    setTrackPoints(trackReplayFrames[0].points);
                    setTrackReplayFrameDate(trackReplayFrames[0].date);
                  }
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  cursor: "pointer",
                }}
              >
                Reset
              </button>

              <div style={{ fontSize: 13, opacity: 0.75 }}>
                Frames: {trackReplayFrames.length} | Current: {trackReplayIndex + 1}
              </div>
            </div>

            <TrackMapTest
  points={trackPoints}
  frameDate={trackReplayFrameDate}
  outlineRows={trackOutlineRows}
  selectedDriverNumber={selectedDriverNumber}
  onSelectDriver={setSelectedDriverNumber}
/>

<div style={{ marginTop: 16 }}>
  <DriverDetails
  selectedDriverNumber={selectedDriverNumber}
  tower={towerData}
  driverDetails={driverDetails}
/>
</div>
          </div>
        </>
      )}

      {err && <div>{err}</div>}
      {!data && !err && <div>Loading...</div>}

      {data?.mode === "up-next" && data?.nextMeeting && (
        <div style={{ marginTop: 20 }}>
          <h3>Up Next</h3>

          <div
            style={{
              marginTop: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 16,
              overflow: "hidden",
              background: "#ffffff",
              color: "#111111",
              maxWidth: 1100,
              boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
            }}
          >
            <div
              style={{
                background: "#151922",
                color: "#ffffff",
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>
                  {data.nextMeeting.meeting_name || "Next Meeting"}
                </div>
                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  {data.nextMeeting.meeting_official_name || "—"}
                </div>
              </div>

              {data.nextMeeting.country_flag && (
                <img
                  src={data.nextMeeting.country_flag}
                  alt={data.nextMeeting.country_name || "Flag"}
                  style={{
                    width: 72,
                    height: 48,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "#fff",
                  }}
                />
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.1fr 0.9fr",
                gap: 24,
                padding: 20,
                alignItems: "start",
              }}
            >
              <div>
                <InfoRow
                  label="Circuit"
                  value={data.nextMeeting.circuit_short_name}
                />
                <InfoRow
                  label="Location"
                  value={
                    data.nextMeeting.location && data.nextMeeting.country_name
                      ? `${data.nextMeeting.location}, ${data.nextMeeting.country_name}`
                      : data.nextMeeting.location || data.nextMeeting.country_name
                  }
                />
                <InfoRow
                  label="Circuit Type"
                  value={data.nextMeeting.circuit_type}
                />
                <InfoRow
                  label="Weekend Start"
                  value={formatDateTime(data.nextMeeting.date_start)}
                />
                <InfoRow
                  label="Weekend End"
                  value={formatDateTime(data.nextMeeting.date_end)}
                />
                <InfoRow
                  label="GMT Offset"
                  value={data.nextMeeting.gmt_offset}
                />
                <InfoRow label="Season" value={data.nextMeeting.year} />
              </div>

              <div>
                {data.nextMeeting.circuit_image ? (
                  <div
                    style={{
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 14,
                      padding: 16,
                      background: "#f7f7f7",
                    }}
                  >
                    <img
                      src={data.nextMeeting.circuit_image}
                      alt={data.nextMeeting.circuit_short_name || "Circuit"}
                      style={{
                        width: "100%",
                        maxWidth: 420,
                        display: "block",
                        margin: "0 auto",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 14,
                      padding: 16,
                      background: "#f7f7f7",
                      minHeight: 220,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0.6,
                    }}
                  >
                    No circuit image available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {data?.mode === "next-session" && (
        <div style={{ marginTop: 20 }}>
          <h3>Next Session</h3>

          <div
            style={{
              marginTop: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 16,
              overflow: "hidden",
              background: "#ffffff",
              color: "#111111",
              maxWidth: 1100,
              boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
            }}
          >
            <div
              style={{
                background: "#151922",
                color: "#ffffff",
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>
                  {data.meeting?.meeting_name || "Meeting in progress"}
                </div>
                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  {data.meeting?.meeting_official_name || "—"}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.14)",
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                Weekend in progress
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.1fr 0.9fr",
                gap: 24,
                padding: 20,
                alignItems: "start",
              }}
            >
              <div>
                <div
                  style={{
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 20,
                    background: "#f8f8f8",
                  }}
                >
                  <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>
                    Upcoming session
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>
                    {data.nextSession?.session_name || "—"}
                  </div>
                  <div style={{ fontSize: 15, opacity: 0.8 }}>
                    {data.nextSession?.session_type || "—"}
                  </div>
                </div>

                <InfoRow
                  label="Session Start"
                  value={formatDateTime(data.nextSession?.date_start)}
                />
                <InfoRow
                  label="Session End"
                  value={formatDateTime(data.nextSession?.date_end)}
                />
                <InfoRow
                  label="Circuit"
                  value={
                    data.nextSession?.circuit_short_name ||
                    data.meeting?.circuit_short_name
                  }
                />
                <InfoRow
                  label="Location"
                  value={
                    (data.nextSession?.location || data.meeting?.location) &&
                    (data.nextSession?.country_name || data.meeting?.country_name)
                      ? `${data.nextSession?.location || data.meeting?.location}, ${
                          data.nextSession?.country_name || data.meeting?.country_name
                        }`
                      : data.nextSession?.location ||
                        data.meeting?.location ||
                        data.nextSession?.country_name ||
                        data.meeting?.country_name
                  }
                />
                <InfoRow
                  label="GMT Offset"
                  value={data.nextSession?.gmt_offset || data.meeting?.gmt_offset}
                />
              </div>

              <div>
                {data.meeting?.country_flag && (
                  <img
                    src={data.meeting.country_flag}
                    alt={data.meeting.country_name || "Flag"}
                    style={{
                      width: 72,
                      height: 48,
                      objectFit: "cover",
                      borderRadius: 8,
                      marginBottom: 16,
                      border: "1px solid rgba(0,0,0,0.1)",
                      background: "#fff",
                    }}
                  />
                )}

                {data.meeting?.circuit_image ? (
                  <div
                    style={{
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 14,
                      padding: 16,
                      background: "#f7f7f7",
                    }}
                  >
                    <img
                      src={data.meeting.circuit_image}
                      alt={data.meeting.circuit_short_name || "Circuit"}
                      style={{
                        width: "100%",
                        maxWidth: 420,
                        display: "block",
                        margin: "0 auto",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 14,
                      padding: 16,
                      background: "#f7f7f7",
                      minHeight: 220,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0.6,
                    }}
                  >
                    No circuit image available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!showReplayTests && data?.mode === "live-session" && (
  <div
    style={{
      display: "grid",
      gridTemplateColumns:
        window.innerWidth > 1400
          ? "300px minmax(0, 1fr) 340px"
          : "1fr",
      gap: 16,
      alignItems: "start",
      marginTop: 20,
      width: "100%",
    }}
  >
    <div style={{ minWidth: 0 }}>
      <PositionTower
        tower={towerData}
        selectedDriverNumber={selectedDriverNumber}
        onSelectDriver={setSelectedDriverNumber}
      />
    </div>

    <div style={{ minWidth: 0 }}>
      <TrackMap
        points={trackPoints}
        circuitImage={data?.meeting?.circuit_image}
        selectedDriverNumber={selectedDriverNumber}
        onSelectDriver={setSelectedDriverNumber}
      />
    </div>

    <div style={{ minWidth: 0 }}>
      <DriverDetails
        selectedDriverNumber={selectedDriverNumber}
        tower={towerData}
        driverDetails={driverDetails}
      />
    </div>
  </div>
)}
    </div>
  );
}