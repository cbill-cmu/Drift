import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

/**
 * Attach Auth0 bearer token when Person 2 wires getAccessTokenSilently.
 * Example: api.defaults.headers.common.Authorization = `Bearer ${token}`;
 */

/** POST /api/trips — see shared/api-contract.md */
export async function postTrip(body) {
  const { data } = await api.post("/api/trips", body);
  return data;
}

/** GET /api/groups/:groupId/graph */
export async function fetchGroupGraph(groupId) {
  const { data } = await api.get(`/api/groups/${groupId}/graph`);
  return data;
}

/** GET /api/users/:userId/profile */
export async function fetchUserProfile(userId) {
  const { data } = await api.get(`/api/users/${userId}/profile`);
  return data;
}
