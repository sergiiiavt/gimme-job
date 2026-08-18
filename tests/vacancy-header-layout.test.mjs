import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../app/vacancy-detail-layout.css", import.meta.url), "utf8");

test("personal vacancy counts stay beside the action buttons", () => {
  assert.match(styles, /\.vacancy-workspace-personal \.vacancy-page-intro\s*\{[\s\S]*justify-content:\s*flex-start/);
  assert.match(styles, /\.vacancy-workspace-personal \.vacancy-page-intro\s*\{[\s\S]*flex-wrap:\s*wrap/);
});

test("personal vacancy header stacks cleanly on mobile", () => {
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.vacancy-workspace-personal \.vacancy-page-intro\s*\{[\s\S]*flex-direction:\s*column/);
});
