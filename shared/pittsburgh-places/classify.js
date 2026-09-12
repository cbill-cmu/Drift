/**
 * Map OSM tags → Drift place_type (locked enum) + social category.
 * Social categories: night_life, food, sights, outdoors, shopping, recreation, hangout
 */

export const SOCIAL_CATEGORIES = [
  "night_life",
  "food",
  "sights",
  "outdoors",
  "shopping",
  "recreation",
  "hangout",
];

export const PITTSBURGH_HOODS = [
  { name: "Oakland", lat: 40.4415, lng: -79.956 },
  { name: "Shadyside", lat: 40.452, lng: -79.934 },
  { name: "Bloomfield", lat: 40.462, lng: -79.945 },
  { name: "Squirrel Hill", lat: 40.438, lng: -79.923 },
  { name: "East Liberty", lat: 40.462, lng: -79.923 },
  { name: "Strip District", lat: 40.45, lng: -79.985 },
  { name: "South Side", lat: 40.428, lng: -79.975 },
  { name: "Downtown", lat: 40.441, lng: -79.996 },
  { name: "North Side", lat: 40.453, lng: -80.01 },
  { name: "North Shore", lat: 40.446, lng: -80.013 },
  { name: "Point Breeze", lat: 40.447, lng: -79.905 },
  { name: "Homestead", lat: 40.406, lng: -79.912 },
  { name: "Lawrenceville", lat: 40.463, lng: -79.964 },
  { name: "Polish Hill", lat: 40.457, lng: -79.965 },
  { name: "Friendship", lat: 40.462, lng: -79.934 },
  { name: "Regent Square", lat: 40.432, lng: -79.895 },
  { name: "Highland Park", lat: 40.479, lng: -79.916 },
  { name: "Greenfield", lat: 40.423, lng: -79.94 },
  { name: "Hazelwood", lat: 40.409, lng: -79.941 },
  { name: "Mount Washington", lat: 40.428, lng: -80.01 },
  { name: "South Shore", lat: 40.432, lng: -80.005 },
  { name: "West End", lat: 40.44, lng: -80.034 },
  { name: "Brookline", lat: 40.392, lng: -80.02 },
  { name: "Dormont", lat: 40.396, lng: -80.038 },
  { name: "Mt. Lebanon", lat: 40.38, lng: -80.05 },
  { name: "Millvale", lat: 40.48, lng: -79.978 },
  { name: "Aspinwall", lat: 40.49, lng: -79.904 },
  { name: "Sharpsburg", lat: 40.495, lng: -79.93 },
  { name: "Etna", lat: 40.499, lng: -79.945 },
  { name: "Swissvale", lat: 40.422, lng: -79.883 },
  { name: "Wilkinsburg", lat: 40.442, lng: -79.882 },
  { name: "Edgewood", lat: 40.432, lng: -79.88 },
  { name: "Carrick", lat: 40.397, lng: -79.987 },
  { name: "Beechview", lat: 40.411, lng: -80.024 },
  { name: "Allentown", lat: 40.422, lng: -79.993 },
  { name: "Troy Hill", lat: 40.466, lng: -79.985 },
  { name: "Fineview", lat: 40.464, lng: -80.004 },
  { name: "Manchester", lat: 40.455, lng: -80.024 },
  { name: "Allegheny West", lat: 40.452, lng: -80.018 },
  { name: "Mexican War Streets", lat: 40.455, lng: -80.012 },
  { name: "East Allegheny", lat: 40.456, lng: -80.001 },
  { name: "The Run", lat: 40.433, lng: -79.951 },
  { name: "Panther Hollow", lat: 40.437, lng: -79.949 },
];

export function nearestNeighborhood(lat, lng) {
  let best = PITTSBURGH_HOODS[0];
  let bestD = Infinity;
  for (const hood of PITTSBURGH_HOODS) {
    const dLat = lat - hood.lat;
    const dLng = (lng - hood.lng) * 1.3;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) {
      bestD = d;
      best = hood;
    }
  }
  return best.name;
}

function has(tags, key, values) {
  const v = tags[key];
  if (!v) return false;
  return values.includes(v);
}

export function classifyOsmTags(tags = {}) {
  const amenity = tags.amenity || "";
  const leisure = tags.leisure || "";
  const tourism = tags.tourism || "";
  const shop = tags.shop || "";
  const historic = tags.historic || "";
  const sport = tags.sport || "";
  const cuisine = tags.cuisine || "";

  if (
    ["bar", "pub", "nightclub", "biergarten"].includes(amenity) ||
    leisure === "dance" ||
    shop === "wine" ||
    tags["club"] === "music"
  ) {
    return {
      category: "night_life",
      place_type: "entertainment",
      kind: amenity || leisure || "bar",
    };
  }

  if (["cinema", "theatre", "arts_centre", "music_venue", "casino"].includes(amenity)) {
    return {
      category: "night_life",
      place_type: "entertainment",
      kind: amenity,
    };
  }

  if (
    ["restaurant", "cafe", "fast_food", "ice_cream", "food_court", "bbq"].includes(amenity) ||
    shop === "bakery" ||
    cuisine
  ) {
    return { category: "food", place_type: "food", kind: amenity || shop || "restaurant" };
  }

  if (["supermarket", "convenience", "greengrocer", "butcher", "seafood"].includes(shop)) {
    return { category: "food", place_type: "shopping", kind: shop };
  }

  if (
    ["mall", "department_store", "clothes", "books", "gift", "music", "yes"].includes(shop) ||
    amenity === "marketplace"
  ) {
    return { category: "shopping", place_type: "shopping", kind: shop || amenity };
  }

  if (
    ["park", "garden", "nature_reserve", "dog_park", "picnic_site"].includes(leisure) ||
    tourism === "picnic_site"
  ) {
    return { category: "outdoors", place_type: "park", kind: leisure || "park" };
  }

  if (
    ["sports_centre", "stadium", "pitch", "track", "fitness_centre", "swimming_pool", "ice_rink", "bowling_alley"].includes(
      leisure
    ) ||
    sport ||
    amenity === "community_centre"
  ) {
    return { category: "recreation", place_type: "entertainment", kind: leisure || sport || amenity };
  }

  if (
    ["attraction", "museum", "viewpoint", "artwork", "gallery", "theme_park", "zoo", "aquarium"].includes(tourism) ||
    historic ||
    amenity === "fountain" ||
    amenity === "place_of_worship"
  ) {
    return { category: "sights", place_type: "urban_core", kind: tourism || historic || amenity };
  }

  if (["university", "college", "library", "townhall"].includes(amenity)) {
    return { category: "hangout", place_type: "urban_core", kind: amenity };
  }

  if (leisure === "playground") {
    return { category: "outdoors", place_type: "park", kind: "playground" };
  }

  return { category: "hangout", place_type: "unknown", kind: amenity || leisure || tourism || shop || "place" };
}

export function coordsFromElement(el) {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center && typeof el.center.lat === "number") {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return null;
}

export function classifyFromName(name = "") {
  const n = String(name).toLowerCase();
  if (/\b(bar|pub|tavern|brewery|nightclub|lounge|taproom|biergarten|speakeasy)\b/.test(n)) {
    return { category: "night_life", place_type: "entertainment", kind: "bar" };
  }
  if (/\b(club|concert|theater|theatre|cinema|music hall|casino)\b/.test(n)) {
    return { category: "night_life", place_type: "entertainment", kind: "venue" };
  }
  if (/\b(park|trail|conservatory|garden|overlook|cemetery)\b/.test(n)) {
    return { category: "outdoors", place_type: "park", kind: "park" };
  }
  if (/\b(museum|cathedral|incline|bridge|monument|zoo|aviary|viewpoint|landmark)\b/.test(n)) {
    return { category: "sights", place_type: "urban_core", kind: "attraction" };
  }
  if (/\b(stadium|arena|gym|bowl|rink|pool|kennywood|sandcastle)\b/.test(n)) {
    return { category: "recreation", place_type: "entertainment", kind: "recreation" };
  }
  if (/\b(grocery|market|supermarket|whole foods|trader joe|aldi|giant eagle|mall|target)\b/.test(n)) {
    return { category: "shopping", place_type: "shopping", kind: "store" };
  }
  if (/\b(restaurant|cafe|diner|pizza|taco|burger|bakery|coffee|grill|kitchen|eatery)\b/.test(n)) {
    return { category: "food", place_type: "food", kind: "restaurant" };
  }
  return { category: "hangout", place_type: "unknown", kind: "place" };
}

export function classifyGoogleTypes(types = [], name = "") {
  const set = new Set(types || []);
  if (["night_club", "bar"].some((t) => set.has(t))) {
    return { category: "night_life", place_type: "entertainment", kind: "bar" };
  }
  if (["movie_theater", "casino", "stadium"].some((t) => set.has(t))) {
    return { category: "night_life", place_type: "entertainment", kind: "venue" };
  }
  if (["restaurant", "cafe", "bakery", "meal_takeaway", "meal_delivery", "food"].some((t) => set.has(t))) {
    return { category: "food", place_type: "food", kind: "restaurant" };
  }
  if (["supermarket", "grocery_or_supermarket"].some((t) => set.has(t))) {
    return { category: "food", place_type: "shopping", kind: "supermarket" };
  }
  if (["shopping_mall", "store", "clothing_store", "department_store"].some((t) => set.has(t))) {
    return { category: "shopping", place_type: "shopping", kind: "store" };
  }
  if (["park", "campground", "natural_feature"].some((t) => set.has(t))) {
    return { category: "outdoors", place_type: "park", kind: "park" };
  }
  if (["museum", "art_gallery", "tourist_attraction", "church", "hindu_temple"].some((t) => set.has(t))) {
    return { category: "sights", place_type: "urban_core", kind: "attraction" };
  }
  if (["amusement_park", "gym", "bowling_alley", "zoo", "aquarium"].some((t) => set.has(t))) {
    return { category: "recreation", place_type: "entertainment", kind: "recreation" };
  }
  if (["university", "school", "library"].some((t) => set.has(t))) {
    return { category: "hangout", place_type: "urban_core", kind: "campus" };
  }
  return classifyFromName(name);
}
