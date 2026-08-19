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

test("learning article headings receive direct links to the same TOC section IDs", async () => {
  const learningUi = await read("app/learning-document-ui.tsx");

  assert.match(learningUi, /document\.getElementById\(sectionId\)/);
  assert.match(learningUi, /document\.getElementById\("learning-source-register"\)/);
  assert.match(learningUi, /link\.className = uiStyles\.headingDirectLink/);
  assert.match(learningUi, /target\.appendChild\(link\)/);
  assert.match(learningUi, /link\.href = contentHref\(pathname, searchParams\.toString\(\), \{\}, sectionId\)/);
});

test("learning chapter navigation buttons expose direct chapter links", async () => {
  const learningUi = await read("app/learning-document-ui.tsx");

  assert.match(learningUi, /pagerItemId\(previous\)/);
  assert.match(learningUi, /pagerItemId\(next\)/);
  assert.match(learningUi, /contentHref\(pathname, searchParams\.toString\(\), \{ topic: previousId \}\)/);
  assert.match(learningUi, /contentHref\(pathname, searchParams\.toString\(\), \{ topic: nextId \}\)/);
  assert.match(learningUi, /className=\{uiStyles\.pagerDirectLink\}/);
});

test("learning direct-link controls are circular and use the horizontal-chain glyph", async () => {
  const [learningUi, styles] = await Promise.all([
    read("app/learning-document-ui.tsx"),
    read("app/learning-document-ui.module.css"),
  ]);

  assert.match(learningUi, /M9 7H7/);
  assert.match(styles, /\.tocDirectLink,/);
  assert.match(styles, /\.headingDirectLink,/);
  assert.match(styles, /\.pagerDirectLink/);
  assert.match(styles, /background: #fff !important/);
  assert.match(styles, /border: 1px solid #dfe4df !important/);
  assert.match(styles, /border-radius: 999px !important/);
  assert.match(styles, /align-items: center/);
  assert.match(styles, /justify-content: center/);
});
