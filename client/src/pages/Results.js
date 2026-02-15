import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../api";
import { TEAMS } from "../teamData";

const SEASONS = [2026, 2025, 2024, 2023];

const DRIVER_MAP = {
  1: "VER",
  11: "PER",
  63: "RUS",
  44: "HAM",
  16: "LEC",
  55: "SAI",
  4: "NOR",
  81: "PIA",
  14: "ALO",
  18: "STR",
  10: "GAS",
  31: "OCO",
  20: "MAG",
  27: "HUL",
  24: "ZHO",
  77: "BOT",
  21: "DEV",
  3: "RIC",
  40: "LAW",
  22: "TSU",
  2: "SAR",
  23: "ALB",
  43: "COL",
  30: "LAW",
  87: "BEA",
  7: "DOO",
  5: "BOR",
  12: "ANT",
  6: "HAD",


};

function getDriverName(number) {
  return DRIVER_MAP[number] || `#${number}`;
}

export default function Results() {
  const [season, setSeason] = useState(2026);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  // omiljeni tim iz localStorage
  const favoriteTeamId = useMemo(() => {
    const u = localStorage.getItem("user");
    if (!u) return null;
    try {
      return JSON.parse(u).favorite_team_id || null;
    } catch {
      return null;
    }
  }, []);

  const favoriteTeamName = useMemo(() => {
    const t = TEAMS.find((x) => x.id === favoriteTeamId);
    return t?.name || null;
  }, [favoriteTeamId]);

  useEffect(() => {
    setData(null);
    setErr("");

    authFetch(`/results/standings?season=${season}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) {
          setErr(j.error || "Error loading standings");
          return;
        }
        setData(j);
      })
      .catch((e) => setErr(String(e)));
  }, [season]);

  return (
    <div>
      <h2>Results</h2>

      <div style={{ marginBottom: 20 }}>
        <label>Season: </label>
        <select value={season} onChange={(e) => setSeason(Number(e.target.value))}>
          {SEASONS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {err && <div>{err}</div>}
      {!data && !err && <div>Loading...</div>}

      {data && (
        <>
          {/* Drivers */}
          <h3>Drivers Championship</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Pos</th>
                <th align="left">Driver #</th>
                <th align="right">Points</th>
              </tr>
            </thead>
            <tbody>
              {data.drivers
                .sort((a, b) => a.position_current - b.position_current)
                .map((d) => (
                  <tr key={d.driver_number}>
                    <td>{d.position_current}</td>
                    <td>{getDriverName(d.driver_number)}</td>
                    <td align="right">{d.points_current}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          {/* Teams */}
          <h3 style={{ marginTop: 30 }}>Teams Championship</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Pos</th>
                <th align="left">Team</th>
                <th align="right">Points</th>
              </tr>
            </thead>
            <tbody>
              {data.teams
                .sort((a, b) => a.position_current - b.position_current)
                .map((t) => {
                  const isFav =
                    favoriteTeamName &&
                    t.team_name?.toLowerCase() === favoriteTeamName.toLowerCase();

                  return (
                    <tr
                      key={t.team_name}
                      style={{
                        background: isFav ? "rgba(255,255,255,0.12)" : "transparent",
                        fontWeight: isFav ? "bold" : "normal"
                      }}
                    >
                      <td>{t.position_current}</td>
                      <td>{t.team_name}</td>
                      <td align="right">{t.points_current}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}