import Layout from "./components/Layout.jsx";
import { setAuthEmailGetter, setAuthTokenGetter } from "./api/client.js";
import { useAuthStatus } from "./hooks/useAuth0.js";
import { useLayoutEffect } from "react";

const GROUP_ID = String(import.meta.env.VITE_DEMO_GROUP_ID || "").trim();

/**
 * Root app (Person 2).
 */
export default function App() {
  const { getAccessTokenSilently, isConfigured, loginWithRedirect, user } = useAuthStatus();

  useLayoutEffect(() => {
    setAuthTokenGetter(async () => {
      if (!isConfigured) return "dev-local";
      try {
        return await getAccessTokenSilently();
      } catch (err) {
        // Silent renewal failed (expired session, blocked 3rd-party cookie,
        // no refresh token yet, etc.). Log it — a bare null here is what
        // makes every API call fail as a confusing 401 "missing bearer
        // token" instead of an obvious auth problem — and send the user
        // back through login rather than leaving requests silently broken.
        console.warn("[auth] getAccessTokenSilently failed:", err?.error || err?.message || err);
        if (err?.error === "login_required" || err?.error === "consent_required") {
          loginWithRedirect();
        }
        return null;
      }
    });
    setAuthEmailGetter(async () => user?.email || null);
    return () => {
      setAuthTokenGetter(async () => null);
      setAuthEmailGetter(async () => null);
    };
  }, [getAccessTokenSilently, isConfigured, loginWithRedirect, user?.email]);

  return <Layout defaultGroupId={GROUP_ID} />;
}
