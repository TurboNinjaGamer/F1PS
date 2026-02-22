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
          {
            driver_number: null,
            full_name: "TBD",
            name_acronym: "TBD",
            headshot_url: null,
          },
          {
            driver_number: null,
            full_name: "TBD",
            name_acronym: "TBD",
            headshot_url: null,
          },
        ],
    }));

    // favorite team first (samo radi konzistentnosti; posle ga ionako izdvajamo)
    const favLower = (favoriteTeamName || "").toLowerCase();
    list.sort((a, b) => {
      const af = a.teamName?.toLowerCase() === favLower ? 0 : 1;
      const bf = b.teamName?.toLowerCase() === favLower ? 0 : 1;
      if (af !== bf) return af - bf;
      return (a.teamName || "").localeCompare(b.teamName || "");
    });

    return list;
  }, [favoriteTeamName]);

  const favoriteGroup = useMemo(() => {
    if (!favoriteTeamName) return null;
    const favLower = favoriteTeamName.toLowerCase();
    return groups.find((g) => g.teamName?.toLowerCase() === favLower) || null;
  }, [groups, favoriteTeamName]);

  const otherGroups = useMemo(() => {
    if (!favoriteTeamName) return groups;
    const favLower = favoriteTeamName.toLowerCase();
    return groups.filter((g) => g.teamName?.toLowerCase() !== favLower);
  }, [groups, favoriteTeamName]);

  const Stat = ({ label, value }) => (
  <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
    <div style={{ fontSize: 11, opacity: 0.65, fontWeight: 800 }}>{label}</div>
    <div style={{ fontSize: 12, fontWeight: 900 }}>{value ?? "—"}</div>
  </div>
  );

  const renderDriverCard = (g, d, idx, isFav) => {
    return (
      <div
        key={`${g.teamName}:${d.driver_number ?? "NA"}:${idx}`}
        style={{
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "#FFFFFF",
          color: "#111",
          padding: isFav ? 16 : 12,
          display: "flex",
          gap: 12,
          alignItems: "center",
          boxShadow: isFav ? "0 8px 22px rgba(0,0,0,0.25)" : "none",
        }}
      >
        <div
          style={{
            width: 6,
            height: isFav ? 52 : 44,
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
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = "/heads/default.png";
            }}
            style={{
              width: isFav ? 64 : 48,
              height: isFav ? 64 : 48,
              borderRadius: "50%",
              objectFit: "cover",
              background: "#eee",
              flexShrink: 0,
              border: `2px solid ${g.teamColor}`,
            }}
          />
        ) : (
          <img
            src="/heads/default.png"
            alt="Driver"
            style={{
              width: isFav ? 64 : 48,
              height: isFav ? 64 : 48,
              borderRadius: "50%",
              objectFit: "cover",
              background: "#eee",
              flexShrink: 0,
              border: `2px solid ${g.teamColor}`,
            }}
          />
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
  <div style={{ fontWeight: 900, letterSpacing: 0.3, fontSize: isFav ? 16 : 14 }}>
    {d.name_acronym || d.full_name || "TBD"}
  </div>

  <div style={{ fontSize: 13, opacity: 0.8, marginBottom: isFav ? 8 : 0 }}>
    #{d.driver_number ?? "—"} · {d.full_name || "TBD"}
  </div>

  {/* ✅ BIO/STATS samo za favorite */}
  {isFav && d.bio && (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "10px 16px",
        alignItems: "center",
      }}
    >
      <Stat label="Born" value={d.bio.born} />
      <Stat label="Wins" value={d.bio.wins} />
      <Stat label="Podiums" value={d.bio.podiums} />
      <Stat label="Titles" value={d.bio.titles} />
      <Stat label="Best finish" value={d.bio.bestFinish} />
    </div>
  )}
</div>

      </div>
    );
  };

  const renderTeamCard = (g, isFav) => {
    return (
      <div
        key={g.teamName}
        style={{
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: isFav ? 16 : 12,
          overflow: "hidden",
          background: "rgba(255,255,255,0.04)",
          boxShadow: isFav ? "0 14px 34px rgba(0,0,0,0.28)" : "none",
        }}
      >
        {/* Team header */}
        <div
          style={{
            background: g.teamColor,
            color: "#fff",
            padding: isFav ? "16px 18px" : "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: 900,
            fontSize: isFav ? 20 : 14,
          }}
        >
          <div>{g.teamName}</div>
          {isFav && (
            <div
              style={{
                background: "rgba(255,255,255,0.22)",
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 13,
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
            gap: isFav ? 16 : 12,
            padding: isFav ? 16 : 12,
          }}
        >
          {g.drivers.slice(0, 2).map((d, idx) => renderDriverCard(g, d, idx, isFav))}

          {/* ako tim ima samo 1 vozača, ostavi placeholder da grid ne pukne */}
          {g.drivers.length < 2 && <div />}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "16px 18px" }}>
      

      {/* FAVORITE TEAM kao zaseban red */}
      {favoriteGroup && (
        <div style={{ marginBottom: 22 }}>
          {renderTeamCard(favoriteGroup, true)}
        </div>
      )}

      {/* Ostali timovi u gridu */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          alignItems: "start",
        }}
      >
        {otherGroups.map((g) => renderTeamCard(g, false))}
      </div>
    </div>
  );
}