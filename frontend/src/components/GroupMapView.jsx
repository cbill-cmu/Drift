import { useEffect, useRef, useState } from "react";
import { useMapGraph } from "../hooks/useGroupGraph.js";
import { useGroupCoverage } from "../hooks/useGroupCoverage.js";
import { useVisitedCells } from "../hooks/useVisitedCells.js";
import GraphMap from "./GraphMap.jsx";
import SuggestionCards from "./SuggestionCards.jsx";
import { suggestionId } from "../utils/suggestions.js";

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
  fogRefreshKey = 0,
  fogMode = "personal",
  visitedCells: visitedCellsProp,
  fogLoading: fogLoadingProp,
  onSelectPlace,
  suggestions = [],
  suggestionsLoading = false,
  origin = null,
  selectedPlace = null,
}) {
  const { data, loading, error, reload, usingFixture } = useMapGraph({
    groupId,
    friendId,
    refreshKey,
  });
  const visitedFromHook = useVisitedCells({
    refreshKey: fogRefreshKey,
    enabled: visitedCellsProp === undefined,
  });
  const visitedCells = visitedCellsProp ?? visitedFromHook.cells;
  const fogLoading = fogLoadingProp ?? visitedFromHook.loading;
  const {
    everyone,
    some,
    loading: coverageLoading,
  } = useGroupCoverage({
    groupId,
    refreshKey: fogRefreshKey,
    enabled: fogMode === "group" && Boolean(groupId),
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
      const width = Math.floor(box.width);
      const height = Math.floor(box.height);
      if (width < 8 || height < 8) return;
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
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
          viewKey={`${groupId || ""}:${friendId || ""}`}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          visitedCells={visitedCells}
          fogMode={fogMode}
          everyoneCells={everyone}
          someCells={some}
          suggestions={friendId ? [] : suggestions}
          origin={friendId ? null : origin}
          selectedSuggestion={friendId ? null : selectedPlace}
          onSelectSuggestion={onSelectPlace}
        />
      ) : null}

      {!groupId && !friendId ? (
        <p className="fog-hint">Create a group in Profile to share coverage</p>
      ) : null}
      {fogMode === "personal" && groupId && !fogLoading && visitedCells.length === 0 ? (
        <p className="fog-hint">Unexplored — start exploring to lift the fog</p>
      ) : null}
      {fogMode === "group" && !coverageLoading && everyone.length === 0 && some.length === 0 ? (
        <p className="fog-hint">No group coverage yet — explore, then switch back</p>
      ) : null}
      {fogMode === "group" ? (
        <div className="fog-legend" aria-label="Group coverage">
          <span>
            <i className="fog-swatch fog-swatch-everyone" aria-hidden="true" />
            Everyone
          </span>
          <span>
            <i className="fog-swatch fog-swatch-some" aria-hidden="true" />
            Some
          </span>
          <span>
            <i className="fog-swatch fog-swatch-none" aria-hidden="true" />
            No one
          </span>
        </div>
      ) : null}
      {groupId && !friendId ? (
        <div className="suggestion-dock">
          <SuggestionCards
            items={suggestions}
            limit={4}
            compact
            origin={origin}
            selectedId={suggestionId(selectedPlace)}
            loading={suggestionsLoading}
            onSelectPlace={onSelectPlace}
          />
        </div>
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
              {usingFixture && !groupId && !friendId ? (
                <p>No group yet — create one in Profile</p>
              ) : null}
              {usingFixture && (groupId || friendId) ? <p>Local fixture</p> : null}
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
