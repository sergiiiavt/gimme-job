/**
 * Vacancy ingestion runs on a schedule, so the workspace tells the reader how
 * old the catalogue is instead of implying every view is freshly collected.
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

/**
 * Renders the age of the catalogue, or `null` when ingestion has never reported
 * a completed run. A clock skew that puts the marker in the future reads as
 * "just now" rather than as a negative age.
 */
export function formatVacancyCatalogAge(completedAt: string | null | undefined, now = Date.now()): string | null {
  if (typeof completedAt !== "string" || !completedAt) return null;
  const parsed = Date.parse(completedAt);
  if (!Number.isFinite(parsed)) return null;

  const ageMs = now - parsed;
  if (ageMs < MINUTE_MS) return "just now";
  if (ageMs < HOUR_MS) return plural(Math.floor(ageMs / MINUTE_MS), "minute");
  if (ageMs < DAY_MS) return plural(Math.floor(ageMs / HOUR_MS), "hour");
  return plural(Math.floor(ageMs / DAY_MS), "day");
}

/** The catalogue age as a sentence fragment, empty when the age is unknown. */
export function syncFreshnessLabel(completedAt: string | null | undefined, now = Date.now()): string {
  const age = formatVacancyCatalogAge(completedAt, now);
  return age ? ` (collected ${age})` : "";
}

/** The catalogue age as a standalone status line, empty when unknown. */
export function vacancyCatalogStatusLine(completedAt: string | null | undefined, now = Date.now()): string {
  const age = formatVacancyCatalogAge(completedAt, now);
  return age ? `Vacancies collected ${age}` : "";
}
