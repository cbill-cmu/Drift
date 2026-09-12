export function suggestionId(item) {
  return item?.place_id || item?.h3_cell || item?.name || item?.location_name || "";
}
