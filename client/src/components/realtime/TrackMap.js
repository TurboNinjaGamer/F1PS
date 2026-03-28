import {
  buildTransform,
  buildTrackOutline,
  normalizeTrackPointsWithTransform,
  getDriverCode,
} from "../../utils/realtimeHelpers";

export default function TrackMap({
  points,
  circuitImage,
  selectedDriverNumber,
  onSelectDriver,
  driversMap,
  outlineRows,
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

  const normalized = normalizeTrackPointsWithTransform(points, transform);
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
      <h3 style={{ marginTop: 0 }}>Track Map</h3>

      {!normalized.length && !outline.length && (
        <div style={{ opacity: 0.7 }}>No track position data yet.</div>
      )}

      {(!!normalized.length || !!outline.length) && (
        <div
          style={{
            position: "relative",
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
          {/*{circuitImage && (
            <img
              src={circuitImage}
              alt="Circuit"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                opacity: 0.12,
                pointerEvents: "none",
              }}
            />
          )}*/}

          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
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

            {normalized.map((p) => {
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