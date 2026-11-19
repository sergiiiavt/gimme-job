import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const { agenticVideoHeadings, agenticVideos } = await import("../app/agentic-videos.ts");
const {
  isLearningVideoRateSupported,
  LEARNING_VIDEO_PLAYBACK_RATES,
  sameLearningVideoRate,
} = await import("../app/learning-video-policy.ts");

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

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

test("video table-of-contents labels are concise and independent from full video titles", () => {
  assert.deepEqual(agenticVideos.map(({ tocTitle }) => tocTitle), [
    "Claude Code Desktop",
    "Claude Cowork + Notion",
    "Огляд Claude Cowork",
    "Промпти для Claude",
  ]);
  assert.ok(agenticVideos.every(({ title, tocTitle }) => title !== tocTitle && tocTitle.length <= 24));
});

test("the video page table of contents lists every video by its short label", () => {
  assert.deepEqual(agenticVideoHeadings, agenticVideos.map(({ id, tocTitle }) => ({ id, text: tocTitle })));
});

test("the learning video player can hide its own title when the page shows it", async () => {
  const player = await read("app/learning-video.tsx");
  assert.match(player, /showTitle = true/);
  assert.match(player, /showTitle && <strong>\{title\}<\/strong>/);
});

test("learning table of contents wraps full video names and can omit the source registry", async () => {
  const [rail, css] = await Promise.all([
    read("app/learning-document-ui.tsx"),
    read("app/qa-fundamentals-page.module.css"),
  ]);

  // A page without sources, such as the video page, can leave the source registry out of its TOC.
  assert.match(rail, /showSourceRegistry = true/);
  assert.match(rail, /showSourceRegistry && \(/);
  assert.match(rail, /\.\.\.\(showSourceRegistry \? \["source-registry"\] : \[\]\)/);

  // Grid items must grow to their wrapped text height; do not clip long multilingual names.
  assert.match(css, /\.toc nav\s*\{[^}]*grid-auto-rows:\s*max-content/s);
  assert.match(css, /\.toc a\s*\{[^}]*display:\s*block;[^}]*height:\s*auto;[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere/s);
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
