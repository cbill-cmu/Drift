import { useCallback, useEffect, useState } from "react";
import { fetchMyVisitedCells } from "../api/client.js";

const POLL_MS = 15000;

/**
 * Load the current user's visited H3 cells for personal fog-of-war.
 * Polls so a tracking flush shows up without a full reload.
 */
export function useVisitedCells({ enabled = true, refreshKey = 0 } = {}) {
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchMyVisitedCells();
      setCells(Array.isArray(raw?.cells) ? raw.cells : []);
    } catch (err) {
      setError(err.message || "Failed to load visited cells");
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

  return { cells, loading, error, reload };
}
