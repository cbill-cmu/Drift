/**
 * In-process checks for requireAuth / requireGroupMember early exits.
 */
import "dotenv/config";
import assert from "node:assert/strict";

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function main() {
  const auth = await import("../src/middleware/auth.js");
  assert.equal(typeof auth.requireAuth, "function");

  const gm = await import("../src/middleware/groupMember.js");
  assert.equal(typeof gm.requireGroupMember, "function");
  assert.equal(typeof gm.describeCaller, "function");

  const req = { headers: {} };
  const res = mockRes();
  let nextCalled = false;
  auth.requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false, "requireAuth must not next() without token");
  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.success, false);
  assert.equal(res.body?.error, "Missing Bearer token");

  const res2 = mockRes();
  let next2 = false;
  await gm.requireGroupMember({ params: { groupId: "x" }, auth: {} }, res2, () => {
    next2 = true;
  });
  assert.equal(next2, false);
  assert.equal(res2.statusCode, 401);
  assert.equal(res2.body?.success, false);

  console.log("PASS middleware exports + requireAuth/requireGroupMember early 401s");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
