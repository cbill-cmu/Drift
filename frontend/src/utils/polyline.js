/**
 * Google polyline encoding (standard algorithm, precision 5 — ~1.1m,
 * plenty for city-block-scale fog-of-war cells). No dependency needed;
 * this is the well-known reference implementation.
 *
 * Encodes an array of [lat, lng] pairs into a compact ASCII string, and
 * decodes it back. Used to compress a batch of accepted GPS fixes before
 * sending to POST /api/location/traces (see TASKS.md Phase 1-2) instead
 * of shipping one row per point.
 */

const PRECISION = 1e5;

function encodeSignedNumber(num) {
  let sgnNum = num << 1;
  if (num < 0) sgnNum = ~sgnNum;
  let value = "";
  while (sgnNum >= 0x20) {
    value += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
    sgnNum >>= 5;
  }
  value += String.fromCharCode(sgnNum + 63);
  return value;
}

export function encodePolyline(points) {
  let output = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const [lat, lng] of points) {
    const lat5 = Math.round(lat * PRECISION);
    const lng5 = Math.round(lng * PRECISION);
    output += encodeSignedNumber(lat5 - prevLat);
    output += encodeSignedNumber(lng5 - prevLng);
    prevLat = lat5;
    prevLng = lng5;
  }
  return output;
}

export function decodePolyline(encoded) {
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
