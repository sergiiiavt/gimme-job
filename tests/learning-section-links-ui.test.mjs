import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("learning TOC exposes direct links using the current topic and track URL", async () => {
  const learningUi = await read("app/learning-document-ui.tsx");

  assert.match(learningUi, /usePathname, useSearchParams/);
  assert.match(learningUi, /contentHref\(pathname, searchParams\.toString\(\), \{\}, sectionId\)/);
  assert.match(learningUi, /className=\{uiStyles\.tocDirectLink\}/);
  assert.match(learningUi, /title=\{language === "uk" \? "Пряме посилання" : "Direct link"\}/);
  assert.match(learningUi, /href=\{href\}/);
});

test("learning TOC direct-link icon is plain rather than circular", async () => {
  const styles = await read("app/learning-document-ui.module.css");

  assert.match(styles, /\.tocDirectLink/);
  assert.match(styles, /background: transparent !important/);
  assert.match(styles, /border-left: 0 !important/);
  assert.match(styles, /border-radius: 0 !important/);
});
