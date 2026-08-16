import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AboutSite from "../app/about-site.tsx";
import PublicSite from "../app/public-site.tsx";

test("public learning navigation renders regular route links instead of hashes", () => {
  const markup = renderToStaticMarkup(createElement(PublicSite, { mode: "public" }));

  assert.match(markup, /href="\/learn\/about"/);
  assert.match(markup, /href="\/learn\/interview"/);
  assert.match(markup, /href="\/learn\/certifications"/);
  assert.match(markup, /href="\/learn\/api"/);
  assert.match(markup, /href="\/learn\/programming"/);
  assert.match(markup, /href="\/learn\/automation"/);
  assert.match(markup, /href="\/learn\/cloud-devops"/);
  assert.match(markup, /href="\/learn\/qa-fundamentals"/);
  assert.doesNotMatch(markup, /href="\/learn#/);
});

test("personal learning navigation preserves private destinations", () => {
  const markup = renderToStaticMarkup(createElement(PublicSite, { mode: "personal" }));

  assert.match(markup, /href="\/learn\/about"/);
  assert.match(markup, /href="\/workspace\/learn\?section=interview"/);
  assert.match(markup, /href="\/workspace\/learn\?section=api"/);
  assert.match(markup, /href="\/workspace\/learn\/programming"/);
  assert.match(markup, /href="\/workspace\/learn\/automation"/);
  assert.match(markup, /href="\/workspace\/learn\/cloud-devops"/);
});

test("About interview card uses the same canonical route resolver", () => {
  const publicMarkup = renderToStaticMarkup(createElement(AboutSite, { mode: "public" }));
  const personalMarkup = renderToStaticMarkup(createElement(AboutSite, { mode: "personal" }));

  assert.match(publicMarkup, /href="\/learn\/interview"/);
  assert.doesNotMatch(publicMarkup, /#interview/);
  assert.match(personalMarkup, /href="\/workspace\/learn\?section=interview"/);
});
