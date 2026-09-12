/** Demo friends list until Person 1/3 expose a friends API. */
export const fixtureFriends = {
  accepted: [
    { id: "alice", display_name: "Alice", email: "alice@test.com", status: "accepted" },
    { id: "bob", display_name: "Bob", email: "bob@test.com", status: "accepted" },
    { id: "hiro", display_name: "Hiro", email: "hiro@test.com", status: "accepted" },
  ],
  incoming: [
    { id: "cara", display_name: "Cara", email: "cara@test.com", status: "pending_in" },
  ],
  outgoing: [
    { id: "devon", display_name: "Devon", email: "devon@test.com", status: "pending_out" },
  ],
};
