import { useCallback, useEffect, useState } from "react";
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
  const { isAuthenticated, loginWithRedirect, user, isConfigured } = useAuthStatus();
  const [showTripLogger, setShowTripLogger] = useState(false);
  const [discoveryData, setDiscoveryData] = useState(null);
  const [activeTab, setActiveTab] = useState("locations");
  const [activeFriend, setActiveFriend] = useState(null);
  const [displayedGraph, setDisplayedGraph] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  if (isConfigured && !isAuthenticated) {
    return (
      <div className="login-gate">
        <h1>Drift</h1>
        <p>Log in to open your group map.</p>
        <button type="button" className="btn-sun" onClick={() => loginWithRedirect()}>
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
          <span>{user?.name || user?.email || "Dev mode (no Auth0)"}</span>
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
          {activeTab === "locations" ? (
            <NeighborhoodStats
              neighborhoods={displayedGraph?.neighborhoods}
              nodes={displayedGraph?.nodes}
              selectedNodeId={selectedNode?.id}
              onSelectNode={setSelectedNode}
            />
          ) : (
            <FriendsPanel
              onViewMap={viewFriend}
              activeFriendId={activeFriend?.id}
              members={displayedGraph?.members}
            />
          )}
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
