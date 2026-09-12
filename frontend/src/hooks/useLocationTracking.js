import { useCallback, useEffect, useRef, useState } from "react";
import { postLocationTrace } from "../api/client.js";
import { haversineMeters } from "../utils/haversine.js";
import { encodePolyline } from "../utils/polyline.js";

// See requirements.md §5 for the full spec and the reasoning behind these
// numbers (battery-usage tradeoff table).
const WATCH_OPTIONS = { enableHighAccuracy: false, maximumAge: 15000, timeout: 10000 };
const ACCEPT_DISTANCE_M = 25;
const ACCEPT_INTERVAL_MS = 30000;
const FLUSH_INTERVAL_MS = 60000;

/**
 * Continuous foreground location tracking (Phase 1 of the location-
 * tracking + fog-of-war pivot — see TASKS.md).
 *
 * - Permission is requested implicitly the first time `start()` calls
 *   watchPosition (not on cold app launch) — the browser handles the
 *   actual permission prompt.
 * - Foreground only: the watch pauses on `visibilitychange` to hidden
 *   (flushing whatever's buffered first) and resumes on visible. True
 *   background tracking needs a native wrapper — not attempted here,
 *   see requirements.md §5's honesty note.
 * - Client-side accept filter on top of watchPosition's own throttling:
 *   only keep a fix if it's moved >=25m or >=30s since the last accepted
 *   fix, to cut noise/duplicates before anything gets buffered.
 * - Accepted fixes buffer in memory and flush (encode -> POST) every 60s
 *   and immediately whenever the tab is hidden, so nothing is lost.
 *
 * Flush failures are caught and logged, not surfaced as user-facing
 * errors — losing a batch is an acceptable tradeoff vs unbounded retry.
 */
export function useLocationTracking() {
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);
  const [lastFix, setLastFix] = useState(null);
  const [bufferedCount, setBufferedCount] = useState(0);

  const watchIdRef = useRef(null);
  const bufferRef = useRef([]); // [{ lat, lng, t }]
  const lastAcceptedRef = useRef(null); // { lat, lng, t }
  const flushIntervalRef = useRef(null);
  const activeRef = useRef(false); // mirrors `active` for use in listeners

  const flush = useCallback(() => {
    const points = bufferRef.current;
    if (points.length === 0) return;

    const polyline = encodePolyline(points.map((p) => [p.lat, p.lng]));
    let distance_m = 0;
    for (let i = 1; i < points.length; i += 1) {
      distance_m += haversineMeters(
        points[i - 1].lat,
        points[i - 1].lng,
        points[i].lat,
        points[i].lng
      );
    }
    const payload = {
      polyline,
      started_at: new Date(points[0].t).toISOString(),
      ended_at: new Date(points[points.length - 1].t).toISOString(),
      point_count: points.length,
      distance_m: Math.round(distance_m),
    };

    // Clear the buffer optimistically — losing a batch to a failed
    // upload is an acceptable tradeoff at hackathon scale; holding it
    // and retrying indefinitely risks unbounded memory growth instead.
    bufferRef.current = [];
    setBufferedCount(0);

    postLocationTrace(payload)
      .then(() => {
        console.log("[location] flushed trace:", payload);
      })
      .catch((err) => {
        console.log("[location] flush failed:", err.message, payload);
      });
  }, []);

  const acceptFix = useCallback(
    (position) => {
      const { latitude: lat, longitude: lng } = position.coords;
      const t = position.timestamp || Date.now();
      const last = lastAcceptedRef.current;

      const accept =
        !last ||
        haversineMeters(last.lat, last.lng, lat, lng) >= ACCEPT_DISTANCE_M ||
        t - last.t >= ACCEPT_INTERVAL_MS;

      setLastFix({ lat, lng, t, accepted: accept });

      if (!accept) return;

      lastAcceptedRef.current = { lat, lng, t };
      bufferRef.current = [...bufferRef.current, { lat, lng, t }];
      setBufferedCount(bufferRef.current.length);
    },
    []
  );

  const clearWatchIfAny = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const beginWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }
    clearWatchIfAny();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setError(null);
        acceptFix(position);
      },
      (err) => {
        setError(err.message || "Location permission denied.");
        setActive(false);
        activeRef.current = false;
      },
      WATCH_OPTIONS
    );
  }, [acceptFix, clearWatchIfAny]);

  const start = useCallback(() => {
    setError(null);
    setActive(true);
    activeRef.current = true;
    beginWatch();
  }, [beginWatch]);

  const stop = useCallback(() => {
    setActive(false);
    activeRef.current = false;
    clearWatchIfAny();
    flush();
  }, [clearWatchIfAny, flush]);

  // Pause/resume on tab visibility — the honest ceiling for foreground-
  // only web tracking (see the module doc comment above).
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) {
        clearWatchIfAny();
        flush();
      } else if (activeRef.current) {
        beginWatch();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [beginWatch, clearWatchIfAny, flush]);

  // Periodic flush while active.
  useEffect(() => {
    if (!active) {
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
      return undefined;
    }
    flushIntervalRef.current = setInterval(flush, FLUSH_INTERVAL_MS);
    return () => {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    };
  }, [active, flush]);

  // Clean up the watch on unmount.
  useEffect(() => {
    return () => clearWatchIfAny();
  }, [clearWatchIfAny]);

  return { active, error, lastFix, bufferedCount, start, stop };
}
