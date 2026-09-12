/**
 * Great-circle distance in meters between two lat/lng points.
 * Mirrors backend/src/services/neighborhoods.js's haversineMeters exactly
 * so the client-side accept filter and any server-side distance math agree.
 */
export function haversineMeters(aLat, aLng, bLat, bLng) {
  const R = 6_371_000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
