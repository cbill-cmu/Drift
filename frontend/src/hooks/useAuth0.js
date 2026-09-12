import { useAuth0 } from "@auth0/auth0-react";

/**
 * Auth helper for components.
 * If Auth0 env vars are missing, app runs in "dev mode" without login.
 */
export function useAuthStatus() {
  const configured = Boolean(
    import.meta.env.VITE_AUTH0_DOMAIN && import.meta.env.VITE_AUTH0_CLIENT_ID
  );

  if (!configured) {
    return {
      isConfigured: false,
      isAuthenticated: true,
      user: { name: "Dev User" },
      loginWithRedirect: async () => {},
      getAccessTokenSilently: async () => null,
    };
  }

  // Hooks must be called unconditionally — wrap only when provider is mounted.
  // When configured, Auth0Provider wraps App in main.jsx.
  return useAuth0Configured();
}

function useAuth0Configured() {
  const auth = useAuth0();
  return {
    isConfigured: true,
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    loginWithRedirect: auth.loginWithRedirect,
    getAccessTokenSilently: auth.getAccessTokenSilently,
  };
}

// Re-export for teammates who import useAuth0 from hooks/
export { useAuth0 };
