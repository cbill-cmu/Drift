import { useEffect, useState } from "react";
import { fetchGroupSuggestions } from "../api/client.js";
import { withDistance } from "../utils/distance.js";
import { suggestionId } from "../utils/suggestions.js";

export default function SuggestionCards({
  groupId,
  items: itemsProp,
  limit = 16,
  compact = false,
  origin = null,
  selectedId = null,
  loading: loadingProp = false,
  onSelectPlace,
}) {
  const [fetched, setFetched] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controlled = Array.isArray(itemsProp);

  useEffect(() => {
    if (controlled || !groupId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchGroupSuggestions(groupId, { limit })
      .then((payload) => {
        if (cancelled) return;
        const list = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
        setFetched(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load suggestions");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [controlled, groupId, limit]);

  const items = (controlled ? itemsProp : withDistance(fetched, origin)).slice(0, limit);
  const waiting = controlled ? loadingProp : loading;

  if (!groupId && !controlled) return null;
  if (waiting && !items.length) {
    if (compact) {
      return (
        <section className="suggestion-cards suggestion-cards-compact">
          <strong>Go here next</strong>
          <p className="hint suggestion-status">Finding unexplored spots…</p>
        </section>
      );
    }
    return <p className="hint">Finding unexplored spots…</p>;
  }
  if (!controlled && error) return <p className="error">{error}</p>;
  if (!items.length) {
    return compact ? null : <p className="hint">No uncovered catalog places right now.</p>;
  }

  return (
    <section className={compact ? "suggestion-cards suggestion-cards-compact" : "suggestion-cards"}>
      {compact ? <strong>Go here next</strong> : <h2>Unexplored nearby</h2>}
      {!compact ? (
        <p className="hint">
          {origin
            ? "Places nobody in this group has visited yet, nearest first."
            : "Places nobody in this group has visited yet. Start exploring to see distance from you."}
        </p>
      ) : null}
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
