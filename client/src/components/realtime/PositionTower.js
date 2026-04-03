import { getDriverCode, formatLapTime } from "../../utils/realtimeHelpers";

function formatGap(value, isLeader = false, mode = "interval") {
  if (isLeader) {
    return mode === "to-leader" ? "+0.000" : "LEADER";
  }

  if (value == null) return "—";

  if (typeof value === "string") {
    return value;
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "—";
  }

  return `+${num.toFixed(3)}`;
}

export default function PositionTower({
  tower,
  frameDate,
  selectedDriverNumber,
  onSelectDriver,
  driversMap,
  gapMode = "interval",
  onChangeGapMode,
  towerMode = "race",
  currentLap = null,
  totalLaps = null,
}) {
  const isQualyMode = towerMode === "qualy";

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {towerMode === "race" && currentLap != null && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                padding: "4px 10px",
                borderRadius: 999,
                background: "#f3f3f3",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              {totalLaps != null ? `${currentLap}/${totalLaps}` : `Lap ${currentLap}`}
            </div>
          )}
        </div>

        <div
          style={{
            display: "inline-flex",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 10,
            overflow: "hidden",
            background: "#f3f3f3",
          }}
        >
          {!isQualyMode && (
            <>
              <button
                onClick={() => onChangeGapMode?.("interval")}
                style={{
                  padding: "6px 10px",
                  border: "none",
                  background: gapMode === "interval" ? "#151922" : "transparent",
                  color: gapMode === "interval" ? "#ffffff" : "#111111",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                Interval
              </button>

              <button
                onClick={() => onChangeGapMode?.("to-leader")}
                style={{
                  padding: "6px 10px",
                  border: "none",
                  background: gapMode === "to-leader" ? "#151922" : "transparent",
                  color: gapMode === "to-leader" ? "#ffffff" : "#111111",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                To Leader
              </button>
            </>
          )}

          {isQualyMode && (
            <>
              <button
                onClick={() => onChangeGapMode?.("gap")}
                style={{
                  padding: "6px 10px",
                  border: "none",
                  background: gapMode === "gap" ? "#151922" : "transparent",
                  color: gapMode === "gap" ? "#ffffff" : "#111111",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                Gap
              </button>

              <button
                onClick={() => onChangeGapMode?.("best-lap")}
                style={{
                  padding: "6px 10px",
                  border: "none",
                  background: gapMode === "best-lap" ? "#151922" : "transparent",
                  color: gapMode === "best-lap" ? "#ffffff" : "#111111",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                Best Lap
              </button>
            </>
          )}
        </div>
      </div>

      {frameDate && (
        <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 12 }}>
          Replay frame: {new Date(frameDate).toLocaleString()}
        </div>
      )}

      {!tower?.length && (
        <div style={{ opacity: 0.7 }}>No position data yet.</div>
      )}

      {!!tower?.length && (
        <div style={{ display: "grid", gap: 8 }}>
          {tower.map((row) => {
            const driver = driversMap?.[row.driver_number];
            const teamColor = driver?.team_colour
              ? `#${driver.team_colour}`
              : "#999999";

            const isSelected =
              Number(selectedDriverNumber) === Number(row.driver_number);

            const isLeader = Number(row.position) === 1;

            let mainValue = "—";

            if (!isQualyMode) {
              const gapValue =
                gapMode === "to-leader"
                  ? row.gap_to_leader
                  : row.interval_to_ahead;

              mainValue = formatGap(gapValue, isLeader, gapMode);
            } else {
              if (gapMode === "best-lap") {
                mainValue = formatLapTime(row.best_lap_time);
              } else {
                mainValue = isLeader
                  ? formatLapTime(row.best_lap_time)
                  : formatGap(row.gap_to_fastest, false, "gap");
              }
            }

            return (
              <div
                key={row.driver_number}
                onClick={() => onSelectDriver?.(row.driver_number)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "6px 44px 1fr 110px",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: isSelected ? "#e9eefc" : "#f5f5f5",
                  border: isSelected
                    ? "1px solid #4c6fff"
                    : "1px solid rgba(0,0,0,0.06)",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: "100%",
                    borderRadius: 6,
                    background: teamColor,
                  }}
                />

                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 18,
                    textAlign: "center",
                  }}
                >
                  {row.position}
                </div>

                <div>
                  <div style={{ fontWeight: 800 }}>
                    {getDriverCode(row.driver_number)}
                  </div>
                </div>

                <div
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    fontSize: 13,
                    opacity: 0.9,
                  }}
                >
                  {mainValue}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}