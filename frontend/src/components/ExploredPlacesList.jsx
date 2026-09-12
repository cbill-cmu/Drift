import { suggestionId, toSelectPlace } from "../utils/suggestions.js";

/**
 * Places the current user has already walked through — shown in the Places
 * sheet instead of as map pins.
 */
export default function ExploredPlacesList({
  items = [],
  loading = false,
  selectedId = null,
  onSelectPlace,
}) {
  const byHood = new Map();
  for (const item of items || []) {
    const hood = item.neighborhood || "Pittsburgh";
    if (!byHood.has(hood)) byHood.set(hood, []);
    byHood.get(hood).push(item);
  }
  const neighborhoods = [...byHood.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  if (loading && !items.length) {
    return <p className="hint">Loading places you’ve been…</p>;
  }
  if (!items.length) {
    return <p className="hint">Start exploring to fill this list with places you’ve been.</p>;
  }

  return (
    <section className="neighborhood-stats explored-places">
      <p className="overall-pct">
        {items.length} place{items.length === 1 ? "" : "s"} you’ve been
      </p>
      <ul>
        {neighborhoods.map(([name, places]) => (
          <li key={name}>
            <details open>
              <summary>
                <div className="stat-row">
                  <span className="stat-name">{name}</span>
                  <span className="stat-meta">
                    {places.length} place{places.length === 1 ? "" : "s"}
                  </span>
                </div>
              </summary>
              <ul className="place-list">
                {places.map((item) => {
                  const id = suggestionId(item);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className={id === selectedId ? "place-btn place-btn-active" : "place-btn"}
                        onClick={() => onSelectPlace?.(toSelectPlace(item), { closeSheet: false })}
                      >
                        <span>{item.name}</span>
                        <span className="hint">
                          {String(item.place_type || "place").replaceAll("_", " ")}
                          {item.distance_label ? ` · ${item.distance_label}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
