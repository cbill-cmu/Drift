import { useEffect, useState } from "react";
import { deleteCurrentUser, updateCurrentUser } from "../api/client.js";

const TRAVEL_MODES = ["walk", "bus", "car", "uber", "train"];
const DELETE_PROMPT =
  "Are you sure you want to delete your account? Doing so will delete all of the data you have associated with your account";

export default function ProfileModal({
  isOpen,
  user,
  authUser,
  required = false,
  onClose,
  onSaved,
  onDeleted,
}) {
  const [displayName, setDisplayName] = useState("");
  const [calendarName, setCalendarName] = useState("");
  const [travelMode, setTravelMode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setConfirmDelete(false);
    setDisplayName(user?.display_name || "");
    setCalendarName(user?.calendar_file_name || "");
    setTravelMode(user?.preferred_travel_mode || "");
  }, [isOpen, user, authUser]);

  if (!isOpen) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await updateCurrentUser({
        display_name: name,
        calendar_file_name: calendarName,
        preferred_travel_mode: travelMode,
      });
      onSaved?.(result.user);
      if (!required) onClose?.();
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
        if (!required && !busy) onClose?.();
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
            <h2 id="profile-modal-title">{required ? "Finish your profile" : "Account settings"}</h2>
            <p className="hint">
              {required
                ? "Add a few details so friends know who you are."
                : "Update how you appear in Drift."}
            </p>
            <form className="profile-form" onSubmit={handleSubmit}>
              <label>
                Name* (required)
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jane Doe"
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                Google Calendar file
                <span className="file-field">
                  <span className="file-field-text">
                    {calendarName || "Choose a .ics file"}
                  </span>
                  <input
                    type="file"
                    accept=".ics,text/calendar"
                    onChange={(e) => setCalendarName(e.target.files?.[0]?.name || "")}
                  />
                </span>
              </label>
              <label>
                Preferred form of transportation
                <select value={travelMode} onChange={(e) => setTravelMode(e.target.value)}>
                  <option value="">Choose one</option>
                  {TRAVEL_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </label>
              {user?.email ? <p className="hint">Signed in as {user.email}</p> : null}
              {error ? <p className="error">{error}</p> : null}
              <div className="modal-actions">
                {!required ? (
                  <button type="button" className="btn-paper" onClick={onClose} disabled={busy}>
                    Cancel
                  </button>
                ) : null}
                <button type="submit" className="btn-sun" disabled={busy}>
                  {busy ? "Saving…" : required ? "Save and continue" : "Save"}
                </button>
              </div>
            </form>
            {!required ? (
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
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
