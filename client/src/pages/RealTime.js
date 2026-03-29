import { useEffect, useState } from "react";
import { authFetch } from "../api";

import InfoRow from "../components/realtime/InfoRow";
import PositionTower from "../components/realtime/PositionTower";
import TrackMap from "../components/realtime/TrackMap";
import TrackMapTest from "../components/realtime/TrackMapTest";
import DriverDetails from "../components/realtime/DriverDetails";

import {
  formatDateTime,
  buildReplayFrames,
  buildTrackReplayFrames,
} from "../utils/realtimeHelpers";

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
  const [driversMap, setDriversMap] = useState({});

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
        console.log("REALTIME STATUS RESPONSE:", j);
console.log("MODE:", j.mode);
console.log("LIVE SESSION:", j.liveSession);
console.log("MEETING:", j.meeting);
console.log("NEXT SESSION:", j.nextSession);
        console.log("Pozvan sam u: " + j);
      })
      .catch((e) => setErr(String(e)));
  }, []);

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

 /* useEffect(() => {
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
  }, [showReplayTests]); */

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

  useEffect(() => {
  const sessionKey = showReplayTests
    ? 11234
    : data?.liveSession?.session_key;

  if (!sessionKey) return;

  authFetch(
    `/api/realtime/test-track-outline?session_key=${sessionKey}&driver_number=1`
  )
    .then((r) => r.json())
    .then((j) => {
      console.log("OUTLINE RESPONSE:", j);

      // ✅ prihvati samo VALIDAN outline
      if (j.ok && Array.isArray(j.rows) && j.rows.length > 200) {
        setTrackOutlineRows(j.rows);
      } else {
        console.warn(
          "Ignoring invalid outline response",
          j?.rows?.length
        );
      }
    })
    .catch((e) => {
      console.error("TRACK OUTLINE FETCH ERROR:", e);
      // ❗ ništa ne radimo → zadržavamo stari outline
    });
}, [showReplayTests, data?.liveSession?.session_key]);

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
              driversMap={driversMap}
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
              driversMap={driversMap}
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
              driversMap={driversMap}
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <TrackMap
              points={trackPoints}
              circuitName={data?.meeting?.circuit_short_name}
              selectedDriverNumber={selectedDriverNumber}
              onSelectDriver={setSelectedDriverNumber}
              driversMap={driversMap}
              outlineRows={trackOutlineRows}
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