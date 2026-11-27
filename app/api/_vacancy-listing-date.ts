/**
 * The date a vacancy is listed under: its board date, unless the vacancy
 * reached GimmeJob late.
 *
 * Boards date a vacancy when the employer created it, which can be days before
 * the posting appears in their listings. Djinni dated TechUnit's "QA Team Lead
 * (Hands-on, Web / API)" 23 November, but it first appeared in the QA listings
 * on 26 November, so "Newest first" filed a vacancy that was new to the reader
 * below 41 others.
 *
 * A vacancy first seen more than a day after its board date is therefore listed
 * when it was found. The day of slack absorbs day-precision board dates and the
 * gap between scheduled syncs. Beyond two weeks the board date wins again: that
 * is a backlog imported with a newly added source, whose real age is the more
 * useful order. A board date later than discovery (a republished vacancy) is
 * always kept, so republishing still lifts a vacancy.
 *
 * Every list query selects this as `listed_at` and orders by it, so the
 * 500-row window, the visible order, and the date filter share one rule.
 */
export const LATE_ARRIVAL_MIN_DAYS = 1;
export const LATE_ARRIVAL_MAX_DAYS = 14;

export const LISTED_AT_SQL = `CASE
      WHEN posted_at IS NOT NULL
        AND julianday(discovered_at) - julianday(posted_at) > ${LATE_ARRIVAL_MIN_DAYS}
        AND julianday(discovered_at) - julianday(posted_at) <= ${LATE_ARRIVAL_MAX_DAYS}
      THEN discovered_at
      ELSE COALESCE(posted_at, discovered_at)
    END`;

/**
 * A stored row's listed date. Every list query selects `listed_at`; a row read
 * without it falls back to the board date, then to the discovery time.
 */
export function listedAtOf(row: { listed_at?: unknown; posted_at?: unknown; discovered_at?: unknown }): string {
  for (const value of [row.listed_at, row.posted_at, row.discovered_at]) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}
