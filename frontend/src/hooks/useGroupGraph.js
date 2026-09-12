import { useCallback, useEffect, useState } from "react";
import { fetchFriendGraph, fetchGroupGraph } from "../api/client.js";
import { normalizeGraph } from "../api/normalizeGraph.js";
import groupGraphFixture from "../../../shared/fixtures/graph-response.json";

function getFixtureFriendGraph() {
  return null;
}

/**
 * Load the graph currently on the map from the API.
 * Falls back to seeded fixture when the API is down or rejects (local demo).
 */
export function useMapGraph({ groupId, friendId, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usingFixture, setUsingFixture] = useState(false);

  const reload = useCallback(async () => {
    if (!friendId && !groupId) return;
    setLoading(true);
    setError(null);
    try {
      const raw = friendId
        ? await fetchFriendGraph(friendId, groupId)
        : await fetchGroupGraph(groupId);
      if (raw?.success === false) {
        throw new Error(raw.error || "Failed to load graph");
      }
      setData(normalizeGraph(raw));
      setUsingFixture(false);
    } catch (err) {
      const message = err.message || "Failed to load graph";
      if (friendId) {
        const fixture = getFixtureFriendGraph(friendId);
        if (fixture) {
          setData(normalizeGraph(fixture));
          setUsingFixture(true);
          setError(message);
          return;
        }
      } else if (groupGraphFixture) {
        setData(normalizeGraph(groupGraphFixture));
        setUsingFixture(true);
        setError(message);
        return;
      }
      setData(null);
      setUsingFixture(false);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [groupId, friendId, refreshKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, usingFixture };
}

export function useGroupGraph(groupId) {
  return useMapGraph({ groupId, friendId: null });
}
