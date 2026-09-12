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
  const { isAuthenticated, loginWithRedirect, user, isConfigured } = useAuthStatus();
  const [showTripLogger, setShowTripLogger] = useState(false);
  const [discoveryData, setDiscoveryData] = useState(null);
  const [neighborhoods, setNeighborhoods] = useState({});

  if (isConfigured && !isAuthenticated) {
    return (
      <div className="login-gate">
        <h1>Drift</h1>
        <p>Log in to open your group map.</p>
        <button type="button" onClick={() => loginWithRedirect()}>
          Log in with Auth0
        </button>
        <p className="hint">Person 3 must finish shared/auth0-setup.md first.</p>
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
          <span>{user?.name || user?.email || "Dev mode (no Auth0)"}</span>
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
