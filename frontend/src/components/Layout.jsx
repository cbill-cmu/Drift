import { useCallback, useEffect, useState } from "react";
import { ensureCurrentUser } from "../api/client.js";
import { readAddFriendParam } from "../utils/friendInvite.js";
import DiscoveryReveal from "./DiscoveryReveal.jsx";
import FriendsPanel from "./FriendsPanel.jsx";
import GroupMapView from "./GroupMapView.jsx";
import GroupsPanel from "./GroupsPanel.jsx";
import RecommendationsPanel from "./RecommendationsPanel.jsx";
import NeighborhoodStats from "./NeighborhoodStats.jsx";
import ProfileModal from "./ProfileModal.jsx";
import { useAuthStatus } from "../hooks/useAuth0.js";
import { useGroups } from "../hooks/useGroups.js";
import { useLocationTracking } from "../hooks/useLocationTracking.js";

const NAV = [
  { id: "places", label: "Places", icon: "places" },
  { id: "recs", label: "Recs", icon: "recs" },
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
  if (name === "recs") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
        <path
          fill="currentColor"
          d="M12 2.5 13.7 8h5.8l-4.7 3.4 1.8 5.6L12 13.8 7.4 17l1.8-5.6L4.5 8h5.8L12 2.5z"
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
  const {
    active: tracking,
    error: trackingError,
    bufferedCount: trackingBufferedCount,
    start: startTracking,
    stop: stopTracking,
  } = useLocationTracking();
  const [fogRefreshKey, setFogRefreshKey] = useState(0);
  const [fogMode, setFogMode] = useState("personal");
  // discoveryData/DiscoveryReveal is kept — it's a generic "show a reveal
  // toast" mechanism, not specific to manual trip logging. It'll be wired
  // to the GPS/fog-of-war pipeline (see TASKS.md) instead of a trip form.
  const [discoveryData, setDiscoveryData] = useState(null);
  const [sheet, setSheet] = useState(() =>
    readAddFriendParam() ? "friends" : null
  );
  const [activeFriend, setActiveFriend] = useState(null);
  const [displayedGraph, setDisplayedGraph] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loginError, setLoginError] = useState(null);
  const [account, setAccount] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Profile is auto-provisioned from the Auth0 identity on login (see
  // upsertCurrentUser on the backend) — no onboarding step to gate on here.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    ensureCurrentUser()
      .then((data) => {
        if (cancelled) return;
        setAccount(data?.user || null);
      })
      .catch((err) => {
        console.error("[auth] ensureCurrentUser failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.sub]);

  useEffect(() => {
    if (tracking) return undefined;
    const timer = setTimeout(() => {
      setFogRefreshKey((key) => key + 1);
    }, 1200);
    return () => clearTimeout(timer);
  }, [tracking]);

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

  const displayName = account?.display_name || user?.name || user?.email || "You";

  function viewFriend(friend) {
    if (activeFriend?.id === friend.id) {
      setActiveFriend(null);
      return;
    }
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
        : sheet === "recs"
          ? "Recommendations"
          : "Places";

  return (
    <div className="layout layout-map-first">
      <header className="map-topbar">
        <strong className="brand">Drift</strong>
        {/* Minimal control for now (Phase 1) — proper placement/styling is a
            follow-up polish pass, see TASKS.md. */}
        <button
          type="button"
          className="text-btn tracking-toggle"
          onClick={tracking ? stopTracking : startTracking}
        >
          <span
            className={
              tracking
                ? "status-island-dot status-island-dot-pulse"
                : "status-island-dot status-island-dot-warn"
            }
            aria-hidden="true"
          />
          {tracking ? `Tracking… (${trackingBufferedCount} buffered)` : "Start exploring"}
        </button>
        {trackingError ? <span className="error tracking-error">{trackingError}</span> : null}
        <div className="fog-mode-toggle" role="group" aria-label="Fog view">
          <button
            type="button"
            className={fogMode === "personal" ? "is-on" : ""}
            onClick={() => setFogMode("personal")}
          >
            You
          </button>
          <button
            type="button"
            className={fogMode === "group" ? "is-on" : ""}
            disabled={!groupId}
            onClick={() => setFogMode("group")}
          >
            Group
          </button>
        </div>
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
          fogRefreshKey={fogRefreshKey}
          fogMode={fogMode}
        />
      </main>

      {sheet ? (
        <div
          className={sheet === "places" ? "soft-sheet soft-sheet-compact" : "soft-sheet"}
          role="dialog"
          aria-label={sheetTitle}
        >
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
                onGroupsChanged={reloadGroups}
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
            {sheet === "recs" ? (
              <RecommendationsPanel
                groupId={groupId}
                onSelectPlace={(place) => {
                  const match = (displayedGraph?.nodes || []).find(
                    (node) => node.name?.toLowerCase() === place.location_name?.toLowerCase()
                  );
                  if (match) {
                    setSelectedNode(match);
                    setSheet(null);
                  }
                }}
              />
            ) : null}
            {sheet === "profile" ? (
              <section className="profile-sheet">
                <div className="profile-avatar" aria-hidden="true">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
                <p className="profile-name">{displayName}</p>
                <p className="hint">{user?.email}</p>
                <p className="profile-group">{groupName}</p>
                {activeFriend ? (
                  <p className="hint">Viewing {activeFriend.display_name}</p>
                ) : null}
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
                  className="btn-paper"
                  onClick={() => setShowSettings(true)}
                >
                  Account settings
                </button>
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
      </nav>

      <DiscoveryReveal
        discoveryData={discoveryData}
        onDismiss={() => setDiscoveryData(null)}
      />
      <ProfileModal
        isOpen={showSettings}
        user={account}
        onClose={() => setShowSettings(false)}
        onSaved={(profile) => {
          setAccount(profile);
          setShowSettings(false);
        }}
        onDeleted={() => {
          logout({
            logoutParams: { returnTo: window.location.origin },
          });
        }}
      />
    </div>
  );
}
