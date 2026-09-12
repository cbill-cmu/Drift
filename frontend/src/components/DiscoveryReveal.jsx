import { useEffect, useState } from "react";

const AUTO_DISMISS_MS = 5000;
const LEAVE_ANIMATION_MS = 220;

/**
 * Discovery reveal — soft top toast matching Soft product standard.
 * Auto-dismisses after 5s (or on manual close), with a brief fade/slide
 * out before actually unmounting so the exit reads as intentional.
 */
export default function DiscoveryReveal({ discoveryData, onDismiss }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!discoveryData) {
      setLeaving(false);
      return undefined;
    }
    const autoTimer = setTimeout(() => setLeaving(true), AUTO_DISMISS_MS);
    return () => clearTimeout(autoTimer);
  }, [discoveryData]);

  useEffect(() => {
    if (!leaving) return undefined;
    const leaveTimer = setTimeout(() => onDismiss?.(), LEAVE_ANIMATION_MS);
    return () => clearTimeout(leaveTimer);
  }, [leaving, onDismiss]);

  if (!discoveryData) return null;

  const edge = discoveryData.new_edge;
  const before = discoveryData.neighborhood_pct_before;
  const after = discoveryData.neighborhood_pct_after;

  return (
    <div
      className={leaving ? "discovery-toast discovery-toast-leaving" : "discovery-toast"}
      role="status"
    >
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
      <button
        type="button"
        className="icon-dismiss"
        onClick={() => setLeaving(true)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
