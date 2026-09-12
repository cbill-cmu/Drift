/**
 * Auth0 JWT middleware (Person A).
 * Verifies Bearer access tokens via Auth0 JWKS (signature, issuer, audience, expiry).
 * See shared/auth0-setup.md for tenant details.
 */
import { auth as createJwtMiddleware } from "express-oauth2-jwt-bearer";

let jwtCheck = null;

function getJwtCheck() {
  if (jwtCheck) return jwtCheck;

  const domain = process.env.AUTH0_DOMAIN?.trim();
  const audience = process.env.AUTH0_AUDIENCE?.trim();
  if (!domain || !audience || domain.startsWith("YOUR_")) {
    return null;
  }

  jwtCheck = createJwtMiddleware({
    audience,
    issuerBaseURL: `https://${domain}/`,
    tokenSigningAlg: "RS256",
  });
  return jwtCheck;
}

function emailFromHeaders(req) {
  const headerEmail = Array.isArray(req.headers["x-user-email"])
    ? req.headers["x-user-email"][0]
    : req.headers["x-user-email"];
  if (typeof headerEmail === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(headerEmail.trim())) {
    return headerEmail.trim();
  }
  return null;
}

/**
 * Require a valid Auth0 access token. On success sets:
 *   req.auth = { token, sub, name, email }
 * Always returns contract shape on failure: 401 { success: false, error }
 */
export function requireAuth(req, res, next) {
  const check = getJwtCheck();
  if (!check) {
    return res.status(500).json({
      success: false,
      error: "Auth0 is not configured (set AUTH0_DOMAIN and AUTH0_AUDIENCE)",
    });
  }

  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ") || !header.slice("Bearer ".length).trim()) {
    return res.status(401).json({ success: false, error: "Missing Bearer token" });
  }

  check(req, res, (err) => {
    if (err) {
      const raw = String(err.message || "");
      let message = "Invalid token";
      if (/expired/i.test(raw)) message = "Token expired";
      return res.status(401).json({ success: false, error: message });
    }

    const payload = req.auth?.payload || {};
    const token = req.auth?.token || null;
    req.auth = {
      token,
      sub: payload.sub || null,
      name: payload.name || payload.nickname || null,
      email:
        payload.email ||
        payload["https://api.drift.local/email"] ||
        emailFromHeaders(req) ||
        null,
    };
    return next();
  });
}
