import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const accountSource = await readFile(new URL("../app/auth-status-control.ts", import.meta.url), "utf8");
const navigationSource = await readFile(new URL("../app/site-navigation.tsx", import.meta.url), "utf8");
const passwordAuthSource = await readFile(new URL("../app/auth/password-auth.ts", import.meta.url), "utf8");

test("account menu exposes the Gmail forwarding setup and verification workflow", () => {
  assert.match(accountSource, /Gmail forwarding/);
  assert.match(accountSource, /Forwarding and POP\/IMAP/);
  assert.match(accountSource, /Open Gmail verification link/);
  assert.match(accountSource, /Check for verification email/);
  assert.match(accountSource, /confirmationCode/);
  assert.match(accountSource, /Sign out/);
  assert.doesNotMatch(accountSource, /Public\s*\/\s*Personal/);
});

test("account control is mounted in the top-right corner instead of the sidebar footer", () => {
  assert.match(navigationSource, /kb-account-corner/);
  assert.match(navigationSource, /position:\s*"fixed"/);
  assert.match(navigationSource, /right:\s*"18px"/);
  assert.doesNotMatch(navigationSource, /kb-sidebar-footer/);
});

test("registration UI no longer exposes the legacy private-site password field", () => {
  assert.doesNotMatch(passwordAuthSource, /Existing private-site password/);
  assert.doesNotMatch(passwordAuthSource, /name=\\"legacyPassword\\"/);
  assert.match(passwordAuthSource, /name=\\"confirmPassword\\"/);
});
