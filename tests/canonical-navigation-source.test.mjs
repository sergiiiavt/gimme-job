import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("site navigation does not generate section, topic, track, or login next query strings", async () => {
  const [paths, publicSite, authControl, learningDocument] = await Promise.all([
    read("app/navigation-paths.ts"),
    read("app/public-site.tsx"),
    read("app/auth-status-control.ts"),
    read("app/learning-document-page.tsx"),
  ]);

  assert.doesNotMatch(paths, /workspace\/learn\?section=/);
  assert.doesNotMatch(publicSite, /new URLSearchParams\(window\.location\.search\)\.get\("section"\)/);
  assert.doesNotMatch(publicSite, /requestAnimationFrame\(syncFromLocation\)/);
  assert.doesNotMatch(authControl, /workspace\/login\?next=/);
  assert.match(authControl, /return "\/login"/);
  assert.doesNotMatch(learningDocument, /searchParams\.(set|delete)\(/);
  assert.doesNotMatch(learningDocument, /new URLSearchParams\(window\.location\.search\)/);
});
