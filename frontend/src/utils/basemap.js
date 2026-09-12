/**
 * Basemap picker: Carto Positron when VITE_CARTO_API_KEY is set (zoom 19,
 * no watermark). Falls back to the original Esri light-gray tiles so an
 * empty key never shows Carto's "API KEY REQUIRED" overlay.
 */

const CARTO_STYLES = {
  positron: "light_all",
  voyager: "rastertiles/voyager",
  dark_matter: "dark_all",
};

const CARTO_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const ESRI_GRAY_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const ESRI_GRAY_ATTR =
  "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ";

export function getBasemap() {
  const key = String(import.meta.env.VITE_CARTO_API_KEY || "").trim();
  const styleName = String(import.meta.env.VITE_CARTO_STYLE || "positron").trim();
  const style = CARTO_STYLES[styleName] || CARTO_STYLES.positron;

  if (key) {
    return {
      id: "carto",
      url: `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`,
      attribution: CARTO_ATTR,
      subdomains: "abcd",
      maxZoom: 19,
      maxNativeZoom: 20,
    };
  }

  return {
    id: "esri-gray",
    url: ESRI_GRAY_TILES,
    attribution: ESRI_GRAY_ATTR,
    subdomains: undefined,
    maxZoom: 16,
    maxNativeZoom: 16,
  };
}
