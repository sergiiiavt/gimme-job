import assert from "node:assert/strict";
import test from "node:test";

const routeSource = await (await fetch(new URL("../app/auth/forwarding/route.ts", import.meta.url))).text().catch(() => "");

test("forwarding endpoint exposes only temporary verification fields", () => {
  assert.match(routeSource, /email_forwarding_verifications/);
  assert.match(routeSource, /verificationUrl/);
  assert.match(routeSource, /confirmationCode/);
  assert.match(routeSource, /Date\.parse\(verification\.expires_at\) > Date\.now\(\)/);
});
