export function normalizeGraph(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const nodes = (raw.nodes || []).map((n) => ({
    id: String(n.id ?? n._id ?? ""),
    name: n.name,
    neighborhood: n.neighborhood,
    lat: Number(n.lat),
    lng: Number(n.lng),
    place_type: n.place_type || "unknown",
    visits: n.visits ?? n.visit_count ?? 0,
  }));
  const nodeIds = new Set(nodes.map((n) => n.id));
  return {
    ...raw,
    nodes,
    edges: (raw.edges || []).map((e) => ({
      id: String(e.id ?? e._id ?? `${e.from}-${e.to}`),
      from: String(e.from ?? e.from_node_id ?? ""),
      to: String(e.to ?? e.to_node_id ?? ""),
      count: e.count ?? e.traversal_count ?? 1,
      avg_duration: e.avg_duration ?? e.avg_duration_min ?? 0,
      travel_mode: e.travel_mode || "walk",
    })).filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to)),
    heatpoints: (raw.heatpoints || []).map((h) => ({
      lat: Number(h.lat),
      lng: Number(h.lng),
      weight: Number(h.weight) || 1,
    })),
    members: (raw.members || []).map((m) => ({
      id: String(m.id ?? m._id ?? ""),
      display_name: m.display_name || m.email || "Member",
      email: m.email || "",
    })),
  };
}
