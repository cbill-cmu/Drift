import Layout from "./components/Layout.jsx";
import { setAuthTokenGetter } from "./api/client.js";
import { useAuthStatus } from "./hooks/useAuth0.js";
import { useEffect } from "react";

const GROUP_ID =
  import.meta.env.VITE_DEMO_GROUP_ID || "6aa4d5b78c6341a27ed90e4b";

/**
 * Root app (Person 2).
 */
export default function App() {
  const { getAccessTokenSilently, isConfigured } = useAuthStatus();

  useEffect(() => {
    setAuthTokenGetter(async () => {
      if (!isConfigured) return "dev-local";
      try {
        return await getAccessTokenSilently();
      } catch {
        return null;
      }
    });
    return () => setAuthTokenGetter(async () => null);
  }, [getAccessTokenSilently, isConfigured]);

  return <Layout groupId={GROUP_ID} />;
}
