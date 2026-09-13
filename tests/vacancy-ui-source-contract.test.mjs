import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("vacancy UI keeps responsive rows, local-agent routing, and accessible interaction contracts", async () => {
  const [privateJobsSource, publicSiteSource, stylesSource] = await Promise.all([
    read("app/page.tsx"),
    read("app/public-site.tsx"),
    read("app/globals.css"),
  ]);

  assert.doesNotMatch(privateJobsSource, /company-mark/);
  assert.doesNotMatch(publicSiteSource, /kb-company-mark/);
  assert.doesNotMatch(stylesSource, /\.job-card\s*\{[^}]*grid-template-columns:\s*\d+px/);
  assert.doesNotMatch(stylesSource, /\.detail-head\s*\{[^}]*grid-template-columns:\s*\d+px/);
  assert.doesNotMatch(stylesSource, /\.kb-job-row\s*\{[^}]*grid-template-columns:\s*\d+px/);
  assert.match(stylesSource, /\.kb-job-action-stack > a \{/);
  assert.match(privateJobsSource, /createLocalAgentApiResolver/);
  assert.match(privateJobsSource, /const base = await apiBase\(\)/);
  assert.match(privateJobsSource, /fetch\(`\$\{base\}\$\{path\}`/);
  assert.match(privateJobsSource, /import\.meta\.env\.VITE_JOB_AGENT_PORT/);
  assert.match(privateJobsSource, /import\.meta\.env\.VITE_JOB_AGENT_INSTANCE_ID/);
  assert.match(privateJobsSource, /className="job-card"\s*\n\s*role="button"/);
  assert.match(privateJobsSource, /className="back-link" onClick=\{\(\) => setSelectedId\(null\)\}/);
  assert.match(privateJobsSource, /id="selected-vacancy-detail" role="region"/);
  assert.match(privateJobsSource, /aria-label="Search vacancies"/);
  assert.match(privateJobsSource, /className="toast" role="status" aria-live="polite"/);
});
