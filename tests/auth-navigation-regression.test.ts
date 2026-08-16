import assert from "node:assert/strict";
import test from "node:test";
import { signInHref, startAuthSync } from "../app/auth-status-control.ts";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("sign in uses one query-free canonical route", () => {
  assert.equal(signInHref("/interview"), "/login");
  assert.equal(signInHref("/vacancies"), "/login");
});

test("transient auth server failures do not redirect personal pages to login", async () => {
  const states: boolean[] = [];
  const redirects: string[] = [];

  startAuthSync({
    mode: "personal",
    personalHref: "/interview",
    onAuthenticatedChange: (value) => states.push(value),
    probe: async () => ({ ok: false, status: 503 }),
    currentHref: () => "https://gimme-job.com/interview",
    replace: (href) => redirects.push(href),
  });

  await tick();
  assert.deepEqual(states, [true]);
  assert.deepEqual(redirects, []);
});
