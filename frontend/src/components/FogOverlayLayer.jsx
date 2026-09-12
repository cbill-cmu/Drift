import { useMemo } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import { buildPersonalFogGeoJSON, buildVisitedCellGeoJSON } from "../utils/fogGeoJSON.js";

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

function FogPane() {
  const map = useMap();
  if (!map.getPane("fog")) {
    map.createPane("fog");
  }
  const pane = map.getPane("fog");
  pane.style.zIndex = "350";
  pane.style.pointerEvents = "none";
  return null;
}

/**
 * Personal fog-of-war: unvisited area is a translucent gray mask;
 * visited H3 cells are punched clear so the basemap shows through.
 */
export default function FogOverlayLayer({ cells = [] }) {
  const signature = useMemo(
    () =>
      cells
        .map((c) => (typeof c === "string" ? c : c.h3_cell))
        .filter(Boolean)
        .sort()
        .join(","),
    [cells]
  );

  const fog = useMemo(() => buildPersonalFogGeoJSON(cells), [cells]);
  const revealed = useMemo(() => buildVisitedCellGeoJSON(cells), [cells]);

  return (
    <>
      <FogPane />
      <GeoJSON
        key={`fog-${signature || "empty"}`}
        data={fog}
        pane="fog"
        interactive={false}
        style={FOG_STYLE}
        className="fog-mask"
      />
      {revealed.features.length ? (
        <GeoJSON
          key={`reveal-${signature}`}
          data={revealed}
          pane="fog"
          interactive={false}
          style={REVEAL_STYLE}
          className="fog-reveal"
        />
      ) : null}
    </>
  );
}
