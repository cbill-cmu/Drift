import { useCallback, useEffect, useState } from "react";
import {
  acceptGroupInvite,
  declineGroupInvite,
  fetchGroupInvites,
  fetchInviteableFriends,
  inviteFriendToGroup,
  unsendGroupInvite,
} from "../api/client.js";

export function useGroupInvites(groupId) {
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
      return result;
    },
    [reload]
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
