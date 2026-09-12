import { ObjectId } from "mongodb";
import { COLLECTIONS, INDEXES } from "../models/index.js";
import { asString, idVariants, matchGroupId, sameId } from "./ids.js";
import { getDb } from "./mongoService.js";
import { HttpError, requireCurrentUser } from "./friendsService.js";

const PENDING = "pending";
const ACCEPTED = "accepted";
const FRIEND_ACCEPTED = "accepted";

const MAX_GROUP_NAME = 80;

let indexesReady = false;

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

function publicUser(user) {
  return {
    id: asString(user._id),
    display_name: user.display_name || user.email || "User",
    email: user.email || "",
  };
}

function serializeGroup(group) {
  return {
    id: asString(group._id),
    name: group.name || "Group",
    creator_id: asString(group.creator_id),
    member_ids: (group.member_ids || []).map(asString),
    created_at: group.created_at,
    total_nodes_discovered: group.total_nodes_discovered || 0,
    total_edges_discovered: group.total_edges_discovered || 0,
  };
}

function serializeInvite(row, me, other, group) {
  const iAmInviter = sameId(row.inviter_id, me._id);
  return {
    invite_id: asString(row._id),
    status: row.status,
    direction: iAmInviter ? "outgoing" : "incoming",
    created_at: row.created_at,
    group: {
      id: asString(group?._id || row.group_id),
      name: group?.name || "Group",
    },
    user: publicUser(other),
  };
}

function isHexObjectId(value) {
  return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
}

function isGroupMember(group, user) {
  const memberIds = group.member_ids || [];
  return (
    memberIds.some((id) => sameId(id, user._id)) ||
    memberIds.some((id) => sameId(id, user.auth0_id)) ||
    sameId(group.creator_id, user._id)
  );
}

async function ensureIndexes(db) {
  if (indexesReady) return;
  try {
    await db.collection(COLLECTIONS.GROUP_INVITES).createIndexes(INDEXES.group_invites);
  } catch (err) {
    console.warn("[groups] ensureIndexes:", err.message);
  }
  indexesReady = true;
}

async function findGroup(db, groupId) {
  return db.collection(COLLECTIONS.GROUPS).findOne({
    $or: idVariants(groupId).map((value) => ({ _id: value })),
  });
}

async function findUserById(db, userId) {
  const raw = String(userId || "").trim();
  if (!raw) return null;
  return db.collection(COLLECTIONS.USERS).findOne({
    $or: [
      ...idVariants(raw).map((value) => ({ _id: value })),
      { auth0_id: raw },
    ],
  });
}

async function findAcceptedFriendship(db, userA, userB) {
  return db.collection(COLLECTIONS.FRIENDS).findOne({
    $and: [pairFilter(userA, userB), { status: FRIEND_ACCEPTED }],
  });
}

async function findInviteForPair(db, groupId, inviteeId) {
  return db.collection(COLLECTIONS.GROUP_INVITES).findOne({
    $and: [
      matchGroupId("group_id", groupId),
      { $or: idVariants(inviteeId).map((value) => ({ invitee_id: value })) },
    ],
  });
}

async function requireInvite(db, inviteId) {
  if (!isHexObjectId(inviteId) || !ObjectId.isValid(inviteId)) {
    throw new HttpError(400, "Invalid group invite id");
  }
  const row = await db.collection(COLLECTIONS.GROUP_INVITES).findOne({
    _id: new ObjectId(inviteId),
  });
  if (!row) throw new HttpError(404, "Group invite not found");
  return row;
}

async function loadInviteContext(db, row, me) {
  const otherId = sameId(row.inviter_id, me._id) ? row.invitee_id : row.inviter_id;
  const [other, group] = await Promise.all([
    findUserById(db, otherId),
    findGroup(db, row.group_id),
  ]);
  return {
    other: other || { _id: otherId, display_name: "User", email: "" },
    group: group || { _id: row.group_id, name: "Group" },
  };
}

/**
 * POST /api/groups
 * Body: { name }
 */
export async function createGroup(rawBody, auth = {}) {
  const db = getDb();
  await ensureIndexes(db);

  const name = String(rawBody?.name || "").trim();
  if (!name) throw new HttpError(400, "name is required");
  if (name.length > MAX_GROUP_NAME) {
    throw new HttpError(400, `name must be ${MAX_GROUP_NAME} characters or fewer`);
  }

  const me = await requireCurrentUser(db, auth);
  const now = new Date();
  const doc = {
    name,
    creator_id: me._id,
    member_ids: [me._id],
    created_at: now,
    total_nodes_discovered: 0,
    total_edges_discovered: 0,
  };

  const { insertedId } = await db.collection(COLLECTIONS.GROUPS).insertOne(doc);
  doc._id = insertedId;

  await db.collection(COLLECTIONS.USERS).updateOne(
    { _id: me._id },
    { $addToSet: { groups: insertedId } }
  );

  return { success: true, group: serializeGroup(doc) };
}

/**
 * GET /api/groups
 */
export async function listMyGroups(auth = {}) {
  const db = getDb();
  await ensureIndexes(db);

  const me = await requireCurrentUser(db, auth);
  const variants = [...idVariants(me._id)];
  if (me.auth0_id) variants.push(...idVariants(me.auth0_id));

  const groups = await db
    .collection(COLLECTIONS.GROUPS)
    .find({
      $or: [{ member_ids: { $in: variants } }, { creator_id: { $in: variants } }],
    })
    .sort({ created_at: -1 })
    .toArray();

  return {
    success: true,
    groups: groups.map(serializeGroup),
  };
}

/**
 * POST /api/groups/:groupId/invites
 * Body: { user_id } — must be an accepted friend, not already a member.
 */
export async function inviteFriendToGroup(groupId, rawBody, auth = {}) {
  const db = getDb();
  await ensureIndexes(db);

  const userId = String(rawBody?.user_id || "").trim();
  if (!userId) throw new HttpError(400, "user_id is required");

  const me = await requireCurrentUser(db, auth);
  const group = await findGroup(db, groupId);
  if (!group) throw new HttpError(404, "Unknown group");
  if (!isGroupMember(group, me)) {
    throw new HttpError(403, "Not a group member");
  }

  const other = await findUserById(db, userId);
  if (!other) throw new HttpError(404, "No user found with that id");
  if (sameId(me._id, other._id)) {
    throw new HttpError(400, "You cannot invite yourself");
  }
  if (isGroupMember(group, other)) {
    throw new HttpError(409, "That user is already a group member");
  }

  const friendship = await findAcceptedFriendship(db, me._id, other._id);
  if (!friendship) {
    throw new HttpError(403, "You can only invite accepted friends");
  }

  const existing = await findInviteForPair(db, group._id, other._id);
  if (existing) {
    if (existing.status === PENDING) {
      throw new HttpError(409, "Group invite already sent");
    }
    if (existing.status === ACCEPTED) {
      throw new HttpError(409, "That user is already a group member");
    }
  }

  const now = new Date();
  const doc = {
    group_id: group._id,
    inviter_id: me._id,
    invitee_id: other._id,
    status: PENDING,
    created_at: now,
    updated_at: now,
  };

  try {
    const { insertedId } = await db.collection(COLLECTIONS.GROUP_INVITES).insertOne(doc);
    doc._id = insertedId;
  } catch (err) {
    if (err?.code === 11000) {
      throw new HttpError(409, "Group invite already sent");
    }
    throw err;
  }

  return {
    success: true,
    invite: serializeInvite(doc, me, other, group),
  };
}

/**
 * GET /api/groups/:groupId/inviteable
 * Accepted friends who are not members and have no pending invite.
 */
export async function listInviteableFriends(groupId, auth = {}) {
  const db = getDb();
  await ensureIndexes(db);

  const me = await requireCurrentUser(db, auth);
  const group = await findGroup(db, groupId);
  if (!group) throw new HttpError(404, "Unknown group");
  if (!isGroupMember(group, me)) {
    throw new HttpError(403, "Not a group member");
  }

  const friendRows = await db
    .collection(COLLECTIONS.FRIENDS)
    .find({
      $and: [
        {
          $or: [fieldMatchesUser("user_id_1", me._id), fieldMatchesUser("user_id_2", me._id)],
        },
        { status: FRIEND_ACCEPTED },
      ],
    })
    .toArray();

  const friendIds = friendRows.map((row) =>
    sameId(row.user_id_1, me._id) ? row.user_id_2 : row.user_id_1
  );

  const existingInvites = await db
    .collection(COLLECTIONS.GROUP_INVITES)
    .find(matchGroupId("group_id", group._id))
    .toArray();
  const invitedIds = new Set(existingInvites.map((row) => asString(row.invitee_id)));

  const friends = friendIds.length
    ? await db
        .collection(COLLECTIONS.USERS)
        .find({
          $or: friendIds.flatMap((id) => idVariants(id).map((value) => ({ _id: value }))),
        })
        .toArray()
    : [];

  const inviteable = friends
    .filter((user) => !isGroupMember(group, user))
    .filter((user) => !invitedIds.has(asString(user._id)))
    .map(publicUser);

  return {
    success: true,
    group: { id: asString(group._id), name: group.name || "Group" },
    inviteable,
  };
}

/**
 * GET /api/groups/invites
 */
export async function listMyGroupInvites(auth = {}) {
  const db = getDb();
  await ensureIndexes(db);

  const me = await requireCurrentUser(db, auth);
  const rows = await db
    .collection(COLLECTIONS.GROUP_INVITES)
    .find({
      $and: [
        {
          $or: [fieldMatchesUser("inviter_id", me._id), fieldMatchesUser("invitee_id", me._id)],
        },
        { status: PENDING },
      ],
    })
    .sort({ created_at: -1 })
    .toArray();

  const userIds = rows.map((row) =>
    sameId(row.inviter_id, me._id) ? row.invitee_id : row.inviter_id
  );
  const groupIds = rows.map((row) => row.group_id);

  const [users, groups] = await Promise.all([
    userIds.length
      ? db
          .collection(COLLECTIONS.USERS)
          .find({
            $or: userIds.flatMap((id) => idVariants(id).map((value) => ({ _id: value }))),
          })
          .toArray()
      : [],
    groupIds.length
      ? db
          .collection(COLLECTIONS.GROUPS)
          .find({
            $or: groupIds.flatMap((id) => idVariants(id).map((value) => ({ _id: value }))),
          })
          .toArray()
      : [],
  ]);

  const userById = new Map(users.map((user) => [asString(user._id), user]));
  const groupById = new Map(groups.map((group) => [asString(group._id), group]));

  const incoming = [];
  const outgoing = [];

  for (const row of rows) {
    const otherId = sameId(row.inviter_id, me._id) ? row.invitee_id : row.inviter_id;
    const other =
      userById.get(asString(otherId)) || { _id: otherId, display_name: "User", email: "" };
    const group =
      groupById.get(asString(row.group_id)) || { _id: row.group_id, name: "Group" };
    const item = serializeInvite(row, me, other, group);
    if (item.direction === "incoming") incoming.push(item);
    else outgoing.push(item);
  }

  return {
    success: true,
    me: publicUser(me),
    incoming,
    outgoing,
  };
}

/**
 * POST /api/groups/invites/:id/accept
 */
export async function acceptGroupInvite(inviteId, auth = {}) {
  const db = getDb();
  await ensureIndexes(db);

  const me = await requireCurrentUser(db, auth);
  const row = await requireInvite(db, inviteId);

  if (!sameId(row.invitee_id, me._id)) {
    throw new HttpError(403, "Only the invitee can accept this invite");
  }

  const { other, group } = await loadInviteContext(db, row, me);

  if (row.status === ACCEPTED) {
    return {
      success: true,
      already_accepted: true,
      invite: serializeInvite(row, me, other, group),
      group: serializeGroup(group),
    };
  }

  if (row.status !== PENDING) {
    throw new HttpError(400, `Cannot accept an invite with status "${row.status}"`);
  }

  const now = new Date();
  await db.collection(COLLECTIONS.GROUP_INVITES).updateOne(
    { _id: row._id },
    { $set: { status: ACCEPTED, updated_at: now } }
  );

  if (group?._id) {
    await db.collection(COLLECTIONS.GROUPS).updateOne(
      { _id: group._id },
      { $addToSet: { member_ids: me._id } }
    );
    await db.collection(COLLECTIONS.USERS).updateOne(
      { _id: me._id },
      { $addToSet: { groups: group._id } }
    );
  }

  const updatedInvite = await db.collection(COLLECTIONS.GROUP_INVITES).findOne({ _id: row._id });
  const updatedGroup = group?._id ? await findGroup(db, group._id) : group;

  return {
    success: true,
    already_accepted: false,
    invite: serializeInvite(updatedInvite, me, other, updatedGroup),
    group: serializeGroup(updatedGroup || group),
  };
}

/**
 * POST /api/groups/invites/:id/decline
 * Invitee deletes the row so they can be invited again.
 */
export async function declineGroupInvite(inviteId, auth = {}) {
  const db = getDb();
  await ensureIndexes(db);

  const me = await requireCurrentUser(db, auth);
  const row = await requireInvite(db, inviteId);

  if (!sameId(row.invitee_id, me._id)) {
    throw new HttpError(403, "Only the invitee can decline this invite");
  }
  if (row.status === ACCEPTED) {
    throw new HttpError(400, "Cannot decline an accepted invite");
  }
  if (row.status !== PENDING) {
    throw new HttpError(400, `Cannot decline an invite with status "${row.status}"`);
  }

  const { other, group } = await loadInviteContext(db, row, me);
  await db.collection(COLLECTIONS.GROUP_INVITES).deleteOne({ _id: row._id });

  return {
    success: true,
    declined: true,
    invite: serializeInvite(row, me, other, group),
  };
}

/**
 * POST /api/groups/invites/:id/unsend
 * Inviter deletes the row so they can send again.
 */
export async function unsendGroupInvite(inviteId, auth = {}) {
  const db = getDb();
  await ensureIndexes(db);

  const me = await requireCurrentUser(db, auth);
  const row = await requireInvite(db, inviteId);

  if (!sameId(row.inviter_id, me._id)) {
    throw new HttpError(403, "Only the sender can unsend this invite");
  }
  if (row.status === ACCEPTED) {
    throw new HttpError(400, "Cannot unsend an accepted invite");
  }
  if (row.status !== PENDING) {
    throw new HttpError(400, `Cannot unsend an invite with status "${row.status}"`);
  }

  const { other, group } = await loadInviteContext(db, row, me);
  await db.collection(COLLECTIONS.GROUP_INVITES).deleteOne({ _id: row._id });

  return {
    success: true,
    unsent: true,
    invite: serializeInvite(row, me, other, group),
  };
}
