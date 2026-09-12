/**
 * Discovery reveal hero stub (Person 2).
 * Highest-priority UI once the API returns new_edge / neighborhood %.
 */
export default function DiscoveryReveal({ discoveryData, onDismiss }) {
  if (!discoveryData) return null;

  const edge = discoveryData.new_edge;
  const before = discoveryData.neighborhood_pct_before;
  const after = discoveryData.neighborhood_pct_after;

  return (
    <div className="discovery-toast" role="status">
      <p>
        <strong>{discoveryData.actor_name || "Someone"}</strong> expanded your Drift.
      </p>
      {before != null && after != null && (
        <p>
          Neighborhood {before}% → {after}%
        </p>
      )}
      {edge && (
        <p>
          New connection: {edge.from} → {edge.to}
          {edge.duration_min != null ? `, ${edge.duration_min} min` : ""}
        </p>
      )}
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
