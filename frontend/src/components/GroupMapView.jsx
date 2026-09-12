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

  const showIsland = loading || error || usingFixture || friendId;

  return (
    <div ref={wrapRef} className="map-wrap">
      {size.width > 0 && size.height > 0 ? (
        <GraphMap
          graph={data || { nodes: [], edges: [], heatpoints: [] }}
          width={size.width}
          height={size.height}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
      ) : null}

      {showIsland ? (
        <div className="status-island" role="status">
          <div className="status-island-pill">
            <span
              className={
                loading
                  ? "status-island-dot status-island-dot-pulse"
                  : usingFixture || error
                    ? "status-island-dot status-island-dot-warn"
                    : "status-island-dot"
              }
              aria-hidden="true"
            />

            <div className="status-island-copy">
              {loading ? <p>Loading graph…</p> : null}
              {usingFixture ? <p>Local fixture</p> : null}
              {error && !usingFixture ? <p className="status-island-error">{error}</p> : null}
              {friendId && !loading && !usingFixture && !error ? (
                <p>Friend map</p>
              ) : null}
            </div>

            <div className="status-island-actions">
              {friendId ? (
                <button
                  type="button"
                  className="status-island-btn status-island-btn-quiet"
                  onClick={onBackToGroup}
                >
                  Group
                </button>
              ) : null}
              {(error || usingFixture) && !loading ? (
                <button
                  type="button"
                  className="status-island-btn"
                  onClick={reload}
                >
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
