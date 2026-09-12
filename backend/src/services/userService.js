import { COLLECTIONS } from "../models/index.js";
import { asString, idVariants } from "./ids.js";
import { getDb } from "./mongoService.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function emailsMatch(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

export function publicUser(user) {
  return {
    id: asString(user._id),
    auth0_id: user.auth0_id || "",
    display_name: user.display_name || "",
    email: user.email || "",
    home_neighborhood: user.home_neighborhood || "",
    calendar_file_name: user.calendar_file_name || "",
    preferred_travel_mode: user.preferred_travel_mode || "",
    profile_complete: Boolean(user.profile_complete),
    groups: Array.isArray(user.groups) ? user.groups.map(asString) : [],
    created_at: user.created_at || null,
  };
}

/**
 * Find or create the Mongo `users` row for this Auth0 identity.
 * Called on login/signup so the account exists before trips/friends.
 */
export async function upsertCurrentUser(auth = {}) {
  const sub = auth.sub || null;
  const email = String(auth.email || "").trim();
  const displayName = String(auth.name || "").trim();

  if (!sub && !email) {
    throw new HttpError(401, "Unauthorized");
  }

  const db = getDb();
  const users = db.collection(COLLECTIONS.USERS);
  let created = false;

  let me = sub ? await users.findOne({ auth0_id: sub }) : null;

  if (!me && email) {
    const byEmail = await users.findOne({
      email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
    });
    if (byEmail && (!byEmail.auth0_id || byEmail.auth0_id === sub)) {
      me = byEmail;
    }
  }

  if (!me) {
    if (!sub) {
      throw new HttpError(401, "Unauthorized");
    }
    const now = new Date();
    const doc = {
      auth0_id: sub,
      email,
      display_name: displayName,
      home_neighborhood: "",
      calendar_file_name: "",
      preferred_travel_mode: "",
      profile_complete: false,
      created_at: now,
      groups: [],
    };
    try {
      const { insertedId } = await users.insertOne(doc);
      doc._id = insertedId;
      me = doc;
      created = true;
    } catch (err) {
      const again = sub ? await users.findOne({ auth0_id: sub }) : null;
      if (!again) throw err;
      me = again;
    }
  }

  const updates = {};
  if (sub && !me.auth0_id) updates.auth0_id = sub;
  if (email && !emailsMatch(me.email, email)) updates.email = email;
  if (typeof me.profile_complete !== "boolean") {
    updates.profile_complete = true;
  }

  if (Object.keys(updates).length) {
    await users.updateOne({ _id: me._id }, { $set: updates });
    me = { ...me, ...updates };
  }

  return { user: me, created };
}

const TRAVEL_MODES = ["walk", "bus", "car", "uber", "train"];

/**
 * PATCH /api/users/me — complete or edit the Drift profile.
 */
export async function updateCurrentUser(auth = {}, body = {}) {
  const { user } = await upsertCurrentUser(auth);
  const db = getDb();

  const display_name = String(body.display_name || "").trim();
  if (!display_name) {
    throw new HttpError(400, "display_name is required");
  }
  if (display_name.length > 80) {
    throw new HttpError(400, "display_name must be 80 characters or less");
  }

  const calendar_file_name = String(body.calendar_file_name || "").trim();
  if (calendar_file_name.length > 200) {
    throw new HttpError(400, "calendar_file_name must be 200 characters or less");
  }

  const preferred_travel_mode = String(body.preferred_travel_mode || "").trim();
  if (preferred_travel_mode && !TRAVEL_MODES.includes(preferred_travel_mode)) {
    throw new HttpError(400, `preferred_travel_mode must be one of: ${TRAVEL_MODES.join(", ")}`);
  }

  const updates = {
    display_name,
    calendar_file_name,
    preferred_travel_mode,
    profile_complete: true,
    updated_at: new Date(),
  };

  await db.collection(COLLECTIONS.USERS).updateOne({ _id: user._id }, { $set: updates });
  return { user: { ...user, ...updates } };
}

/**
 * DELETE /api/users/me — remove this user's account-associated data.
 */
export async function deleteCurrentUser(auth = {}) {
  const { user } = await upsertCurrentUser(auth);
  const db = getDb();
  const variants = idVariants(user._id);
  const userMatch = { $or: variants.map((value) => ({ user_id: value })) };
  const friendMatch = {
    $or: [
      ...variants.map((value) => ({ user_id_1: value })),
      ...variants.map((value) => ({ user_id_2: value })),
    ],
  };

  await db.collection(COLLECTIONS.FRIENDS).deleteMany(friendMatch);
  await db.collection(COLLECTIONS.TRIPS).deleteMany(userMatch);
  await db.collection(COLLECTIONS.USER_HEATPOINTS).deleteMany(userMatch);
  await db.collection(COLLECTIONS.USER_PLACE_TYPE_PROFILES).deleteMany(userMatch);
  for (const value of variants) {
    await db.collection(COLLECTIONS.GROUPS).updateMany({}, { $pull: { member_ids: value } });
  }
  await db.collection(COLLECTIONS.USERS).deleteOne({ _id: user._id });
  return { deleted: true, user_id: asString(user._id) };
}
