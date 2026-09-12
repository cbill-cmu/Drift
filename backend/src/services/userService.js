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
    groups: Array.isArray(user.groups) ? user.groups.map(asString) : [],
    // null = implicit allow-all (field never written). Explicit [] means
    // share with no groups.
    contributes_to: Array.isArray(user.contributes_to)
      ? user.contributes_to.map(asString)
      : null,
    created_at: user.created_at || null,
  };
}

/**
 * Allowlist with implicit-all default: missing `contributes_to` means
 * the user shares exploration with every group they belong to.
 */
export function userSharesExploration(user, groupId) {
  if (!Array.isArray(user?.contributes_to)) return true;
  const wanted = asString(groupId);
  if (!wanted) return false;
  return user.contributes_to.some((id) => asString(id) === wanted);
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
      // Auto-provisioned from the Auth0 identity on first login — no
      // separate profile-creation step. display_name defaults to the
      // Auth0 `name` claim (or blank; the user can rename any time via
      // Account settings, which is the only editable field).
      display_name: displayName,
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

  if (Object.keys(updates).length) {
    await users.updateOne({ _id: me._id }, { $set: updates });
    me = { ...me, ...updates };
  }

  return { user: me, created };
}

/**
 * PATCH /api/users/me — nickname and/or per-group exploration sharing.
 * Fields are optional and independent so a privacy toggle does not wipe
 * display_name.
 */
export async function updateCurrentUser(auth = {}, body = {}) {
  const { user } = await upsertCurrentUser(auth);
  const db = getDb();
  const hasName = Object.prototype.hasOwnProperty.call(body, "display_name");
  const share = body.share_exploration;
  if (!hasName && (share == null || typeof share !== "object")) {
    throw new HttpError(400, "display_name or share_exploration is required");
  }

  const users = db.collection(COLLECTIONS.USERS);
  const setDoc = { updated_at: new Date() };
  let next = { ...user };

  if (hasName) {
    const display_name = String(body.display_name || "").trim();
    if (display_name.length > 80) {
      throw new HttpError(400, "display_name must be 80 characters or less");
    }
    setDoc.display_name = display_name;
    next.display_name = display_name;
    await users.updateOne({ _id: user._id }, { $set: setDoc });
    next = { ...next, ...setDoc };
  }

  if (share != null && typeof share === "object") {
    const groupId = String(share.group_id || "").trim();
    if (!groupId) throw new HttpError(400, "share_exploration.group_id is required");
    if (typeof share.enabled !== "boolean") {
      throw new HttpError(400, "share_exploration.enabled must be a boolean");
    }
    next = await setExplorationShare(db, next, groupId, share.enabled);
  } else if (!hasName) {
    throw new HttpError(400, "display_name or share_exploration is required");
  }

  return { user: next };
}

/**
 * Write `contributes_to` for one group. First opt-out materializes the
 * allowlist from current memberships minus this group, so other groups
 * keep sharing. Cells are not deleted.
 */
async function setExplorationShare(db, user, groupId, enabled) {
  const group = await db.collection(COLLECTIONS.GROUPS).findOne({
    $or: [
      ...idVariants(groupId).map((value) => ({ _id: value })),
    ],
  });
  if (!group) throw new HttpError(404, "Unknown group");

  const member = (group.member_ids || []).some((id) => asString(id) === asString(user._id));
  if (!member) throw new HttpError(403, "Not a member of this group");

  const users = db.collection(COLLECTIONS.USERS);
  const groupKey = group._id;

  if (!Array.isArray(user.contributes_to)) {
    if (enabled) {
      return user;
    }
    const memberships = await db
      .collection(COLLECTIONS.GROUPS)
      .find({ member_ids: { $in: idVariants(user._id) } })
      .project({ _id: 1 })
      .toArray();
    const materialized = memberships
      .map((row) => row._id)
      .filter((id) => asString(id) !== asString(groupKey));
    await users.updateOne(
      { _id: user._id },
      { $set: { contributes_to: materialized, updated_at: new Date() } }
    );
    return { ...user, contributes_to: materialized };
  }

  if (enabled) {
    await users.updateOne(
      { _id: user._id },
      { $addToSet: { contributes_to: groupKey }, $set: { updated_at: new Date() } }
    );
  } else {
    await users.updateOne(
      { _id: user._id },
      {
        $pull: { contributes_to: { $in: idVariants(groupKey) } },
        $set: { updated_at: new Date() },
      }
    );
  }

  const fresh = await users.findOne({ _id: user._id });
  return fresh || user;
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
