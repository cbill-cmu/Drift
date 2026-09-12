import { useCallback, useEffect, useState } from "react";
import { fetchGroupGraph } from "../api/client.js";

/**
 * Load group graph payload for the map.
 */
export function useGroupGraph(groupId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const graph = await fetchGroupGraph(groupId);
      setData(graph);
    } catch (err) {
      setError(err.message || "Failed to load graph");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
