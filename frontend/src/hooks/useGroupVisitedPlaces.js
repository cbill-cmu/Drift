import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchGroupVisitedPlaces } from "../api/client.js";
import { withDistance } from "../utils/distance.js";

const POLL_MS = 15000;

/**
 * Catalog places inside cells the group HAS visited (unshaded/revealed
 * hexes) — the mirror of useGroupSuggestions, feeding the Places tab.
 */
export function useGroupVisitedPlaces({
  groupId,
  enabled = true,
  limit = 40,
  origin = null,
  refreshKey = 0,
} = {}) {
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!enabled || !groupId) {
      setRaw([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchGroupVisitedPlaces(groupId, { limit });
      setRaw(Array.isArray(payload?.places) ? payload.places : []);
    } catch (err) {
      setError(err.message || "Failed to load visited places");
    } finally {
      setLoading(false);
    }
  }, [enabled, groupId, limit]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  // Poll like useVisitedCells/useGroupCoverage so the Places tab picks up
  // newly-visited cells while a walk is still in progress, not just
  // ~1.2s after tracking stops (refreshKey's trigger).
  useEffect(() => {
    if (!enabled || !groupId) return undefined;
    const id = setInterval(reload, POLL_MS);
    function onVisible() {
      if (!document.hidden) reload();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, groupId, reload]);

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
