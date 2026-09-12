/**
 * Auth0 JWT middleware (Person 1).
 * Accepts Bearer prefix (hackathon stub). If the token looks like a JWT,
 * decode the payload so trips can resolve req.auth.sub without JWKS yet.
 * See shared/auth0-setup.md for tenant details.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Missing Bearer token" });
  }

  const token = header.slice("Bearer ".length).trim();
  const claims = decodeJwtPayload(token);
  const headerEmail = Array.isArray(req.headers["x-user-email"])
    ? req.headers["x-user-email"][0]
    : req.headers["x-user-email"];
  const fromHeader =
    typeof headerEmail === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(headerEmail.trim())
      ? headerEmail.trim()
      : null;
  req.auth = {
    token,
    sub: claims.sub || null,
    name: claims.name || claims.nickname || null,
    email: claims.email || claims["https://api.drift.local/email"] || fromHeader || null,
  };
  next();
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json);
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return {};
  }
}
