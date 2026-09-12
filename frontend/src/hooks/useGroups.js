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
        // Only keep `current` if it's a group we're actually in. Matching
        // it against `fallbackId` alone isn't enough — that env-var default
        // is only a hint for brand-new users with zero groups, and treating
        // it as always-valid got people stuck pointed at a deleted/seed-only
        // group forever (real membership never overrides it once selected).
        if (current && list.some((group) => group.id === current)) {
          return current;
        }
        const next = list[0]?.id || fallbackId;
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
    selectedId: selectedId || fallbackId,
    loading,
    error,
    reload,
    select,
    create,
    leave,
  };
}
