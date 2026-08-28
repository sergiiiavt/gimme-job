# GimmeJob Locust load test

This directory contains an authorized, read-only load test for the public
GimmeJob production surface. It exercises four distinct layers without
creating or changing application data:

| Tag | Route | What it measures |
| --- | --- | --- |
| `smoke` | `GET /api/health` | Lightweight Worker/API availability |
| `edge` | `GET /` | Normal public page delivery, including edge caching |
| `worker` | `GET /reference/qa-fundamentals` | Uncached Worker-rendered HTML |
| `d1` | `GET /api/public/jobs` | Public D1 read path |
| `d1`, `heavy` | `GET /api/dashboard` | Heavier D1 dashboard read path |

The script deliberately excludes authentication, writes, vacancy sync,
analysis, AI/RAG endpoints, observability endpoints, email processing, and
external integrations. It therefore does not test a complete browser session
or the authenticated multi-tenant experience.

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

Add `--tags smoke` to call only `/api/health`, or `--tags d1` to isolate the
public D1 read paths.

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

7. Review the estimated VUH and start the test manually.
8. Watch the Azure test dashboard and, at the same timestamps, Cloudflare
   Workers **Requests / CPU / Errors** and D1 **Rows read / Query latency**.

Keep Azure's automatic stop enabled for excessive error rates. It limits a
failing run sooner, while the script's user, duration, failure-ratio, and p95
guards remain the final test contract.

Azure copies uploaded Locust artifacts into one flat directory, so the script
has no repository-relative runtime dependencies.

## Interpret the first run

The first 10-user run is a tool and telemetry validation, not a capacity
claim. Record at least:

- total and successful requests/second;
- p50, p95, and p99 by named route;
- error ratio and response codes;
- Cloudflare Worker requests, CPU time, and exceptions;
- D1 rows read, query latency, and overload errors;
- the exact user count, duration, region, deployment commit, and test time.

Because GimmeJob runs on Cloudflare Workers and D1, this test is useful for
learning Locust/Azure Load Testing and assessing GimmeJob itself. It is not a
substitute for testing the separate React/.NET/SQL Server application on AKS.
