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

/** GET /api/recommendations?group_id= */
export async function fetchRecommendations(groupId) {
  try {
    const { data } = await api.get("/api/recommendations", {
      params: { group_id: groupId },
    });
    return data;
  } catch (err) {
    throw apiError(err, "Failed to load recommendations");
  }
}

/** GET /api/places — city catalog, not the group graph */
export async function fetchPlaces(params = {}) {
  try {
    const { data } = await api.get("/api/places", { params });
    return {
      success: data?.success !== false,
      places: data?.places || [],
      neighborhoods: data?.neighborhoods || [],
    };
  } catch (err) {
    throw apiError(err, "Failed to load places");
  }
}

/** POST /api/places — add a named hangout to the catalog */
export async function createPlace(body) {
  try {
    const { data } = await api.post("/api/places", body);
    return data;
  } catch (err) {
    throw apiError(err, "Failed to add place");
  }
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

/**
 * POST /api/location/traces — flush a buffered, encoded polyline of
 * accepted GPS fixes (see requirements.md §5, TASKS.md Phase 1-2).
 */
export async function postLocationTrace(body) {
  try {
    const { data } = await api.post("/api/location/traces", body);
    return data;
  } catch (err) {
    throw apiError(err, "Failed to upload location trace");
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

function mapGroupInvite(item) {
  return {
    invite_id: item?.invite_id,
    status: item?.status,
    direction: item?.direction,
    created_at: item?.created_at,
    group: item?.group || null,
    user: item?.user || null,
  };
}

/** POST /api/groups  body { name } */
export async function createGroup(name) {
  try {
    const { data } = await api.post("/api/groups", { name });
    return data;
  } catch (err) {
    throw apiError(err, "Failed to create group");
  }
}

/** GET /api/groups */
export async function fetchMyGroups() {
  try {
    const { data } = await api.get("/api/groups");
    return data;
  } catch (err) {
    throw apiError(err, "Failed to load groups");
  }
}

/** GET /api/groups/:groupId/inviteable */
export async function fetchInviteableFriends(groupId) {
  try {
    const { data } = await api.get(`/api/groups/${groupId}/inviteable`);
    return data;
  } catch (err) {
    throw apiError(err, "Failed to load inviteable friends");
  }
}

/** POST /api/groups/:groupId/invites  body { user_id } */
export async function inviteFriendToGroup(groupId, userId) {
  try {
    const { data } = await api.post(`/api/groups/${groupId}/invites`, { user_id: userId });
    return data;
  } catch (err) {
    throw apiError(err, "Failed to send group invite");
  }
}

/** GET /api/groups/invites */
export async function fetchGroupInvites() {
  try {
    const { data } = await api.get("/api/groups/invites");
    return {
      success: data?.success !== false,
      me: data?.me || null,
      incoming: (data?.incoming || []).map(mapGroupInvite),
      outgoing: (data?.outgoing || []).map(mapGroupInvite),
    };
  } catch (err) {
    throw apiError(err, "Failed to load group invites");
  }
}

/** POST /api/groups/invites/:id/accept */
export async function acceptGroupInvite(inviteId) {
  try {
    const { data } = await api.post(`/api/groups/invites/${inviteId}/accept`);
    return data;
  } catch (err) {
    throw apiError(err, "Failed to accept group invite");
  }
}

/** POST /api/groups/invites/:id/decline */
export async function declineGroupInvite(inviteId) {
  try {
    const { data } = await api.post(`/api/groups/invites/${inviteId}/decline`);
    return data;
  } catch (err) {
    throw apiError(err, "Failed to decline group invite");
  }
}

/** POST /api/groups/invites/:id/unsend */
export async function unsendGroupInvite(inviteId) {
  try {
    const { data } = await api.post(`/api/groups/invites/${inviteId}/unsend`);
    return data;
  } catch (err) {
    throw apiError(err, "Failed to unsend group invite");
  }
}
