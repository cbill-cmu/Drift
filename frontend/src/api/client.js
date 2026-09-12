import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

let tokenGetter = async () => null;

export function setAuthTokenGetter(fn) {
  tokenGetter = fn || (async () => null);
}

api.interceptors.request.use(async (config) => {
  const token = await tokenGetter();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function apiError(err, fallback) {
  const fromBody = err.response?.data?.error;
  return new Error(fromBody || err.message || fallback);
}

/** POST /api/trips — see shared/api-contract.md */
export async function postTrip(body) {
  try {
    const { data } = await api.post("/api/trips", body);
    return data;
  } catch (err) {
    throw apiError(err, "Trip request failed");
  }
}

/** GET /api/groups/:groupId/graph */
export async function fetchGroupGraph(groupId) {
  try {
    const { data } = await api.get(`/api/groups/${groupId}/graph`);
    return data;
  } catch (err) {
    throw apiError(err, "Failed to load graph");
  }
}

/** GET /api/users/:userId/profile */
export async function fetchUserProfile(userId) {
  const { data } = await api.get(`/api/users/${userId}/profile`);
  return data;
}

/** Personal / friend graph for a member of the group. */
export async function fetchFriendGraph(userId, groupId) {
  try {
    const { data } = await api.get(`/api/groups/${groupId}/members/${userId}/graph`);
    return data;
  } catch (err) {
    throw apiError(err, "Failed to load friend graph");
  }
}
