import { useState } from "react";
import { useGroupInvites } from "../hooks/useGroupInvites.js";

export default function GroupInvitesPanel({ groupId, groupName: fallbackName, onGroupsChanged }) {
  const {
    group,
    inviteable,
    incoming,
    outgoing,
    loading,
    error,
    memberDenied,
    invite,
    accept,
    decline,
    unsend,
  } = useGroupInvites(groupId, { onGroupsChanged });
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState("hint");
  const [busy, setBusy] = useState(false);

  const groupName = group?.name || fallbackName || "this group";

  async function run(action, successMessage) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await action();
      setNoticeKind("hint");
      setNotice(successMessage);
    } catch (err) {
      setNoticeKind("error");
      setNotice(err.message || "Group invite failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="group-invites">
      <h3>Group invites</h3>
      <p className="hint">
        Friends first, then invite them into {groupName}.
      </p>
      {notice ? <p className={noticeKind}>{notice}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="hint">Loading group invites…</p> : null}

      <h3>Inbox</h3>
      <ul>
        {incoming.map((item) => (
          <li key={item.invite_id} className="friend-row">
            <div>
              <strong>{item.user?.display_name || "Someone"}</strong>
              <span className="hint">invited you to {item.group?.name || "a group"}</span>
            </div>
            <div className="friend-row-actions">
              <button
                type="button"
                className="btn-sun"
                disabled={busy}
                onClick={() =>
                  run(
                    () => accept(item.invite_id),
                    `You joined ${item.group?.name || "the group"}.`
                  )
                }
              >
                Accept
              </button>
              <button
                type="button"
                className="btn-paper"
                disabled={busy}
                onClick={() =>
                  run(() => decline(item.invite_id), `Declined ${item.group?.name || "the invite"}.`)
                }
              >
                Decline
              </button>
            </div>
          </li>
        ))}
        {outgoing.map((item) => (
          <li key={item.invite_id} className="friend-row">
            <div>
              <strong>{item.user?.display_name || "Someone"}</strong>
              <span className="hint">invited to {item.group?.name || "a group"}</span>
            </div>
            <button
              type="button"
              className="btn-paper"
              disabled={busy}
              onClick={() =>
                run(
                  () => unsend(item.invite_id),
                  `Unsent ${item.group?.name || "group"} invite to ${item.user?.display_name || "them"}.`
                )
              }
            >
              Unsend
            </button>
          </li>
        ))}
        {!loading && incoming.length === 0 && outgoing.length === 0 ? (
          <li className="hint">No pending group invites.</li>
        ) : null}
      </ul>

      <h3>Invite to {groupName}</h3>
      {memberDenied ? (
        <p className="hint">
          You are not in this group yet. Accept an invite above, or ask a member to add you.
        </p>
      ) : (
        <ul>
          {inviteable.map((friend) => (
            <li key={friend.id} className="friend-row">
              <div>
                <strong>{friend.display_name}</strong>
                <span className="hint">{friend.email}</span>
              </div>
              <button
                type="button"
                className="btn-sun"
                disabled={busy}
                onClick={() =>
                  run(
                    () => invite(friend.id),
                    `Invited ${friend.display_name} to ${groupName}.`
                  )
                }
              >
                Invite
              </button>
            </li>
          ))}
          {!loading && !memberDenied && inviteable.length === 0 ? (
            <li className="hint">
              No friends left to invite. Add someone above first, then invite them here.
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
