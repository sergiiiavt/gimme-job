import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared Vacancies page renders loading progress for the dashboard request", async () => {
  const vacancies = await read("app/vacancies-workspace.tsx");

  assert.match(vacancies, /online === null/);
  assert.match(vacancies, /vacancy-load-progress/);
  assert.match(vacancies, /analyze-progress-bar indeterminate/);
  assert.match(vacancies, /role="progressbar"/);
  assert.match(vacancies, /Loading vacancies from database/);
  assert.match(vacancies, /aria-busy=\{online === null/);
});
