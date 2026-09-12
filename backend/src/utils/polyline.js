/**
 * Google polyline encoding (precision 5). Decode direction used by
 * POST /api/location/traces so the server can turn a flushed client
 * polyline into lat/lng points without trusting a parallel point list.
 * Same algorithm as frontend/src/utils/polyline.js.
 */

const PRECISION = 1e5;

export function decodePolyline(encoded) {
  if (typeof encoded !== "string" || encoded.length === 0) return [];

  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / PRECISION, lng / PRECISION]);
  }
  return points;
}
