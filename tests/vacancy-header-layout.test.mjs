import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../app/vacancy-detail-layout.css", import.meta.url), "utf8");

test("personal and public vacancy counts stay beside the header actions", () => {
  assert.match(styles, /\.vacancy-workspace-personal \.vacancy-page-intro,[\s\S]*\.vacancy-workspace-public \.vacancy-page-intro\s*\{[\s\S]*justify-content:\s*flex-start/);
  assert.match(styles, /\.vacancy-workspace-personal \.vacancy-page-intro,[\s\S]*\.vacancy-workspace-public \.vacancy-page-intro\s*\{[\s\S]*flex-wrap:\s*wrap/);
});

test("personal and public vacancy counts match the action button height", () => {
  assert.match(styles, /\.vacancy-workspace-personal \.stat-line,[\s\S]*\.vacancy-workspace-public \.stat-line\s*\{[\s\S]*height:\s*38px/);
  assert.match(styles, /\.vacancy-workspace-personal \.stat-line,[\s\S]*\.vacancy-workspace-public \.stat-line\s*\{[\s\S]*padding:\s*0 4px/);
});

test("personal and public vacancy headers stack cleanly on mobile", () => {
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.vacancy-workspace-personal \.vacancy-page-intro,[\s\S]*\.vacancy-workspace-public \.vacancy-page-intro\s*\{[\s\S]*flex-direction:\s*column/);
});
