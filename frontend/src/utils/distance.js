import { haversineMeters } from "./haversine.js";

/** US-facing distance label from a live or last-known origin. */
export function formatDistanceMeters(meters) {
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (meters < 160) return `${Math.max(1, Math.round(meters))} m`;
  const miles = meters / 1609.34;
  if (miles < 9.95) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function distanceFromOrigin(origin, lat, lng) {
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return haversineMeters(origin.lat, origin.lng, lat, lng);
}

export function withDistance(items, origin) {
  const next = (items || []).map((item) => {
    const meters = distanceFromOrigin(origin, item.lat, item.lng);
    return {
      ...item,
      distance_m: meters,
      distance_label: meters == null ? "" : formatDistanceMeters(meters),
    };
  });
  if (origin) {
    next.sort((a, b) => (a.distance_m ?? 1e12) - (b.distance_m ?? 1e12));
  }
  return next;
}
