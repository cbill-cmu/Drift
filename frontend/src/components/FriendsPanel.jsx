import { useState } from "react";
import { useFriends } from "../hooks/useFriends.js";
import { useAuthStatus } from "../hooks/useAuth0.js";
import FriendQrCard from "./FriendQrCard.jsx";

export default function FriendsPanel({ onViewMap, activeFriendId }) {
  const { user } = useAuthStatus();
  const {
    me,
    accepted,
    incoming,
    outgoing,
    loading,
    error,
    inviteNotice,
    inviteNoticeKind,
    addByEmail,
    accept,
    unsend,
  } = useFriends();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState("hint");
  const [busy, setBusy] = useState(false);

  async function handleAdd(event) {
    event.preventDefault();
    const value = query.trim();
    if (!value || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await addByEmail(value);
      setNoticeKind("hint");
      if (result?.auto_accepted) {
        setNotice(`You and ${result.friendship?.user?.display_name || value} are now friends.`);
      } else {
        setNotice(`Invite sent to ${result.friendship?.user?.display_name || value}.`);
      }
      setQuery("");
    } catch (err) {
      setNoticeKind("error");
      setNotice(err.message || "Could not send invite");
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept(friend) {
    if (!friend.friendship_id || busy) return;
    setBusy(true);
    setNotice("");
    try {
      await accept(friend.friendship_id);
      setNoticeKind("hint");
      setNotice(`${friend.display_name} is now a friend.`);
    } catch (err) {
      setNoticeKind("error");
      setNotice(err.message || "Could not accept request");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnsend(friend) {
    if (!friend.friendship_id || busy) return;
    setBusy(true);
    setNotice("");
    try {
      await unsend(friend.friendship_id);
      setNoticeKind("hint");
      setNotice(`Unsent invite to ${friend.display_name}.`);
    } catch (err) {
      setNoticeKind("error");
      setNotice(err.message || "Could not unsend invite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="friends-panel">
      <h2>Friends</h2>
      <p className="hint">Add someone by email. Heat density stays friends-only.</p>

      <form className="add-friend" onSubmit={handleAdd}>
        <label htmlFor="friend-query">Add by email</label>
        <div className="add-friend-row">
          <input
            id="friend-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="johndoe@example.com"
            disabled={busy}
          />
          <button type="submit" className="btn-sun" disabled={busy}>
            {busy ? "…" : "Add"}
          </button>
        </div>
      </form>
      <FriendQrCard email={me?.email || user?.email || ""} />
      {inviteNotice ? <p className={inviteNoticeKind || "hint"}>{inviteNotice}</p> : null}
      {notice ? <p className={noticeKind}>{notice}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="hint">Loading friends…</p> : null}

      <h3>Accepted</h3>
      <ul>
        {accepted.map((friend) => (
          <li key={friend.friendship_id || friend.id} className="friend-row">
            <div>
              <strong>{friend.display_name}</strong>
              <span className="hint">{friend.email}</span>
            </div>
            <button type="button" className="btn-sun" onClick={() => onViewMap?.(friend)}>
              {activeFriendId === friend.id ? "Viewing" : "View map"}
            </button>
          </li>
        ))}
        {!loading && accepted.length === 0 ? (
          <li className="hint">No accepted friends yet.</li>
        ) : null}
      </ul>

      <h3>Requests</h3>
      <ul>
        {incoming.map((friend) => (
          <li key={friend.friendship_id || friend.id} className="friend-row">
            <div>
              <strong>{friend.display_name}</strong>
              <span className="hint">wants to connect</span>
            </div>
            <button
              type="button"
              className="btn-sun"
              disabled={busy}
              onClick={() => handleAccept(friend)}
            >
              Accept
            </button>
          </li>
        ))}
        {outgoing.map((friend) => (
          <li key={friend.friendship_id || friend.id} className="friend-row">
            <div>
              <strong>{friend.display_name}</strong>
              <span className="hint">invite sent</span>
            </div>
            <button
              type="button"
              className="btn-paper"
              disabled={busy}
              onClick={() => handleUnsend(friend)}
            >
              Unsend
            </button>
          </li>
        ))}
        {!loading && incoming.length === 0 && outgoing.length === 0 ? (
          <li className="hint">No pending requests.</li>
        ) : null}
      </ul>
    </section>
  );
}