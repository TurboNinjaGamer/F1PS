import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../api";
import { TEAMS } from "../teamData";

const SEASONS = [2026, 2025, 2024, 2023];

const DRIVER_MAP = {
  1: "VERSTAPPEN",
  11: "PEREZ",
  63: "RUSSELL",
  44: "HAMILTON",
  16: "LECLERC",
  55: "SAINZ",
  4: "NORRIS",
  81: "PIASTRI",
  14: "ALONSO",
  18: "STROLL",
  10: "GASLY",
  31: "OCON",
  20: "MAGNUSSEN",
  27: "HULKENBERG",
  24: "ZHOU",
  77: "BOTTAS",
  21: "DE VRIES",
  3: "RICCIARDO",
  22: "TSUNODA",
  2: "SARGEANT",
  23: "ALBON",
  43: "COLAPINTO",
  30: "LAWSON",
  87: "BEARMAN",
  7: "DOOHAN",
  5: "BORTOLETO",
  12: "ANTONELLI",
  6: "HADJAR",
  40: "LAWSON",
  61: "DOOHAN",
  50: "BEARMAN"
  
};

const thStyle = {
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.15)",
  fontWeight: 700
};

const tdStyle = {
  padding: "8px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.08)"
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

  const favoriteTeam = useMemo(() => {
  return TEAMS.find((x) => x.id === favoriteTeamId) || null;
}, [favoriteTeamId]);

  useEffect(() => {
    setData(null);
    setErr("");

    authFetch(`/results/standings?season=${season}&limit=15`)
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
    <div style={{"--table-accent": favoriteTeam?.primary || "#e10600"}}>
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
        <div className="resultsGrid">

          <div style={{overflowX: "auto"}}>
            {/* Drivers */}
              <h3>Drivers Championship</h3>
              <table className="standingsTable" style={{ width: "30%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
              <tr>
                <th style={{...thStyle, width: 20}}>Pos</th>
                <th style={{...thStyle, width: 100}}>Driver</th>
                <th style={{...thStyle, width: 60, textAlign: "right"}}>Points</th>
                {data.races?.map((r) => (
                  <th
                    key={r.session_key}
                    style={{ ...thStyle, width: 60, textAlign: "center" }}
                    title={r.session_key}
                  >
                   {r.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.drivers
                .sort((a, b) => a.position_current - b.position_current)
                .map((d) => (
                  <tr key={d.driver_number}>
                    <td style={{...tdStyle, width: 20}}>{d.position_current}</td>
                    <td style={{...tdStyle, width: 100}}>{getDriverName(d.driver_number)}</td>
                    <td style={{...tdStyle, width: 60, textAlign: "right"}}>{d.points_current}</td>
                    {data.races?.map((r) => {
                        const pos = data.driverRacePositions?.[String(d.driver_number)]?.[r.session_key];
                        return (
                            <td key={r.session_key} style={{ ...tdStyle, width: 60, textAlign: "center" }}>
                              {pos ? `P${pos}` : "-"}
                            </td>
                        );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

          {/* Teams */}
          <div style={{overflowX: "auto"}}>
          <h3 style={{ marginTop: 30 }}>Teams Championship</h3>
          <table className="standingsTable" style={{ width: "20%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{...thStyle, width: 0}}>Pos</th>
                <th style={{...thStyle, width: 60}}>Team</th>
                <th style={{...thStyle, width: 60, textAlign: "right"}}>Points</th>
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
                      <td style={{...tdStyle, width: 0}}>{t.position_current}</td>
                      <td style={{...tdStyle, width: 60}}>{t.team_name}</td>
                      <td style={{...tdStyle, width: 60, textAlign: "right"}}>{t.points_current}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
          </div>
        </>
      )}
    </div>
  );
}