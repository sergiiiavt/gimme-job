import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Robot Framework uses a dedicated chaptered navigation and stable legacy entry", async () => {
  const [page, path, catalog] = await Promise.all([
    read("app/automation-learning-page.tsx"),
    read("content/automation-learning/robot-framework-path.ts"),
    read("content/automation-learning/catalog.ts"),
  ]);
  assert.match(page, /label: "Robot Framework"/);
  assert.match(page, /moduleIds: robotFrameworkChapterIds/);
  assert.match(path, /"robot-framework"/);
  for (const name of ["robot-keywords", "robot-project", "robot-web", "robot-api", "robot-execution", "robot-architecture"]) {
    assert.ok(path.includes(name), `missing ${name}`);
  }
  assert.match(path, /if \(!moduleId\) throw new Error/);
  assert.match(catalog, /robotFrameworkCurriculumLessons/);
  assert.match(catalog, /\.\.\.robotFrameworkModules/);
});

test("Robot Framework offline capstone has complete layers and verifiable commands", async () => {
  const [readme, robot, template, resource, python] = await Promise.all([
    read("examples/robot-framework/README.md"),
    read("examples/robot-framework/tests/inventory.robot"),
    read("examples/robot-framework/tests/template.robot"),
    read("examples/robot-framework/resources/inventory.resource"),
    read("examples/robot-framework/libraries/Inventory.py"),
  ]);
  assert.match(readme, /python -m robot --outputdir results examples\/robot-framework\/tests/);
  assert.match(robot, /Run Keyword And Expect Error/);
  assert.match(robot, /Test Teardown    Clean Up Inventory/);
  assert.match(template, /Test Template    Addition Should Equal/);
  assert.match(resource, /Library    \.\.\/libraries\/Inventory.py/);
  assert.match(python, /@library\(scope="TEST"\)/);
  assert.match(python, /raise ValueError/);
});
