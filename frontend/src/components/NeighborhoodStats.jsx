/**
 * Sidebar neighborhood % bars stub (Person 2).
 */
export default function NeighborhoodStats({ neighborhoods = {} }) {
  const entries = Object.entries(neighborhoods);

  return (
    <section className="neighborhood-stats">
      <h2>Neighborhoods</h2>
      {entries.length === 0 && <p className="hint">No stats yet.</p>}
      <ul>
        {entries.map(([name, data]) => (
          <li key={name}>
            <div className="stat-row">
              <span>{name}</span>
              <span>{data.pct}%</span>
            </div>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${Math.min(100, data.pct)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
