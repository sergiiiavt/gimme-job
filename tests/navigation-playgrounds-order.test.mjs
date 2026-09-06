import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/site-navigation.tsx", import.meta.url), "utf8");

test("Playgrounds follow Career and contain the interactive tools", () => {
  const careerIndex = source.indexOf('id: "career"');
  const playgroundsIndex = source.indexOf('id: "playgrounds"');
  const learningIndex = source.indexOf('id: "learning"');

  assert.ok(careerIndex >= 0);
  assert.ok(playgroundsIndex > careerIndex);
  assert.ok(learningIndex > playgroundsIndex);

  const careerBlock = source.slice(careerIndex, playgroundsIndex);
  const playgroundsBlock = source.slice(playgroundsIndex, learningIndex);

  assert.doesNotMatch(careerBlock, /id: "ai-assistant"/);
  assert.match(playgroundsBlock, /id: "ai-assistant"/);
  assert.match(playgroundsBlock, /id: "websocket-playground"/);
  assert.match(playgroundsBlock, /id: "games"/);
});
