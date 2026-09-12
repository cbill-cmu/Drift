import { useCallback, useEffect, useState } from "react";
import {
  acceptFriendRequest,
  addFriendByEmail,
  fetchFriends,
  unsendFriendRequest,
} from "../api/client.js";
import { runFriendInvite } from "../utils/friendInvite.js";

export function useFriends() {
  const [accepted, setAccepted] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inviteNotice, setInviteNotice] = useState("");
  const [inviteNoticeKind, setInviteNoticeKind] = useState("hint");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFriends();
      setMe(data.me || null);
      setAccepted(data.accepted);
      setIncoming(data.incoming);
      setOutgoing(data.outgoing);
    } catch (err) {
      setMe(null);
      setAccepted([]);
      setIncoming([]);
      setOutgoing([]);
      setError(err.message || "Failed to load friends");
    } finally {
      setLoading(false);
    }
  }, []);

  const clearInviteNotice = useCallback(() => {
    setInviteNotice("");
    setInviteNoticeKind("hint");
  }, []);

  const addByEmail = useCallback(
    async (email) => {
      clearInviteNotice();
      const result = await addFriendByEmail(email);
      await reload();
      return result;
    },
    [clearInviteNotice, reload]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const job = runFriendInvite(addByEmail);
    if (!job) return;
    let cancelled = false;
    job
      .then((result) => {
        if (cancelled || !result) return;
        setInviteNoticeKind("hint");
        const name = result.friendship?.user?.display_name;
        if (result.auto_accepted) {
          setInviteNotice(`You and ${name || "this user"} are now friends.`);
        } else {
          setInviteNotice(`Invite sent to ${name || "this user"}.`);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setInviteNoticeKind("error");
        setInviteNotice(err.message || "Could not send invite from QR");
      });
    return () => {
      cancelled = true;
    };
  }, [addByEmail]);

  const accept = useCallback(
    async (friendshipId) => {
      clearInviteNotice();
      const result = await acceptFriendRequest(friendshipId);
      await reload();
      return result;
    },
    [clearInviteNotice, reload]
  );

  const unsend = useCallback(
    async (friendshipId) => {
      clearInviteNotice();
      const result = await unsendFriendRequest(friendshipId);
      await reload();
      return result;
    },
    [clearInviteNotice, reload]
  );

  return {
    me,
    accepted,
    incoming,
    outgoing,
    loading,
    error,
    inviteNotice,
    inviteNoticeKind,
    reload,
    addByEmail,
    accept,
    unsend,
    clearInviteNotice,
  };
}
