import { useState } from "react";
import { fixtureFriends } from "../data/fixtureFriends.js";

export default function FriendsPanel({
  onViewMap,
  activeFriendId,
  members = [],
}) {
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const liveMembers = members.filter((m) => m.id);
  const accepted = liveMembers.length ? liveMembers : fixtureFriends.accepted;
  const incoming = liveMembers.length ? [] : fixtureFriends.incoming;
  const outgoing = liveMembers.length ? [] : fixtureFriends.outgoing;

  function handleAdd(event) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setNotice(`Invite queued locally for ${value}. Friends API is not wired yet.`);
    setQuery("");
  }

  return (
    <section className="friends-panel">
      <h2>Friends</h2>
      {liveMembers.length ? (
        <p className="hint">Crew members from MongoDB.</p>
      ) : (
        <p className="hint">Group sees where you have been. Heat density stays friends-only.</p>
      )}

      <form className="add-friend" onSubmit={handleAdd}>
        <label htmlFor="friend-query">Add by email or code</label>
        <div className="add-friend-row">
          <input
            id="friend-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="alice@test.com"
          />
          <button type="submit" className="btn-sun">Add</button>
        </div>
      </form>
      {notice ? <p className="hint">{notice}</p> : null}

      <h3>Accepted</h3>
      <ul>
        {accepted.map((friend) => (
          <li key={friend.id} className="friend-row">
            <div>
              <strong>{friend.display_name}</strong>
              <span className="hint">{friend.email}</span>
            </div>
            <button type="button" className="btn-sun" onClick={() => onViewMap?.(friend)}>
              {activeFriendId === friend.id ? "Viewing" : "View map"}
            </button>
          </li>
        ))}
      </ul>

      <h3>Requests</h3>
      <ul>
        {incoming.map((friend) => (
          <li key={friend.id} className="friend-row">
            <div>
              <strong>{friend.display_name}</strong>
              <span className="hint">wants to connect</span>
            </div>
            <span className="pill">Incoming</span>
          </li>
        ))}
        {outgoing.map((friend) => (
          <li key={friend.id} className="friend-row">
            <div>
              <strong>{friend.display_name}</strong>
              <span className="hint">invite sent</span>
            </div>
            <span className="pill">Sent</span>
          </li>
        ))}
        {incoming.length === 0 && outgoing.length === 0 ? (
          <li className="hint">No pending requests.</li>
        ) : null}
      </ul>
    </section>
  );
}
