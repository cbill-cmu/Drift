import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import { suggestionId } from "../utils/suggestions.js";

const PIN = L.divIcon({
  className: "suggestion-pin",
  html: '<span class="suggestion-pin-mark"></span>',
  iconSize: [22, 28],
  iconAnchor: [11, 28],
  tooltipAnchor: [0, -22],
});

const PIN_SELECTED = L.divIcon({
  className: "suggestion-pin suggestion-pin-selected",
  html: '<span class="suggestion-pin-mark"></span>',
  iconSize: [26, 32],
  iconAnchor: [13, 32],
  tooltipAnchor: [0, -26],
});

const YOU = L.divIcon({
  className: "you-pin",
  html: '<span class="you-pin-dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  tooltipAnchor: [0, -10],
});

/**
 * Catalog suggestion markers + optional live "You" pin.
 * Lives inside MapContainer so Leaflet has a map context.
 */
export default function SuggestionPins({
  items = [],
  origin = null,
  selectedId = null,
  onSelectPlace,
}) {
  const pins = (items || []).filter(
    (item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)
  );

  return (
    <>
      {origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng) ? (
        <Marker position={[origin.lat, origin.lng]} icon={YOU} zIndexOffset={800} keyboard={false}>
          <Tooltip direction="top" offset={[0, -6]} opacity={1}>
            You
          </Tooltip>
        </Marker>
      ) : null}

      {pins.map((item) => {
        const id = suggestionId(item);
        const selected = selectedId === id;
        return (
          <Marker
            key={id}
            position={[item.lat, item.lng]}
            icon={selected ? PIN_SELECTED : PIN}
            zIndexOffset={selected ? 900 : 650}
            eventHandlers={{
              click: () =>
                onSelectPlace?.({
                  location_name: item.name,
                  activity_type: item.place_type,
                  lat: item.lat,
                  lng: item.lng,
                  h3_cell: item.h3_cell,
                  place_id: item.place_id,
                }),
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -8]}
              opacity={1}
              permanent={selected}
            >
              {item.distance_label ? `${item.name} · ${item.distance_label}` : item.name}
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
