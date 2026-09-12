/**
 * Discovery reveal — soft top toast matching Soft product standard.
 */
export default function DiscoveryReveal({ discoveryData, onDismiss }) {
  if (!discoveryData) return null;

  const edge = discoveryData.new_edge;
  const before = discoveryData.neighborhood_pct_before;
  const after = discoveryData.neighborhood_pct_after;

  return (
    <div className="discovery-toast" role="status">
      <span className="discovery-check" aria-hidden="true">
        ✓
      </span>
      <div className="discovery-copy">
        <p>
          <strong>{discoveryData.actor_name || "Someone"}</strong> expanded your
          Drift.
        </p>
        {before != null && after != null ? (
          <p className="hint">
            Neighborhood {before}% → {after}%
          </p>
        ) : null}
        {edge ? (
          <p className="hint">
            New connection: {edge.from} → {edge.to}
            {edge.duration_min != null ? `, ${edge.duration_min} min` : ""}
          </p>
        ) : null}
      </div>
      <button type="button" className="icon-dismiss" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
