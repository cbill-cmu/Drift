import { useState } from "react";
import { useTrip } from "../hooks/useTrip.js";

function pickNode(nodes, preferredNames) {
  for (const name of preferredNames) {
    const match = nodes.find((n) => n.name?.toLowerCase().includes(name.toLowerCase()));
    if (match) return match.id;
  }
  return nodes[0]?.id || "";
}

export default function TripLoggerModal({
  isOpen,
  groupId,
  nodes = [],
  onClose,
  onSubmitSuccess,
}) {
  const { submitTrip, loading, error } = useTrip();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [durationMin, setDurationMin] = useState(31);
  const [travelMode, setTravelMode] = useState("bus");

  const fromNode = nodes.find((n) => n.id === fromId) || nodes.find((n) => n.id === pickNode(nodes, ["CMU"]));
  const toNode =
    nodes.find((n) => n.id === toId) ||
    nodes.find((n) => n.id === pickNode(nodes, ["Lawrenceville"])) ||
    nodes[1];

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    const from = nodes.find((n) => n.id === (fromId || fromNode?.id));
    const to = nodes.find((n) => n.id === (toId || toNode?.id));
    if (!from || !to) return;
    const payload = {
      group_id: groupId,
      from_lat: from.lat,
      from_lng: from.lng,
      to_lat: to.lat,
      to_lng: to.lng,
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
          <p className="hint">From / to come from your group graph.</p>
          <label>
            From
            <select
              value={fromId || fromNode?.id || ""}
              onChange={(e) => setFromId(e.target.value)}
            >
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            To
            <select
              value={toId || toNode?.id || ""}
              onChange={(e) => setToId(e.target.value)}
            >
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </label>
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
            <button type="button" className="btn-paper" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-sun" disabled={loading || nodes.length < 2}>
              {loading ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
