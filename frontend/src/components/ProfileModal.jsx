import { useEffect, useState } from "react";
import { deleteCurrentUser, updateCurrentUser } from "../api/client.js";

const DELETE_PROMPT =
  "Are you sure you want to delete your account? Doing so will delete all of the data you have associated with your account";

/**
 * Account settings — an optional nickname, nothing else. The profile
 * itself is auto-provisioned from the Auth0 identity on login; there is
 * no separate profile-creation step, so this modal is never forced open
 * and the nickname is never required.
 */
export default function ProfileModal({ isOpen, user, onClose, onSaved, onDeleted }) {
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
