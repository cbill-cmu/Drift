import { ObjectId } from "mongodb";
import { COLLECTIONS } from "../models/index.js";
import { asString, idVariants, sameId } from "./ids.js";
import { getDb } from "./mongoService.js";

/** user_id_1 = requester, user_id_2 = recipient. */
const PENDING = "pending";
const ACCEPTED = "accepted";
const BLOCKED = "blocked";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let indexesReady = false;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fieldMatchesUser(field, userId) {
  return { $or: idVariants(userId).map((value) => ({ [field]: value })) };
}

function pairFilter(userA, userB) {
  return {
    $or: [
      {
        $and: [fieldMatchesUser("user_id_1", userA), fieldMatchesUser("user_id_2", userB)],
      },
      {
        $and: [fieldMatchesUser("user_id_1", userB), fieldMatchesUser("user_id_2", userA)],
      },
    ],
  };
}

function involvedFilter(userId) {
  return {
    $or: [fieldMatchesUser("user_id_1", userId), fieldMatchesUser("user_id_2", userId)],
  };
}

function emailsMatch(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: asString(user._id),
    display_name: user.display_name || user.email || "User",
    email: user.email || "",
  };
}

function serializeRow(row, me, other) {
  const iAmRequester = sameId(row.user_id_1, me._id);
  return {
    friendship_id: asString(row._id),
    status: row.status,
    direction: iAmRequester ? "outgoing" : "incoming",
    created_at: row.created_at,
    user: publicUser(other),
  };
}

async function ensureIndexes(db) {
  if (indexesReady) return;
  try {
    await db.collection(COLLECTIONS.FRIENDS).createIndex(
      { user_id_1: 1, user_id_2: 1 },
      { unique: true }
    );
  } catch (err) {
    console.warn("[friends] ensureIndexes:", err.message);
  }
  indexesReady = true;
}

export async function requireCurrentUser(db, auth) {
  if (!auth?.sub && !auth?.email) {
    throw new HttpError(401, "Unauthorized");
  }

  const users = db.collection(COLLECTIONS.USERS);
  const email = String(auth.email || "").trim();
  const clauses = [];
  if (auth.sub) clauses.push({ auth0_id: auth.sub });
  if (email) {
    clauses.push({
      email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
    });
  }

  let me = await users.findOne({ $or: clauses });

  if (!me) {
    if (!auth.sub) {
      throw new HttpError(404, "Current user is not in the database");
    }
    const now = new Date();
    const doc = {
      auth0_id: auth.sub,
      email,
      display_name: auth.name || email || "Traveler",
      created_at: now,
      groups: [],
    };
    try {
      const { insertedId } = await users.insertOne(doc);
      doc._id = insertedId;
      me = doc;
    } catch (err) {
      const again = await users.findOne({ auth0_id: auth.sub });
      if (!again) throw err;
      me = again;
    }
  }

  if (email && !emailsMatch(me.email, email)) {
    await users.updateOne({ _id: me._id }, { $set: { email } });
    me.email = email;
  }

  return me;
}

async function findUserByEmail(db, email) {
  return db.collection(COLLECTIONS.USERS).findOne({
    email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
  });
}

async function findPair(db, userA, userB) {
  return db.collection(COLLECTIONS.FRIENDS).findOne(pairFilter(userA, userB));
}

/**
 * POST /api/friends
 * Body: { email }
 */
export async function requestFriend(rawBody, auth = {}) {
  const db = getDb();
  await ensureIndexes(db);

  const trimmed = String(rawBody?.email || "").trim();
  if (!trimmed) throw new HttpError(400, "email is required");
  if (!EMAIL_RE.test(trimmed)) throw new HttpError(400, "email is invalid");

  const me = await requireCurrentUser(db, auth);

  if (emailsMatch(me.email, trimmed)) {
    throw new HttpError(400, "You cannot add yourself as a friend");
  }

  const other = await findUserByEmail(db, trimmed);
  if (!other) throw new HttpError(404, "No user found with that email");

  if (sameId(me._id, other._id)) {
    throw new HttpError(400, "You cannot add yourself as a friend");
  }

  const existing = await findPair(db, me._id, other._id);

  if (existing) {
    if (existing.status === BLOCKED) {
      throw new HttpError(403, "Cannot send a friend request to this user");
    }
    if (existing.status === ACCEPTED) {
      throw new HttpError(409, "You are already friends");
    }
    if (existing.status === PENDING) {
      if (sameId(existing.user_id_1, me._id)) {
        throw new HttpError(409, "Friend request already sent");
      }
      await db.collection(COLLECTIONS.FRIENDS).updateOne(
        { _id: existing._id },
        { $set: { status: ACCEPTED, updated_at: new Date() } }
      );
      const accepted = await db.collection(COLLECTIONS.FRIENDS).findOne({ _id: existing._id });
      return {
        success: true,
        auto_accepted: true,
        friendship: serializeRow(accepted, me, other),
      };
    }
    throw new HttpError(409, "Friend request already exists");
  }

  const now = new Date();
  const doc = {
    user_id_1: me._id,
    user_id_2: other._id,
    status: PENDING,
    created_at: now,
    updated_at: now,
  };

  try {
    const { insertedId } = await db.collection(COLLECTIONS.FRIENDS).insertOne(doc);
    doc._id = insertedId;
  } catch (err) {
    if (err?.code === 11000) {
      throw new HttpError(409, "Friend request already sent");
    }
    throw err;
  }

  return {
    success: true,
    auto_accepted: false,
    friendship: serializeRow(doc, me, other),
  };
}

/**
 * POST /api/friends/:id/accept
 */
export async function acceptFriend(friendshipId, auth = {}) {
  const db = getDb();
  await ensureIndexes(db);

  if (!friendshipId || !ObjectId.isValid(friendshipId)) {
    throw new HttpError(400, "Invalid friend request id");
  }

  const me = await requireCurrentUser(db, auth);
  const friends = db.collection(COLLECTIONS.FRIENDS);
  const row = await friends.findOne({ _id: new ObjectId(friendshipId) });
  if (!row) throw new HttpError(404, "Friend request not found");

  const involved = sameId(row.user_id_1, me._id) || sameId(row.user_id_2, me._id);
  if (!involved) throw new HttpError(403, "This friend request is not yours");

  if (row.status === BLOCKED) {
    throw new HttpError(403, "Cannot accept a blocked relationship");
  }

  if (row.status === ACCEPTED) {
    const otherId = sameId(row.user_id_1, me._id) ? row.user_id_2 : row.user_id_1;
    const other = await db.collection(COLLECTIONS.USERS).findOne({
      $or: idVariants(otherId).map((value) => ({ _id: value })),
    });
    return {
      success: true,
      already_accepted: true,
      friendship: serializeRow(row, me, other || { _id: otherId }),
    };
  }

  if (row.status !== PENDING) {
    throw new HttpError(400, `Cannot accept a request with status "${row.status}"`);
  }

  if (!sameId(row.user_id_2, me._id)) {
    throw new HttpError(403, "Only the recipient can accept this request");
  }

  await friends.updateOne(
    { _id: row._id },
    { $set: { status: ACCEPTED, updated_at: new Date() } }
  );
  const updated = await friends.findOne({ _id: row._id });
  const other = await db.collection(COLLECTIONS.USERS).findOne({
    $or: idVariants(updated.user_id_1).map((value) => ({ _id: value })),
  });

  return {
    success: true,
    already_accepted: false,
    friendship: serializeRow(updated, me, other || { _id: updated.user_id_1 }),
  };
}

/**
 * POST /api/friends/:id/unsend
 * Requester cancels a pending invite. Deletes the row so they can send again.
 */
export async function unsendFriend(friendshipId, auth = {}) {
  const db = getDb();
  await ensureIndexes(db);

  if (!friendshipId || !ObjectId.isValid(friendshipId)) {
    throw new HttpError(400, "Invalid friend request id");
  }

  const me = await requireCurrentUser(db, auth);
  const friends = db.collection(COLLECTIONS.FRIENDS);
  const row = await friends.findOne({ _id: new ObjectId(friendshipId) });
  if (!row) throw new HttpError(404, "Friend request not found");

  const involved = sameId(row.user_id_1, me._id) || sameId(row.user_id_2, me._id);
  if (!involved) throw new HttpError(403, "This friend request is not yours");

  if (!sameId(row.user_id_1, me._id)) {
    throw new HttpError(403, "Only the sender can unsend this request");
  }

  if (row.status === BLOCKED) {
    throw new HttpError(403, "Cannot unsend a blocked relationship");
  }

  if (row.status === ACCEPTED) {
    throw new HttpError(400, "Cannot unsend an accepted friendship");
  }

  if (row.status !== PENDING) {
    throw new HttpError(400, `Cannot unsend a request with status "${row.status}"`);
  }

  await friends.deleteOne({ _id: row._id });
  const other = await db.collection(COLLECTIONS.USERS).findOne({
    $or: idVariants(row.user_id_2).map((value) => ({ _id: value })),
  });

  return {
    success: true,
    unsent: true,
    friendship: serializeRow(row, me, other || { _id: row.user_id_2 }),
  };
}

/**
 * GET /api/friends
 */
export async function listFriends(auth = {}) {
  const db = getDb();
  await ensureIndexes(db);

  const me = await requireCurrentUser(db, auth);
  const rows = await db
    .collection(COLLECTIONS.FRIENDS)
    .find(involvedFilter(me._id))
    .sort({ created_at: -1 })
    .toArray();

  const counterpartIds = rows.map((row) =>
    sameId(row.user_id_1, me._id) ? row.user_id_2 : row.user_id_1
  );

  const others = counterpartIds.length
    ? await db
        .collection(COLLECTIONS.USERS)
        .find({
          $or: counterpartIds.flatMap((id) => idVariants(id).map((value) => ({ _id: value }))),
        })
        .toArray()
    : [];

  const otherById = new Map(others.map((user) => [asString(user._id), user]));

  const accepted = [];
  const incoming = [];
  const outgoing = [];

  for (const row of rows) {
    if (row.status === BLOCKED) continue;
    const otherId = sameId(row.user_id_1, me._id) ? row.user_id_2 : row.user_id_1;
    const other =
      otherById.get(asString(otherId)) || { _id: otherId, display_name: "Unknown", email: "" };
    const item = serializeRow(row, me, other);
    if (row.status === ACCEPTED) accepted.push(item);
    else if (row.status === PENDING && item.direction === "incoming") incoming.push(item);
    else if (row.status === PENDING && item.direction === "outgoing") outgoing.push(item);
  }

  return {
    success: true,
    me: publicUser(me),
    accepted,
    incoming,
    outgoing,
  };
}
