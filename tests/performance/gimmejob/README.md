# GimmeJob Locust load test

This directory contains an authorized, read-only load test for the public
GimmeJob production surface. It exercises several layers without creating or
changing application data.

| Selector | Route | What it measures |
| --- | --- | --- |
| `smoke` or `health` | `GET /api/health` | Lightweight Worker/API availability |
| `home` | `GET /` | Normal public page delivery, including edge caching |
| `reference` | `GET /reference/qa-fundamentals` | Worker-rendered HTML |
| `jobs` | `GET /api/public/jobs` | Public D1 read path |
| `dashboard` | `GET /api/dashboard` | Heavier D1 dashboard read path |
| `public-read` | all four non-health routes above | Mixed read-only public workload |
| `d1` | jobs + dashboard | Both D1-backed read paths |

The script deliberately excludes authentication, writes, vacancy sync,
analysis, AI/RAG endpoints, observability endpoints, email processing, and
external integrations. It therefore does not test a complete browser session
or the authenticated multi-tenant experience.

## Where the test actually runs

The repository stores the script, but GitHub does not execute the production
load test. When the test is started in Azure Load Testing, Azure provisions a
load-generator engine and runs the uploaded `locustfile.py` there. The request
path is:

```text
Azure Load Testing engine
  -> Locust virtual users
  -> HTTPS requests to https://gimme-job.com
  -> Cloudflare edge
  -> Worker: gimmejob
  -> D1: gimmejob-db, when the selected route reads D1
  -> HTTP response back to Locust
```

For a local run the Locust process runs on the developer machine instead of an
Azure engine. The target application path is otherwise the same when the host
is production.

This distinction matters because two different systems observe the same test:
Azure/Locust observes the request from the client/load-generator side, while
Cloudflare observes what happens inside the platform serving the request.

## Safety defaults

- The default host is `http://127.0.0.1:4173`.
- Production requires `GIMMEJOB_PRODUCTION_ACK=gimme-job.com`.
- Production requires HTTPS and an explicit bounded run time.
- Production is capped at 10 users unless `GIMMEJOB_MAX_USERS` is deliberately
  increased.
- Production is capped at 600 seconds unless
  `GIMMEJOB_MAX_RUN_SECONDS` is deliberately increased.
- Every simulated user waits 2-5 seconds between requests.
- The workload only uses HTTP `GET`.
- The default exploratory guardrails are error ratio <= 1% and aggregate p95
  <= 2,500 ms. They can be changed with environment variables.

These script-level protections complement Azure Load Testing auto-stop rules,
Azure Cost Management alerts, and Cloudflare usage monitoring.

## Azure cost for the first run

Azure bills Load Testing in virtual user hours (VUH). Since March 1, 2026, each
test run is billed for at least 10 virtual users per engine and at least 10
minutes. Consequently, a one-engine run with up to 10 users and a duration of
up to 10 minutes has a minimum billable usage of 1.67 VUH. At the 0-10,000 VUH
list rate of USD 0.15/VUH published on August 28, 2026, that is approximately
USD 0.25 per run, before taxes and agreement-specific pricing.

Creating several tiny Azure runs is therefore not cheaper than one reviewed
10-user, 10-minute run. Local Locust runs have no Azure Load Testing charge.
Create an Azure Cost Management budget and alerts before experimenting, but do
not treat the budget as a hard stop: Azure budgets notify and do not stop the
test or other resources automatically.

- [Official Azure App Testing pricing](https://azure.microsoft.com/en-us/pricing/details/app-testing/)
- [Azure Cost Management budget behavior](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets)

## Install locally

From the repository root on Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r tests/performance/gimmejob/requirements.txt
```

On Linux or macOS:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r tests/performance/gimmejob/requirements.txt
```

## Run against the local application

Start GimmeJob in one terminal with `npm run local`, then run a 30-second
single-user smoke test in another terminal:

```powershell
.\.venv\Scripts\python.exe -m locust `
  -f tests/performance/gimmejob/locustfile.py `
  --host http://127.0.0.1:4173 `
  --headless --users 1 --spawn-rate 1 --run-time 30s
```

Use `--tags smoke` to call only `/api/health`, `--tags public-read` to exercise
all four non-health public reads, `--tags d1` for both D1 paths, or one of the
route-specific selectors: `home`, `reference`, `jobs`, `dashboard`.

## Run a minimal authorized production smoke

Use this only while watching the Cloudflare Worker and D1 dashboards:

```powershell
$env:GIMMEJOB_HOST = "https://gimme-job.com"
$env:GIMMEJOB_PRODUCTION_ACK = "gimme-job.com"
$env:GIMMEJOB_MAX_USERS = "1"
$env:GIMMEJOB_MAX_RUN_SECONDS = "30"

.\.venv\Scripts\python.exe -m locust `
  -f tests/performance/gimmejob/locustfile.py `
  --headless --users 1 --spawn-rate 1 --run-time 30s --tags smoke
```

Clear the temporary variables after the run:

```powershell
Remove-Item Env:GIMMEJOB_HOST
Remove-Item Env:GIMMEJOB_PRODUCTION_ACK
Remove-Item Env:GIMMEJOB_MAX_USERS
Remove-Item Env:GIMMEJOB_MAX_RUN_SECONDS
```

## Upload to Azure Load Testing

1. Create the Azure Load Testing resource, then create an Azure Cost Management
   budget with low actual-cost thresholds for the resource group or
   subscription.
2. Open **Tests -> Create -> Upload a script**. Do not use **URL-based test**;
   that path generates JMeter and does not run Locust.
3. Disable **Run test after creation** until the complete configuration has
   been reviewed.
4. Select **Locust** and upload both:
   - `locustfile.py` as the main test script;
   - `requirements.txt` as the Python dependencies file.
5. Configure one engine, 10 users, a spawn rate of 1 user/second, and a
   10-minute duration.
6. Add these non-secret environment variables:

   | Name | Initial value |
   | --- | --- |
   | `GIMMEJOB_HOST` | `https://gimme-job.com` |
   | `GIMMEJOB_PRODUCTION_ACK` | `gimme-job.com` |
   | `GIMMEJOB_MAX_USERS` | `10` |
   | `GIMMEJOB_MAX_RUN_SECONDS` | `600` |
   | `GIMMEJOB_MAX_FAILURE_RATIO` | `0.01` |
   | `GIMMEJOB_MAX_P95_MS` | `2500` |
   | `LOCUST_TAGS` | scenario selector, for example `smoke` or `public-read` |

7. Review the estimated VUH and start the test manually.
8. Keep Azure's automatic stop enabled for excessive error rates.

Azure copies uploaded Locust artifacts into one flat directory, so the script
has no repository-relative runtime dependencies.

## Next run: exercise the real public read paths

The first Azure run intentionally used:

```text
LOCUST_TAGS=smoke
```

which makes only `GET /api/health` eligible. To run the four implemented
non-health calls in one read-only workload, upload the current `locustfile.py`
and use:

```text
LOCUST_TAGS=public-read
```

That run will select among:

- `GET /`
- `GET /reference/qa-fundamentals`
- `GET /api/public/jobs`
- `GET /api/dashboard`

with their configured task weights and the same 2-5 second per-user wait.
For diagnosis, a later run can isolate one route by setting `LOCUST_TAGS` to
`home`, `reference`, `jobs`, or `dashboard`.

## Where to see the results

### Azure Load Testing: client/load-generator view

Open the Azure Load Testing resource, select the test, then open the specific
test run. Azure is the primary place for the metrics Locust measures from the
requester's side:

- total requests and throughput/RPS;
- response-time percentiles such as p50, p90, p95 and p99;
- failures/error percentage and response codes;
- per-request statistics for the named Locust routes;
- the time-series graphs for the run.

This answers **what the simulated user experienced**.

### Cloudflare: server/platform view

For the same test timestamps, inspect Cloudflare as well.

**Worker `gimmejob`:** open **Workers & Pages -> gimmejob** and inspect its
Metrics/Observability data. Important signals are request count, invocation
errors/status, CPU time, wall/execution time, memory when relevant, and logs or
traces when a request needs investigation.

**D1 `gimmejob-db`:** inspect D1 analytics for read query rate, rows read, query
latency and response volume. D1 metrics matter mainly for the `jobs` and
`dashboard` scenarios; the health request does not prove D1 performance.

Cloudflare's current official metric definitions are documented here:

- [Workers metrics and analytics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)
- [Workers observability](https://developers.cloudflare.com/workers/observability/)
- [D1 metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)

## Which dashboard is authoritative?

Do not choose only one for a meaningful performance investigation.

| Question | Look at |
| --- | --- |
| Did users get slow responses? | Azure/Locust latency percentiles |
| Did throughput stay at the generated rate? | Azure/Locust RPS and request count |
| Did requests fail functionally or over HTTP? | Azure/Locust failures/errors |
| Did the Worker approach CPU/runtime limits? | Cloudflare Worker metrics |
| Did Worker exceptions/resource errors appear? | Cloudflare Worker metrics/logs |
| Did D1 queries become slow or scan many rows? | Cloudflare D1 analytics |
| What component probably caused the slowdown? | Correlate Azure and Cloudflare at the same timestamps |

For the first smoke run, Azure was enough to confirm that Locust generated the
expected traffic and received correct health responses. For the next D1/public
read run, Azure alone is insufficient for diagnosis: monitor Azure and
Cloudflare together.

## Interpret a run

Record at least:

- total and successful requests/second;
- p50, p95, and p99 by named route;
- error ratio and response codes;
- Cloudflare Worker requests, CPU time, execution/wall time and exceptions;
- D1 read query rate, rows read and query latency for D1-backed routes;
- the exact user count, duration, region, deployment commit, scenario tags and
  test start/end time.

Because GimmeJob runs on Cloudflare Workers and D1, this test is useful for
learning Locust/Azure Load Testing and assessing GimmeJob itself. It is not a
substitute for testing the separate React/.NET/SQL Server application on AKS.
