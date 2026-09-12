import { suggestionId } from "../utils/suggestions.js";

/**
 * Catalog places sitting inside unshaded (visited) hexes — the mirror of
 * SuggestionCards, but for places the group has actually been to. Feeds
 * the Places tab so a revealed hex's contents count as visited, not just
 * an "unexplored" suggestion.
 */
export default function VisitedPlacesList({
  items = [],
  loading = false,
  selectedId = null,
  onSelectPlace,
}) {
  if (loading && !items.length) {
    return <p className="hint">Finding places you've visited…</p>;
  }
  if (!items.length) {
    return <p className="hint">No catalog places inside your explored area yet.</p>;
  }

  return (
    <section className="suggestion-cards">
      <h2>Places you've visited</h2>
      <p className="hint">Catalog places inside hexes this group has explored.</p>
      <ul>
        {items.map((item) => {
          const id = suggestionId(item);
          return (
            <li key={id}>
              <button
                type="button"
                className={selectedId === id ? "rec-place rec-place-selected" : "rec-place"}
                onClick={() =>
                  onSelectPlace?.({
                    location_name: item.name,
                    activity_type: item.place_type,
                    lat: item.lat,
                    lng: item.lng,
                    h3_cell: item.h3_cell,
                    place_id: item.place_id,
                  })
                }
              >
                <span className="rec-type">
                  {item.neighborhood || item.place_type || "Place"}
                  {item.distance_label ? ` · ${item.distance_label}` : ""}
                  {item.coverage_tier === "everyone" ? " · everyone's been" : ""}
                </span>
                <strong className="rec-location-name">{item.name}</strong>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
