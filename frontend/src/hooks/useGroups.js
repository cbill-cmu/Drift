import { useCallback, useEffect, useState } from "react";
import { createGroup, fetchMyGroups } from "../api/client.js";

const STORAGE_KEY = "drift.selectedGroupId";

function readStoredGroupId() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function writeStoredGroupId(id) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
}

export function useGroups(defaultGroupId, { enabled = true } = {}) {
  const fallbackId = defaultGroupId || "";
  const [groups, setGroups] = useState([]);
  const [selectedId, setSelectedId] = useState(() => readStoredGroupId() || fallbackId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const select = useCallback((id) => {
    const next = String(id || "").trim();
    if (!next) return;
    setSelectedId(next);
    writeStoredGroupId(next);
  }, []);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyGroups();
      const list = data?.groups || [];
      setGroups(list);
      setSelectedId((current) => {
        if (current && (list.some((group) => group.id === current) || current === fallbackId)) {
          return current;
        }
        const next = list[0]?.id || fallbackId;
        if (next) writeStoredGroupId(next);
        return next;
      });
    } catch (err) {
      setGroups([]);
      setError(err.message || "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }, [enabled, fallbackId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    async (name) => {
      const result = await createGroup(name);
      const created = result?.group;
      await reload();
      if (created?.id) select(created.id);
      return result;
    },
    [reload, select]
  );

  const selected = groups.find((group) => group.id === selectedId) || null;

  return {
    groups,
    selected,
    selectedId: selectedId || fallbackId,
    loading,
    error,
    reload,
    select,
    create,
  };
}
