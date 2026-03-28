import InfoRow from "./InfoRow";
import { formatLapTime, getDriverCode } from "../../utils/realtimeHelpers";



function formatLatestLap(latestLap) {
  if (!latestLap) return "—";

  const lapNum = latestLap.lap_number;
  const lapTime = formatLapTime(latestLap.lap_duration);

  if (!lapNum && !lapTime) return "—";

  if (lapNum && lapTime !== "—") {
    return `Lap ${lapNum} — ${lapTime}`;
  }

  if (lapNum) return `Lap ${lapNum}`;
  return lapTime;
}




export default function DriverDetails({
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

      <InfoRow
        label="Acronym"
        value={driver?.name_acronym || getDriverCode(selectedDriverNumber)}
      />
      <InfoRow label="Driver Number" value={`#${selectedDriverNumber}`} />
      <InfoRow label="Current Position" value={towerRow?.position ?? "—"} />
      <InfoRow label="Latest Lap" value={formatLatestLap(latestLap)} />
      <InfoRow label="Lap Time" value={formatLapTime(latestLap?.lap_duration)} />
      <InfoRow label="Sector 1" value={formatLapTime(latestLap?.duration_sector_1)} />
      <InfoRow label="Sector 2" value={formatLapTime(latestLap?.duration_sector_2)} />
      <InfoRow label="Sector 3" value={formatLapTime(latestLap?.duration_sector_3)} />
      <InfoRow
        label="I1 Speed"
        value={latestLap?.i1_speed != null ? `${latestLap.i1_speed} km/h` : "—"}
      />
      <InfoRow
        label="I2 Speed"
        value={latestLap?.i2_speed != null ? `${latestLap.i2_speed} km/h` : "—"}
      />
      <InfoRow
        label="ST Speed"
        value={latestLap?.st_speed != null ? `${latestLap.st_speed} km/h` : "—"}
      />
    </div>
  );
}