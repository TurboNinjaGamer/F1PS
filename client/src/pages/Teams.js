import { useMemo } from "react";
import { TEAMS } from "../teamData";
import { DRIVERS_2026 } from "../drivers2026";

function getFavoriteTeamId() {
  const u = localStorage.getItem("user");
  if (!u) return null;
  try {
    return JSON.parse(u).favorite_team_id || null;
  } catch {
    return null;
  }
}

export default function Teams() {
  const favoriteTeamId = useMemo(getFavoriteTeamId, []);
  const favoriteTeamName = useMemo(() => {
    const t = TEAMS.find((x) => x.id === favoriteTeamId);
    return t?.name || null;
  }, [favoriteTeamId]);

  const groups = useMemo(() => {
    // map teamName -> drivers[]
    const driverMap = new Map(
      DRIVERS_2026.map((x) => [(x.teamName || "").toLowerCase(), x.drivers || []])
    );

    // napravi listu timova iz TEAMS (2026), pa upari vozače iz driverMap
    let list = TEAMS.map((t) => ({
      teamName: t.name,
      teamColor: t.primary || "#999999",
      drivers:
        driverMap.get((t.name || "").toLowerCase()) || [
          { driver_number: null, full_name: "TBD", name_acronym: "TBD", headshot_url: null },
          { driver_number: null, full_name: "TBD", name_acronym: "TBD", headshot_url: null },
        ],
    }));

    // favorite team first
    const favLower = (favoriteTeamName || "").toLowerCase();
    list.sort((a, b) => {
      const af = a.teamName?.toLowerCase() === favLower ? 0 : 1;
      const bf = b.teamName?.toLowerCase() === favLower ? 0 : 1;
      if (af !== bf) return af - bf;
      return (a.teamName || "").localeCompare(b.teamName || "");
    });

    return list;
  }, [favoriteTeamName]);

  return (
    <div style={{ padding: "16px 18px" }}>
      <h2>Teams 2026</h2>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          alignItems: "start",
        }}
      >
        {groups.map((g) => {
          const isFav =
            favoriteTeamName &&
            g.teamName?.toLowerCase() === favoriteTeamName.toLowerCase();

          return (
            <div
              key={g.teamName}
              style={{
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 12,
                overflow: "hidden",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              {/* Team header */}
              <div
                style={{
                  background: g.teamColor,
                  color: "#fff",
                  padding: isFav ? "12px 14px" : "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontWeight: 800,
                }}
              >
                <div>{g.teamName}</div>
                {isFav && (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.22)",
                      padding: "4px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    Favorite
                  </div>
                )}
              </div>

              {/* Drivers pair */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  padding: 12,
                }}
              >
                {g.drivers.slice(0, 2).map((d, idx) => (
                  <div
                    key={`${g.teamName}:${d.driver_number ?? "NA"}:${idx}`}
                    style={{
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "#FFFFFF",
                      color: "#111",
                      padding: isFav ? 14 : 12,
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      boxShadow: isFav ? "0 6px 18px rgba(0,0,0,0.25)" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 44,
                        borderRadius: 999,
                        background: g.teamColor,
                        flexShrink: 0,
                      }}
                    />

                    {/* Headshot (optional) */}
                    {d.headshot_url ? (
                      <img
                        src={d.headshot_url}
                        alt={d.full_name || "Driver"}
                        style={{
                          width: isFav ? 54 : 48,
                          height: isFav ? 54 : 48,
                          borderRadius: "50%",
                          objectFit: "cover",
                          background: "#eee",
                          flexShrink: 0,
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: isFav ? 54 : 48,
                          height: isFav ? 54 : 48,
                          borderRadius: "50%",
                          background: "#eee",
                          flexShrink: 0,
                        }}
                      />
                    )}

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, letterSpacing: 0.3 }}>
                        {d.name_acronym || d.full_name || "TBD"}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.8 }}>
                        #{d.driver_number ?? "—"} · {d.full_name || "TBD"}
                      </div>
                    </div>
                  </div>
                ))}

                {/* ako tim ima samo 1 vozača, ostavi placeholder da grid ne pukne */}
                {g.drivers.length < 2 && <div />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}