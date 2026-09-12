import { useState } from "react";

export default function GroupsPanel({
  groups,
  selectedId,
  loading,
  error,
  onSelect,
  onCreate,
}) {
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState("hint");
  const [busy, setBusy] = useState(false);

  async function handleCreate(event) {
    event.preventDefault();
    const value = name.trim();
    if (!value || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await onCreate(value);
      setNoticeKind("hint");
      setNotice(`Created ${result?.group?.name || value}. Opening its map.`);
      setName("");
    } catch (err) {
      setNoticeKind("error");
      setNotice(err.message || "Could not create group");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="profile-groups">
      <h3>Your groups</h3>
      <p className="hint">Create a group, then invite friends from the Friends tab.</p>
      {notice ? <p className={noticeKind}>{notice}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="hint">Loading groups…</p> : null}

      <ul>
        {groups.map((group) => {
          const viewing = group.id === selectedId;
          return (
            <li key={group.id} className="friend-row">
              <div>
                <strong>{group.name}</strong>
                <span className="hint">{viewing ? "on the map" : "member"}</span>
              </div>
              <button
                type="button"
                className="btn-sun"
                disabled={viewing}
                onClick={() => onSelect(group.id)}
              >
                {viewing ? "Viewing" : "View map"}
              </button>
            </li>
          );
        })}
        {!loading && groups.length === 0 ? (
          <li className="hint">No groups yet. Create one below.</li>
        ) : null}
      </ul>

      <form className="add-friend" onSubmit={handleCreate}>
        <label htmlFor="new-group-name">New group</label>
        <div className="add-friend-row">
          <input
            id="new-group-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sunday Hikers"
            maxLength={80}
            disabled={busy}
          />
          <button type="submit" className="btn-sun" disabled={busy || !name.trim()}>
            {busy ? "…" : "Create"}
          </button>
        </div>
      </form>
    </section>
  );
}
