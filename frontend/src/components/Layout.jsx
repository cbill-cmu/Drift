import { useCallback, useEffect, useState } from "react";
import { readAddFriendParam } from "../utils/friendInvite.js";
import DiscoveryReveal from "./DiscoveryReveal.jsx";
import FriendsPanel from "./FriendsPanel.jsx";
import GroupMapView from "./GroupMapView.jsx";
import GroupsPanel from "./GroupsPanel.jsx";
import NeighborhoodStats from "./NeighborhoodStats.jsx";
import TripLoggerModal from "./TripLoggerModal.jsx";
import { useAuthStatus } from "../hooks/useAuth0.js";
import { useGroups } from "../hooks/useGroups.js";

const NAV = [
  { id: "places", label: "Places", icon: "places" },
  { id: "friends", label: "Friends", icon: "friends" },
  { id: "profile", label: "Profile", icon: "profile" },
];

function NavIcon({ name }) {
  if (name === "places") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
        <path
          fill="currentColor"
          d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
        />
      </svg>
    );
  }
  if (name === "friends") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
        <path
          fill="currentColor"
          d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-8 0a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 8 11zm8 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm-8 1c-.29 0-.62.02-.97.05C5.27 14.4 2 15.54 2 17.5V19h6v-2c0-.7.2-2.14 2.03-3.2A11.4 11.4 0 0 0 8 14z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        fill="currentColor"
        d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5z"
      />
    </svg>
  );
}

/**
 * Soft product standard shell: full-bleed map + circular bottom nav.
 */
export default function Layout({ defaultGroupId }) {
  const {
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    user,
    error,
  } = useAuthStatus();
  const {
    groups,
    selected,
    selectedId,
    loading: groupsLoading,
    error: groupsError,
    reload: reloadGroups,
    select: selectGroup,
    create: createGroup,
  } = useGroups(defaultGroupId, { enabled: isAuthenticated });
  const groupId = selectedId || defaultGroupId;
  const [showTripLogger, setShowTripLogger] = useState(false);
  const [discoveryData, setDiscoveryData] = useState(null);
  const [sheet, setSheet] = useState(() =>
    readAddFriendParam() ? "friends" : null
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

  useEffect(() => {
    setActiveFriend(null);
    setSelectedNode(null);
    setDisplayedGraph(null);
  }, [groupId]);

  useEffect(() => {
    if (sheet === "profile" && isAuthenticated) reloadGroups();
  }, [sheet, isAuthenticated, reloadGroups]);

  const groupName =
    selected?.name ||
    displayedGraph?.group_name ||
    import.meta.env.VITE_DEMO_GROUP_NAME ||
    "CMU CREW";

  function viewFriend(friend) {
    setActiveFriend(friend);
    setSheet(null);
  }

  function toggleSheet(id) {
    setSheet((prev) => (prev === id ? null : id));
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
        <button type="button" className="btn-mint" onClick={handleLogin}>
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

  const sheetTitle =
    sheet === "friends"
      ? "Friends"
      : sheet === "profile"
        ? "Profile"
        : "Places";

  return (
    <div className="layout layout-map-first">
      <header className="map-topbar">
        <strong className="brand">Drift</strong>
        <span className="group-chip">{groupName}</span>
      </header>

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

      {sheet ? (
        <div className="soft-sheet" role="dialog" aria-label={sheetTitle}>
          <div className="soft-sheet-head">
            <strong>{sheetTitle}</strong>
            <button
              type="button"
              className="text-btn"
              onClick={() => setSheet(null)}
            >
              Close
            </button>
          </div>
          <div className="soft-sheet-body">
            {sheet === "friends" ? (
              <FriendsPanel
                groupId={groupId}
                groupName={groupName}
                onViewMap={viewFriend}
                activeFriendId={activeFriend?.id}
              />
            ) : null}
            {sheet === "places" ? (
              <NeighborhoodStats
                neighborhoods={displayedGraph?.neighborhoods}
                nodes={displayedGraph?.nodes}
                selectedNodeId={selectedNode?.id}
                onSelectNode={setSelectedNode}
              />
            ) : null}
            {sheet === "profile" ? (
              <section className="profile-sheet">
                <div className="profile-avatar" aria-hidden="true">
                  {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
                </div>
                <p className="profile-name">{user?.name || "You"}</p>
                <p className="hint">{user?.email}</p>
                <p className="profile-group">{groupName}</p>
                <GroupsPanel
                  groups={groups}
                  selectedId={groupId}
                  loading={groupsLoading}
                  error={groupsError}
                  onSelect={selectGroup}
                  onCreate={createGroup}
                />
                <button
                  type="button"
                  className="btn-paper profile-logout"
                  onClick={() =>
                    logout({
                      logoutParams: { returnTo: window.location.origin },
                    })
                  }
                >
                  Log out
                </button>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}

      <nav className="bottom-dock" aria-label="Main">
        <div className="dock-row">
          {NAV.map((item) => {
            const active = sheet === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={active ? "dock-circle dock-circle-active" : "dock-circle"}
                aria-pressed={active}
                aria-label={item.label}
                onClick={() => toggleSheet(item.id)}
              >
                <span className="dock-glyph">
                  <NavIcon name={item.icon} />
                </span>
                <span className="dock-label">{item.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="dock-fab"
          aria-label="Log trip"
          onClick={() => setShowTripLogger(true)}
        >
          <span className="dock-fab-plus" aria-hidden="true">
            +
          </span>
          <span>Log trip</span>
        </button>
      </nav>

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
