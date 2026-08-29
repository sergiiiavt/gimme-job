import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("waiting-for-review banner is yellow and reusable", async () => {
  const source = await readFile(projectFile("app/learning-review-status.ts"), "utf8");

  assert.match(source, /Waiting for review/);
  assert.match(source, /background:\s*#fff3b0/i);
  assert.match(source, /border:\s*1px solid #e1b934/i);
  assert.match(source, /\.kb-content::before/);
});

test("Embedded and IoT shows the review banner on every topic page", async () => {
  const source = await readFile(projectFile("app/embedded-iot-page.tsx"), "utf8");

  assert.match(source, /waitingForReviewBannerStyle/);
  assert.match(source, /<style>\{waitingForReviewBannerStyle\}<\/style>/);
  assert.match(source, /<TopicLearningPage/);
});

test("SQL shows the review banner without applying it to unfinished sibling data tracks", async () => {
  const source = await readFile(projectFile("app/data-learning-page.tsx"), "utf8");

  assert.match(source, /const requestedTrack = searchParams\.get\("track"\)/);
  assert.match(source, /const showReviewBanner = !requestedTrack \|\| requestedTrack === "sql"/);
  assert.match(source, /showReviewBanner \? waitingForReviewBannerStyle : ""/);
});
