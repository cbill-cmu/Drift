import { useAuth0 } from "@auth0/auth0-react";

/**
 * Auth helper — must only be used under Auth0Provider (see main.jsx).
 */
export function useAuthStatus() {
  const auth = useAuth0();

  return {
    isConfigured: true,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    error: auth.error,
    loginWithRedirect: auth.loginWithRedirect,
    logout: auth.logout,
    getAccessTokenSilently: auth.getAccessTokenSilently,
  };
}

export { useAuth0 };
