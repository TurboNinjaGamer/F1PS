import { getDriverCode } from "../../utils/realtimeHelpers";

export default function PositionTower({
  tower,
  frameDate,
  selectedDriverNumber,
  onSelectDriver,
  driversMap,
}) {
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

            return (
              <div
                key={row.driver_number}
                onClick={() => onSelectDriver?.(row.driver_number)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "6px 44px 1fr 60px",
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

                <div style={{ fontWeight: 800 }}>
                  {getDriverCode(row.driver_number)}
                </div>

                <div style={{ textAlign: "right", opacity: 0.75 }}>
                  #{row.driver_number}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}