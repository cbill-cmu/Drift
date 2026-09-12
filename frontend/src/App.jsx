import Layout from "./components/Layout.jsx";

/**
 * Root app (Person 2).
 * Wire Auth0 gate + groupId from route/context once login works.
 */
export default function App() {
  const groupId = "REPLACE_WITH_SEEDED_GROUP_ID";

  return <Layout groupId={groupId} />;
}
