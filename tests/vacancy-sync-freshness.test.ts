import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const {
  formatVacancyCatalogAge,
  syncFreshnessLabel,
  vacancyCatalogStatusLine,
  vacancySourceHealthLine,
} = await import("../app/vacancy-sync-freshness.ts");

const NOW = Date.parse("2026-09-20T12:00:00.000Z");

function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

test("catalogue age reads in the largest useful unit", () => {
  assert.equal(formatVacancyCatalogAge(ago(20_000), NOW), "just now");
  assert.equal(formatVacancyCatalogAge(ago(60_000), NOW), "1 minute ago");
  assert.equal(formatVacancyCatalogAge(ago(12 * 60_000), NOW), "12 minutes ago");
  assert.equal(formatVacancyCatalogAge(ago(60 * 60_000), NOW), "1 hour ago");
  assert.equal(formatVacancyCatalogAge(ago(5 * 60 * 60_000), NOW), "5 hours ago");
  assert.equal(formatVacancyCatalogAge(ago(36 * 60 * 60_000), NOW), "1 day ago");
  assert.equal(formatVacancyCatalogAge(ago(3 * 24 * 60 * 60_000), NOW), "3 days ago");
});

test("an unknown or unparseable marker produces no age at all", () => {
  assert.equal(formatVacancyCatalogAge(null, NOW), null);
  assert.equal(formatVacancyCatalogAge(undefined, NOW), null);
  assert.equal(formatVacancyCatalogAge("", NOW), null);
  assert.equal(formatVacancyCatalogAge("not a date", NOW), null);
});

test("a marker ahead of the local clock still reads sensibly", () => {
  assert.equal(formatVacancyCatalogAge(new Date(NOW + 5 * 60_000).toISOString(), NOW), "just now");
});

test("labels stay empty rather than claiming an unknown freshness", () => {
  assert.equal(syncFreshnessLabel(null, NOW), "");
  assert.equal(vacancyCatalogStatusLine(null, NOW), "");
  assert.equal(syncFreshnessLabel(ago(12 * 60_000), NOW), " (collected 12 minutes ago)");
  assert.equal(vacancyCatalogStatusLine(ago(12 * 60_000), NOW), "Vacancies collected 12 minutes ago");
});


test("scheduled source failures render without treating expected skips as failures", () => {
  assert.equal(vacancySourceHealthLine([
    { source: "djinni:qa", status: "FAILED", error: "403 Forbidden" },
    { source: "workua:qa", status: "SKIPPED", error: "cloud access blocked" },
    { source: "robotaua:qa", status: "SUCCESS", error: null },
  ]), "1 source failing: djinni:qa (403 Forbidden)");

  assert.equal(vacancySourceHealthLine([
    { source: "robotaua:qa", status: "SUCCESS", error: null },
  ]), "");
});
