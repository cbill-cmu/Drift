import { cellToBoundary, cellToLatLng, cellToParent, getResolution } from "h3-js";

/** Stored visit resolution (block-scale). Coarser view is derived, never stored. */
export const FOG_STORED_RESOLUTION = 9;
export const FOG_COARSE_RESOLUTION = 7;
/** Leaflet zoom at or below this uses neighborhood-scale (res 7) hexes. */
export const FOG_COARSE_ZOOM_MAX = 13;

export function resolutionForZoom(zoom) {
  return Number(zoom) <= FOG_COARSE_ZOOM_MAX
    ? FOG_COARSE_RESOLUTION
    : FOG_STORED_RESOLUTION;
}

export function cellAtResolution(cellId, resolution) {
  if (!cellId || !Number.isInteger(resolution)) return cellId;
  const current = getResolution(cellId);
  if (current === resolution) return cellId;
  if (current > resolution) return cellToParent(cellId, resolution);
  return cellId;
}

/**
 * Collapse res-9 cells to a coarser H3 resolution, de-duping siblings that
 * share a parent so zoomed-out hexes don't overlap.
 */
export function coarsenCells(cells, resolution) {
  const list = cellList(cells);
  if (!Number.isInteger(resolution) || resolution >= FOG_STORED_RESOLUTION) {
    return list;
  }
  const byParent = new Map();
  for (const cell of list) {
    let parent;
    try {
      parent = cellAtResolution(cell.h3_cell, resolution);
    } catch {
      continue;
    }
    if (!parent) continue;
    const count = Number.isFinite(cell.visit_count) ? cell.visit_count : 1;
    const prev = byParent.get(parent);
    if (!prev) {
      byParent.set(parent, { h3_cell: parent, visit_count: count });
    } else {
      prev.visit_count = Math.max(prev.visit_count, count);
    }
  }
  return [...byParent.values()];
}

/** Everyone wins over some when a neighborhood contains both tiers. */
export function coarsenGroupCoverage(everyone, some, resolution) {
  const everyoneCells = coarsenCells(everyone, resolution);
  const everyoneSet = new Set(everyoneCells.map((cell) => cell.h3_cell));
  const someCells = coarsenCells(some, resolution).filter(
    (cell) => !everyoneSet.has(cell.h3_cell)
  );
  return { everyone: everyoneCells, some: someCells };
}

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
