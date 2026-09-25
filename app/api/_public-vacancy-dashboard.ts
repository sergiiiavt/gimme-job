type AnonymousDashboardJob = {
  source: string;
  title: string;
  location: string;
  remote: boolean;
  salaryText?: string | null;
  reservation?: boolean;
  description: string;
};

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

export function buildAnonymousVacancyDashboard<T extends AnonymousDashboardJob>(
  publicPayload: { jobs: T[] },
  vacancySync: unknown,
  generatedAt: string,
) {
  const jobs = publicPayload.jobs;
  const percent = (count: number) => jobs.length ? Math.round(count / jobs.length * 100) : 0;

  return {
    jobs,
    market: {
      totalJobs: jobs.length,
      analyzedJobs: 0,
      remoteShare: percent(jobs.filter((job) => job.remote).length),
      salaryDisclosureShare: percent(jobs.filter((job) => Boolean(job.salaryText)).length),
      reservationMentions: jobs.filter((job) => job.reservation || /reservation from mobilization/i.test(`${job.title} ${job.description}`)).length,
      topSources: countBy(jobs.map((job) => job.source)),
      topRoles: countBy(jobs.map((job) => job.title)),
      topLocations: countBy(jobs.map((job) => job.location)),
      topRequirements: [],
      topCandidateGaps: [],
      verdicts: { strong: 0, possible: 0, weak: 0, reject: 0 },
    },
    statuses: {},
    connections: null,
    vacancySync,
    authenticated: false,
    generatedAt,
  };
}
