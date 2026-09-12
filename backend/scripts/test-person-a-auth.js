/**
 * Smoke tests for Person A auth hardening.
 * Run against a live server: node scripts/test-person-a-auth.js
 */
const BASE = process.env.API_BASE || "http://localhost:3000";
const GROUP = process.env.DEMO_GROUP_ID || "000000000000000000000000";

function fakeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesignature`;
}

async function req(path, headers = {}) {
  const res = await fetch(`${BASE}${path}`, { headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const results = [];

  // 1) Health stays public
  {
    const r = await req("/");
    assert(r.status === 200 && r.json?.ok === true, `health expected 200, got ${r.status}`);
    results.push("PASS health public");
  }

  // 2) Graph without token → 401 contract shape
  {
    const r = await req(`/api/groups/${GROUP}/graph`);
    assert(r.status === 401, `graph no-token expected 401, got ${r.status}`);
    assert(r.json?.success === false && typeof r.json?.error === "string", "graph no-token bad body");
    assert(
      r.json.error === "Missing Bearer token" || r.json.error === "Unauthorized",
      `unexpected missing-token message: ${r.json.error}`
    );
    results.push(`PASS graph missing token → 401 (${r.json.error})`);
  }

  // 3) Member graph without token → 401
  {
    const r = await req(`/api/groups/${GROUP}/members/someone/graph`);
    assert(r.status === 401, `member-graph no-token expected 401, got ${r.status}`);
    assert(r.json?.success === false, "member-graph no-token bad body");
    results.push("PASS member-graph missing token → 401");
  }

  // 4) Trips without token → 401
  {
    const r = await fetch(`${BASE}/api/trips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const json = await r.json();
    assert(r.status === 401, `trips no-token expected 401, got ${r.status}`);
    assert(json?.success === false, "trips no-token bad body");
    results.push("PASS trips missing token → 401");
  }

  // 5) Forged / unsigned JWT must not be accepted (JWKS verify)
  {
    const forged = fakeJwt({
      sub: "auth0|forged-user",
      email: "forged@test.com",
      aud: "https://api.drift.local",
      iss: "https://example.auth0.com/",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const r = await req(`/api/groups/${GROUP}/graph`, {
      Authorization: `Bearer ${forged}`,
    });
    assert(r.status === 401, `forged JWT expected 401, got ${r.status} body=${JSON.stringify(r.json)}`);
    assert(r.json?.success === false && typeof r.json?.error === "string", "forged JWT bad body");
    assert(r.json.error === "Invalid token" || r.json.error === "Unauthorized", `unexpected forged message: ${r.json.error}`);
    results.push(`PASS forged JWT rejected → 401 (${r.json.error})`);
  }

  // 6) Garbage bearer rejected
  {
    const r = await req(`/api/groups/${GROUP}/graph`, {
      Authorization: "Bearer not-a-jwt",
    });
    assert(r.status === 401, `garbage token expected 401, got ${r.status}`);
    assert(r.json?.success === false, "garbage token bad body");
    results.push("PASS garbage bearer → 401");
  }

  console.log(results.join("\n"));
  console.log("\nAll Person A auth smoke tests passed.");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
