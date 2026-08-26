import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Learning Path Advisor exposes switchable language and voice input", async () => {
  const component = await source("app/ai-assistant/learning-path-advisor.tsx");

  assert.match(component, /aria-label="Response language"/);
  assert.match(component, />EN<\/button>/);
  assert.match(component, />UA<\/button>/);
  assert.match(component, /SpeechRecognition/);
  assert.match(component, /webkitSpeechRecognition/);
  assert.match(component, /instance\.lang = language === "uk" \? "uk-UA" : "en-US"/);
  assert.match(component, /aria-pressed=\{listening\}/);
  assert.match(component, /body: JSON\.stringify\(\{ messages: requestMessages, language,/);
});

test("shared AI controls visibly distinguish active dictation", async () => {
  const [css, layout] = await Promise.all([
    source("app/ai-assistant-controls.css"),
    source("app/layout.tsx"),
  ]);

  assert.match(layout, /import "\.\/ai-assistant-controls\.css"/);
  assert.match(css, /button\[aria-label="Stop voice input"\]\[aria-pressed="true"\]/);
  assert.match(css, /aiAssistantListeningPulse/);
  assert.match(css, /background: #e7f4e8 !important/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("AI interview setup labels use normal font weight", async () => {
  const css = await source("app/ai-assistant-controls.css");

  assert.match(css, /fieldset > legend/);
  assert.match(css, /label:has\(select\) > span/);
  assert.match(css, /font-weight: 400 !important/);
});
