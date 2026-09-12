import { useState } from "react";
import DiscoveryReveal from "./DiscoveryReveal.jsx";
import GroupMapView from "./GroupMapView.jsx";
import NeighborhoodStats from "./NeighborhoodStats.jsx";
import TripLoggerModal from "./TripLoggerModal.jsx";
import { useAuthStatus } from "../hooks/useAuth0.js";

/**
 * App shell: map + sidebar + trip logger + discovery toast.
 */
export default function Layout({ groupId }) {
  const {
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    user,
    error,
  } = useAuthStatus();
  const [showTripLogger, setShowTripLogger] = useState(false);
  const [discoveryData, setDiscoveryData] = useState(null);
  const [neighborhoods, setNeighborhoods] = useState({});
  const [loginError, setLoginError] = useState(null);

  async function handleLogin() {
    setLoginError(null);
    try {
      await loginWithRedirect({
        authorizationParams: {
          redirect_uri: window.location.origin,
          audience: import.meta.env.VITE_AUTH0_AUDIENCE || undefined,
        },
      });
    } catch (err) {
      console.error("[Auth0] loginWithRedirect failed:", err);
      setLoginError(err?.message || String(err));
    }
  }

  if (isLoading) {
    return (
      <div className="login-gate">
        <h1>Drift</h1>
        <p>Checking login…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="login-gate">
        <h1>Drift</h1>
        <p>Log in to open your group map.</p>
        <button type="button" onClick={handleLogin}>
          Log in with Auth0
        </button>
        {(error || loginError) && (
          <p className="error">{error?.message || loginError}</p>
        )}
        <p className="hint">
          If nothing happens, open DevTools (F12) → Console and click again.
        </p>
      </div>
    );
  }

  return (
    <div className="layout">
      <main className="layout-main">
        <GroupMapView
          groupId={groupId}
          onNeighborhoods={setNeighborhoods}
        />
      </main>
      <aside className="layout-aside">
        <header className="aside-header">
          <strong>Drift</strong>
          <span>{user?.name || user?.email || "Signed in"}</span>
        </header>
        <NeighborhoodStats neighborhoods={neighborhoods} />
        <button type="button" onClick={() => setShowTripLogger(true)}>
          Log trip
        </button>
      </aside>
      <TripLoggerModal
        isOpen={showTripLogger}
        groupId={groupId}
        onClose={() => setShowTripLogger(false)}
        onSubmitSuccess={(data) => {
          setShowTripLogger(false);
          setDiscoveryData(data);
        }}
      />
      <DiscoveryReveal
        discoveryData={discoveryData}
        onDismiss={() => setDiscoveryData(null)}
      />
    </div>
  );
}
