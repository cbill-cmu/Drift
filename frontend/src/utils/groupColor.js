/**
 * Stable per-group color. Hash the id so the same group looks the same
 * for every member, independent of list order.
 */
export const GROUP_PALETTE = [
  { fill: "#6db3a8", soft: "#c5e8dc", stroke: "#3f8f86" },
  { fill: "#c45d6c", soft: "#f0c4cb", stroke: "#8f3d48" },
  { fill: "#5b8fd4", soft: "#c9dbf2", stroke: "#3a6499" },
  { fill: "#d4a017", soft: "#f3e0a8", stroke: "#9a7610" },
  { fill: "#8b6bb5", soft: "#ddd0ee", stroke: "#624a86" },
  { fill: "#c47a4a", soft: "#f0d2bc", stroke: "#8a5432" },
  { fill: "#3d9a8a", soft: "#b7e0d6", stroke: "#2a6d62" },
  { fill: "#5a6d7a", soft: "#cdd6dc", stroke: "#3e4c55" },
];

export function colorForGroup(id) {
  const key = String(id || "");
  if (!key) return GROUP_PALETTE[0];
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return GROUP_PALETTE[Math.abs(hash) % GROUP_PALETTE.length];
}
