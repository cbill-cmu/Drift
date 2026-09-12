import { cellToBoundary } from "h3-js";

/** Web-Mercator-safe world ring [lng, lat], closed. */
const WORLD_RING = [
  [-180, -85.05112878],
  [180, -85.05112878],
  [180, 85.05112878],
  [-180, 85.05112878],
  [-180, -85.05112878],
];

function closedRing(coords) {
  if (!coords.length) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return coords;
  return [...coords, first];
}

function hexHole(h3Cell) {
  try {
    const ring = cellToBoundary(h3Cell, true);
    if (!ring || ring.length < 3) return null;
    // Reverse so the hole winds opposite the outer world ring (GeoJSON holes).
    return closedRing([...ring].reverse());
  } catch {
    return null;
  }
}

/**
 * Invert-mask GeoJSON: a world polygon with visited hexes punched out
 * so the map shows through explored cells and fog covers the rest.
 */
export function buildPersonalFogGeoJSON(cells) {
  const holes = [];
  for (const cell of cells || []) {
    const id = typeof cell === "string" ? cell : cell?.h3_cell;
    if (!id) continue;
    const hole = hexHole(id);
    if (hole) holes.push(hole);
  }
  return {
    type: "Feature",
    properties: { kind: "personal-fog" },
    geometry: {
      type: "Polygon",
      coordinates: [WORLD_RING, ...holes],
    },
  };
}

/** Individual visited hex polygons (stroke only — the hole is the reveal). */
export function buildVisitedCellGeoJSON(cells) {
  const features = [];
  for (const cell of cells || []) {
    const id = typeof cell === "string" ? cell : cell?.h3_cell;
    if (!id) continue;
    try {
      const ring = closedRing(cellToBoundary(id, true));
      if (!ring || ring.length < 4) continue;
      features.push({
        type: "Feature",
        properties: {
          h3_cell: id,
          visit_count: Number.isFinite(cell?.visit_count) ? cell.visit_count : 1,
        },
        geometry: { type: "Polygon", coordinates: [ring] },
      });
    } catch {
      /* skip invalid indexes */
    }
  }
  return { type: "FeatureCollection", features };
}
