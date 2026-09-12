import { useEffect, useMemo, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import {
  buildPersonalFogGeoJSON,
  buildVisitedCellGeoJSON,
  cellList,
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

const EVERYONE_STYLE = {
  stroke: true,
  color: "#3f8f86",
  weight: 1.15,
  fillColor: "#6db3a8",
  fillOpacity: 0.58,
  fill: true,
};

const SOME_STYLE = {
  stroke: true,
  color: "#6db3a8",
  weight: 1.05,
  dashArray: "5 7",
  fillColor: "#ade5ce",
  fillOpacity: 0.28,
  fill: true,
  className: "fog-tier-some",
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

function HatchPattern() {
  useEffect(() => {
    if (document.getElementById("drift-some-hatch")) return undefined;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.style.position = "absolute";
    svg.style.width = "0";
    svg.style.height = "0";
    svg.innerHTML =
      '<defs><pattern id="drift-some-hatch" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(38)"><rect width="9" height="9" fill="#ade5ce" fill-opacity="0.2"/><line x1="0" y1="0" x2="0" y2="9" stroke="#6db3a8" stroke-width="3"/></pattern></defs>';
    document.body.appendChild(svg);
    return undefined;
  }, []);
  return null;
}

/**
 * Fog-of-war overlay.
 * personal — gray mask with visited hexes punched clear
 * group — gray "no one" mask; mint fill for everyone; hatched mint for some
 */
export default function FogOverlayLayer({
  mode = "personal",
  cells = [],
  everyone = [],
  some = [],
}) {
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

  const holeCells = useMemo(() => {
    if (mode === "group") return cellList([...everyone, ...some]);
    return cellList(cells);
  }, [mode, cells, everyone, some]);

  const visibleHoles = useMemo(
    () => filterCellsInBounds(holeCells, view.bbox),
    [holeCells, view.bbox]
  );

  const visibleEveryone = useMemo(
    () => filterCellsInBounds(cellList(everyone), view.bbox),
    [everyone, view.bbox]
  );

  const visibleSome = useMemo(
    () => filterCellsInBounds(cellList(some), view.bbox),
    [some, view.bbox]
  );

  const fog = useMemo(
    () => buildPersonalFogGeoJSON(visibleHoles, view.ring),
    [visibleHoles, view.ring]
  );

  const everyoneGeo = useMemo(
    () => buildVisitedCellGeoJSON(visibleEveryone),
    [visibleEveryone]
  );

  const someGeo = useMemo(
    () => buildVisitedCellGeoJSON(visibleSome),
    [visibleSome]
  );

  const revealed = useMemo(
    () =>
      mode === "personal" && view.zoom >= REVEAL_MIN_ZOOM
        ? buildVisitedCellGeoJSON(visibleHoles)
        : { type: "FeatureCollection", features: [] },
    [mode, visibleHoles, view.zoom]
  );

  const fogKey = `${mode}|${view.ring.map((p) => p.map((n) => n.toFixed(4)).join(",")).join("|")}|${visibleHoles.length}`;

  return (
    <>
      <HatchPattern />
      <FogPane renderer={renderer} />
      <GeoJSON
        key={`fog-${fogKey}`}
        data={fog}
        pane="fog"
        interactive={false}
        style={FOG_STYLE}
        renderer={renderer}
      />
      {mode === "group" && someGeo.features.length ? (
        <GeoJSON
          key={`some-${fogKey}`}
          data={someGeo}
          interactive={false}
          style={SOME_STYLE}
        />
      ) : null}
      {mode === "group" && everyoneGeo.features.length ? (
        <GeoJSON
          key={`everyone-${fogKey}`}
          data={everyoneGeo}
          interactive={false}
          style={EVERYONE_STYLE}
        />
      ) : null}
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
