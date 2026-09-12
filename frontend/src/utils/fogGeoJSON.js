import { cellToBoundary, cellToLatLng } from "h3-js";

function closedRing(coords) {
  if (!coords.length) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return coords;
  return [...coords, first];
}

export function lngLatRingFromBBox({ west, south, east, north }) {
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

export function filterCellsInBounds(cells, bbox) {
  if (!bbox) return cells || [];
  const { west, south, east, north } = bbox;
  const out = [];
  for (const cell of cells || []) {
    const id = typeof cell === "string" ? cell : cell?.h3_cell;
    if (!id) continue;
    try {
      const [lat, lng] = cellToLatLng(id);
      if (lat >= south && lat <= north && lng >= west && lng <= east) {
        out.push(cell);
      }
    } catch {
      /* skip invalid indexes */
    }
  }
  return out;
}

function hexHole(h3Cell) {
  try {
    const ring = cellToBoundary(h3Cell, true);
    if (!ring || ring.length < 3) return null;
    // Reverse so the hole winds opposite the outer ring (GeoJSON holes).
    return closedRing([...ring].reverse());
  } catch {
    return null;
  }
}

/**
 * Invert-mask GeoJSON: outer ring (viewport) with visited hexes punched out
 * so the map shows through explored cells and fog covers the rest.
 */
export function buildPersonalFogGeoJSON(cells, outerRing) {
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
      coordinates: [outerRing, ...holes],
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

export function cellList(cells) {
  const out = [];
  for (const cell of cells || []) {
    if (typeof cell === "string" && cell) out.push({ h3_cell: cell });
    else if (cell?.h3_cell) out.push(cell);
  }
  return out;
}
