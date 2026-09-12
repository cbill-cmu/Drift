export const MAP_BOUNDS = {
  north: 40.468,
  south: 40.422,
  west: -79.985,
  east: -79.912,
};

export function boundsFromNodes(nodes, pad = 0.012) {
  const usable = (nodes || []).filter(
    (n) => Number.isFinite(n.lat) && Number.isFinite(n.lng)
  );
  if (usable.length === 0) return MAP_BOUNDS;
  const lats = usable.map((n) => n.lat);
  const lngs = usable.map((n) => n.lng);
  return {
    north: Math.max(...lats) + pad,
    south: Math.min(...lats) - pad,
    west: Math.min(...lngs) - pad,
    east: Math.max(...lngs) + pad,
  };
}

export function project(lat, lng, width, height, bounds = MAP_BOUNDS, pad = 48) {
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);
  const x = pad + ((lng - bounds.west) / (bounds.east - bounds.west)) * innerW;
  const y = pad + ((bounds.north - lat) / (bounds.north - bounds.south)) * innerH;
  return { x, y };
}
