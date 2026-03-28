import {
  buildTransform,
  buildTrackOutline,
  normalizeTrackPointsWithTransform,
  getDriverCode,
} from "../../utils/realtimeHelpers";

export default function TrackMapTest({
  points,
  frameDate,
  outlineRows,
  selectedDriverNumber,
  onSelectDriver,
  driversMap,
}) {
  const width = 700;
  const height = 500;
  const pad = 24;
  const outlineDriverNumber = 1;

  const transform = buildTransform(
    outlineRows,
    width,
    height,
    pad,
    outlineDriverNumber
  );

  const normalizedCars = normalizeTrackPointsWithTransform(points, transform);
  const outline = buildTrackOutline(
    outlineRows,
    transform,
    outlineDriverNumber
  );

  const outlinePath = outline.map((p) => `${p.x},${p.y}`).join(" ");

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
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>Track Map Test</h3>

      {frameDate && (
        <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 12 }}>
          Replay frame: {new Date(frameDate).toLocaleString()}
        </div>
      )}

      {!normalizedCars.length && !outline.length && (
        <div style={{ opacity: 0.7 }}>No track location data yet.</div>
      )}

      {(!!normalizedCars.length || !!outline.length) && (
        <div
          style={{
            width: "100%",
            maxWidth: width,
            height,
            margin: "0 auto",
            borderRadius: 12,
            overflow: "hidden",
            background: "#f7f7f7",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: "100%", height: "100%", display: "block" }}
          >
            {!!outline.length && (
              <polyline
                points={outlinePath}
                fill="none"
                stroke="rgba(0,0,0,0.22)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {normalizedCars.map((p) => {
              const driver = driversMap?.[p.driver_number];
              const teamColor = driver?.team_colour
                ? `#${driver.team_colour}`
                : "#151922";

              const isSelected =
                Number(selectedDriverNumber) === Number(p.driver_number);

              return (
                <g
                  key={p.driver_number}
                  transform={`translate(${p.renderX}, ${p.renderY})`}
                  onClick={() => onSelectDriver?.(p.driver_number)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    r={isSelected ? "13" : "10"}
                    fill={teamColor}
                    stroke={isSelected ? "#111111" : "#ffffff"}
                    strokeWidth={isSelected ? "3" : "2"}
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#ffffff"
                  >
                    {getDriverCode(p.driver_number)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}