import assert from "node:assert/strict";
import test from "node:test";
import { handlePasswordLogin, handlePasswordRegister } from "../app/auth/password-auth.ts";

const env = {
  MULTI_USER_ENABLED: "true",
  DB: {} as D1Database,
};

test("login back link returns to the same-origin public page that opened auth", async () => {
  const response = await handlePasswordLogin(new Request(
    "https://gimme-job.com/workspace/login?next=%2Fworkspace",
    { headers: { referer: "https://gimme-job.com/vacancies?source=djinni" } },
  ), env);

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /class="back" href="\/vacancies\?source=djinni"/);
  assert.match(html, /name="returnTo" value="\/vacancies\?source=djinni"/);
  assert.match(html, /returnTo=%2Fvacancies%3Fsource%3Ddjinni/);
});

test("explicit public return path survives switching between login and registration", async () => {
  const response = await handlePasswordRegister(new Request(
    "https://gimme-job.com/workspace/register?next=%2Fworkspace&returnTo=%2Finterview-questions%3Ftopic%3Dapi",
  ), env);

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /class="back" href="\/interview-questions\?topic=api"/);
  assert.match(html, /returnTo=%2Finterview-questions%3Ftopic%3Dapi/);
});

test("auth back link rejects external and private return targets", async () => {
  const external = await handlePasswordLogin(new Request(
    "https://gimme-job.com/workspace/login",
    { headers: { referer: "https://example.com/vacancies" } },
  ), env);
  assert.match(await external.text(), /class="back" href="\/"/);

  const privateTarget = await handlePasswordLogin(new Request(
    "https://gimme-job.com/workspace/login?returnTo=%2Fworkspace%2Fsettings",
  ), env);
  assert.match(await privateTarget.text(), /class="back" href="\/"/);
});
