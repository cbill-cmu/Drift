import { useCallback, useEffect, useState } from "react";
import { readAddFriendParam } from "../utils/friendInvite.js";
import DiscoveryReveal from "./DiscoveryReveal.jsx";
import FriendsPanel from "./FriendsPanel.jsx";
import GroupMapView from "./GroupMapView.jsx";
import NeighborhoodStats from "./NeighborhoodStats.jsx";
import TripLoggerModal from "./TripLoggerModal.jsx";
import { useAuthStatus } from "../hooks/useAuth0.js";

const TABS = [
  { id: "locations", label: "Locations" },
  { id: "friends", label: "Friends" },
];

/**
 * App shell: map + sidebar + trip logger + discovery toast.
 */
export default function Layout({ groupId }) {
  const {
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    user,
    error,
  } = useAuthStatus();
  const [showTripLogger, setShowTripLogger] = useState(false);
  const [discoveryData, setDiscoveryData] = useState(null);
  const [activeTab, setActiveTab] = useState(() =>
    readAddFriendParam() ? "friends" : "locations"
  );
  const [activeFriend, setActiveFriend] = useState(null);
  const [displayedGraph, setDisplayedGraph] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loginError, setLoginError] = useState(null);

  const handleGraph = useCallback((graph) => {
    setDisplayedGraph(graph);
  }, []);

  useEffect(() => {
    setSelectedNode(null);
  }, [activeFriend?.id]);

  function viewFriend(friend) {
    setActiveFriend(friend);
    setActiveTab("locations");
  }

  async function handleLogin() {
    setLoginError(null);
    try {
      await loginWithRedirect({
        appState: {
          returnTo: `${window.location.pathname}${window.location.search}`,
        },
        authorizationParams: {
          redirect_uri: window.location.origin,
          audience: import.meta.env.VITE_AUTH0_AUDIENCE || undefined,
          scope: "openid profile email",
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
        <button type="button" className="btn-sun" onClick={handleLogin}>
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
      <button
        type="button"
        className="logout-btn"
        onClick={() =>
          logout({
            logoutParams: { returnTo: window.location.origin },
          })
        }
      >
        Back to login
      </button>
      <main className="layout-main">
        <GroupMapView
          groupId={groupId}
          friendId={activeFriend?.id || null}
          onGraph={handleGraph}
          selectedNodeId={selectedNode?.id}
          onSelectNode={setSelectedNode}
          onBackToGroup={() => setActiveFriend(null)}
          refreshKey={refreshKey}
        />
      </main>
      <aside className="layout-aside">
        <header className="aside-header">
          <strong>Drift</strong>
          <span>{user?.name || user?.email || "Signed in"}</span>
          {activeFriend ? (
            <span className="hint">Viewing {activeFriend.display_name}</span>
          ) : null}
        </header>
        <div className="sidebar-tabs" role="tablist" aria-label="Sidebar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "tab tab-active" : "tab"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="sidebar-tab-body">
          <div className={activeTab === "locations" ? undefined : "is-hidden"}>
            <NeighborhoodStats
              neighborhoods={displayedGraph?.neighborhoods}
              nodes={displayedGraph?.nodes}
              selectedNodeId={selectedNode?.id}
              onSelectNode={setSelectedNode}
            />
          </div>
          <div className={activeTab === "friends" ? undefined : "is-hidden"}>
            <FriendsPanel
              onViewMap={viewFriend}
              activeFriendId={activeFriend?.id}
            />
          </div>
        </div>
        <button type="button" className="btn-sun" onClick={() => setShowTripLogger(true)}>
          Log trip
        </button>
      </aside>
      <TripLoggerModal
        isOpen={showTripLogger}
        groupId={groupId}
        nodes={displayedGraph?.nodes || []}
        onClose={() => setShowTripLogger(false)}
        onSubmitSuccess={(data) => {
          setShowTripLogger(false);
          setDiscoveryData(data);
          setRefreshKey((n) => n + 1);
        }}
      />
      <DiscoveryReveal
        discoveryData={discoveryData}
        onDismiss={() => setDiscoveryData(null)}
      />
    </div>
  );
}
