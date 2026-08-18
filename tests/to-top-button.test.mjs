import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/to-top-button.tsx", import.meta.url), "utf8");

test("to-top control covers vacancies, interview questions, and learning paths", () => {
  assert.match(source, /pathname === "\/vacancies"/);
  assert.match(source, /pathname === "\/workspace"/);
  assert.match(source, /pathname\.startsWith\("\/interview"\)/);
  assert.match(source, /pathname === "\/learn"/);
  assert.match(source, /pathname\.startsWith\("\/learn\/"\)/);
  assert.match(source, /pathname === "\/workspace\/learn"/);
  assert.match(source, /pathname\.startsWith\("\/workspace\/learn\/"\)/);
  assert.match(source, /window\.scrollTo\(\{ top: 0/);
  assert.match(source, />To top</);
});
