export function suggestionId(item) {
  return item?.place_id || item?.h3_cell || item?.name || item?.location_name || "";
}

export function cellIdSet(cells) {
  const set = new Set();
  for (const cell of cells || []) {
    const id = typeof cell === "string" ? cell : cell?.h3_cell;
    if (id) set.add(id);
  }
  return set;
}

export function toSelectPlace(item) {
  return {
    location_name: item.name || item.location_name,
    activity_type: item.place_type,
    lat: item.lat,
    lng: item.lng,
    h3_cell: item.h3_cell,
    place_id: item.place_id,
  };
}
