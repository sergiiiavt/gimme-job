import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [advisorStyles, traceStyles] = await Promise.all([
  readFile(new URL("../app/ai-assistant/learning-path-advisor.module.css", import.meta.url), "utf8"),
  readFile(new URL("../app/ai-assistant/execution-trace.module.css", import.meta.url), "utf8"),
]);

test("AI Assistant uses WebSocket playground outer geometry after the secondary sidebar", () => {
  assert.match(advisorStyles, /max-width:\s*1580px;/);
  assert.match(advisorStyles, /padding:\s*36px 34px 22px;/);
  assert.match(advisorStyles, /width:\s*100%;/);
  assert.doesNotMatch(advisorStyles, /kb-main[\s\S]{0,120}margin-left:\s*220px/);
});

test("AI Assistant gives the trace more width and keeps both desktop panels equal height", () => {
  assert.match(traceStyles, /gap:\s*18px;/);
  assert.match(traceStyles, /grid-template-columns:\s*minmax\(0, 1\.2fr\) minmax\(430px, \.95fr\);/);
  assert.match(traceStyles, /--assistant-panel-height:\s*clamp\(620px, calc\(100vh - 190px\), 760px\);/);
  assert.match(traceStyles, /\.workspace > \*\s*\{[\s\S]*?height:\s*100%;/);
  assert.match(advisorStyles, /\.chat\s*\{[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*620px;/);
  assert.match(traceStyles, /\.panel\s*\{[\s\S]*?height:\s*100%;/);
  assert.match(advisorStyles, /\.conversation\s*\{[\s\S]*?flex:\s*1;[\s\S]*?overflow-y:\s*auto;/);
});

test("AI Assistant keeps chat and execution details readable at normal browser zoom", () => {
  assert.match(advisorStyles, /Readability pass[\s\S]*?\.userTurn p,[\s\S]*?\.responseIntro p[\s\S]*?font-size:\s*14px;/);
  assert.match(advisorStyles, /\.composer textarea[\s\S]*?font-size:\s*14px;/);
  assert.match(traceStyles, /\.timeline summary strong\s*\{[\s\S]*?font-size:\s*14px;/);
  assert.match(traceStyles, /\.stepBody p,[\s\S]*?\.stepBody pre\s*\{[\s\S]*?font-size:\s*13px;/);
  assert.match(traceStyles, /\.metadata dd\s*\{[\s\S]*?font-size:\s*12px;/);
});

test("execution trace shows newest activity first", () => {
  assert.match(traceStyles, /\.timeline\s*\{[\s\S]*?flex-direction:\s*column-reverse;/);
});
