import { useCallback, useEffect, useState } from "react";
import {
  acceptGroupInvite,
  declineGroupInvite,
  fetchGroupInvites,
  fetchInviteableFriends,
  inviteFriendToGroup,
  unsendGroupInvite,
} from "../api/client.js";

const POLL_INTERVAL_MS = 10000;

export function useGroupInvites(groupId, { onGroupsChanged } = {}) {
  const [inviteable, setInviteable] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [memberDenied, setMemberDenied] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const inbox = await fetchGroupInvites();
      setIncoming(inbox.incoming);
      setOutgoing(inbox.outgoing);
    } catch (err) {
      setIncoming([]);
      setOutgoing([]);
      setError(err.message || "Failed to load group invites");
      setInviteable([]);
      setGroup(null);
      setMemberDenied(false);
      setLoading(false);
      return;
    }

    if (!groupId) {
      setInviteable([]);
      setGroup(null);
      setMemberDenied(false);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchInviteableFriends(groupId);
      setInviteable(data.inviteable || []);
      setGroup(data.group || null);
      setMemberDenied(false);
    } catch (err) {
      setInviteable([]);
      setGroup(null);
      const message = err.message || "Failed to load inviteable friends";
      if (/not a group member/i.test(message)) {
        setMemberDenied(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // No push channel (WebSocket/SSE) yet — poll while this panel is mounted
  // so an invite the other person sends/accepts shows up without the user
  // having to close and reopen the sheet. See PERSON_B_TASKS.md-style note:
  // this is the pragmatic fix for staleness; a real-time push channel is
  // the correct long-term upgrade if instant (<1s) updates become a
  // requirement rather than "within ~10s."
  useEffect(() => {
    const id = setInterval(reload, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reload]);

  const invite = useCallback(
    async (userId) => {
      const result = await inviteFriendToGroup(groupId, userId);
      await reload();
      return result;
    },
    [groupId, reload]
  );

  const accept = useCallback(
    async (inviteId) => {
      const result = await acceptGroupInvite(inviteId);
      await reload();
      // Accepting changes *this user's* group membership, which lives in a
      // separate hook instance (useGroups) with no shared state — nudge it
      // directly instead of waiting on its own poll interval.
      onGroupsChanged?.();
      return result;
    },
    [reload, onGroupsChanged]
  );

  const decline = useCallback(
    async (inviteId) => {
      const result = await declineGroupInvite(inviteId);
      await reload();
      return result;
    },
    [reload]
  );

  const unsend = useCallback(
    async (inviteId) => {
      const result = await unsendGroupInvite(inviteId);
      await reload();
      return result;
    },
    [reload]
  );

  return {
    group,
    inviteable,
    incoming,
    outgoing,
    loading,
    error,
    memberDenied,
    reload,
    invite,
    accept,
    decline,
    unsend,
  };
}
