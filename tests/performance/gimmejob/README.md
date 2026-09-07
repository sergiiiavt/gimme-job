# GimmeJob Locust load test

This directory contains an authorized, read-only load test for the public
GimmeJob production surface.

The primary benchmark scenario is now the **real anonymous Vacancies UI request
flow**, not a synthetic mix of unrelated endpoints.

| Selector | Request flow | Purpose |
| --- | --- | --- |
| `vacancies-ui` | `GET /vacancies` -> `GET /api/auth-state` -> `GET /api/dashboard` | Real public Vacancies UI backend flow; use this for the 10/50/100-user benchmark |
| `smoke` or `health` | `GET /api/health` | Lightweight Worker/API smoke |
| `home` | `GET /` | Isolated public home-page HTML diagnostic |
| `reference` | `GET /reference/qa-fundamentals` | Isolated reference-page HTML diagnostic |
| `dashboard` | `GET /api/dashboard` | Isolated dashboard/D1 diagnostic |
| `jobs-api` | `GET /api/public/jobs` | Infrastructure-only public vacancy catalogue diagnostic; not a current frontend consumer |
| `infra` | `GET /api/public/jobs` | Same infrastructure-only jobs API selector |

`/api/public/jobs` remains useful for DOU sync verification and isolated D1
investigation, but it is deliberately excluded from the real UI benchmark.

## What the real UI scenario models

A public browser visit to `/vacancies` performs this application flow:

```text
GET /vacancies
  -> React route resolves the visitor mode
GET /api/auth-state
  -> anonymous production visitor receives HTTP 401 with authenticated=false
GET /api/dashboard
  -> vacancy list data used by VacanciesWorkspace
```

Locust explicitly reproduces those three HTTP requests in sequence. It does
**not** launch a browser, execute React, or automatically download JS/CSS/images.
A separate Playwright/browser test is required for browser rendering and asset
performance.

## Where the test runs

GitHub stores the workload, but Azure Load Testing is the load generator:

```text
Azure Load Testing engine
  -> Locust virtual users
  -> https://gimme-job.com
  -> Cloudflare edge
  -> Worker: gimmejob
  -> D1: gimmejob-db for /api/dashboard
  -> response back to Azure/Locust
```

Azure/Locust shows what the simulated client experienced. Cloudflare shows what
happened inside the serving platform.

## Safety defaults

- Default local host: `http://127.0.0.1:4173`.
- Production requires `GIMMEJOB_PRODUCTION_ACK=gimme-job.com`.
- Production requires HTTPS and an explicit run time.
- Production is capped at 10 users unless `GIMMEJOB_MAX_USERS` is deliberately raised.
- Production is capped at 600 seconds unless `GIMMEJOB_MAX_RUN_SECONDS` is deliberately raised.
- Each virtual user waits 2-5 seconds between completed task iterations.
- The workload uses HTTP `GET` only.
- Default guardrails: failure ratio <= 1% and aggregate p95 <= 2500 ms.

## Install locally

Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r tests/performance/gimmejob/requirements.txt
```

Linux/macOS:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r tests/performance/gimmejob/requirements.txt
```

## Local real-UI smoke

Start the app with `npm run local`, then:

```powershell
.\.venv\Scripts\python.exe -m locust `
  -f tests/performance/gimmejob/locustfile.py `
  --host http://127.0.0.1:4173 `
  --headless --users 1 --spawn-rate 1 --run-time 30s --tags vacancies-ui
```

On localhost `/api/auth-state` intentionally reports an authenticated trusted
development host, so the strict anonymous-production auth-state assertion is
intended for the Azure production benchmark. Use `--tags smoke` for a purely
local smoke if needed.

## Azure benchmark configuration

Upload the current:

- `locustfile.py`
- `requirements.txt`

Use one engine, one region, ten-minute runs, and keep every setting identical
except user count and spawn rate.

Environment variables for all benchmark runs:

| Name | Value |
| --- | --- |
| `GIMMEJOB_HOST` | `https://gimme-job.com` |
| `GIMMEJOB_PRODUCTION_ACK` | `gimme-job.com` |
| `GIMMEJOB_MAX_USERS` | `100` |
| `GIMMEJOB_MAX_RUN_SECONDS` | `600` |
| `GIMMEJOB_MAX_FAILURE_RATIO` | `0.01` |
| `GIMMEJOB_MAX_P95_MS` | `2500` |
| `LOCUST_TAGS` | `vacancies-ui` |

Run matrix:

| Run | Users | Spawn rate | Duration | Approx. VUH |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 10 | 1 user/s | 10 min | 1.67 |
| Medium | 50 | 5 users/s | 10 min | 8.33 |
| High | 100 | 10 users/s | 10 min | 16.67 |

At USD 0.15/VUH this matrix is approximately USD 4.00 before taxes or
agreement-specific pricing. A 40-VUH monthly resource limit gives room for this
matrix plus limited retries while remaining bounded.

The earlier 100-user synthetic mixed-route run is useful diagnostic history,
but it is **not** directly comparable with this benchmark because its request
mix was different. Run a fresh 100-user `vacancies-ui` test for an apples-to-
apples 10/50/100 comparison.

## Where to see the results

### Azure Load Testing: client/load-generator view

For each run record:

- total requests;
- achieved throughput/RPS;
- p50/p90/p95/p99;
- failures/error ratio;
- the three named requests:
  - `GET /vacancies [UI page]`
  - `GET /api/auth-state [vacancies UI]`
  - `GET /api/dashboard [vacancies UI]`.

Mark the 10-user run as the baseline and compare 10 vs 50 vs 100 using the same
script, tag, engine count, region and duration.

### Cloudflare: server/platform view

For the same timestamps inspect:

**Workers & Pages -> gimmejob -> Metrics / Observability**

- Invocations/request count;
- errors/invocation status;
- CPU time;
- wall/execution time;
- logs/traces if needed.

**D1 -> gimmejob-db -> Metrics**

- read query rate;
- rows read;
- query latency.

`/api/dashboard` is the important D1-backed call in the real Vacancies UI
scenario.

Cloudflare references:

- [Workers metrics and analytics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)
- [Workers observability](https://developers.cloudflare.com/workers/observability/)
- [D1 metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)

## Interpreting the comparison

The useful scaling table is:

| Metric | 10 users | 50 users | 100 users |
| --- | ---: | ---: | ---: |
| Total RPS | | | |
| Overall p95 | | | |
| `/vacancies` p95 | | | |
| `/api/auth-state` p95 | | | |
| `/api/dashboard` p95 | | | |
| Error ratio | | | |
| Worker CPU/wall time | | | |
| D1 query latency/rows read | | | |

A healthy system should increase throughput as load rises without a
proportionally large latency increase or increasing error rate. If Azure latency
rises, correlate the same timestamp with Worker CPU/wall time and D1 query
latency/rows read before identifying a bottleneck.
