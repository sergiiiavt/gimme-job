import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const { agenticVideos } = await import("../app/agentic-videos.ts");
const {
  isLearningVideoRateSupported,
  LEARNING_VIDEO_PLAYBACK_RATES,
  sameLearningVideoRate,
} = await import("../app/learning-video-policy.ts");

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("agentic route uses the dedicated learning page", async () => {
  const route = await read("app/learn/agentic/page.tsx");

  assert.match(route, /import AgenticLearningPage from/);
  assert.match(route, /return <AgenticLearningPage\/>/);
});

test("agentic video list preserves the four existing videos and their titles", () => {
  assert.deepEqual(agenticVideos.map(({ videoId }) => videoId), [
    "zW4SEqgFBJc",
    "rSDKAjao_7Q",
    "LZ79ZwTI6lU",
    "geoFJ6OXMKE",
  ]);
  assert.equal(new Set(agenticVideos.map(({ id }) => id)).size, agenticVideos.length);
  assert.deepEqual(agenticVideos.map(({ title }) => title), [
    "Claude Code Desktop: from zero to a working web app",
    "Контент-завод з Claude Cowork, Notion та Skill Editor",
    "Як автоматизувати 80% роботи за €20? Повний огляд Claude Cowork",
    "Інженер Claude показав, ЯК ПРАВИЛЬНО писати промти",
  ]);
  for (const video of agenticVideos) {
    assert.ok(video.channel);
    assert.match(video.channelUrl, /^https:\/\/www\.youtube\.com\//);
  }
});

test("agentic learning keeps a single Learning videos navigation entry alongside planned chapters", async () => {
  const { agenticPlannedTopics } = await import("../app/agentic-videos.ts");
  const page = await read("app/agentic-learning-page.tsx");

  assert.deepEqual(agenticPlannedTopics.map(({ id }) => id), [
    "tools-and-actions",
    "state-and-memory",
    "approval-workflows",
    "agent-evaluation",
    "mcp-experiments",
    "pet-projects",
  ]);
  assert.match(page, /id: "learning-videos", label: "Learning videos"/);
  assert.match(page, /status: "under-construction" as const/);
  assert.match(page, /id="learning-videos"/);
  assert.match(page, /id=\{item\.id\}/);
  assert.match(page, /text\.underConstruction/);
  assert.doesNotMatch(page, /agenticVideos\.map\(\(\{ id, title \}\) => \(\{ id, label: title \}\)\)/);
});

test("right-hand table of contents contains individual video titles", async () => {
  const page = await read("app/agentic-learning-page.tsx");

  assert.match(page, /videoHeadings = agenticVideos\.map\(\(\{ id, title \}\) => \(\{ id, text: title \}\)\)/);
  assert.match(page, /<LearningRail headings=\{videoHeadings\}/);
  assert.match(page, /<h2 className=\{styles\.videoTitle\} id=\{id\}>\{title\}<\/h2>/);
  assert.match(page, /showTitle=\{false\}/);
  assert.match(page, /<LearningVideo[\s\S]*?videoId=\{videoId\}/);
  assert.doesNotMatch(page, /codeIntro|coworkIntro|promptingIntro|patternsIntro|practical start|Practitioner Start/);
  const player = await read("app/learning-video.tsx");
  assert.match(player, /showTitle = true/);
  assert.match(player, /showTitle && <strong>\{title\}<\/strong>/);
});

test("learning video playback policy exposes 3× and 4× and can still identify advertised rates", () => {
  assert.deepEqual([...LEARNING_VIDEO_PLAYBACK_RATES], [1, 1.25, 1.5, 1.75, 2, 3, 4]);
  assert.equal(isLearningVideoRateSupported([1, 1.5, 2, 3, 4], 3), true);
  assert.equal(isLearningVideoRateSupported([1, 1.5, 2, 3, 4], 4), true);
  assert.equal(isLearningVideoRateSupported([1, 1.5, 2], 3), false);
  assert.equal(isLearningVideoRateSupported([1, 1.5, 2], 4), false);
  assert.equal(sameLearningVideoRate(1.999, 2), true);
  assert.equal(sameLearningVideoRate(1.98, 2), false);
});

test("learning video always attempts requested custom speed and reports YouTube's actual result", async () => {
  const player = await read("app/learning-video.tsx");

  assert.match(player, /https:\/\/www\.youtube\.com\/iframe_api/);
  assert.match(player, /getAvailablePlaybackRates/);
  assert.match(player, /player\.setPlaybackRate\(rate\)/);
  assert.match(player, /const actual = player\.getPlaybackRate\(\)/);
  assert.match(player, /setLastAttempt\(\{ requested: rate, actual \}\)/);
  assert.match(player, /LEARNING_VIDEO_PLAYBACK_RATES\.map/);
  assert.match(player, /disabled=\{!ready\}/);
  assert.doesNotMatch(player, /disabled=\{!supported\}/);
  assert.doesNotMatch(player, /if \(!player \|\| !isLearningVideoRateSupported/);
  assert.match(player, /Request \$\{rate\}×; YouTube may clamp it to a supported speed/);
  assert.match(player, /Requested \$\{lastAttempt\.requested\}×; YouTube applied \$\{lastAttempt\.actual\}×/);
  assert.doesNotMatch(player, /contentDocument/);
  assert.doesNotMatch(player, /querySelector\(["']video["']\)/);
});
