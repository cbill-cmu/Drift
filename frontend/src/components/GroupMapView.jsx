import { useEffect, useRef, useState } from "react";
import { useMapGraph } from "../hooks/useGroupGraph.js";
import GraphMap from "./GraphMap.jsx";

/**
 * Main map + graph overlay.
 * Renders whatever payload useMapGraph returns (group API, friend API, or fixture).
 */
export default function GroupMapView({
  groupId,
  friendId,
  onGraph,
  selectedNodeId,
  onSelectNode,
  onBackToGroup,
  refreshKey = 0,
}) {
  const { data, loading, error, reload, usingFixture } = useMapGraph({
    groupId,
    friendId,
    refreshKey,
  });
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    onGraph?.(data || null);
  }, [data, onGraph]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      setSize({
        width: Math.floor(box.width),
        height: Math.floor(box.height),
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const title = data?.display_name
    ? `${data.display_name}'s map`
    : data?.group_name || "GroupMapView";

  return (
    <div ref={wrapRef} className="map-wrap">
      {data ? (
        <GraphMap
          graph={data}
          width={size.width}
          height={size.height}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
      ) : null}
      <div className="map-hud">
        <p>
          <strong>{title}</strong>
          {data ? ` · visit heatmap` : ""}
        </p>
        {loading && <p>Loading graph…</p>}
        {usingFixture && (
          <p className="hint">
            Showing a local friend fixture ({error}). Group map uses Mongo when the API is up.
          </p>
        )}
        {error && !usingFixture && <p className="error">{error}</p>}
        <div className="hud-actions">
          {friendId ? (
          <button type="button" className="btn-paper" onClick={onBackToGroup}>
            Back to group map
          </button>
          ) : null}
          <button type="button" className="btn-sun" onClick={reload}>
            Retry API
          </button>
        </div>
      </div>
      <aside className="heat-legend" aria-label="Visit heatmap legend">
        <p>Visit heat</p>
        <ul>
          <li>
            <span className="legend-swatch legend-swatch-light" />
            Pale green — unvisited
          </li>
          <li>
            <span className="legend-swatch legend-swatch-mid" />
            Leaf green — medium visited
          </li>
          <li>
            <span className="legend-swatch legend-swatch-dark" />
            Forest green — heavily visited
          </li>
        </ul>
      </aside>
    </div>
  );
}
