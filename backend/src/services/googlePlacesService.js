/**
 * Google Places / Geocoding lookup.
 * Cache results — do not call twice for the same lat/lng.
 */
const placesCache = new Map();

function cacheKey(lat, lng) {
  return `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
}

function apiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
}

const TYPE_RULES = [
  [["park", "campground", "natural_feature"], "park"],
  [["restaurant", "cafe", "bakery", "meal_takeaway", "meal_delivery", "food", "bar"], "food"],
  [["shopping_mall", "store", "clothing_store", "supermarket", "department_store"], "shopping"],
  [
    ["transit_station", "bus_station", "subway_station", "train_station", "light_rail_station"],
    "transit",
  ],
  [
    ["night_club", "movie_theater", "museum", "stadium", "amusement_park", "art_gallery", "casino"],
    "entertainment",
  ],
  [["university", "school", "locality", "neighborhood", "colloquial_area"], "urban_core"],
  [["premise", "subpremise", "street_address", "route", "political"], "urban_core"],
  [["lodging", "residential"], "residential"],
];

export function mapGoogleTypes(types = []) {
  const set = new Set(types);
  for (const [needles, placeType] of TYPE_RULES) {
    if (needles.some((t) => set.has(t))) return placeType;
  }
  return "unknown";
}

export async function reverseGeocodePlaceType(lat, lng) {
  const key = cacheKey(lat, lng);
  if (placesCache.has(key)) {
    return placesCache.get(key);
  }

  const secret = apiKey();
  if (!secret) {
    const stub = { name: null, place_type: "unknown" };
    placesCache.set(key, stub);
    return stub;
  }

  try {
    const result = await lookupPlace(lat, lng, secret);
    placesCache.set(key, result);
    return result;
  } catch (err) {
    console.warn("[places] lookup failed:", err.message);
    const fallback = { name: null, place_type: "unknown" };
    placesCache.set(key, fallback);
    return fallback;
  }
}

async function lookupPlace(lat, lng, secret) {
  const nearby = await fetchJson(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=150&key=${encodeURIComponent(secret)}`
  );
  if (nearby.status === "OK" && nearby.results?.[0]) {
    const top = nearby.results[0];
    return {
      name: top.name || null,
      place_type: mapGoogleTypes(top.types || []),
    };
  }
  if (nearby.status && nearby.status !== "ZERO_RESULTS") {
    console.warn("[places] nearby:", nearby.status, nearby.error_message || "");
  }

  const geo = await fetchJson(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(secret)}`
  );
  if (geo.status === "OK" && geo.results?.[0]) {
    const top = geo.results[0];
    return {
      name: nameFromGeocode(top),
      place_type: mapGoogleTypes(top.types || []),
    };
  }
  if (geo.status && geo.status !== "ZERO_RESULTS") {
    console.warn("[places] geocode:", geo.status, geo.error_message || "");
  }

  return { name: null, place_type: "unknown" };
}

function nameFromGeocode(result) {
  const comps = result.address_components || [];
  const pick = (...types) => {
    const hit = comps.find((c) => c.types.some((t) => types.includes(t)));
    return hit?.long_name || null;
  };
  return (
    pick("point_of_interest", "establishment") ||
    pick("neighborhood", "sublocality", "sublocality_level_1") ||
    pick("route") ||
    result.formatted_address?.split(",")[0] ||
    null
  );
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google HTTP ${res.status}`);
  }
  return res.json();
}
