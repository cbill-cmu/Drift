/**
 * Demo users aligned with Auth0 test accounts (see shared/auth0-setup.md).
 * Stub returns 10 users; expand display names / auth0_ids after Auth0 creation.
 */
export function generateUsers() {
  const names = [
    ["fabio@test.com", "Fabio"],
    ["alice@test.com", "Alice"],
    ["bob@test.com", "Bob"],
    ["cara@test.com", "Cara"],
    ["devon@test.com", "Devon"],
    ["elena@test.com", "Elena"],
    ["frank@test.com", "Frank"],
    ["grace@test.com", "Grace"],
    ["hiro@test.com", "Hiro"],
    ["ivy@test.com", "Ivy"],
  ];

  const now = new Date();
  return names.map(([email, display_name], i) => ({
    _localId: `user_${i}`,
    auth0_id: `auth0|seed_${email.split("@")[0]}`,
    email,
    display_name,
    created_at: now,
    groups: [],
  }));
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  console.log(JSON.stringify(generateUsers(), null, 2));
}
