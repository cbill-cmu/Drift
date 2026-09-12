/**
 * Sidebar neighborhood % bars. Each row expands to nodes visited in that area.
 */
export default function NeighborhoodStats({
  neighborhoods = {},
  nodes = [],
  selectedNodeId,
  onSelectNode,
  focusHood = null,
}) {
  const entries = Object.entries(neighborhoods)
    .filter(([name]) => !focusHood || name === focusHood)
    .sort((a, b) => b[1].pct - a[1].pct);
  const overall =
    entries.length === 0
      ? 0
      : Math.round(entries.reduce((sum, [, n]) => sum + n.pct, 0) / entries.length);

  const nodesByHood = {};
  for (const node of nodes) {
    const hood = node.neighborhood || "Unknown";
    if (!nodesByHood[hood]) nodesByHood[hood] = [];
    nodesByHood[hood].push(node);
  }
  for (const list of Object.values(nodesByHood)) {
    list.sort((a, b) => b.visits - a.visits);
  }

  return (
    <section className="neighborhood-stats">
      {entries.length === 0 ? (
        <p className="hint">No stats yet.</p>
      ) : (
        <p className="overall-pct">{overall}% of listed areas explored</p>
      )}
      <ul>
        {entries.map(([name, data]) => {
          const places = nodesByHood[name] || [];
          return (
            <li key={name}>
              <details open={Boolean(focusHood)}>
                <summary>
                  <div className="stat-row">
                    <span className="stat-name">{name}</span>
                    <span className="stat-meta">
                      {data.pct}%
                      {places.length ? ` · ${places.length} stops` : ""}
                    </span>
                  </div>
                  <div className="bar">
                    <div className="bar-fill" style={{ width: `${Math.min(100, data.pct)}%` }} />
                  </div>
                </summary>
                {places.length === 0 ? (
                  <p className="hint">No logged stops in this area yet.</p>
                ) : (
                  <ul className="place-list">
                    {places.map((node) => (
                      <li key={node.id}>
                        <button
                          type="button"
                          className={
                            node.id === selectedNodeId ? "place-btn place-btn-active" : "place-btn"
                          }
                          onClick={() => onSelectNode?.(node)}
                        >
                          <span>{node.name}</span>
                          <span className="hint">
                            {String(node.place_type || "unknown").replaceAll("_", " ")} · {node.visits}{" "}
                            visits
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
