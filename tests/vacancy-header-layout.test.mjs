import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../app/vacancy-detail-layout.css", import.meta.url), "utf8");
const source = readFileSync(new URL("../app/vacancies-workspace.tsx", import.meta.url), "utf8");

test("personal vacancy counters remain beside personal header actions", () => {
  assert.match(styles, /\.vacancy-workspace-personal \.vacancy-page-intro\s*\{[^}]*justify-content:\s*flex-start/);
  assert.match(styles, /\.vacancy-workspace-personal \.stat-line\s*\{[^}]*height:\s*38px/);
  assert.match(source, /<Stat value=\{personalCounts\.total\} label="Total"\/>/);
  assert.match(source, /<Stat value=\{personalCounts\.interviews\} label="Interviews"\/>/);
});

test("public vacancy header has no catalogue counters", () => {
  assert.doesNotMatch(source, /publicCounts/);
  assert.doesNotMatch(source, /<Stat value=\{publicCounts\./);
  assert.match(source, /\{isPersonal && <div className="stat-line">/);
  assert.match(source, /\{\(isPersonal \|\| catalogStatus \|\| catalogHealth\) && <div className="vacancy-catalog-summary">/);
});

test("public sign-in is a separate, right-aligned compact header action", () => {
  assert.match(source, /<a className="signin-link vacancy-signin-action" href="\/workspace\/login" aria-label="Sign in to use personal vacancy tools">Sign in →<\/a>/);
  assert.match(source, /<a className="signin-link vacancy-signin-action" href="\/workspace">Personal workspace →<\/a>/);
  assert.match(styles, /\.vacancy-workspace-public \.vacancy-page-intro\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/);
});

test("public header stays in a two-column grid while personal header stacks on mobile", () => {
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.vacancy-workspace-personal \.vacancy-page-intro\s*\{[^}]*flex-direction:\s*column/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.vacancy-workspace-public \.vacancy-page-intro\s*\{[^}]*gap:\s*8px 12px/);
});
