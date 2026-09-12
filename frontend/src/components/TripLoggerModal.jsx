import { useEffect, useMemo, useState } from "react";
import { createPlace, fetchPlaces } from "../api/client.js";
import { useTrip } from "../hooks/useTrip.js";

const CATEGORIES = ["", "night_life", "food", "sights", "outdoors", "shopping", "recreation", "hangout"];

export default function TripLoggerModal({
  isOpen,
  groupId,
  nodes = [],
  onClose,
  onSubmitSuccess,
}) {
  const { submitTrip, loading, error } = useTrip();
  const [places, setPlaces] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [fromPlace, setFromPlace] = useState(null);
  const [toPlace, setToPlace] = useState(null);
  const [durationMin, setDurationMin] = useState(31);
  const [travelMode, setTravelMode] = useState("bus");
  const [adding, setAdding] = useState(null);
  const [newName, setNewName] = useState("");
  const [newHood, setNewHood] = useState("Oakland");
  const [newCategory, setNewCategory] = useState("food");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetchPlaces({ limit: 80 })
      .then((data) => {
        if (cancelled) return;
        setPlaces(data.places);
        setNeighborhoods(data.neighborhoods);
        if (data.neighborhoods[0]) setNewHood(data.neighborhoods[0]);
      })
      .catch((err) => {
        if (!cancelled) setLocalError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const fromOptions = useMemo(() => filterPlaces(places, fromQuery), [places, fromQuery]);
  const toOptions = useMemo(() => filterPlaces(places, toQuery), [places, toQuery]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError("");
    const from = fromPlace || fromOptions[0];
    const to = toPlace || toOptions[0];
    if (!from || !to) {
      setLocalError("Pick a from and to place from the catalog.");
      return;
    }
    const payload = {
      group_id: groupId,
      from_lat: from.lat,
      from_lng: from.lng,
      to_lat: to.lat,
      to_lng: to.lng,
      from_name: from.name,
      to_name: to.name,
      from_place_id: from.id,
      to_place_id: to.id,
      duration_min: Number(durationMin),
      travel_mode: travelMode,
    };
    const result = await submitTrip(payload);
    if (result) onSubmitSuccess?.(result);
  }

  async function handleAddPlace(target) {
    if (!newName.trim()) return;
    setLocalError("");
    try {
      const data = await createPlace({
        name: newName.trim(),
        neighborhood: newHood,
        category: newCategory,
      });
      const place = data.place;
      setPlaces((prev) => {
        if (prev.some((p) => p.id === place.id)) return prev;
        return [place, ...prev];
      });
      if (target === "from") {
        setFromPlace(place);
        setFromQuery(place.name);
      } else {
        setToPlace(place);
        setToQuery(place.name);
      }
      setNewName("");
      setAdding(null);
    } catch (err) {
      setLocalError(err.message);
    }
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
          <p className="hint">Places come from the Pittsburgh catalog. New spots are classified and saved there, then appear on your group graph after this trip.</p>
          <PlaceField
            label="From"
            query={fromQuery}
            onQuery={(value) => {
              setFromQuery(value);
              setFromPlace(null);
            }}
            options={fromOptions}
            selected={fromPlace}
            onSelect={(place) => {
              setFromPlace(place);
              setFromQuery(place.name);
            }}
            onAdd={() => setAdding("from")}
          />
          <PlaceField
            label="To"
            query={toQuery}
            onQuery={(value) => {
              setToQuery(value);
              setToPlace(null);
            }}
            options={toOptions}
            selected={toPlace}
            onSelect={(place) => {
              setToPlace(place);
              setToQuery(place.name);
            }}
            onAdd={() => setAdding("to")}
          />
          {adding ? (
            <div className="add-place">
              <p className="hint">Add a new {adding} place to the catalog</p>
              <label>
                Place name
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Mad Mex" />
              </label>
              <label>
                Neighborhood
                <select value={newHood} onChange={(e) => setNewHood(e.target.value)}>
                  {neighborhoods.map((hood) => (
                    <option key={hood} value={hood}>
                      {hood}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Category
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                  {CATEGORIES.filter(Boolean).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
              <div className="modal-actions">
                <button type="button" className="btn-paper" onClick={() => setAdding(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-sun" onClick={() => handleAddPlace(adding)}>
                  Save place
                </button>
              </div>
            </div>
          ) : null}
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
          {(error || localError) && <p className="error">{error || localError}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-paper" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-sun" disabled={loading || nodes.length + places.length < 1}>
              {loading ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function filterPlaces(places, query) {
  const q = query.trim().toLowerCase();
  if (!q) return places.slice(0, 12);
  return places
    .filter((p) =>
      [p.name, p.neighborhood, p.category, p.kind].some((value) =>
        String(value || "").toLowerCase().includes(q)
      )
    )
    .slice(0, 12);
}

function PlaceField({ label, query, onQuery, options, selected, onSelect, onAdd }) {
  return (
    <div className="place-field">
      <span>{label}</span>
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search restaurants, bars, parks…"
        autoComplete="off"
      />
      <div className="place-options">
        {options.map((place) => (
          <button
            key={place.id}
            type="button"
            className={selected?.id === place.id ? "place-option place-option-active" : "place-option"}
            onClick={() => onSelect(place)}
          >
            <strong>{place.name}</strong>
            <span className="hint">
              {place.neighborhood} · {place.category}
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="text-btn" onClick={onAdd}>
        Can’t find it? Add a place
      </button>
    </div>
  );
}
