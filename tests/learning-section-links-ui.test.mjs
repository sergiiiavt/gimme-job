import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("learning TOC remains simple in-page navigation without direct-link icons", async () => {
  const learningUi = await read("app/learning-document-ui.tsx");

  assert.match(learningUi, /href=\{sectionHref\(heading\.id\)\}/);
  assert.match(learningUi, /aria-current=\{isActive \? "location" : undefined\}/);
  assert.doesNotMatch(learningUi, /uiStyles\.tocDirectLink/);
});

test("learning article headings open direct section links in a new tab", async () => {
  const learningUi = await read("app/learning-document-ui.tsx");

  assert.match(learningUi, /document\.getElementById\(sectionId\)/);
  assert.match(learningUi, /document\.getElementById\("learning-source-register"\)/);
  assert.match(learningUi, /link\.className = uiStyles\.headingDirectLink/);
  assert.match(learningUi, /link\.href = contentHref\(pathname, searchParams\.toString\(\), \{\}, sectionId\)/);
  assert.match(learningUi, /link\.target = "_blank"/);
  assert.match(learningUi, /link\.rel = "noreferrer"/);
  assert.match(learningUi, /target\.appendChild\(link\)/);
});

test("learning chapter direct links open the exact chapter in a new tab", async () => {
  const learningUi = await read("app/learning-document-ui.tsx");

  assert.match(learningUi, /pagerItemId\(previous\)/);
  assert.match(learningUi, /pagerItemId\(next\)/);
  assert.match(learningUi, /contentHref\(pathname, searchParams\.toString\(\), \{ topic: previousId \}\)/);
  assert.match(learningUi, /contentHref\(pathname, searchParams\.toString\(\), \{ topic: nextId \}\)/);
  assert.match(learningUi, /className=\{uiStyles\.pagerDirectLink\}/);
  assert.match(learningUi, /target="_blank"/);
  assert.match(learningUi, /rel="noreferrer"/);
});

test("learning content direct-link controls stay circular and use the horizontal-chain glyph", async () => {
  const [learningUi, styles] = await Promise.all([
    read("app/learning-document-ui.tsx"),
    read("app/learning-document-ui.module.css"),
  ]);

  assert.match(learningUi, /M9 7H7/);
  assert.match(styles, /\.headingDirectLink,/);
  assert.match(styles, /\.pagerDirectLink/);
  assert.doesNotMatch(styles, /\.tocDirectLink/);
  assert.match(styles, /background: #fff !important/);
  assert.match(styles, /border: 1px solid #dfe4df !important/);
  assert.match(styles, /border-radius: 999px !important/);
  assert.match(styles, /align-items: center/);
  assert.match(styles, /justify-content: center/);
});
