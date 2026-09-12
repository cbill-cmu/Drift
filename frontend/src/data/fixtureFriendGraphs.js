import { getFixtureGraph } from "./fixtureGraph.js";

function graphFromBase({ userId, display_name, nodeIds, edgeIds, neighborhoods, visitOverrides = {} }) {
  const base = getFixtureGraph();
  const nodes = base.nodes
    .filter((n) => nodeIds.includes(n.id))
    .map((n) => ({ ...n, visits: visitOverrides[n.id] ?? n.visits }));
  const nodeSet = new Set(nodes.map((n) => n.id));
  const edges = base.edges.filter(
    (e) => edgeIds.includes(e.id) && nodeSet.has(e.from) && nodeSet.has(e.to)
  );
  const heatpoints = nodes.map((n) => ({
    lat: n.lat,
    lng: n.lng,
    weight: Math.max(0.3, n.visits / 15),
  }));

  return {
    success: true,
    user_id: userId,
    display_name,
    group_name: `${display_name}'s map`,
    nodes,
    edges,
    heatpoints,
    neighborhoods,
  };
}

const friendGraphs = {
  alice: () =>
    graphFromBase({
      userId: "alice",
      display_name: "Alice",
      nodeIds: ["cmu", "shadyside", "walnut", "eastlib", "squirrel"],
      edgeIds: ["e3", "e4", "e5", "e9"],
      visitOverrides: { shadyside: 30, walnut: 18, eastlib: 16, cmu: 10, squirrel: 7 },
      neighborhoods: {
        Shadyside: { pct: 82, discovered: 8, total: 10 },
        "East Liberty": { pct: 55, discovered: 5, total: 10 },
        "Squirrel Hill": { pct: 40, discovered: 4, total: 11 },
        Oakland: { pct: 28, discovered: 2, total: 9 },
      },
    }),
  bob: () =>
    graphFromBase({
      userId: "bob",
      display_name: "Bob",
      nodeIds: ["cmu", "oakland", "southside", "lawrenceville", "schenley"],
      edgeIds: ["e1", "e6", "e7"],
      visitOverrides: { southside: 22, oakland: 14, cmu: 9, lawrenceville: 6, schenley: 5 },
      neighborhoods: {
        "South Side": { pct: 61, discovered: 5, total: 9 },
        Oakland: { pct: 48, discovered: 4, total: 9 },
        Lawrenceville: { pct: 22, discovered: 2, total: 11 },
      },
    }),
  hiro: () =>
    graphFromBase({
      userId: "hiro",
      display_name: "Hiro",
      nodeIds: ["cmu", "oakland", "wagner", "lawrenceville"],
      edgeIds: ["e1", "e8"],
      visitOverrides: { cmu: 20, oakland: 17, wagner: 11, lawrenceville: 4 },
      neighborhoods: {
        Oakland: { pct: 70, discovered: 6, total: 9 },
        Lawrenceville: { pct: 18, discovered: 2, total: 11 },
      },
    }),
};

/** Same payload shape as GET /api/groups/:id/graph, scoped to one friend. */
export function getFixtureFriendGraph(userId) {
  const build = friendGraphs[userId];
  if (!build) return null;
  return structuredClone(build());
}
