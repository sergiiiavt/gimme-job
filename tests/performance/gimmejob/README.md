# GimmeJob performance load tests

This directory contains the authorized read-only production workloads for GimmeJob.
`locustfile.py` is the Locust implementation and `k6.js` is the equivalent k6 implementation of the same request model.
The primary Azure baseline runs every defined read-only Locust task with 10 total virtual users.

The k6-specific setup, commands, safety model, and Locust-to-k6 mapping are documented in [`K6.md`](K6.md).

| Selector | Request flow | Purpose |
| --- | --- | --- |
| `full-readonly` | Vacancies UI flow + `GET /api/health` + `GET /` + `GET /reference/qa-fundamentals` + `GET /api/public/jobs` + standalone `GET /api/dashboard` | Full production read-only baseline used by the saved Azure test |
| `vacancies-ui` | `GET /vacancies` -> `GET /api/auth-state` -> `GET /api/dashboard` | Focused real public Vacancies UI flow |
| `smoke` / `health` | `GET /api/health` | Worker/API smoke |
| `home` | `GET /` | Home HTML diagnostic |
| `reference` | `GET /reference/qa-fundamentals` | Reference HTML diagnostic |
| `dashboard` | `GET /api/dashboard` | Isolated D1/dashboard diagnostic |
| `jobs-api` / `infra` | `GET /api/public/jobs` | Infrastructure-only diagnostic; not a current frontend consumer |

## Full read-only baseline

`LOCUST_TAGS=full-readonly` selects every GET-only task currently defined in `locustfile.py`:

```text
GET /vacancies
GET /api/auth-state
GET /api/dashboard
GET /api/health
GET /
GET /reference/qa-fundamentals
GET /api/public/jobs
GET /api/dashboard
```

The same routes and weights are implemented by `GIMMEJOB_SCENARIO=full-readonly` in `k6.js`.

The two dashboard rows are intentional: one belongs to the real Vacancies UI flow and the other is the standalone diagnostic task. The Locust user count is shared across the selected workload; `LOCUST_USERS=10` means 10 total virtual users, not 10 users per endpoint.

Task weights remain part of the workload model. `vacancies_ui` has weight 6 and each diagnostic task has weight 1, so the real Vacancies flow receives more traffic while every defined read-only task remains eligible in the same run.

## Real UI scenario

The public Vacancies frontend performs:

```text
GET /vacancies
GET /api/auth-state
GET /api/dashboard
```

For an anonymous production visitor, `/api/auth-state` returning HTTP `401` is the expected frontend branch. The frontend decides public vs personal mode from the HTTP status, so both Locust and k6 treat that `401` as a successful request.

These protocol workloads do not launch a browser or automatically execute React, JS, CSS, images, or browser-generated XHR/fetch traffic. A browser performance test requires Playwright, k6 browser, or another real-browser tool.

## Execution status vs performance findings

Performance numbers do not decide whether the load test executed successfully.

A run is an execution failure when the workload cannot run correctly, for example because the production safety guard stops it, configuration is invalid, the test crashes, or no requests complete. Those conditions may use an `ERROR` log and a non-zero process exit code.

A run that starts, sends requests, reaches the configured duration, and shuts down normally is considered successfully executed even when the application performs badly. High request failure ratio or high p95 are performance findings. The scripts report them without converting the run into a threshold-driven execution failure.

The reporting thresholds remain:

- failure ratio > 1%;
- aggregate p95 > 10000 ms.

Crossing either threshold does not fail the execution. It tells us that the application did not meet the expected performance level for that run.

## Production safety

- `GIMMEJOB_PRODUCTION_ACK=gimme-job.com` is required.
- HTTPS and an explicit bounded run time are required.
- The saved Azure baseline explicitly uses `LOCUST_TAGS=full-readonly` so it exercises all defined read-only tasks.
- If a selector is omitted on a production run, both implementations safely default to `vacancies-ui` rather than broadening to every diagnostic route.
- `GIMMEJOB_MAX_USERS` defaults to 10.
- `GIMMEJOB_MAX_RUN_SECONDS` defaults to 600.
- The workloads are GET-only.
- Default reporting thresholds are failure ratio <= 1% and aggregate p95 <= 10000 ms; they are observations, not execution-failure criteria.

## Azure benchmark configuration

Use the checked-in `azure-loadtest.yaml` as the source of truth for Azure Load Testing with Locust. It contains the production host, bounded load, explicit `LOCUST_TAGS=full-readonly`, acknowledgement, and reporting thresholds so the saved benchmark remains reproducible.

The checked-in Azure configuration deliberately contains no `failureCriteria` and sets `autoStop: disable`. A slow or error-heavy run is therefore allowed to continue to its configured duration and is not converted into an execution failure merely because of performance numbers.

The current `locustfile.py` also handles an older Azure portal test that has no `LOCUST_TAGS`: once that script version is uploaded, an untagged production run selects only `vacancies-ui` instead of failing or executing every task.

If editing an existing Azure portal test manually, open **Configure -> Parameters -> Environment variables**. The checked-in benchmark uses:

| Name | Value |
| --- | --- |
| `GIMMEJOB_HOST` | `https://gimme-job.com` |
| `GIMMEJOB_PRODUCTION_ACK` | `gimme-job.com` |
| `GIMMEJOB_MAX_USERS` | `100` |
| `GIMMEJOB_MAX_RUN_SECONDS` | `600` |
| `GIMMEJOB_MAX_FAILURE_RATIO` | `0.01` |
| `GIMMEJOB_MAX_P95_MS` | `10000` |
| `LOCUST_TAGS` | `full-readonly` |

For an existing Azure portal test, also remove saved entries under **Configure -> Test criteria** and disable **AutoStop**. Otherwise Azure itself can still mark or stop a run based on performance numbers even though the Locust script now treats those numbers as findings only.

`requirements.txt` pins Locust for local/repository-controlled execution. Azure Load Testing supplies its own managed Locust runtime, so the Azure log may report a different Locust version even when `requirements.txt` is uploaded. The workload must remain compatible with the Azure-managed runtime actually shown in the run log.

The baseline file is configured for 10 users, 1 user/s, 600 seconds, and one engine. Keep every setting identical except user count and spawn rate for a future comparison matrix.

Run matrix:

| Run | Users | Spawn rate | Duration | Approx. VUH |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 10 | 1 user/s | 10 min | 1.67 |
| Medium | 50 | 5 users/s | 10 min | 8.33 |
| High | 100 | 10 users/s | 10 min | 16.67 |

At USD 0.15/VUH, the fresh matrix is approximately USD 4.00 before taxes or agreement-specific pricing. Including the earlier known smoke and synthetic 100-user run, the known usage plus this matrix is about 45.2 VUH. Use a 50 VUH monthly resource limit for this comparison.

Earlier runs that used a different selector are not directly comparable. Establish a fresh 10-user `full-readonly` baseline before comparing 50/100-user runs.

## Results

### Azure Load Testing: client/load-generator view

Record:

- total requests and RPS;
- p50/p90/p95/p99;
- error ratio;
- `GET /vacancies [UI page]`;
- `GET /api/auth-state [vacancies UI]`;
- `GET /api/dashboard [vacancies UI]`;
- `GET /api/health`;
- `GET / [public home]`;
- `GET /reference/qa-fundamentals [uncached]`;
- `GET /api/public/jobs [infra D1]`;
- `GET /api/dashboard [diagnostic D1 heavy]`.

Mark the fresh 10-user `full-readonly` run as the baseline, then compare later runs only when the script, selector, engine count, region, and duration match.

### Cloudflare: server/platform view

For the same timestamps inspect:

**Workers & Pages -> gimmejob**

- invocations;
- errors;
- CPU time;
- wall/execution time.

**D1 -> gimmejob-db**

- read query rate;
- rows read;
- query latency.

Cloudflare references:

- https://developers.cloudflare.com/workers/observability/metrics-and-analytics/
- https://developers.cloudflare.com/d1/observability/metrics-analytics/

## Local Locust smoke

Use the smoke selector locally because localhost is intentionally trusted by the application:

```powershell
.\.venv\Scripts\python.exe -m locust `
  -f tests/performance/gimmejob/locustfile.py `
  --host http://127.0.0.1:4173 `
  --headless --users 1 --spawn-rate 1 --run-time 30s --tags smoke
```

## Local k6 smoke

```powershell
k6 run `
  -e GIMMEJOB_HOST=http://127.0.0.1:4173 `
  -e GIMMEJOB_SCENARIO=health `
  -e GIMMEJOB_USERS=1 `
  -e GIMMEJOB_SPAWN_RATE=1 `
  -e GIMMEJOB_DURATION=30s `
  tests/performance/gimmejob/k6.js
```

See [`K6.md`](K6.md) for the full production commands and the detailed Locust-to-k6 concept mapping.
