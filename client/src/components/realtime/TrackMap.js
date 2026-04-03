import { useEffect, useState } from "react";
import { getDriverCode } from "../../utils/realtimeHelpers";

function resolveTrackFile(circuitName, previousFileName) {
  const name = String(circuitName || "").toLowerCase().trim();

  if (name.includes("japan") || name.includes("suzuka")) {
    return "Suzuka.svg";
  }

  if (
    name.includes("china") ||
    name.includes("shanghai") ||
    name.includes("chinese grand prix")
  ) {
    return "Shanghai.svg";
  }

  if(name.includes("australia") || name.includes("melbourne") || name.includes("australian grand prix")){
    return "Melbourne.svg";
  }

  return previousFileName || null
}

function parseSvgTrack(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svgEl = doc.querySelector("svg");

  if (!svgEl) return null;

  const viewBoxAttr = svgEl.getAttribute("viewBox") || "0 0 100 100";
  const [minX, minY, width, height] = viewBoxAttr.split(/\s+/).map(Number);

  const paths = [...svgEl.querySelectorAll("path")].map((p, index) => ({
    id: p.id || `path-${index}`,
    d: p.getAttribute("d") || "",
    stroke: p.getAttribute("stroke") || "#999",
    strokeWidth:
      p.getAttribute("stroke-width") ||
      p.getAttribute("strokeWidth") ||
      "20",
    fill: p.getAttribute("fill") || "none",
    opacity: p.getAttribute("opacity") || "1",
    strokeLinecap:
      p.getAttribute("stroke-linecap") ||
      p.getAttribute("strokeLinecap") ||
      "round",
    strokeLinejoin:
      p.getAttribute("stroke-linejoin") ||
      p.getAttribute("strokeLinejoin") ||
      "round",
  }));

  return {
    viewBox: { minX, minY, width, height },
    paths,
  };
}

export default function TrackMap({
  points,
  circuitName,
  selectedDriverNumber,
  onSelectDriver,
  driversMap,
}) {
  const [trackData, setTrackData] = useState(null);
  const [trackError, setTrackError] = useState(null);
  const [lastResolvedFile, setLastResolvedFile] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSvg() {
      setTrackError(null);
      setTrackData(null);
      

      const fileName = resolveTrackFile(circuitName, lastResolvedFile);

if (!fileName) {
  return;
}
      const trackUrl = `/tracks/${fileName}`;

      console.log("TrackMap circuitName =", circuitName);
      console.log("TrackMap fileName =", fileName);
      console.log("TrackMap url =", trackUrl);

      const res = await fetch(trackUrl);
      if (!res.ok) {
        throw new Error(`Failed to load SVG: ${trackUrl}`);
      }

      const svgText = await res.text();
      const parsed = parseSvgTrack(svgText);

      if (!parsed) {
        throw new Error(`Invalid SVG file: ${trackUrl}`);
      }

      if (!cancelled) {
        setTrackData(parsed);
        setLastResolvedFile(fileName);
      }
    }

    loadSvg().catch((err) => {
      console.error(err);
      if (!cancelled) {
        setTrackError(err.message);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [circuitName]);

  const viewBox = trackData?.viewBox;

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
      <div style={{ height: 8 }} />

      {trackError && (
        <div style={{ color: "#c62828", opacity: 0.9, marginBottom: 12 }}>
          Failed to load track: {trackError}
        </div>
      )}

      {!points?.length && !trackError && (
        <div style={{ opacity: 0.7 }}>No track position data yet.</div>
      )}

      {!!points?.length && !!trackData && !!viewBox && (
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 900,
            aspectRatio: `${viewBox.width} / ${viewBox.height}`,
            margin: "0 auto",
            borderRadius: 12,
            overflow: "hidden",
            background: "#f7f7f7",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <svg
            viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
            }}
          >
            {trackData.paths.map((path) => (
              <path
                key={path.id}
                id={path.id}
                d={path.d}
                fill={path.fill}
                stroke={path.stroke}
                strokeWidth={path.strokeWidth}
                strokeLinecap={path.strokeLinecap}
                strokeLinejoin={path.strokeLinejoin}
                opacity={path.opacity}
              />
            ))}

            {points.map((p) => {
              const driver = driversMap?.[p.driver_number];
              const teamColor = driver?.team_colour
                ? `#${driver.team_colour}`
                : "#151922";

              const isSelected =
                Number(selectedDriverNumber) === Number(p.driver_number);

              return (
                <g
                  key={p.driver_number}
                  transform={`translate(${p.x}, ${-p.y})`}
                  onClick={() => onSelectDriver?.(p.driver_number)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    r={220}
                    fill={teamColor}
                    stroke={isSelected ? "#111111" : "#ffffff"}
                    strokeWidth={isSelected ? 60 : 40}
                  />
                  <text
                    x="0"
                    y="55"
                    textAnchor="middle"
                    fontSize="180"
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