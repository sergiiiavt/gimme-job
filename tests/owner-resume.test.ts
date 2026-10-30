import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/owner-resume/route.ts";

test("private resume API fails closed without a verified owner identity", async () => {
  for (const headers of [
    {},
    { "x-gimmejob-authenticated": "1" },
    { "x-gimmejob-resume-owner": "1" },
  ]) {
    const response = await GET(new Request("https://gimme-job.com/api/owner-resume", { headers }));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("private resume API returns complete data only for the verified owner without caching", async () => {
  const response = await GET(new Request("https://gimme-job.com/api/owner-resume", {
    headers: { "x-gimmejob-authenticated": "1", "x-gimmejob-resume-owner": "1" },
  }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  const resume = await response.json() as { name: string; skills: string[]; experience: { role: string }[] };
  assert.ok(resume.name);
  assert.ok(resume.skills.length > 5);
  assert.ok(resume.experience.length > 2);
});
