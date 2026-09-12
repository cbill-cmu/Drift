import { useEffect, useState } from "react";
import { fetchRecommendations } from "../api/client.js";

export default function RecommendationsPanel({ groupId, onSelectPlace }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      setData(null);
      setError("");
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetchRecommendations(groupId)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load recommendations");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  if (!groupId) {
    return (
      <p className="hint">Make a group first and we’ll show you what’s around the area.</p>
    );
  }
  if (loading) return <p className="hint">Finding spots for you…</p>;
  if (error) return <p className="error">{error}</p>;

  const categories = data?.categories || [];

  return (
    <section className="recs-panel">
      <h2>Recommendations</h2>
      <p className="hint">
        Three activity types based on where you and your group have been. Each card is an activity type and a location name.
      </p>
      {categories.map((bucket) => (
        <article key={bucket.activity_type_id} className="rec-category">
          <h3>{bucket.activity_type}</h3>
          <p className="hint">{bucket.why}</p>
          {bucket.places?.length ? (
            <ul>
              {bucket.places.map((place) => (
                <li key={place.place_id || place.location_name}>
                  <button
                    type="button"
                    className="rec-place"
                    onClick={() => onSelectPlace?.(place)}
                  >
                    <span className="rec-type">{place.activity_type}</span>
                    <strong className="rec-location-name">{place.location_name}</strong>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">No unused catalog spots in this type yet.</p>
          )}
        </article>
      ))}
    </section>
  );
}
