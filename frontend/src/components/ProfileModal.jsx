import { useEffect, useState } from "react";
import { deleteCurrentUser, updateCurrentUser } from "../api/client.js";
import { colorForGroup } from "../utils/groupColor.js";

const DELETE_PROMPT =
  "Are you sure you want to delete your account? Doing so will delete all of the data you have associated with your account";

function sharesWithGroup(user, groupId) {
  if (!Array.isArray(user?.contributes_to)) return true;
  return user.contributes_to.includes(String(groupId));
}

/**
 * Account settings — nickname plus per-group exploration sharing.
 * The profile itself is auto-provisioned from the Auth0 identity on login.
 */
export default function ProfileModal({
  isOpen,
  user,
  groups = [],
  onClose,
  onSaved,
  onShareChange,
  onDeleted,
}) {
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setConfirmDelete(false);
    setDisplayName(user?.display_name || "");
  }, [isOpen, user]);

  if (!isOpen) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    const name = displayName.trim();
    setBusy(true);
    setError("");
    try {
      const result = await updateCurrentUser({ display_name: name });
      onSaved?.(result.user);
      onClose?.();
    } catch (err) {
      setError(err.message || "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  async function handleShareToggle(groupId, enabled) {
    setBusy(true);
    setError("");
    try {
      const result = await updateCurrentUser({
        share_exploration: { group_id: groupId, enabled },
      });
      onShareChange?.(result.user);
    } catch (err) {
      setError(err.message || "Could not update sharing");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteYes() {
    setBusy(true);
    setError("");
    try {
      await deleteCurrentUser();
      onDeleted?.();
    } catch (err) {
      setError(err.message || "Could not delete account");
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={() => {
        if (!busy) onClose?.();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-labelledby="profile-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {confirmDelete ? (
          <>
            <h2 id="profile-modal-title">Delete account</h2>
            <p>{DELETE_PROMPT}</p>
            {error ? <p className="error">{error}</p> : null}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-paper"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                No
              </button>
              <button type="button" className="btn-danger" disabled={busy} onClick={handleDeleteYes}>
                {busy ? "Deleting…" : "Yes"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="profile-modal-title">Account settings</h2>
            <p className="hint">Update how you appear in Drift.</p>
            <form className="modal-form" onSubmit={handleSubmit}>
              <label>
                Nickname
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What should friends call you?"
                  autoComplete="nickname"
                />
              </label>
              {user?.email ? <p className="hint">Signed in as {user.email}</p> : null}
              {groups.length ? (
                <fieldset className="share-fieldset">
                  <legend>Exploration sharing</legend>
                  <p className="hint">
                    When this is off, that group map no longer includes where you have been.
                    Your personal fog stays yours, and nothing is deleted.
                  </p>
                  {groups.map((group) => {
                    const on = sharesWithGroup(user, group.id);
                    const color = colorForGroup(group.id);
                    return (
                      <label key={group.id} className="share-row">
                        <span className="share-row-label">
                          <span className="group-swatch" style={{ background: color.fill }} aria-hidden="true" />
                          Share my exploration with {group.name}
                        </span>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={busy}
                          onChange={(event) =>
                            handleShareToggle(group.id, event.target.checked)
                          }
                        />
                      </label>
                    );
                  })}
                </fieldset>
              ) : null}
              {error ? <p className="error">{error}</p> : null}
              <div className="modal-actions">
                <button type="button" className="btn-paper" onClick={onClose} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="btn-sun" disabled={busy}>
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
            <button
              type="button"
              className="btn-danger-text"
              disabled={busy}
              onClick={() => {
                setError("");
                setConfirmDelete(true);
              }}
            >
              Delete account
            </button>
          </>
        )}
      </div>
    </div>
  );
}
