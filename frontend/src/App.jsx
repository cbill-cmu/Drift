import Layout from "./components/Layout.jsx";
import { setAuthEmailGetter, setAuthTokenGetter } from "./api/client.js";
import { useAuthStatus } from "./hooks/useAuth0.js";
import { useLayoutEffect } from "react";

const GROUP_ID =
  import.meta.env.VITE_DEMO_GROUP_ID || "6aa507373e4c8b8fc47e6428";

/**
 * Root app (Person 2).
 */
export default function App() {
  const { getAccessTokenSilently, isConfigured, user } = useAuthStatus();

  useLayoutEffect(() => {
    setAuthTokenGetter(async () => {
      if (!isConfigured) return "dev-local";
      try {
        return await getAccessTokenSilently();
      } catch {
        return null;
      }
    });
    setAuthEmailGetter(async () => user?.email || null);
    return () => {
      setAuthTokenGetter(async () => null);
      setAuthEmailGetter(async () => null);
    };
  }, [getAccessTokenSilently, isConfigured, user?.email]);

  return <Layout defaultGroupId={GROUP_ID} />;
}
