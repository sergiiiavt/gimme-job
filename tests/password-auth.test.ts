import assert from "node:assert/strict";
import test from "node:test";
import { handlePasswordLogin, hashPassword, verifyPassword } from "../app/auth/password-auth.ts";

test("password hashes are salted PBKDF2 values and verify correctly", async () => {
  const password = "correct horse battery staple";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.match(first, /^pbkdf2-sha256\$600000\$/);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong password", first), false);
  assert.equal(await verifyPassword(password, "not-a-password-hash"), false);
});

test("password login GET renders a local sign-in form", async () => {
  const response = await handlePasswordLogin(
    new Request("https://gimme-job.com/workspace/login?next=%2Fworkspace%2Flearn"),
    { MULTI_USER_ENABLED: "true", DB: {} as D1Database },
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Sign in/);
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.doesNotMatch(html, /Sign in with Google/);
});
