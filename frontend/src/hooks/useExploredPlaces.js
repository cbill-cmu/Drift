import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMyExploredPlaces } from "../api/client.js";
import { withDistance } from "../utils/distance.js";

const POLL_MS = 15000;

/**
 * Catalog places that sit inside the current user's visited H3 cells.
 */
export function useExploredPlaces({ enabled = true, origin = null, refreshKey = 0 } = {}) {
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setRaw([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchMyExploredPlaces();
      setRaw(Array.isArray(payload?.places) ? payload.places : []);
    } catch (err) {
      setError(err.message || "Failed to load explored places");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(reload, POLL_MS);
    function onVisible() {
      if (!document.hidden) reload();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, reload]);

  const originLat = origin?.lat;
  const originLng = origin?.lng;
  const items = useMemo(
    () =>
      withDistance(
        raw,
        Number.isFinite(originLat) && Number.isFinite(originLng)
          ? { lat: originLat, lng: originLng }
          : null
      ),
    [raw, originLat, originLng]
  );

  return { items, loading, error, reload };
}
