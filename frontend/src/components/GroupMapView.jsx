/**
 * Main map + graph overlay stub (Person 2).
 * TODO: Google Maps tiles, heatmap, node/edge overlay via useGroupGraph.
 */
export default function GroupMapView({ groupId, onNeighborhoods }) {
  return (
    <div className="map-stub">
      <p>GroupMapView stub</p>
      <p>groupId: {groupId}</p>
      <p>Wire Google Maps + GET /api/groups/:groupId/graph here.</p>
      <button
        type="button"
        onClick={() =>
          onNeighborhoods?.({
            Oakland: { pct: 94, discovered: 8, total: 9 },
            Shadyside: { pct: 71, discovered: 7, total: 10 },
            Lawrenceville: { pct: 13, discovered: 1, total: 11 },
          })
        }
      >
        Load mock neighborhoods
      </button>
    </div>
  );
}
