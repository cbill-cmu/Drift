import { useMap } from "react-leaflet";

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 3.25a.75.75 0 0 1 .75.75v5.25H16a.75.75 0 0 1 0 1.5h-5.25V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4A.75.75 0 0 1 10 3.25z"
      />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10z"
      />
    </svg>
  );
}

export default function MapZoomControl() {
  const map = useMap();
  return (
    <div className="map-zoom" role="group" aria-label="Map zoom">
      <button type="button" aria-label="Zoom in" onClick={() => map.zoomIn()}>
        <PlusIcon />
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => map.zoomOut()}>
        <MinusIcon />
      </button>
    </div>
  );
}
