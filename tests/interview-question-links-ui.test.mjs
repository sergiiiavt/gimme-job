import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("QA and Python interview lists mount direct question links", async () => {
  const [qaPage, pythonPage] = await Promise.all([
    read("app/interview/page.tsx"),
    read("app/interview/python/page.tsx"),
  ]);

  assert.match(qaPage, /InterviewQuestionLinkOverlay pathname="\/interview" questions=\{interviewCatalog\.questions\}/);
  assert.match(pythonPage, /InterviewQuestionLinkOverlay pathname="\/interview\/python" questions=\{pythonInterviewCatalog\.questions\}/);
});

test("question link overlay inserts real anchors with a plain chain-link icon", async () => {
  const overlay = await read("app/interview-question-link-overlay.tsx");

  assert.match(overlay, /questionDeepLinkHref\(pathname, questionId\)/);
  assert.match(overlay, /question\.questionUk/);
  assert.match(overlay, /document\.createElement\("a"\)/);
  assert.match(overlay, /summary\.appendChild\(link\)/);
  assert.match(overlay, /MutationObserver/);
  assert.match(overlay, /setAttribute\("aria-label", "Open direct link to this question"\)/);
  assert.match(overlay, /link\.title = "Direct link"/);
  assert.match(overlay, /iq-question-direct-link/);
  assert.match(overlay, /background: "transparent"/);
  assert.match(overlay, /border: "0"/);
  assert.match(overlay, /borderRadius: "0"/);
  assert.doesNotMatch(overlay, /createPortal/);
});

test("exact-question back action uses browser history for the matching interview list", async () => {
  const deepLink = await read("app/interview-question-deep-link.tsx");

  assert.match(deepLink, /referrer\.pathname === backHref/);
  assert.match(deepLink, /window\.history\.scrollRestoration = "auto"/);
  assert.match(deepLink, /window\.history\.back\(\)/);
  assert.match(deepLink, /window\.location\.assign\(backHref\)/);
});
