import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync(new URL("../app/vacancy-detail-layout.css", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/vacancies-workspace.css", import.meta.url), "utf8");
const source = readFileSync(new URL("../app/vacancies-workspace.tsx", import.meta.url), "utf8");

test("vacancy freshness appears inline after the title for public and personal views", () => {
  assert.match(source, /const catalogAge = formatVacancyCatalogAge\(catalogUpdatedAt\)/);
  const group = source.match(/<div className="vacancy-header-title-group">[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? "";
  assert.match(group, /<h1>Vacancies<\/h1>/);
  assert.match(group, /className="vacancy-header-divider"/);
  assert.match(group, /className="vacancy-header-age"/);
  assert.match(group, />Collected \{catalogAge\}<\/span>/);
  assert.ok(group.indexOf("<h1>Vacancies</h1>") < group.indexOf('className="vacancy-header-age"'));
  assert.match(styles, /\.vacancy-header-title-group\s*\{[^}]*display:\s*inline-flex/);
  assert.match(styles, /\.vacancy-header-meta\s*\{[^}]*white-space:\s*nowrap/);
});

test("public header has one understated contextual sign-in link, not a second button", () => {
  assert.doesNotMatch(source, /vacancy-signin-action/);
  assert.match(source, /<span className="vacancy-header-context">Track and analyze jobs\? <\/span>/);
  assert.match(source, /<a href="\/workspace\/login" aria-label="Sign in to track and analyze vacancies">Sign in <span aria-hidden="true">→<\/span><\/a>/);
  assert.match(source, /<a href="\/workspace">Open personal tools <span aria-hidden="true">→<\/span><\/a>/);
  assert.match(styles, /\.vacancy-header-prompt a\s*\{[^}]*color:\s*var\(--green\)/);
  assert.doesNotMatch(styles, /\.vacancy-workspace-public \.vacancy-signin-action/);
  assert.match(layout, /\.vacancy-workspace-public \.vacancy-page-intro\s*\{[^}]*display:\s*block/);
  assert.doesNotMatch(layout, /grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
});

test("personal dashboard counters remain and public summary counters do not return", () => {
  assert.doesNotMatch(source, /publicCounts/);
  assert.match(source, /\{isPersonal && <div className="vacancy-catalog-summary">/);
  assert.match(source, /<Stat value=\{personalCounts\.total\} label="Total"\/>/);
  assert.match(source, /<Stat value=\{personalCounts\.interviews\} label="Interviews"\/>/);
  assert.match(source, /\{isPersonal && <div className="page-actions">/);
});

test("small screens preserve a compact heading without collision with fixed global auth", () => {
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.vacancy-workspace-public \.vacancy-header-context\s*\{[^}]*display:\s*none/);
  assert.match(styles, /@media \(max-width: 610px\)[\s\S]*\.vacancy-workspace-public \.vacancy-page-intro\s*\{[^}]*padding-top:\s*32px/);
  assert.match(styles, /\.vacancy-header-age\s*\{[^}]*text-overflow:\s*ellipsis/);
  assert.match(styles, /\.vacancy-workspace-personal \.vacancy-page-intro \.private-page-heading\s*\{[^}]*flex-direction:\s*column/);
});

test("source failure notices remain visible outside the compact header", () => {
  assert.match(source, /<\/nav>\s*\{catalogHealth && <p className="vacancy-catalog-freshness vacancy-catalog-health" role="status">\{catalogHealth\}<\/p>\}/);
});
