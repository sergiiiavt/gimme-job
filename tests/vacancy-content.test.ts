import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const {
  extractJobPostingMetadata,
  htmlToVacancyText,
  normalizeVacancyDescription,
  parseVacancySections,
} = await import("../agent/src/vacancy-content.ts");

const STRUCTURED_HTML = `
<section>
  <h2>Огляд</h2>
  <p>Компанія розробляє web application для B2B клієнтів.</p>
  <h2>Основні обов’язки</h2>
  <ul>
    <li>Тестування API та web UI</li>
    <li>Підготовка test cases</li>
  </ul>
  <h2>Основні вимоги</h2>
  <ul>
    <li>3+ роки досвіду у software QA</li>
    <li>SQL та Postman</li>
  </ul>
  <h2>Буде плюсом</h2>
  <p>Playwright automation.</p>
  <h2>На тебе чекають</h2>
  <ul><li>Гнучкий графік</li><li>Медичне страхування</li></ul>
</section>`;

test("htmlToVacancyText preserves headings and list item boundaries", () => {
  const text = htmlToVacancyText(STRUCTURED_HTML);
  assert.match(text, /Основні обов’язки\n- Тестування API та web UI\n- Підготовка test cases/);
  assert.match(text, /Основні вимоги\n- 3\+ роки досвіду у software QA/);
  assert.match(text, /На тебе чекають\n- Гнучкий графік\n- Медичне страхування/);
});

test("parseVacancySections recognizes classic English and Ukrainian vacancy sections", () => {
  const sections = parseVacancySections(htmlToVacancyText(STRUCTURED_HTML));
  assert.deepEqual(
    sections.map((section) => section.kind),
    ["overview", "responsibilities", "requirements", "nice-to-have", "benefits"],
  );
  assert.deepEqual(sections[1].lines, ["- Тестування API та web UI", "- Підготовка test cases"]);
});

test("normalizeVacancyDescription produces stable readable plain-text structure", () => {
  const normalized = normalizeVacancyDescription(STRUCTURED_HTML);
  assert.match(normalized, /^Overview\nКомпанія розробляє web application/m);
  assert.match(normalized, /Responsibilities\n- Тестування API та web UI\n- Підготовка test cases/);
  assert.match(normalized, /Requirements\n- 3\+ роки досвіду у software QA\n- SQL та Postman/);
  assert.match(normalized, /Nice to have\nPlaywright automation/);
  assert.match(normalized, /What we offer\n- Гнучкий графік\n- Медичне страхування/);
  assert.doesNotMatch(normalized, /<\/?(?:h2|li|ul|p)>/);
});

test("extractJobPostingMetadata reads full vacancy data from JSON-LD", () => {
  const html = `
  <html><head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Senior QA Engineer",
        "datePosted": "2026-08-16",
        "hiringOrganization": { "@type": "Organization", "name": "Example Tech" },
        "description": "<h2>Requirements</h2><ul><li>API testing</li><li>SQL</li></ul>"
      }
    </script>
  </head></html>`;

  const metadata = extractJobPostingMetadata(html);
  assert.ok(metadata);
  assert.equal(metadata.title, "Senior QA Engineer");
  assert.equal(metadata.company, "Example Tech");
  assert.equal(metadata.datePosted, "2026-08-16");
  assert.match(metadata.description ?? "", /Requirements/);
});

test("normalization is idempotent for already-normalized vacancy text", () => {
  const once = normalizeVacancyDescription(STRUCTURED_HTML);
  const twice = normalizeVacancyDescription(once);
  assert.equal(twice, once);
});
