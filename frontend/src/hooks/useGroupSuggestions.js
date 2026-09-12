import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchGroupSuggestions } from "../api/client.js";
import { withDistance } from "../utils/distance.js";

/**
 * Uncovered catalog places for the group, nearest-first when origin is known.
 */
export function useGroupSuggestions({
  groupId,
  enabled = true,
  limit = 24,
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
      const payload = await fetchGroupSuggestions(groupId, { limit });
      setRaw(Array.isArray(payload?.suggestions) ? payload.suggestions : []);
    } catch (err) {
      setError(err.message || "Failed to load suggestions");
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
