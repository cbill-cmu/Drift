import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

let tokenGetter = async () => null;
let profileEmailGetter = async () => null;

export function setAuthTokenGetter(fn) {
  tokenGetter = fn || (async () => null);
}

export function setAuthEmailGetter(fn) {
  profileEmailGetter = fn || (async () => null);
}

api.interceptors.request.use(async (config) => {
  const token = await tokenGetter();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const email = await profileEmailGetter();
  if (email) {
    config.headers["X-User-Email"] = email;
  }
  return config;
});

function apiError(err, fallback) {
  const fromBody = err.response?.data?.error;
  const status = err.response?.status;
  if (fromBody) return new Error(fromBody);
  if (status) return new Error(`${fallback} (${status})`);
  return new Error(err.message || fallback);
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

/** POST /api/users/me — create or fetch the Mongo user for this Auth0 login */
export async function ensureCurrentUser() {
  try {
    const { data } = await api.post("/api/users/me");
    return data;
  } catch (err) {
    throw apiError(err, "Failed to create account");
  }
}

/** PATCH /api/users/me */
export async function updateCurrentUser(body) {
  try {
    const { data } = await api.patch("/api/users/me", body);
    return data;
  } catch (err) {
    throw apiError(err, "Failed to update profile");
  }
}

/** DELETE /api/users/me */
export async function deleteCurrentUser() {
  try {
    const { data } = await api.delete("/api/users/me");
    return data;
  } catch (err) {
    throw apiError(err, "Failed to delete account");
  }
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

function mapFriendship(item) {
  return {
    id: item?.user?.id || "",
    display_name: item?.user?.display_name || "User",
    email: item?.user?.email || "",
    friendship_id: item?.friendship_id,
    status: item?.status,
    direction: item?.direction,
  };
}

/** GET /api/friends */
export async function fetchFriends() {
  try {
    const { data } = await api.get("/api/friends");
    return {
      success: data?.success !== false,
      me: data?.me || null,
      accepted: (data?.accepted || []).map(mapFriendship),
      incoming: (data?.incoming || []).map(mapFriendship),
      outgoing: (data?.outgoing || []).map(mapFriendship),
    };
  } catch (err) {
    throw apiError(err, "Failed to load friends");
  }
}

/** POST /api/friends  body { email } */
export async function addFriendByEmail(email) {
  try {
    const { data } = await api.post("/api/friends", { email });
    return data;
  } catch (err) {
    throw apiError(err, "Failed to send friend request");
  }
}

/** POST /api/friends/:id/accept */
export async function acceptFriendRequest(friendshipId) {
  try {
    const { data } = await api.post(`/api/friends/${friendshipId}/accept`);
    return data;
  } catch (err) {
    throw apiError(err, "Failed to accept friend request");
  }
}

/** POST /api/friends/:id/unsend */
export async function unsendFriendRequest(friendshipId) {
  try {
    const { data } = await api.post(`/api/friends/${friendshipId}/unsend`);
    return data;
  } catch (err) {
    throw apiError(err, "Failed to unsend friend request");
  }
}
