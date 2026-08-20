import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const polishSource = readFileSync(new URL("../app/about-interview-polish.css", import.meta.url), "utf8");

test("About external actions use the standard external-link glyph and safe TOC breakpoint", () => {
  assert.match(layoutSource, /import "\.\/about-interview-polish\.css";/);
  assert.match(polishSource, /\.about-tech-actions \.about-tech-action\[target="_blank"\]::after/);
  assert.match(polishSource, /M14 5h5v5/);
  assert.match(polishSource, /M19 13v6H5V5h6/);
  assert.match(polishSource, /@media \(max-width: 1760px\) \{\s*aside\[aria-label="About page navigation"\] \{\s*display: none !important;/s);
});

test("Interview-question toolbar stays compact without changing learning-path controls", () => {
  assert.match(polishSource, /\.iq-page:not\(\.py-page\) \.iq-toolbar \{[^}]*gap: 8px;[^}]*padding: 10px;/s);
  assert.match(polishSource, /\.iq-page:not\(\.py-page\) \.iq-search,[\s\S]*?\.iq-page:not\(\.py-page\) \.iq-filter-status \{[^}]*min-height: 40px;/);
  assert.match(polishSource, /\.iq-page:not\(\.py-page\) \.iq-filter-control summary,[\s\S]*?\.iq-page:not\(\.py-page\) \.iq-clear \{[^}]*min-height: 40px;/);
  assert.match(polishSource, /\.iq-page:not\(\.py-page\) \.iq-filter-grid \{[^}]*padding-top: 8px;/s);
});
