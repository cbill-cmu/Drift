import { useCallback, useEffect, useState } from "react";
import { fetchGroupCoverage } from "../api/client.js";

const POLL_MS = 15000;

/**
 * Load everyone/some H3 cells for the selected group's coverage overlay.
 */
export function useGroupCoverage({ groupId, enabled = true, refreshKey = 0 } = {}) {
  const [everyone, setEveryone] = useState([]);
  const [some, setSome] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!enabled || !groupId) {
      setEveryone([]);
      setSome([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchGroupCoverage(groupId);
      setEveryone(Array.isArray(raw?.everyone) ? raw.everyone : []);
      setSome(Array.isArray(raw?.some) ? raw.some : []);
    } catch (err) {
      setError(err.message || "Failed to load group coverage");
    } finally {
      setLoading(false);
    }
  }, [enabled, groupId]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

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

  return { everyone, some, loading, error, reload };
}
