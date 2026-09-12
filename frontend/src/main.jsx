import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App.jsx";
import "./styles/index.css";

const apiBase = import.meta.env.PROD
  ? import.meta.env.VITE_API_BASE_URL || ""
  : import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function bakedAuth() {
  return {
    domain: String(import.meta.env.VITE_AUTH0_DOMAIN || "").trim(),
    clientId: String(import.meta.env.VITE_AUTH0_CLIENT_ID || "").trim(),
    audience: String(import.meta.env.VITE_AUTH0_AUDIENCE || "").trim(),
  };
}

function AuthRoot() {
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const baked = bakedAuth();
    if (baked.domain && baked.clientId) {
      setCfg(baked);
      return undefined;
    }

    const ctrl = new AbortController();
    fetch(`${apiBase}/api/config`, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`config ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const domain = String(data.auth0_domain || "").trim();
        const clientId = String(data.auth0_client_id || "").trim();
        const audience = String(data.auth0_audience || "").trim();
        if (!domain || !clientId) {
          throw new Error(
            "Auth0 domain/client id missing on the server. Set AUTH0_DOMAIN and AUTH0_CLIENT_ID (or VITE_AUTH0_CLIENT_ID) in Render Environment, then Redeploy."
          );
        }
        setCfg({ domain, clientId, audience });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("[Auth0]", err);
        setError(err.message || String(err));
      });
    return () => ctrl.abort();
  }, []);

  if (error) {
    return (
      <div className="login-gate">
        <h1>Drift</h1>
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!cfg) {
    return (
      <div className="login-gate">
        <h1>Drift</h1>
        <p>Loading auth…</p>
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={cfg.domain}
      clientId={cfg.clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: cfg.audience || undefined,
        scope: "openid profile email offline_access",
      }}
      cacheLocation="localstorage"
      useRefreshTokens
      useRefreshTokensFallback
      onRedirectCallback={(appState) => {
        window.history.replaceState(
          {},
          document.title,
          appState?.returnTo || window.location.pathname
        );
      }}
    >
      <App />
    </Auth0Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AuthRoot />);
