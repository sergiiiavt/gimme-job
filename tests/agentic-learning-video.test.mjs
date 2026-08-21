import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("agentic route uses the dedicated learning page", async () => {
  const route = await read("app/learn/agentic/page.tsx");

  assert.match(route, /import AgenticLearningPage from "\.\.\/\.\.\/agentic-learning-page"/);
  assert.match(route, /return <AgenticLearningPage\/>/);
});

test("agentic learning embeds the verified Rodion Claude Code video", async () => {
  const page = await read("app/agentic-learning-page.tsx");

  assert.match(page, /videoId="zW4SEqgFBJc"/);
  assert.match(page, /channel="RO БУДУЄ · Rodion Lozovoi"/);
  assert.match(page, /Як автоматизувати 80% роботи за €20\? Повний огляд Claude Cowork/);
  assert.match(page, /Контент-завод з Claude Cowork, Notion та Skill Editor/);
});

test("learning video uses YouTube IFrame API and capability-gated custom speeds", async () => {
  const player = await read("app/learning-video.tsx");

  assert.match(player, /https:\/\/www\.youtube\.com\/iframe_api/);
  assert.match(player, /getAvailablePlaybackRates/);
  assert.match(player, /setPlaybackRate/);
  assert.match(player, /const requestedRates = \[1, 1\.25, 1\.5, 1\.75, 2, 3, 4\]/);
  assert.match(player, /disabled=\{!supported\}/);
  assert.match(player, /3× and 4× stay visible but are enabled only when YouTube reports those rates/);
  assert.doesNotMatch(player, /contentDocument/);
  assert.doesNotMatch(player, /querySelector\(["']video["']\)/);
});
