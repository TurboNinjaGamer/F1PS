export function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

export function formatLapTime(seconds) {
  if (seconds == null) return "—";

  const totalMs = Math.round(Number(seconds) * 1000);
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${mins}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export const DRIVER_MAP = {
  1: "NOR",
  81: "PIA",
  63: "RUS",
  12: "ANT",
  44: "HAM",
  16: "LEC",
  3: "VER",
  6: "HAD",
  30: "LAW",
  41: "LIN",
  10: "GAS",
  43: "COL",
  31: "OCO",
  87: "BEA",
  77: "BOT",
  11: "PER",
  5: "BOR",
  27: "HUL",
  14: "ALO",
  18: "STR",
  55: "SAI",
  23: "ALB",
};

export function getDriverCode(num) {
  return DRIVER_MAP[num] || `#${num}`;
}

export function buildReplayFrames(rows) {
  if (!rows?.length) return [];

  const sorted = [...rows].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
  );

  const frameMap = new Map();

  for (const row of sorted) {
    const key = row.date;
    if (!key) continue;

    if (!frameMap.has(key)) {
      frameMap.set(key, []);
    }
    frameMap.get(key).push(row);
  }

  const timestamps = Array.from(frameMap.keys()).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  const latestByDriver = new Map();
  const frames = [];

  for (const ts of timestamps) {
    const updates = frameMap.get(ts) || [];

    for (const row of updates) {
      const driverNumber = Number(row.driver_number);
      const position = Number(row.position ?? row.position_order ?? 0);

      if (!driverNumber || !position) continue;

      latestByDriver.set(driverNumber, {
        driver_number: driverNumber,
        position,
      });
    }

    const tower = Array.from(latestByDriver.values()).sort(
      (a, b) => a.position - b.position
    );

    if (tower.length > 0) {
      frames.push({
        date: ts,
        tower,
      });
    }
  }

  return frames;
}

export function buildTrackReplayFrames(rows) {
  if (!rows?.length) return [];

  const sorted = [...rows].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
  );

  const frameMap = new Map();

  for (const row of sorted) {
    const key = row.date;
    if (!key) continue;

    if (!frameMap.has(key)) {
      frameMap.set(key, []);
    }

    frameMap.get(key).push(row);
  }

  const timestamps = Array.from(frameMap.keys()).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  const latestByDriver = new Map();
  const frames = [];

  for (const ts of timestamps) {
    const updates = frameMap.get(ts) || [];

    for (const row of updates) {
      const driverNumber = Number(row.driver_number);
      const x = Number(row.x);
      const y = Number(row.y);
      const z = row.z != null ? Number(row.z) : null;

      if (!driverNumber) continue;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      latestByDriver.set(driverNumber, {
        driver_number: driverNumber,
        x,
        y,
        z,
      });
    }

    const points = Array.from(latestByDriver.values());

    if (points.length > 0) {
      frames.push({
        date: ts,
        points,
      });
    }
  }

  return frames;
}

export function normalizeTrackPoints(points, width, height, pad) {
  const validPoints = (points || []).filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y)
  );

  if (!validPoints.length) return [];

  const minX = Math.min(...validPoints.map((p) => p.x));
  const maxX = Math.max(...validPoints.map((p) => p.x));
  const minY = Math.min(...validPoints.map((p) => p.y));
  const maxY = Math.max(...validPoints.map((p) => p.y));

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  return validPoints.map((p) => {
    const renderX = pad + ((p.x - minX) / spanX) * (width - pad * 2);
    const renderY = pad + ((p.y - minY) / spanY) * (height - pad * 2);

    return {
      ...p,
      renderX,
      renderY: height - renderY,
    };
  });
}

export function buildTransform(rows, width, height, pad, outlineDriverNumber = 1) {
  const valid = (rows || [])
    .filter(
      (r) =>
        Number(r.driver_number) === outlineDriverNumber &&
        Number.isFinite(Number(r.x)) &&
        Number.isFinite(Number(r.y))
    )
    .sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    );

  if (!valid.length) return null;

  const minX = Math.min(...valid.map((p) => Number(p.x)));
  const maxX = Math.max(...valid.map((p) => Number(p.x)));
  const minY = Math.min(...valid.map((p) => Number(p.y)));
  const maxY = Math.max(...valid.map((p) => Number(p.y)));

  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    pad,
  };
}

export function projectPoint(x, y, transform) {
  if (!transform) return null;

  const spanX = Math.max(1, transform.maxX - transform.minX);
  const spanY = Math.max(1, transform.maxY - transform.minY);

  const renderX =
    transform.pad +
    ((Number(x) - transform.minX) / spanX) * (transform.width - transform.pad * 2);

  const renderY =
    transform.pad +
    ((Number(y) - transform.minY) / spanY) * (transform.height - transform.pad * 2);

  return {
    x: renderX,
    y: transform.height - renderY,
  };
}

export function smoothPoints(points, windowSize = 2) {
  if (!points.length) return points;

  return points.map((_, index) => {
    const from = Math.max(0, index - windowSize);
    const to = Math.min(points.length - 1, index + windowSize);

    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let i = from; i <= to; i++) {
      sumX += points[i].x;
      sumY += points[i].y;
      count += 1;
    }

    return {
      x: sumX / count,
      y: sumY / count,
    };
  });
}

export function buildTrackOutline(rows, transform, outlineDriverNumber = 1) {
  const filtered = (rows || [])
    .filter(
      (r) =>
        Number(r.driver_number) === outlineDriverNumber &&
        Number.isFinite(Number(r.x)) &&
        Number.isFinite(Number(r.y))
    )
    .sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    );

  const sampled = filtered.filter((_, index) => index % 4 === 0);

  const projected = sampled
    .map((p) => projectPoint(p.x, p.y, transform))
    .filter(Boolean);

  return smoothPoints(projected, 2);
}

export function normalizeTrackPointsWithTransform(points, transform) {
  // return points
  return (points || [])
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => {
      const projected = projectPoint(p.x, p.y, transform);
      if (!projected) return null;

      return {
        ...p,
        renderX: projected.x,
        renderY: projected.y,
      };
    })
    .filter(Boolean);
}