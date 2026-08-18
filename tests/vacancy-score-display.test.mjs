import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/vacancies-workspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/vacancy-detail-layout.css", import.meta.url), "utf8");

test("vacancy scores use the /100 format and four score bands", () => {
  assert.match(source, /return `\$\{normalizeScore\(score\)\}\/100`/);
  assert.match(source, /if \(normalized < 40\) return "low"/);
  assert.match(source, /if \(normalized < 60\) return "fair"/);
  assert.match(source, /if \(normalized < 80\) return "good"/);
  assert.match(source, /return "strong"/);
});

test("detail and dashboard both use score grading and formatted values", () => {
  assert.match(source, /vacancy-match[\s\S]*score-\$\{scoreTone\(/);
  assert.match(source, /className=\{`score score-\$\{scoreTone\(job\.analysis\.score\)\}`\}/);
  assert.match(source, /<strong>\{formatScore\(job\.analysis\.score\)\}<\/strong>/);
  assert.match(source, /<strong>\{formatScore\(job\.analysis\?\.score \?\? 0\)\}<\/strong>/);
});

test("score typography is smaller and each band has a distinct color", () => {
  assert.match(styles, /\.vacancy-workspace \.score strong\s*\{[\s\S]*font-size:\s*11px/);
  assert.match(styles, /\.vacancy-workspace \.score span\s*\{[\s\S]*font-size:\s*5\.5px/);
  assert.match(styles, /\.score\.score-low\s*\{[\s\S]*var\(--red-soft\)[\s\S]*var\(--red\)/);
  assert.match(styles, /\.score\.score-fair\s*\{[\s\S]*var\(--amber-soft\)[\s\S]*var\(--amber\)/);
  assert.match(styles, /\.score\.score-good\s*\{[\s\S]*var\(--blue-soft\)[\s\S]*var\(--blue\)/);
  assert.match(styles, /\.score\.score-strong\s*\{[\s\S]*var\(--green-soft\)[\s\S]*var\(--green\)/);
});

test("vacancy score circle displays the canonical analysis verdict instead of MATCH", () => {
  assert.match(styles, /:has\(\.verdict-strong\)[\s\S]*content:\s*"Strong"/);
  assert.match(styles, /:has\(\.verdict-possible\)[\s\S]*content:\s*"Possible"/);
  assert.match(styles, /:has\(\.verdict-weak\)[\s\S]*content:\s*"Weak"/);
  assert.match(styles, /:has\(\.verdict-reject\)[\s\S]*content:\s*"Reject"/);
});
