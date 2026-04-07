import { useEffect, useState } from "react";
import { authFetch } from "../api";

import InfoRow from "../components/realtime/InfoRow";
import PositionTower from "../components/realtime/PositionTower";
import TrackMap from "../components/realtime/TrackMap";

import { formatDateTime } from "../utils/realtimeHelpers";

function resolveMeeting(data) {
  return data?.meeting || data?.nextMeeting || null;
}

function resolveSession(data) {
  return data?.liveSession || data?.nextSession || null;
}

export default function RealTime() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const [towerData, setTowerData] = useState([]);
  const [trackPoints, setTrackPoints] = useState([]);

  const [selectedDriverNumber, setSelectedDriverNumber] = useState(null);
  const [driversMap, setDriversMap] = useState({});

  const [trackMeta, setTrackMeta] = useState(null);
  const [towerGapMode, setTowerGapMode] = useState("interval");
  const [towerMode, setTowerMode] = useState("race");

  const [towerHeaderInfo, setTowerHeaderInfo] = useState({
    currentLap: null,
    totalLaps: null,
  });

  const [trackRaceControl, setTrackRaceControl] = useState(null);

  const meeting = resolveMeeting(data);
  const session = resolveSession(data);

  const resolvedCircuitName =
    trackMeta?.meeting?.circuit_short_name ||
    trackMeta?.meeting?.country_name ||
    trackMeta?.meeting?.meeting_name ||
    data?.meeting?.circuit_short_name ||
    data?.meeting?.country_name ||
    data?.meeting?.meeting_name ||
    "";

  const currentSessionKey =
  session?.session_key ||
  trackMeta?.liveSession?.session_key ||
  trackMeta?.session_key ||
  null;

  // =========================
  // STATUS
  // =========================
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

  // =========================
  // TRACK MAP
  // =========================
  useEffect(() => {
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
            setTrackMeta((prev) => ({
  meeting: j.meeting || prev?.meeting || null,
  liveSession: j.liveSession || prev?.liveSession || null,
  meeting_key: j.meeting_key || prev?.meeting_key || null,
  session_key: j.session_key || prev?.session_key || null,
}));
setTrackRaceControl(j.raceControl || null);
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
  }, [data?.mode]);

  // =========================
  // POSITION TOWER
  // =========================
  useEffect(() => {
    if (data?.mode !== "live-session") {
      setTowerData([]);
      return;
    }

    let cancelled = false;

    const loadTower = () => {
      authFetch("/api/realtime/position-tower")
        .then((r) => r.json())
        .then((j) => {
          console.log("tower response", j);
          console.log("LAP FROM API:", j.current_lap);
          if (!cancelled && j.ok) {
            setTowerData(j.tower || []);
            setTowerMode(j.mode || "race");

            setTowerHeaderInfo({
              currentLap: j.current_lap ?? null,
              totalLaps: j.total_laps ?? null,
            });

            setTowerGapMode((prev) => {
              if ((j.mode || "race") === "qualy") {
                return prev === "interval" || prev === "to-leader"
                  ? "gap"
                  : prev;
              }
              return prev === "gap" || prev === "best-lap"
                ? "interval"
                : prev;
            });
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
  }, [data?.mode]);

  // =========================
  // DRIVERS
  // =========================
  useEffect(() => {
    if (!currentSessionKey) return;

    authFetch(`/api/realtime/drivers?session_key=${currentSessionKey}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return;

        const map = {};
        (j.drivers || []).forEach((d) => {
          map[d.driver_number] = d;
        });

        setDriversMap(map);
      });
  }, [currentSessionKey]);

  // =========================
  // RENDER
  // =========================
  return (
    <div style={{ padding: "16px 18px" }}>
      {err && <div>{err}</div>}
      {!data && !err && <div>Loading...</div>}

      {!data ? null : data.mode === "live-session" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              window.innerWidth > 1200
                ? "320px minmax(0, 1fr)"
                : "1fr",
            gap: 16,
            alignItems: "start",
            marginTop: 10,
          }}
        >
          <PositionTower
            tower={towerData}
            selectedDriverNumber={selectedDriverNumber}
            onSelectDriver={setSelectedDriverNumber}
            driversMap={driversMap}
            gapMode={towerGapMode}
            onChangeGapMode={setTowerGapMode}
            towerMode={towerMode}
            currentLap={towerHeaderInfo.currentLap}
            totalLaps={towerHeaderInfo.totalLaps}
          />

          <TrackMap
            points={trackPoints}
            circuitName={resolvedCircuitName}
            selectedDriverNumber={selectedDriverNumber}
            onSelectDriver={setSelectedDriverNumber}
            driversMap={driversMap}
            raceControl={trackRaceControl}
          />
        </div>
      ) : null}
    </div>
  );
}