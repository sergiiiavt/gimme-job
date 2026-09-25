import assert from "node:assert/strict";
import test from "node:test";

import { buildAnonymousVacancyDashboard } from "../app/api/_public-vacancy-dashboard.ts";

test("anonymous vacancy dashboard exposes public catalogue metrics without private workflow state", () => {
  const jobs = [
    {
      id: "1",
      source: "DOU",
      title: "QA Engineer",
      location: "Kyiv",
      remote: true,
      salaryText: "$3000",
      reservation: true,
      description: "Public role",
    },
    {
      id: "2",
      source: "DOU",
      title: "SDET",
      location: "Kyiv",
      remote: false,
      salaryText: null,
      reservation: false,
      description: "Includes reservation from mobilization",
    },
    {
      id: "3",
      source: "Djinni",
      title: "QA Engineer",
      location: "Lviv",
      remote: true,
      salaryText: null,
      reservation: false,
      description: "Ordinary public role",
    },
  ];
  const vacancySync = { status: "SUCCESS", catalogVersion: "v1" };
  const generatedAt = "2026-09-25T22:00:00.000Z";

  const payload = buildAnonymousVacancyDashboard({ jobs }, vacancySync, generatedAt);

  assert.equal(payload.jobs, jobs);
  assert.equal(payload.authenticated, false);
  assert.equal(payload.connections, null);
  assert.deepEqual(payload.statuses, {});
  assert.equal(payload.vacancySync, vacancySync);
  assert.equal(payload.generatedAt, generatedAt);
  assert.deepEqual(payload.market, {
    totalJobs: 3,
    analyzedJobs: 0,
    remoteShare: 67,
    salaryDisclosureShare: 33,
    reservationMentions: 2,
    topSources: [{ name: "DOU", count: 2 }, { name: "Djinni", count: 1 }],
    topRoles: [{ name: "QA Engineer", count: 2 }, { name: "SDET", count: 1 }],
    topLocations: [{ name: "Kyiv", count: 2 }, { name: "Lviv", count: 1 }],
    topRequirements: [],
    topCandidateGaps: [],
    verdicts: { strong: 0, possible: 0, weak: 0, reject: 0 },
  });

  for (const job of payload.jobs) {
    for (const field of ["status", "statusUpdatedAt", "analysis", "resume", "resumePdf", "draft"]) {
      assert.equal(Object.prototype.hasOwnProperty.call(job, field), false, `anonymous job leaked ${field}`);
    }
  }
});

test("anonymous vacancy dashboard handles an empty catalogue without invalid percentages", () => {
  const payload = buildAnonymousVacancyDashboard({ jobs: [] }, null, "2026-09-25T22:00:00.000Z");

  assert.equal(payload.market.totalJobs, 0);
  assert.equal(payload.market.remoteShare, 0);
  assert.equal(payload.market.salaryDisclosureShare, 0);
  assert.equal(payload.market.reservationMentions, 0);
  assert.deepEqual(payload.market.topSources, []);
  assert.deepEqual(payload.market.topRoles, []);
  assert.deepEqual(payload.market.topLocations, []);
});
