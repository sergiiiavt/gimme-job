import type { MarketReport, MarketRow } from "./domain.js";
import { normalizeKey, roundShare } from "./utils.js";

function topCounts(values: string[], limit = 12): Array<{ name: string; count: number }> {
  const counts = new Map<string, { label: string; count: number }>();
  for (const raw of values) {
    const label = raw.trim();
    if (!label) continue;
    const key = normalizeKey(label);
    if (!key) continue;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { label, count: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(({ label, count }) => ({ name: label, count }));
}

function trendComparison(
  currentRequirements: Array<{ name: string; count: number }>,
  currentRemoteShare: number,
  currentSalaryShare: number,
  previous: MarketReport | null,
): MarketReport["trendComparison"] {
  if (!previous) {
    return {
      previousGeneratedAt: null,
      remoteShareDelta: null,
      salaryDisclosureShareDelta: null,
      requirementDeltas: [],
    };
  }

  const previousByKey = new Map(
    previous.topRequirements.map((entry) => [normalizeKey(entry.name), entry]),
  );
  const currentByKey = new Map(
    currentRequirements.map((entry) => [normalizeKey(entry.name), entry]),
  );
  const keys = new Set([...previousByKey.keys(), ...currentByKey.keys()]);
  const requirementDeltas = [...keys]
    .map((key) => {
      const current = currentByKey.get(key)?.count ?? 0;
      const previousCount = previousByKey.get(key)?.count ?? 0;
      return {
        name: currentByKey.get(key)?.name ?? previousByKey.get(key)?.name ?? key,
        current,
        previous: previousCount,
        delta: current - previousCount,
      };
    })
    .filter((entry) => entry.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.current - a.current)
    .slice(0, 12);

  return {
    previousGeneratedAt: previous.generatedAt,
    remoteShareDelta: Math.round((currentRemoteShare - previous.remoteShare) * 10) / 10,
    salaryDisclosureShareDelta:
      Math.round((currentSalaryShare - previous.salaryDisclosureShare) * 10) / 10,
    requirementDeltas,
  };
}

export function buildMarketReport(
  rows: MarketRow[],
  now = new Date(),
  previous: MarketReport | null = null,
): MarketReport {
  const analyzed = rows.filter((row) => row.analysis !== null);
  const remote = rows.filter((row) => row.job.remote).length;
  const salary = rows.filter((row) => row.job.salaryText !== null).length;
  const reservationMentions = rows.filter((row) =>
    /\b(бронювання|бронь|reservation from mobilization|mobilization reservation)\b/i.test(
      `${row.job.title}\n${row.job.description}`,
    ),
  ).length;
  const verdicts: Record<string, number> = {
    strong: 0,
    possible: 0,
    weak: 0,
    reject: 0,
  };
  for (const row of analyzed) {
    if (row.analysis) verdicts[row.analysis.verdict] = (verdicts[row.analysis.verdict] ?? 0) + 1;
  }

  const remoteShare = roundShare(remote, rows.length);
  const salaryDisclosureShare = roundShare(salary, rows.length);
  const topRequirements = topCounts(
    analyzed.flatMap((row) => row.analysis?.requirementKeywords ?? []),
  );

  return {
    generatedAt: now.toISOString(),
    totalJobs: rows.length,
    analyzedJobs: analyzed.length,
    remoteShare,
    salaryDisclosureShare,
    reservationMentions,
    topSources: topCounts(rows.flatMap((row) => row.job.source.split(","))),
    topRoles: topCounts(rows.map((row) => row.job.title)),
    topLocations: topCounts(rows.map((row) => row.job.location)),
    topRequirements,
    topCandidateGaps: topCounts(analyzed.flatMap((row) => row.analysis?.missingSkills ?? [])),
    verdicts,
    trendComparison: trendComparison(
      topRequirements,
      remoteShare,
      salaryDisclosureShare,
      previous,
    ),
  };
}
