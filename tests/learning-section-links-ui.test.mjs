import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("learning TOC remains simple in-page navigation without direct-link icons", async () => {
  const learningUi = await read("app/learning-document-ui.tsx");

  assert.match(learningUi, /contentHref\(pathname, searchParams\.toString\(\), \{ section: null \}, sectionId\)/);
  assert.match(learningUi, /href=\{sectionHref\(heading\.id\)\}/);
  assert.match(learningUi, /aria-current=\{isActive \? "location" : undefined\}/);
  assert.doesNotMatch(learningUi, /uiStyles\.tocDirectLink/);
});

test("learning article heading links open a focused section URL in a new tab", async () => {
  const learningUi = await read("app/learning-document-ui.tsx");

  assert.match(learningUi, /for \(const heading of headings\)/);
  assert.match(learningUi, /document\.getElementById\(heading\.id\)/);
  assert.match(learningUi, /link\.className = uiStyles\.headingDirectLink/);
  assert.match(learningUi, /link\.href = contentHref\(pathname, searchParams\.toString\(\), \{ section: heading\.id \}\)/);
  assert.match(learningUi, /link\.target = "_blank"/);
  assert.match(learningUi, /link\.rel = "noreferrer"/);
  assert.match(learningUi, /target\.classList\.add\(uiStyles\.linkableHeading\)/);
  assert.match(learningUi, /target\.appendChild\(link\)/);
  assert.doesNotMatch(learningUi, /document\.getElementById\("learning-source-register"\)/);
});

test("focused learning section hides the rest of the chapter and surrounding learning UI", async () => {
  const learningUi = await read("app/learning-document-ui.tsx");

  assert.match(learningUi, /const focusedSectionId = searchParams\.get\("section"\)/);
  assert.match(learningUi, /headings\.find\(\(heading\) => heading\.id === focusedSectionId\)/);
  assert.match(learningUi, /if \(children\[index\]\.tagName === "H2"\)/);
  assert.match(learningUi, /child\.style\.display = "none"/);
  assert.match(learningUi, /document\.querySelector<HTMLElement>\("\.kb-navigation"\)/);
  assert.match(learningUi, /element\.style\.display = "none"/);
  assert.match(learningUi, /mainRoot\.style\.marginLeft = "0"/);
  assert.match(learningUi, /layout\?\.classList\.add\(uiStyles\.focusedLayout\)/);
  assert.match(learningUi, /contentRoot\?\.classList\.add\(uiStyles\.focusedContent\)/);
  assert.match(learningUi, /if \(focusedHeading\) return null/);
});

test("learning chapter direct links open full chapters and clear focused section state", async () => {
  const learningUi = await read("app/learning-document-ui.tsx");

  assert.match(learningUi, /pagerItemId\(previous\)/);
  assert.match(learningUi, /pagerItemId\(next\)/);
  assert.match(learningUi, /contentHref\(pathname, searchParams\.toString\(\), \{ topic: previousId, section: null \}\)/);
  assert.match(learningUi, /contentHref\(pathname, searchParams\.toString\(\), \{ topic: nextId, section: null \}\)/);
  assert.match(learningUi, /className=\{uiStyles\.pagerDirectLink\}/);
  assert.match(learningUi, /target="_blank"/);
  assert.match(learningUi, /rel="noreferrer"/);
});

test("learning heading link sits at the far right and focused mode becomes single-column", async () => {
  const [learningUi, styles] = await Promise.all([
    read("app/learning-document-ui.tsx"),
    read("app/learning-document-ui.module.css"),
  ]);

  assert.match(learningUi, /M9 7H7/);
  assert.match(styles, /\.linkableHeading/);
  assert.match(styles, /display: flex/);
  assert.match(styles, /\.headingDirectLink[\s\S]*margin-left: auto/);
  assert.match(styles, /\.headingDirectLink,[\s\S]*\.pagerDirectLink/);
  assert.match(styles, /border-radius: 999px !important/);
  assert.match(styles, /\.focusedLayout[\s\S]*display: block !important/);
  assert.match(styles, /\.focusedContent[\s\S]*max-width: 980px !important/);
});
