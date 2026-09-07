# GimmeJob Locust load test

This directory contains the authorized read-only production workload for GimmeJob.
The primary benchmark is the real anonymous Vacancies UI request flow.

| Selector | Request flow | Purpose |
| --- | --- | --- |
| `vacancies-ui` | `GET /vacancies` -> `GET /api/auth-state` -> `GET /api/dashboard` | Real public Vacancies UI flow; use for the 10/50/100-user benchmark |
| `smoke` / `health` | `GET /api/health` | Worker/API smoke |
| `home` | `GET /` | Home HTML diagnostic |
| `reference` | `GET /reference/qa-fundamentals` | Reference HTML diagnostic |
| `dashboard` | `GET /api/dashboard` | Isolated D1/dashboard diagnostic |
| `jobs-api` / `infra` | `GET /api/public/jobs` | Infrastructure-only diagnostic; not a current frontend consumer |

## Real UI scenario

The public Vacancies frontend performs:

```text
GET /vacancies
GET /api/auth-state
GET /api/dashboard
```

For an anonymous production visitor, `/api/auth-state` returning HTTP `401` is the expected frontend branch. The frontend decides public vs personal mode from the HTTP status, so Locust treats that `401` as a successful request.

Locust does not launch a browser or automatically execute React, JS, CSS, images, or browser-generated XHR/fetch traffic. A browser performance test requires Playwright or another real-browser tool.

## Production safety

- `GIMMEJOB_PRODUCTION_ACK=gimme-job.com` is required.
- HTTPS and an explicit bounded run time are required.
- An explicit `LOCUST_TAGS` selector is supported and is preferred for reproducible saved configurations. If it is omitted on a production run, the script safely defaults to `vacancies-ui` before Locust filters the task list; it does not run every diagnostic route.
- `GIMMEJOB_MAX_USERS` defaults to 10.
- `GIMMEJOB_MAX_RUN_SECONDS` defaults to 600.
- The workload is GET-only.
- Default guardrails are failure ratio <= 1% and aggregate p95 <= 10000 ms.

## Azure benchmark configuration

Use the checked-in `azure-loadtest.yaml` as the source of truth for Azure Load Testing. It contains the production host, bounded load, explicit `LOCUST_TAGS=vacancies-ui`, acknowledgement, and failure criteria so the saved benchmark remains reproducible.

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
| `LOCUST_TAGS` | `vacancies-ui` |

The baseline file is configured for 10 users, 1 user/s, 600 seconds, and one engine. Keep every setting identical except user count and spawn rate for the comparison matrix.

Run matrix:

| Run | Users | Spawn rate | Duration | Approx. VUH |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 10 | 1 user/s | 10 min | 1.67 |
| Medium | 50 | 5 users/s | 10 min | 8.33 |
| High | 100 | 10 users/s | 10 min | 16.67 |

At USD 0.15/VUH, the fresh matrix is approximately USD 4.00 before taxes or agreement-specific pricing. Including the earlier known smoke and synthetic 100-user run, the known usage plus this matrix is about 45.2 VUH. Use a 50 VUH monthly resource limit for this comparison.

The earlier synthetic 100-user run is not directly comparable because it used a different request mix. Run a fresh 100-user `vacancies-ui` test.

## Results

### Azure Load Testing: client/load-generator view

Record:

- total requests and RPS;
- p50/p90/p95/p99;
- error ratio;
- `GET /vacancies [UI page]`;
- `GET /api/auth-state [vacancies UI]`;
- `GET /api/dashboard [vacancies UI]`.

Mark the 10-user run as the baseline, then compare 10/50/100 with the same script, tag, engine count, region, and duration.

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

## Local smoke

Use the smoke selector locally because localhost is intentionally trusted by the application:

```powershell
.\.venv\Scripts\python.exe -m locust `
  -f tests/performance/gimmejob/locustfile.py `
  --host http://127.0.0.1:4173 `
  --headless --users 1 --spawn-rate 1 --run-time 30s --tags smoke
```
