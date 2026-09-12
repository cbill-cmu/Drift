import { TRAVEL_MODES } from "../mongodb-schema.js";

/**
 * ~2 weeks of trips → edges, group + user heatpoints, place-type profiles.
 * Avoids seeding a dominant CMU→Lawrenceville edge (save for live demo).
 */
export function generateTrips(users, group, nodes) {
  const now = new Date();
  const byHood = {};
  for (const n of nodes) {
    if (!byHood[n.neighborhood]) byHood[n.neighborhood] = [];
    byHood[n.neighborhood].push(n);
  }

  const densePool = nodes.filter(
    (n) =>
      n.neighborhood === "Oakland" ||
      n.neighborhood === "Shadyside" ||
      n.neighborhood === "Bloomfield" ||
      n.neighborhood === "Squirrel Hill" ||
      n.neighborhood === "East Liberty"
  );
  const midPool = nodes.filter(
    (n) =>
      n.neighborhood !== "Lawrenceville" &&
      !densePool.includes(n)
  );
  const lawrenceville = nodes.filter((n) => n.neighborhood === "Lawrenceville");
  const cmu = nodes.find((n) => n.name === "CMU") || densePool[0];

  const trips = [];
  const edgeMap = new Map();
  const heatMap = new Map();
  const userHeat = new Map();
  const profileMap = new Map();

  function key(a, b, mode) {
    return `${a}|${b}|${mode}`;
  }

  function bumpHeat(map, lat, lng, w, extra = {}) {
    const k = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const prev = map.get(k) || { ...extra, lat, lng, weight: 0 };
    prev.weight += w;
    map.set(k, prev);
  }

  function addTrip({ user, from, to, dayOffset, hour, duration_min, travel_mode }) {
    if (!from || !to || from._localId === to._localId) return;
    // Keep hero demo edge free
    if (
      (from.name === "CMU" && to.neighborhood === "Lawrenceville") ||
      (to.name === "CMU" && from.neighborhood === "Lawrenceville")
    ) {
      return;
    }

    const started = new Date(now.getTime() - dayOffset * 86400000);
    started.setHours(hour, (dayOffset * 7) % 60, 0, 0);
    const ended = new Date(started.getTime() + duration_min * 60000);

    trips.push({
      _localId: `trip_${trips.length}`,
      group_id: group._localId,
      user_id: user._localId,
      from_node_id: from._localId,
      to_node_id: to._localId,
      started_at: started,
      ended_at: ended,
      duration_min,
      travel_mode,
      user_created_at: now,
    });

    const ek = key(from._localId, to._localId, travel_mode);
    const edge = edgeMap.get(ek) || {
      _localId: `edge_${edgeMap.size}`,
      group_id: group._localId,
      from_node_id: from._localId,
      to_node_id: to._localId,
      travel_mode,
      avg_duration_min: duration_min,
      traversal_count: 0,
      first_traveled_by: user._localId,
      first_traveled_at: started,
      created_at: now,
      _durSum: 0,
    };
    edge.traversal_count += 1;
    edge._durSum += duration_min;
    edge.avg_duration_min = Math.round(edge._durSum / edge.traversal_count);
    if (started < edge.first_traveled_at) {
      edge.first_traveled_at = started;
      edge.first_traveled_by = user._localId;
    }
    edgeMap.set(ek, edge);

    bumpHeat(heatMap, from.lat, from.lng, 1, { group_id: group._localId, recorded_at: now });
    bumpHeat(heatMap, to.lat, to.lng, 1, { group_id: group._localId, recorded_at: now });
    bumpHeat(
      userHeat,
      from.lat,
      from.lng,
      1,
      { group_id: group._localId, user_id: user._localId, recorded_at: now }
    );
    bumpHeat(
      userHeat,
      to.lat,
      to.lng,
      1,
      { group_id: group._localId, user_id: user._localId, recorded_at: now }
    );

    for (const node of [from, to]) {
      const pk = `${user._localId}|${node.place_type}`;
      const prev = profileMap.get(pk) || {
        user_id: user._localId,
        place_type: node.place_type,
        trip_count: 0,
        last_updated: now,
      };
      prev.trip_count += 1;
      profileMap.set(pk, prev);
    }
  }

  function pick(pool, i, salt) {
    if (!pool.length) return null;
    const x = Math.sin(i * 17.13 + salt * 9.7) * 10000;
    return pool[Math.floor((x - Math.floor(x)) * pool.length)];
  }

  // Dense daily travel for 14 days across users
  let t = 0;
  for (let day = 0; day < 14; day++) {
    for (let u = 0; u < users.length; u++) {
      const user = users[u];
      const tripsToday = 1 + ((day + u) % 3);
      for (let k = 0; k < tripsToday; k++) {
        const from = pick(densePool, t, 1) || cmu;
        const to = pick(densePool, t, 2) || pick(midPool, t, 3);
        addTrip({
          user,
          from,
          to,
          dayOffset: day,
          hour: 8 + ((k * 3 + u) % 12),
          duration_min: 12 + ((t + u) % 35),
          travel_mode: TRAVEL_MODES[(t + u) % TRAVEL_MODES.length],
        });
        t += 1;
      }
    }
  }

  // Occasional mid-city trips
  for (let i = 0; i < 40; i++) {
    addTrip({
      user: users[i % users.length],
      from: pick(midPool, i, 4) || cmu,
      to: pick(densePool, i, 5) || cmu,
      dayOffset: i % 14,
      hour: 11 + (i % 8),
      duration_min: 18 + (i % 40),
      travel_mode: TRAVEL_MODES[i % TRAVEL_MODES.length],
    });
  }

  // Tiny Lawrenceville presence (not CMU→Lawrenceville hero)
  if (lawrenceville[0] && midPool[0]) {
    for (let i = 0; i < 2; i++) {
      addTrip({
        user: users[1 + (i % (users.length - 1))],
        from: midPool[i % midPool.length],
        to: lawrenceville[0],
        dayOffset: 10 + i,
        hour: 19,
        duration_min: 28,
        travel_mode: "bus",
      });
    }
  }

  const edges = [...edgeMap.values()].map(({ _durSum, ...e }) => e);
  const heatpoints = [...heatMap.values()];
  const user_heatpoints = [...userHeat.values()];

  const profiles = [];
  const byUser = {};
  for (const p of profileMap.values()) {
    if (!byUser[p.user_id]) byUser[p.user_id] = [];
    byUser[p.user_id].push(p);
  }
  for (const list of Object.values(byUser)) {
    const sum = list.reduce((s, p) => s + p.trip_count, 0) || 1;
    for (const p of list) {
      profiles.push({
        user_id: p.user_id,
        place_type: p.place_type,
        frequency_pct: Math.round((p.trip_count / sum) * 100),
        trip_count: p.trip_count,
        last_updated: now,
      });
    }
  }

  // Sync visit_count from trip endpoints
  const visitBump = {};
  for (const trip of trips) {
    visitBump[trip.from_node_id] = (visitBump[trip.from_node_id] || 0) + 1;
    visitBump[trip.to_node_id] = (visitBump[trip.to_node_id] || 0) + 1;
  }
  for (const n of nodes) {
    if (visitBump[n._localId]) n.visit_count = visitBump[n._localId];
  }

  group.total_edges_discovered = edges.length;
  return { trips, edges, heatpoints, user_heatpoints, profiles };
}
