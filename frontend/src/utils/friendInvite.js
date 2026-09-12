export const ADD_FRIEND_PARAM = "addFriend";

let pendingInvite = "";
let inviteJob = null;

export function readAddFriendParam() {
  return new URLSearchParams(window.location.search).get(ADD_FRIEND_PARAM)?.trim() || "";
}

export function clearAddFriendParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(ADD_FRIEND_PARAM)) return;
  url.searchParams.delete(ADD_FRIEND_PARAM);
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

export function friendInviteUrl(email) {
  const url = new URL(window.location.origin);
  url.searchParams.set(ADD_FRIEND_PARAM, String(email || "").trim());
  return url.toString();
}

export function captureFriendInvite() {
  const fromUrl = readAddFriendParam();
  if (fromUrl) {
    pendingInvite = fromUrl;
    clearAddFriendParam();
  }
  return pendingInvite;
}

export function runFriendInvite(sendInvite) {
  const email = captureFriendInvite();
  if (!email) return null;
  if (!inviteJob) {
    inviteJob = Promise.resolve()
      .then(() => sendInvite(email))
      .finally(() => {
        pendingInvite = "";
        inviteJob = null;
      });
  }
  return inviteJob;
}
