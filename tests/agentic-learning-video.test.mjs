import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const {
  isLearningVideoRateSupported,
  LEARNING_VIDEO_PLAYBACK_RATES,
  sameLearningVideoRate,
} = await import("../app/learning-video-policy.ts");

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("agentic route uses the dedicated learning page", async () => {
  const route = await read("app/learn/agentic/page.tsx");

  assert.match(route, /import AgenticLearningPage from "\.\.\/\.\.\/agentic-learning-page"/);
  assert.match(route, /return <AgenticLearningPage\/>/);
});

test("agentic learning embeds all three verified videos", async () => {
  const page = await read("app/agentic-learning-page.tsx");

  assert.match(page, /videoId="zW4SEqgFBJc"/);
  assert.match(page, /videoId="rSDKAjao_7Q"/);
  assert.match(page, /videoId="LZ79ZwTI6lU"/);
  assert.match(page, /channel="RO БУДУЄ · Rodion Lozovoi"/);
  assert.match(page, /channel="Штучка Інтелект"/);
  assert.match(page, /Як автоматизувати 80% роботи за €20\? Повний огляд Claude Cowork/);
  assert.match(page, /Контент-завод з Claude Cowork, Notion та Skill Editor/);
  assert.doesNotMatch(page, /Точний YouTube watch URL ще треба верифікувати/);
});

test("agentic learning restores the original under-construction roadmap tabs", async () => {
  const page = await read("app/agentic-learning-page.tsx");

  for (const title of [
    "Tools and actions",
    "State and memory",
    "Approval workflows",
    "Agent evaluation",
    "MCP experiments",
    "Pet projects",
  ]) {
    assert.match(page, new RegExp(title));
  }

  assert.match(page, /status: "under-construction" as const/);
  assert.match(page, /id=\{item\.id\}/);
});

test("learning video playback policy exposes 3× and 4× without pretending unsupported rates work", () => {
  assert.deepEqual([...LEARNING_VIDEO_PLAYBACK_RATES], [1, 1.25, 1.5, 1.75, 2, 3, 4]);
  assert.equal(isLearningVideoRateSupported([1, 1.5, 2, 3, 4], 3), true);
  assert.equal(isLearningVideoRateSupported([1, 1.5, 2, 3, 4], 4), true);
  assert.equal(isLearningVideoRateSupported([1, 1.5, 2], 3), false);
  assert.equal(isLearningVideoRateSupported([1, 1.5, 2], 4), false);
  assert.equal(sameLearningVideoRate(1.999, 2), true);
  assert.equal(sameLearningVideoRate(1.98, 2), false);
});

test("learning video uses YouTube IFrame API and capability-gated custom speeds", async () => {
  const player = await read("app/learning-video.tsx");

  assert.match(player, /https:\/\/www\.youtube\.com\/iframe_api/);
  assert.match(player, /getAvailablePlaybackRates/);
  assert.match(player, /setPlaybackRate/);
  assert.match(player, /LEARNING_VIDEO_PLAYBACK_RATES\.map/);
  assert.match(player, /isLearningVideoRateSupported/);
  assert.match(player, /disabled=\{!supported\}/);
  assert.match(player, /3× and 4× stay visible but are enabled only when YouTube reports those rates/);
  assert.doesNotMatch(player, /contentDocument/);
  assert.doesNotMatch(player, /querySelector\(["']video["']\)/);
});
