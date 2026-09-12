/**
 * Auth0 JWT middleware stub (Person 1).
 * Replace with JWKS validation using AUTH0_DOMAIN + AUTH0_AUDIENCE.
 * See shared/auth0-setup.md for tenant details.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Missing Bearer token" });
  }

  // TODO(Person 1): verify JWT via Auth0 JWKS
  req.auth = { token: header.slice("Bearer ".length), sub: null };
  next();
}
