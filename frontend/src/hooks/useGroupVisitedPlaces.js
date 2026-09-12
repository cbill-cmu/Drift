import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchGroupVisitedPlaces } from "../api/client.js";
import { withDistance } from "../utils/distance.js";

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
