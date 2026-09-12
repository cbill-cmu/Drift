import { useState } from "react";
import { useTrip } from "../hooks/useTrip.js";

/**
 * Trip logging form stub (Person 2).
 * Demo path: CMU → Lawrenceville, 31 min, bus.
 */
export default function TripLoggerModal({ isOpen, groupId, onClose, onSubmitSuccess }) {
  const { submitTrip, loading, error } = useTrip();
  const [durationMin, setDurationMin] = useState(31);
  const [travelMode, setTravelMode] = useState("bus");

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      group_id: groupId,
      from_lat: 40.4425,
      from_lng: -79.9435,
      to_lat: 40.4501,
      to_lng: -79.9585,
      duration_min: Number(durationMin),
      travel_mode: travelMode,
    };
    const result = await submitTrip(payload);
    if (result) onSubmitSuccess?.(result);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-labelledby="trip-logger-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="trip-logger-title">Log trip</h2>
        <form onSubmit={handleSubmit}>
          <p className="hint">Stub defaults: CMU → Lawrenceville</p>
          <label>
            Duration (min)
            <input
              type="number"
              min={5}
              max={120}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
            />
          </label>
          <label>
            Travel mode
            <select value={travelMode} onChange={(e) => setTravelMode(e.target.value)}>
              <option value="walk">walk</option>
              <option value="bus">bus</option>
              <option value="car">car</option>
              <option value="uber">uber</option>
              <option value="train">train</option>
            </select>
          </label>
          {error && <p className="error">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
