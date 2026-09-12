import { useEffect, useMemo, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { latLngToCell } from "h3-js";
import { getBasemap } from "../utils/basemap.js";
import { FOG_STORED_RESOLUTION } from "../utils/fogGeoJSON.js";
import { cellIdSet, suggestionId } from "../utils/suggestions.js";
import FogOverlayLayer from "./FogOverlayLayer.jsx";
import MapZoomControl from "./MapZoomControl.jsx";
import SuggestionPins from "./SuggestionPins.jsx";

const PITTSBURGH = [40.4406, -79.9959];
const BASEMAP = getBasemap();

function FitGraphBounds({ points, resetKey }) {
  const map = useMap();
  const fittedForKey = useRef(null);
  const userMoved = useRef(false);
  const ignoreMove = useRef(false);

  useEffect(() => {
    fittedForKey.current = null;
    userMoved.current = false;
  }, [resetKey]);

  useEffect(() => {
    const markUser = () => {
      if (!ignoreMove.current) userMoved.current = true;
    };
    map.on("zoomstart", markUser);
    map.on("dragstart", markUser);
    return () => {
      map.off("zoomstart", markUser);
      map.off("dragstart", markUser);
    };
  }, [map]);

  useEffect(() => {
    if (!points.length || userMoved.current) return undefined;
    if (fittedForKey.current === resetKey) return undefined;
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    if (!b.isValid()) return undefined;
    ignoreMove.current = true;
    map.fitBounds(b.pad(0.16), { animate: false, maxZoom: 14 });
    fittedForKey.current = resetKey;
    const unlock = window.setTimeout(() => {
      ignoreMove.current = false;
    }, 0);
    return () => window.clearTimeout(unlock);
  }, [map, points, resetKey]);

  return null;
}

function MapSizeSync({ width, height }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map, width, height]);
  return null;
}

function FlyToPlace({ place }) {
  const map = useMap();
  useEffect(() => {
    if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return;
    const nextZoom = Math.max(map.getZoom(), 15);
    map.flyTo([place.lat, place.lng], nextZoom, { duration: 0.55 });
  }, [map, place?.lat, place?.lng, place?.place_id, place?.h3_cell]);
  return null;
}

/**
 * Full-bleed soft city map + Drift graph overlay.
 */
export default function GraphMap({
  graph,
  width,
  height,
  selectedNodeId,
  onSelectNode,
  visitedCells = [],
  fogMode = "personal",
  everyoneCells = [],
  someCells = [],
  suggestions = [],
  origin = null,
  selectedSuggestion = null,
  onSelectSuggestion,
  viewKey = "default",
}) {
  const nodes = useMemo(
    () =>
      (graph?.nodes || []).filter(
        (n) => Number.isFinite(n.lat) && Number.isFinite(n.lng)
      ),
    [graph]
  );

  const nodeById = useMemo(() => {
    const m = new Map();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const edges = useMemo(() => {
    const lines = [];
    for (const e of graph?.edges || []) {
      const a = nodeById.get(e.from);
      const b = nodeById.get(e.to);
      if (!a || !b) continue;
      lines.push({
        id: e.id,
        count: e.count || 1,
        positions: [
          [a.lat, a.lng],
          [b.lat, b.lng],
        ],
      });
    }
    return lines.sort((a, b) => b.count - a.count).slice(0, 48);
  }, [graph, nodeById]);

  const labeled = useMemo(() => {
    const explored =
      fogMode === "group"
        ? cellIdSet([...everyoneCells, ...someCells])
        : cellIdSet(visitedCells);
    return [...nodes]
      .filter((node) => {
        try {
          return !explored.has(latLngToCell(node.lat, node.lng, FOG_STORED_RESOLUTION));
        } catch {
          return true;
        }
      })
      .sort((a, b) => (b.visits || 0) - (a.visits || 0))
      .slice(0, 40);
  }, [nodes, fogMode, visitedCells, everyoneCells, someCells]);

  const openSuggestions = useMemo(() => {
    const explored = cellIdSet(visitedCells);
    return (suggestions || []).filter((item) => !item.h3_cell || !explored.has(item.h3_cell));
  }, [suggestions, visitedCells]);

  const fitPoints = useMemo(
    () => nodes.map((node) => ({ lat: node.lat, lng: node.lng })),
    [nodes]
  );

  if (!graph || width < 8 || height < 8) {
    return (
      <div
        className="graph-map graph-map-empty"
        style={{ width: width || "100%", height: height || "100%" }}
      />
    );
  }

  return (
    <div className="graph-map" style={{ width, height }}>
      <MapContainer
        key={`drift-map-${BASEMAP.id}`}
        center={PITTSBURGH}
        zoom={13}
        minZoom={11}
        maxZoom={BASEMAP.maxZoom}
        zoomSnap={1}
        wheelPxPerZoomLevel={120}
        className="drift-leaflet"
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
        attributionControl
      >
        <TileLayer
          url={BASEMAP.url}
          attribution={BASEMAP.attribution}
          maxZoom={BASEMAP.maxZoom}
          maxNativeZoom={BASEMAP.maxNativeZoom}
          {...(BASEMAP.subdomains ? { subdomains: BASEMAP.subdomains } : {})}
        />
        <MapZoomControl />
        <FogOverlayLayer
          mode={fogMode}
          cells={visitedCells}
          everyone={everyoneCells}
          some={someCells}
        />
        <FitGraphBounds points={fitPoints} resetKey={viewKey} />
        <MapSizeSync width={width} height={height} />
        <FlyToPlace place={selectedSuggestion} />
        <SuggestionPins
          items={openSuggestions}
          origin={origin}
          selectedId={suggestionId(selectedSuggestion)}
          onSelectPlace={onSelectSuggestion}
        />

        {edges.map((e) => (
          <Polyline
            key={e.id}
            positions={e.positions}
            pathOptions={{
              color: "#9ccfc0",
              weight: Math.min(3.2, 1.1 + Math.log2(e.count + 1) * 0.65),
              opacity: 0.42,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        ))}

        {labeled.map((node) => {
          const selected = node.id === selectedNodeId;
          return (
            <CircleMarker
              key={node.id}
              center={[node.lat, node.lng]}
              radius={selected ? 8 : 5.5}
              pathOptions={{
                color: "#ffffff",
                weight: 2.5,
                fillColor: selected ? "#f0b0bc" : "#c5e8dc",
                fillOpacity: 0.95,
              }}
              eventHandlers={{
                click: () => onSelectNode?.(node),
              }}
            >
              <Tooltip direction="right" offset={[8, 0]} opacity={1}>
                {node.name}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
