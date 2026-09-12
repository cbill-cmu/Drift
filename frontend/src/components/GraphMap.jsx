import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cellToLatLng } from "h3-js";
import { boundsFromNodes } from "../utils/projection.js";
import { getBasemap } from "../utils/basemap.js";
import FogOverlayLayer from "./FogOverlayLayer.jsx";

const PITTSBURGH = [40.4406, -79.9959];
const BASEMAP = getBasemap();

function FitGraphBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    if (b.isValid()) {
      map.fitBounds(b.pad(0.16), { animate: false, maxZoom: 14 });
    }
  }, [map, points]);

  return null;
}

function MapSizeSync({ width, height }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map, width, height]);
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

  const labeled = useMemo(
    () =>
      [...nodes]
        .sort((a, b) => (b.visits || 0) - (a.visits || 0))
        .slice(0, 40),
    [nodes]
  );

  const fitPoints = useMemo(() => {
    const source =
      fogMode === "group" ? [...everyoneCells, ...someCells] : visitedCells || [];
    const fogPoints = [];
    for (const cell of source) {
      const id = typeof cell === "string" ? cell : cell?.h3_cell;
      if (!id) continue;
      try {
        const [lat, lng] = cellToLatLng(id);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          fogPoints.push({ lat, lng });
        }
      } catch {
        /* skip invalid indexes */
      }
    }
    const all = [...nodes, ...fogPoints];
    const b = boundsFromNodes(all);
    return [
      { lat: b.south, lng: b.west },
      { lat: b.north, lng: b.east },
      ...all,
    ];
  }, [nodes, visitedCells, fogMode, everyoneCells, someCells]);

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
        <ZoomControl position="bottomright" />
        <FogOverlayLayer
          mode={fogMode}
          cells={visitedCells}
          everyone={everyoneCells}
          some={someCells}
        />
        <FitGraphBounds points={fitPoints} />
        <MapSizeSync width={width} height={height} />

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
