import { useState } from "react";
import { postTrip } from "../api/client.js";

/**
 * Submit a trip and return discovery payload for DiscoveryReveal.
 */
export function useTrip() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function submitTrip(payload) {
    setLoading(true);
    setError(null);
    try {
      const result = await postTrip(payload);
      if (!result?.success) {
        throw new Error(result?.error || "Trip failed");
      }
      return result;
    } catch (err) {
      setError(err.message || "Trip request failed");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { submitTrip, loading, error };
}
