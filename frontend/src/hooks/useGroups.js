import { useCallback, useEffect, useState } from "react";
import { createGroup, fetchMyGroups, leaveGroup } from "../api/client.js";

const STORAGE_KEY = "drift.selectedGroupId";
const POLL_INTERVAL_MS = 15000;

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
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function useGroups(defaultGroupId, { enabled = true } = {}) {
  const fallbackId = defaultGroupId || "";
  const [groups, setGroups] = useState([]);
  const [selectedId, setSelectedId] = useState(() => readStoredGroupId());
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
        if (current && list.some((group) => group.id === current)) {
          return current;
        }
        if (fallbackId && list.some((group) => group.id === fallbackId)) {
          writeStoredGroupId(fallbackId);
          return fallbackId;
        }
        const next = list[0]?.id || "";
        writeStoredGroupId(next);
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

  // No push channel yet — poll so a group someone else added you to shows
  // up without a manual refresh, independent of the more immediate nudge
  // useGroupInvites.accept() fires via its onGroupsChanged callback.
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(reload, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, reload]);

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

  const leave = useCallback(
    async (groupId) => {
      const result = await leaveGroup(groupId);
      if (groupId === selectedId) {
        setSelectedId("");
        writeStoredGroupId("");
      }
      await reload();
      return result;
    },
    [reload, selectedId]
  );

  const selected = groups.find((group) => group.id === selectedId) || null;

  return {
    groups,
    selected,
    selectedId,
    loading,
    error,
    reload,
    select,
    create,
    leave,
  };
}
