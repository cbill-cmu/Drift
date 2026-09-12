import { useEffect, useMemo, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import {
  buildPersonalFogGeoJSON,
  buildVisitedCellGeoJSON,
  filterCellsInBounds,
  lngLatRingFromBBox,
} from "../utils/fogGeoJSON.js";

const FOG_STYLE = {
  stroke: false,
  fillColor: "#172424",
  fillOpacity: 0.62,
  fillRule: "evenodd",
};

const REVEAL_STYLE = {
  color: "#6db3a8",
  weight: 1.15,
  opacity: 0.55,
  fill: false,
};

const REVEAL_MIN_ZOOM = 15;

function snapshotView(map) {
  const padded = map.getBounds().pad(0.35);
  const bbox = {
    west: padded.getWest(),
    south: padded.getSouth(),
    east: padded.getEast(),
    north: padded.getNorth(),
  };
  return {
    zoom: map.getZoom(),
    bbox,
    ring: lngLatRingFromBBox(bbox),
  };
}

function FogPane({ renderer }) {
  const map = useMap();
  if (!map.getPane("fog")) {
    map.createPane("fog");
  }
  const pane = map.getPane("fog");
  pane.style.zIndex = "350";
  pane.style.pointerEvents = "none";
  if (renderer?.options) {
    renderer.options.pane = "fog";
  }
  return null;
}

/**
 * Personal fog-of-war: unvisited area is a translucent gray mask;
 * visited H3 cells in the current view are punched clear.
 *
 * The outer ring is the padded viewport (not the whole planet) so close
 * zoom stays cheap for Leaflet.
 */
export default function FogOverlayLayer({ cells = [] }) {
  const map = useMap();
  const [view, setView] = useState(() => snapshotView(map));
  const renderer = useMemo(() => L.canvas({ padding: 0.8, pane: "fog" }), []);

  useEffect(() => {
    const onView = () => setView(snapshotView(map));
    map.on("moveend", onView);
    map.on("zoomend", onView);
    return () => {
      map.off("moveend", onView);
      map.off("zoomend", onView);
    };
  }, [map]);

  const visible = useMemo(
    () => filterCellsInBounds(cells, view.bbox),
    [cells, view.bbox]
  );

  const fog = useMemo(
    () => buildPersonalFogGeoJSON(visible, view.ring),
    [visible, view.ring]
  );

  const revealed = useMemo(
    () => (view.zoom >= REVEAL_MIN_ZOOM ? buildVisitedCellGeoJSON(visible) : { type: "FeatureCollection", features: [] }),
    [visible, view.zoom]
  );

  const fogKey = `${view.ring.map((p) => p.map((n) => n.toFixed(4)).join(",")).join("|")}|${visible.length}`;

  return (
    <>
      <FogPane renderer={renderer} />
      <GeoJSON
        key={`fog-${fogKey}`}
        data={fog}
        pane="fog"
        interactive={false}
        style={FOG_STYLE}
        renderer={renderer}
      />
      {revealed.features.length ? (
        <GeoJSON
          key={`reveal-${fogKey}`}
          data={revealed}
          pane="fog"
          interactive={false}
          style={REVEAL_STYLE}
          renderer={renderer}
        />
      ) : null}
    </>
  );
}
