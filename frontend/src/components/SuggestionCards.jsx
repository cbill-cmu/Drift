import { useEffect, useState } from "react";
import { fetchGroupSuggestions } from "../api/client.js";
import { withDistance } from "../utils/distance.js";
import { suggestionId } from "../utils/suggestions.js";

function ChevronIcon() {
  return (
    <svg className="suggestion-chevron" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5.3 7.3a.75.75 0 0 1 1.06 0L10 10.94l3.64-3.64a.75.75 0 1 1 1.06 1.06l-4.17 4.17a.75.75 0 0 1-1.06 0L5.3 8.36a.75.75 0 0 1 0-1.06z"
      />
    </svg>
  );
}

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
  const [open, setOpen] = useState(false);
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
        <section className="suggestion-cards suggestion-cards-compact is-collapsed">
          <button type="button" className="suggestion-toggle" disabled>
            <span>Go here next</span>
          </button>
        </section>
      );
    }
    return <p className="hint">Finding unexplored spots…</p>;
  }
  if (!controlled && error) return <p className="error">{error}</p>;
  if (!items.length) {
    return compact ? null : <p className="hint">No uncovered catalog places right now.</p>;
  }

  const list = (
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
  );

  if (compact) {
    return (
      <section
        className={
          open
            ? "suggestion-cards suggestion-cards-compact is-open"
            : "suggestion-cards suggestion-cards-compact is-collapsed"
        }
      >
        <button
          type="button"
          className="suggestion-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span>Go here next</span>
          <span className="suggestion-count">{items.length}</span>
          <ChevronIcon />
        </button>
        <div className="suggestion-panel">{list}</div>
      </section>
    );
  }

  return (
    <section className="suggestion-cards">
      <h2>Unexplored nearby</h2>
      <p className="hint">
        {origin
          ? "Places nobody in this group has visited yet, nearest first."
          : "Places nobody in this group has visited yet. Start exploring to see distance from you."}
      </p>
      {list}
    </section>
  );
}
