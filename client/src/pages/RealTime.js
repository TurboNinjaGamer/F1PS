import { useEffect, useState } from "react";
import { authFetch } from "../api";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

export default function RealTime() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    setData(null);

    authFetch("/api/realtime/up-next?year=2026")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) {
          setErr(j.error || "Error loading up-next data");
          return;
        }
        setData(j);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div style={{ padding: "16px 18px" }}>
      <h2>Real Time</h2>

      {err && <div>{err}</div>}
      {!data && !err && <div>Loading...</div>}

      {data && !data.nextMeeting && (
        <div style={{ marginTop: 20, opacity: 0.7 }}>
          No upcoming meeting found.
        </div>
      )}

      {data && data.nextMeeting && (
        <div style={{ marginTop: 20 }}>
          <h3>Up Next</h3>

          <div
            style={{
              marginTop: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 16,
              overflow: "hidden",
              background: "#fff",
              color: "#111",
              maxWidth: 900,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                fontWeight: 900,
                fontSize: 20,
                background: "#151922",
                color: "#fff",
              }}
            >
              {data.nextMeeting.meeting_name || "Next Meeting"}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr",
                gap: 20,
                padding: 18,
                alignItems: "start",
              }}
            >
              <div>
                <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>
                  Official name
                </div>
                <div style={{ fontWeight: 700, marginBottom: 16 }}>
                  {data.nextMeeting.meeting_official_name || "—"}
                </div>

                <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>
                  Circuit
                </div>
                <div style={{ fontWeight: 700, marginBottom: 16 }}>
                  {data.nextMeeting.circuit_short_name || "—"}
                </div>

                <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>
                  Location
                </div>
                <div style={{ fontWeight: 700, marginBottom: 16 }}>
                  {data.nextMeeting.location || "—"}, {data.nextMeeting.country_name || "—"}
                </div>

                <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>
                  Weekend starts
                </div>
                <div style={{ fontWeight: 700 }}>
                  {formatDate(data.nextMeeting.date_start)}
                </div>
              </div>

              <div>
                {data.nextMeeting.country_flag && (
                  <img
                    src={data.nextMeeting.country_flag}
                    alt={data.nextMeeting.country_name || "Flag"}
                    style={{
                      width: 64,
                      height: 42,
                      objectFit: "cover",
                      borderRadius: 6,
                      marginBottom: 16,
                      border: "1px solid rgba(0,0,0,0.1)",
                    }}
                  />
                )}

                {data.nextMeeting.circuit_image && (
                  <img
                    src={data.nextMeeting.circuit_image}
                    alt={data.nextMeeting.circuit_short_name || "Circuit"}
                    style={{
                      width: "100%",
                      maxWidth: 320,
                      background: "#f5f5f5",
                      borderRadius: 12,
                      padding: 10,
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}