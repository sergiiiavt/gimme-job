# Vacancy ingestion — deep review, evidence, and remediation plan

**Status:** Review document (no code changed)
**Date:** 2026-09-16
**Scope:** `agent/src/sources/*`, `agent/src/vacancy-content.ts`, `agent/src/job-intake.ts`, `app/api/_vacancy-intake.ts`, `app/api/_dou-vacancy-import.ts`, `scripts/sync-dou-vacancies.ts`, `config/sources.json`
**Method:** static review of the pipeline + live probes of every configured source + measurement of the live production catalogue. All numbers below were measured on 2026-09-16, not estimated.

---

## 1. Executive summary

The pipeline is not "partly broken at the edges". Its two identity fields — **company** and **description** — are produced by the weakest mechanism in the chain (regex over rendered HTML, plus prose guessing), while every source involved already publishes those exact fields in a structured, machine-readable form that the code either never reads or reads and throws away.

Measured on the live public API (`/api/public/jobs`, 500 rows):

| Field | Result |
|---|---|
| Company literally `Unknown` | **383 rows (76.6 %)** |
| Company present but fabricated from prose (`- Hands`, `We provides e`, `The project is a large`) | **≈37 rows (7 %)** |
| Company actually correct | **≈80 rows (16 %)** |
| Description shorter than 400 characters (teaser only) | 130 rows (26 %) |
| No posted date | 380 rows (76 %) |
| Location `Unknown` | 96 rows (19 %) |
| Salary present | 30 rows (6 %) |

Source mix in that same payload: DOU 380, Djinni 89, Robota.ua 30, one stale `Djinni + Work.ua` merge. Work.ua contributes nothing at all.

The three headline causes:

1. **DOU** — the company selector looks for `<span class="company">` / `<div class="company">`. DOU's real markup is `<a class="company">`. Every one of the 290 DOU vacancies therefore gets `Unknown`, even though the company slug is also sitting in the vacancy URL. The posted date is in the card too (`<div class="date">`) and is never read.
2. **Djinni** — the feed carries no company at all, but the *listing page* embeds a complete `schema.org/JobPosting` JSON-LD block per vacancy (company, full description, dates, salary). The code ignores it, fetches 40 detail pages, parses their JSON-LD, uses only the description, **discards the company that was right there**, and then guesses the company from the description prose.
3. **Robota.ua** — the search API has no `description` field at all (only a hard 251-character `shortDescription`), and the detail page is behind a Cloudflare managed challenge (HTTP 403). So every Robota.ua row is a 251-character teaser, and 50 detail fetches per run are wasted on 403s that are silently swallowed.

A fourth cause is systemic: **nothing in the test suite or the smoke test can fail on any of this**, because the fixtures are hand-invented HTML that does not match the live sites, and the "company coverage" assertion accepts fabricated names.

The good news is that the fix is mostly *subtraction*. Djinni's entire QA catalogue is available with 100 % company/date coverage and full descriptions in **9 HTTP requests** (verified below) versus the 141 the current code spends to achieve 1 %.

---

## 2. How the pipeline works today

### 2.1 Two independent run paths

| Path | Trigger | Sources collected | Writes |
|---|---|---|---|
| **GitHub Actions runner** — [.github/workflows/dou-vacancies.yml](.github/workflows/dou-vacancies.yml), [scripts/sync-dou-vacancies.ts](scripts/sync-dou-vacancies.ts) | hourly cron `17 * * * *` | **DOU only**, via `RssJobSource` directly | POSTs to `/internal/n8n/vacancies-sync` with `x-gimmejob-mode: dou-import` |
| **Worker sync** — [syncVacancySources](app/api/_vacancy-intake.ts:308) | n8n / manual POST | RSS (DOU + Djinni), Robota.ua, Lobby X. Work.ua explicitly skipped | direct D1 upsert |
| **Local CLI** — [agent/src/sources/index.ts](agent/src/sources/index.ts) | `npm run agent:sync` | whatever is in `config/sources.json` | local store |

Note that the hourly DOU runner calls `source.collect()` **directly**, bypassing [collectAllSources](agent/src/sources/types.ts:39) — so the company-recovery step does not run on the path that produces 76 % of production rows. DOU rows land in D1 with the literal string `Unknown`.

### 2.2 Per-job flow

```
source.collect()                      per-adapter listing parse (+ capped detail enrichment)
  -> normalizeCollectedJob()          trims, substitutes "Unknown" defaults      types.ts:20
  -> recoverMissingCompanies()        prose guessing + extra HTTP fetch          types.ts:30
  -> filterRelevantVacancies()        QA-relevance regex gate                    job-intake.ts
  -> deduplicateVacancies()           O(n^2) similarity merge                    job-intake.ts
  -> upsertVacancies()                loads 1000 rows, O(n*m) match, upsert      _vacancy-intake.ts:205
  -> publicVacancies()                LIMIT 500, then re-filters and re-dedupes on every read
```

---

## 3. Measured evidence

### 3.1 Live per-adapter run (local machine, real network, current code)

Each adapter's `collect()` was executed unmodified, with `fetch` instrumented to count requests.

| Source | Jobs | HTTP requests | Company usable | Location known | Posted date | Description median | Description < 400 chars | Survives relevance filter |
|---|---|---|---|---|---|---|---|---|
| DOU (`rss:dou-qa`) | 290 | 48 | **0 %** | 97.9 % | **0 %** | 223 | **94.5 %** | 230 |
| Djinni (`rss:djinni-qa`) | 100 | 41 | **1 %** | **0 %** | 100 % | 2 573 | 0 % | 94 |
| Djinni + company recovery | 100 | 49 | "100 %" — **but fabricated** | 0 % | 100 % | 2 573 | 0 % | 94 |
| Robota.ua | 105 | 53 | 100 % | 100 % | 100 % | **251** | **100 %** | 54 |
| Lobby X | 3 | 4 | 100 % | hard-coded `Ukraine` | 100 % | 2 184 | 0 % | 3 |
| Work.ua | — | — | **HTTP 403** | — | — | — | — | — |

Company values produced by the "recovery" layer on Djinni, verbatim:

```
"The project is a large"      <- title: QA Engineer            (real company: Mind Studios)
"- Knowledge of full"         <- title: Trainee/Junior QA Engineer
"- Hands"                     <- three different vacancies
"We provides e"               <- two different vacancies
"- Софт"                      <- title: Strong Junior Manual QA
```

These pass [`isUsableCompany`](agent/src/sources/company.ts:33) and are written to D1 and rendered in the UI.

### 3.2 What the sources actually publish

| Source | Company available? | Full description available? | Posted date | Access |
|---|---|---|---|---|
| **DOU listing card** | Yes — `<a class="company">United Tech</a>`, plus the `/companies/<slug>/vacancies/<id>` URL | No (150–220-char `sh-info` teaser) | Yes — `<div class="date">17 серпня</div>` | 200 OK, `robots.txt` permits |
| **DOU detail page** | Yes (page body) | Yes (`.vacancy-section` / `.b-typo`) | — | 200 OK. **No `JobPosting` JSON-LD — only `Organization`** |
| **Djinni RSS** | **No — feed carries no company or location field** (`title, link, description, pubDate, guid, category` only) | Yes (median 2 573 chars) | Yes | 200 OK |
| **Djinni listing page** | **Yes — full `JobPosting` JSON-LD, 15 per page** | **Yes** | Yes, plus `validThrough` | 200 OK, `robots.txt` permits `/jobs/` |
| **Djinni detail page** | Yes — `hiringOrganization.name` | Yes | Yes | 200 OK |
| **Robota.ua search API** | Yes (`companyName`) | **No — field absent; `shortDescription` truncated at 251 chars** | Yes | 200 OK (legacy `api.rabota.ua`) |
| **Robota.ua detail page / GraphQL** | — | — | — | **403 Cloudflare managed challenge** (`robots.txt` itself is challenged) |
| **Work.ua** | — | — | — | **403** with full browser headers, from this machine and from CI |
| **Lobby X API** | **No** — `companies` and `city` taxonomies are empty, `acf` empty | Yes (detail page `.vacancy-description`) | Yes | 200 OK; `robots.txt` disallows `/*?*`, which covers the `wp-json` query URL |

### 3.3 The Djinni discovery that changes the plan

`https://djinni.co/jobs/?primary_keyword=QA&page=N` embeds one JSON-LD array containing **15 complete `JobPosting` objects per page**. Measured across 9 pages:

```
total postings: 139       (9 requests)
company present: 139      100.0 %
datePosted:      139      100.0 %
validThrough:    139      100.0 %   <- gives a real expiry date
baseSalary:       26
description p10/median/p90: 1277 / 2381 / 4069 chars, minimum 672
fields: applicantLocationRequirements, category, datePosted, description,
        directApply, employmentType, experienceRequirements, hiringOrganization,
        identifier, industry, jobLocationType, title, url, validThrough
```

**9 requests -> 100 % company, 100 % date, full descriptions, salary, employment type, remote flag and an expiry date.** Current code: 141 requests -> 1 % company, 0 % location, no salary, no expiry.

---

## 4. Defects, ranked

### D1 — DOU company selector does not match DOU's markup *(critical)*

[agent/src/sources/rss.ts:152](agent/src/sources/rss.ts:152)

```ts
const companyBlock = extractElementByClass(block, "span", "company")
  || extractElementByClass(block, "div", "company");
```

Live DOU card:

```html
<a class="vt" href="https://jobs.dou.ua/companies/united-tech/vacancies/362045/?from=list_hot">Manual QA Engineer (Mobile)</a>
&nbsp;<strong>в&nbsp;<a class="company" href="https://jobs.dou.ua/companies/united-tech/vacancies/">…&nbsp;United Tech</a></strong>
```

The company is an **anchor**, not a span or div. Result: `Unknown` for 290/290 DOU vacancies — 380 of the 500 production rows. The file already contains an [`anchorByClass`](agent/src/sources/rss.ts:110) helper used for the `vt` title link; it is simply not used for `company`. The company slug is *also* in the URL path as a second independent source.

### D2 — DOU posted date is never read *(high)*

The card carries `<div class="date">17 серпня</div>`. The parser does not read it, and [`enrichDouDetails`](agent/src/sources/rss.ts:250) tries to recover `datePosted` from `extractJobPostingMetadata`, which returns `null` for DOU because DOU detail pages publish only an `Organization` JSON-LD block, never `JobPosting`. Result: 0 % posted dates on the largest source; the workspace `Posted` column is empty for 76 % of rows, and `dateSimilarity` in dedup degrades to the neutral 0.5.

### D3 — Detail-page metadata is parsed and then thrown away *(critical)*

[agent/src/sources/rss.ts:386](agent/src/sources/rss.ts:386)

```ts
const full = parseRssDetailDescription(job.url, await fetchText(job.url));
if (full.length > job.description.length) { return { ...job, description: full, … }; }
```

`parseRssDetailDescription` calls `extractJobPostingMetadata(html)` internally and returns **only a string**. For Djinni that JSON-LD block contains `hiringOrganization.name` ("Mind Studios", "Digis (a Fiverr company)"), `datePosted`, `employmentType` and location — all discarded. Worse, the RSS description is usually *longer* than the JSON-LD description (2 472 vs 2 440 chars on the sampled Digis posting), so the `if` is normally false and all 40 detail fetches are pure waste.

### D4 — Company "recovery" fabricates names from prose *(critical — this is the "nonsense company" symptom)*

[`inferCompanyFromText`](agent/src/sources/company.ts:53) applies three heuristics to the first 2 000 characters of the description: an `X is a … company` sentence, an `About the company:` line, and — the damaging one — [line 76](agent/src/sources/company.ts:76): *any line whose first 1–7 words are followed by a dash*. Bullet lists (`- Hands-on experience …`), section headings and ordinary prose all match.

[`recoverJobCompany`](agent/src/sources/company.ts:145) tries this **before** fetching the page, so a fabricated name suppresses the HTTP lookup that would have found the real one. In the instrumented run, only 8 of 99 missing companies ever reached the fetch — the other 91 were "solved" by prose.

Consequences beyond the visible garbage:

- [`canonicalCompany`](agent/src/job-intake.ts) is a hard gate in `duplicateConfidence`: two postings from one company that receive different fabricated names never merge.
- Conversely, two unrelated postings that both receive `- Hands` and have similar titles *can* merge into one row.
- `Unknown` is at least honest and is special-cased downstream; an invented name is indistinguishable from real data.

### D5 — Enrichment is capped at 40 of 290 *(high)*

`MAX_DETAIL_FETCHES = 40` — [rss.ts:23](agent/src/sources/rss.ts:23), also 50 in [robotaua.ts:16](agent/src/sources/robotaua.ts:16) and 40 in [lobbyx.ts](agent/src/sources/lobbyx.ts). DOU returns 290 cards, so 250 vacancies keep a ~150–220-character teaser forever. There is no backlog, no `last_enriched_at`, no second pass — a vacancy that is unlucky on its first sync is never enriched again.

### D6 — Robota.ua descriptions are structurally unobtainable by the current method *(high)*

[robotaua.ts:93](agent/src/sources/robotaua.ts:93) reads `document.description`. That field **does not exist** in the search API response. The actual fields are `shortDescription` (hard-truncated to exactly 251 characters, leading tabs included) and no long form. The detail URL built at [robotaua.ts:54](agent/src/sources/robotaua.ts:54) returns **403** behind a Cloudflare managed challenge, and the failure is swallowed at [robotaua.ts:150](agent/src/sources/robotaua.ts:150). Every modern Robota.ua endpoint (`ua-api.robota.ua`, `api.robota.ua`, `dracula.robota.ua/graphql`) is also 403. Measured: 105/105 descriptions ≤ 251 chars, 50 wasted requests per run.

### D7 — Truncated descriptions silently delete real vacancies *(high, second-order)*

[`classifyJobRelevance`](agent/src/job-intake.ts) scores on `title + description + company + location`. With a 251-character teaser there is no software context to find. Measured on Robota.ua:

```
ACCEPT explicit_software_qa_role                    51
REJECT no_software_qa_role_signal                   26
REJECT generic_test_role_without_software_context   20   <- includes real software QA roles
ACCEPT generic_test_role_with_software_context       3
REJECT non_software_testing_role                     5
```

Among the 20 wrongly rejected: *"Тестувальник QA (CRM Siebel)"*, *"Тестувальник Управління розробки та інтеграції"*. **19 % of a source is lost because of a description defect**, and the rejection is logged only as an aggregate count.

### D8 — Unstable external IDs on DOU promoted cards *(medium)*

`douExternalId` matches `/\/vacancies\/(\d+)\/?$/`, but promoted cards carry `?from=list_hot`, which [`canonicalizeUrl`](agent/src/utils.ts) does not strip (`from` is absent from `TRACKING_PARAMS`). Measured: **4 of 20** first-page cards fall back to a URL-shaped `externalId`. Since `fingerprint = sha256(source|externalId)`, the same vacancy inserts a *second* row once it stops being promoted. The GitHub-Actions import path happens to repair this in [normalizeDouImportJobs](app/api/_dou-vacancy-import.ts), the Worker path does not.

### D9 — Work.ua is dead but still configured *(medium)*

403 with a complete modern browser header set, from a residential IP and from CI. `robots.txt` permits `/jobs/`; the block is at the WAF. The adapter remains in `config/sources.json`, and a stale `Djinni + Work.ua` merged row is still served in production.

### D10 — Local and cloud collect different catalogues *(medium)*

`config/sources.json` has **no `robotaUa` key** -> the schema default `[]` applies -> the local CLI never collects Robota.ua, while [`DEFAULT_VACANCY_SOURCES`](app/api/_vacancy-intake.ts:52) enables it in the Worker. Local uses query `QA` for Work.ua/Lobby X, cloud defaults use `QA Engineer` — which returns 3 vs 2 Lobby X items. Reproducing a production problem locally does not reproduce the same input set.

### D11 — The DOU query in config is decorative *(low, but a trap)*

The scraper hard-codes `?category=QA` ([rss.ts:27-28](agent/src/sources/rss.ts:27)) but only activates when the *configured* URL matches `search=QA` ([rss.ts:325](agent/src/sources/rss.ts:325)). Editing the configured query to anything else silently drops the pipeline back to the 25-item RSS path (`search=QA` feed returns 25 items; `category=QA` listing has 290).

### D12 — No provenance, no completeness gate *(architectural)*

[`normalizeCollectedJob`](agent/src/sources/types.ts:20) substitutes `"Unknown"`, and from that point a scraped value, a defaulted value and a fabricated value are indistinguishable. There is no per-field confidence, no `needs_review` state, no quarantine. The system cannot answer "is this row trustworthy?" — which is why the defects survived for so long.

### D13 — Upsert does not scale and silently stops deduplicating *(medium)*

[app/api/_vacancy-intake.ts:217](app/api/_vacancy-intake.ts:217) loads `SELECT * FROM jobs ORDER BY updated_at DESC LIMIT 1000` into Worker memory, then runs `existing.find(…)` per incoming job ([line 224](app/api/_vacancy-intake.ts:224)) — O(n·m) with a full-description payload. Past 1 000 rows, duplicates against older records are simply not detected.

### D14 — The read path re-filters on every request *(medium)*

[`publicVacancies`](app/api/_vacancy-intake.ts:380) selects 500 rows and then [`sanitizeJobs`](app/api/_vacancy-intake.ts:357) re-runs relevance classification and deduplication **on read**. A correctly stored vacancy can still disappear from the UI, and the CPU cost is paid per request instead of per sync.

### D15 — No vacancy lifecycle *(medium)*

[db/schema.ts:15](db/schema.ts:15) has `discovered_at` and `updated_at` but no `last_seen_at`, `closed_at` or `valid_through`. Closed vacancies are never retired and permanently occupy slots in the `LIMIT 500` public window. Djinni's `validThrough` field — available for free — is not collected.

### D16 — The tests cannot fail on any of the above *(critical process defect)*

- [tests/dou-vacancy-discovery.test.ts:13](tests/dou-vacancy-discovery.test.ts:13) builds fixtures with `<span class="company">в <a href="#">${company}</a></span>` — markup DOU does not emit. The test asserts `["Twist Robotics", "Airlogix", "Eleven"]` and passes, while production returns `Unknown` for every row.
- [tests/agent-sources.test.ts](tests/agent-sources.test.ts) uses a similarly hand-written Work.ua fixture for a site that now returns 403.
- [scripts/smoke-vacancy-sources.ts](scripts/smoke-vacancy-sources.ts) checks only the **first** item of each feed, and its `assertCompanyCoverage` accepts inferred values, so `- Hands` counts as coverage.

**Every fixture in the suite is invented rather than captured.** That is the root cause of the root causes.

---

## 5. Options considered

| Option | What it gives | Cost / risk | Verdict |
|---|---|---|---|
| **Structured data first (`schema.org/JobPosting` JSON-LD)** | Djinni: 100 % company, dates, salary, expiry, full text, **9 requests** for the whole catalogue | Only works where publishers emit it — Djinni yes, DOU no | **Adopt as the primary strategy** |
| **Source API fields** | Robota.ua `companyName`/`cityName`/`date`; Lobby X WP REST | Robota.ua has no description field at all | **Adopt where present**, with honest gaps |
| **Fixed DOM extraction with recorded fixtures** | DOU company, date, location, teaser | Breaks when markup changes — mitigated by fixture-freshness CI | **Adopt for DOU** |
| **Cloudflare `HTMLRewriter`** | Streaming parse, no buffering, no bundle cost; already native in Workers | Worker-only (the DOU runner is Node) | **Adopt for Worker-side parsing**, keep a shared pure-function core |
| **Cheerio / linkedom** | Real CSS selectors, survives markup drift far better than regex | ~100–150 KB bundle; must buffer | **Adopt in the Node runner** (GitHub Actions), where bundle size is irrelevant |
| **Cloudflare Browser Rendering** ($0.09/browser-hour; 10 h/month free on Workers Paid) | Real Chromium | Cloudflare **identifies its renderer as a bot by cryptographic signature and does not bypass bot protection** — so it will *not* solve Robota.ua or Work.ua. Every source that works today works without it | **Reject** — solves nothing here |
| **Jooble REST API** | Company name, aggregated UA coverage | Returns a **snippet only, not the full description**; free tier is 500 requests *lifetime*; per-country keys | **Reject as a primary source**; possible discovery-only supplement |
| **Apify actors for Robota.ua / Work.ua** (~$1.99–2.00 per 1 000 results) | Would return the blocked data | Third-party re-scraping of a site that actively blocks bots — moves the ToS problem rather than solving it; adds a vendor dependency and recurring cost for the two lowest-value sources | **Reject for now**; revisit only if those sources become business-critical |
| **Official partner APIs (Work.ua / Robota.ua)** | Legitimate access | These are **employer/ATS-side** APIs for posting vacancies and receiving applications, not public vacancy-search APIs; require a business agreement | **Park** — the only clean route to those two sources |
| **Defeating the Cloudflare challenge** (residential proxies, stealth headers) | The data | Explicit ToS violation; `robots.txt` on robota.ua is itself behind the challenge, i.e. the operator's intent is unambiguous | **Reject** |
| **LLM extraction of company/fields** (Workers AI / existing `ai-service`) | Handles genuinely unstructured pages (Lobby X) | Cost, latency, hallucination risk — the current regex guesser already demonstrates what unvalidated inference produces | **Adopt only as the last rung**, schema-constrained, always flagged `inferred` |
| **ATS boards (Greenhouse / Lever / Ashby)** — adapters already exist, config is empty | Perfect structured data, free, stable, ToS-clean | Needs a curated board list | **Adopt** — cheapest quality win available |

---

## 6. Target design

### 6.1 The extraction ladder (the core rule)

For every field, take the **highest available rung** and record which one was used. Never silently fall through to a lower rung for identity fields.

| Rung | Mechanism | Confidence |
|---|---|---|
| 1 | Source API / feed field (`companyName`, `hiringOrganization.name`) | `structured` |
| 2 | `schema.org/JobPosting` JSON-LD on the listing or detail page | `structured` |
| 3 | Documented DOM selector backed by a **recorded live fixture** | `parsed` |
| 4 | Deterministic derivation from the canonical URL (`/companies/<slug>/…`) | `derived` |
| 5 | Schema-constrained LLM extraction from the detail page | `inferred` |
| 6 | `null` + `needs_review` | `missing` |

**Prose regex guessing is removed from the ladder entirely.** `null` is a better product than `- Hands`.

### 6.2 Per-source target

| Source | Company | Description | Date | Requests / full run |
|---|---|---|---|---|
| **Djinni** | rung 2 — listing JSON-LD | rung 2 | rung 2 + `validThrough` | **9** (from 141) |
| **DOU** | rung 3 (`a.company`) with rung 4 (URL slug) cross-check | rung 3 detail page, **queued, uncapped** | rung 3 (`div.date`, Ukrainian month parsing) | ~8 listing + N queued detail |
| **Robota.ua** | rung 1 (`companyName`) | **unobtainable** -> store the 251-char teaser, mark `description_complete = false`, link out. Stop the 50 wasted 403 fetches | rung 1 | 3 |
| **Lobby X** | rung 5 or 6 — API exposes nothing | rung 3 detail page | rung 1 | 1 + N |
| **Work.ua** | — | — | — | **disable until partner access exists** |
| **ATS boards** | rung 1 | rung 1 | rung 1 | 1 per board |

### 6.3 Schema additions

```
jobs:
  external_id            source's own id only — never a URL     (D8)
  company_source         structured | parsed | derived | inferred | missing
  description_source     structured | parsed | teaser | missing
  description_complete   0/1
  posted_at_source       …
  last_seen_at           set on every successful sync of that source
  last_enriched_at       drives the enrichment backlog          (D5)
  valid_through          from JobPosting.validThrough           (D15)
  closed_at              set by the sweep
```

### 6.4 Pipeline restructure

1. **Discover** — cheap, complete, uncapped. Writes every card the source lists.
2. **Enrich** — a separate stage over rows where `description_complete = 0`, ordered by `last_enriched_at ASC`, with a per-run request budget. The backlog drains across runs instead of permanently abandoning 250 vacancies.
3. **Classify** — relevance runs only on rows whose description is complete, or flags `relevance_pending` (fixes D7).
4. **Store** — dedup keyed on `(source, external_id)` first, similarity second, with SQL-side candidate selection instead of loading 1 000 rows (D13).
5. **Serve** — pre-computed, no re-filtering on read (D14).
6. **Sweep** — rows not seen for N successful runs of their own source, or past `valid_through`, get `closed_at` and leave the public window (D15).

### 6.5 Where each stage runs

Requests per run land in the low hundreds. Cloudflare raised the Workers subrequest limit on 2026-02-11 to **10 000 per invocation on paid plans** (free plans remain 50 external), so the Worker is viable — but the enrichment stage is better placed on the existing GitHub Actions runner, which already has 10 minutes and no subrequest ceiling. Recommendation: keep discovery in the Worker, move enrichment to the hourly runner, and extend that runner beyond DOU to all sources.

---

## 7. Work plan

Each phase is independently shippable and independently verifiable. Phases 1 and 2 recover the visible damage.

### Phase 1 — Stop producing wrong data *(smallest change, largest effect)*

1. Delete prose inference from the company path (D4): `recoverJobCompany` keeps the URL/JSON-LD rungs and otherwise returns `null` + `missing`. `inferCompanyFromText` survives only behind an explicit `inferred` flag for Lobby X.
2. Fix the DOU company selector to `a.company`, cross-checked against the `/companies/<slug>/` URL segment (D1).
3. Parse the DOU `div.date` card date, including Ukrainian month names and year inference (D2).
4. Return the full `JobPostingMetadata` from the RSS detail path and apply `company`, `datePosted` and location — not just the description (D3).
5. Strip `from` in `canonicalizeUrl` and make `douExternalId` match the numeric id anywhere in the path (D8).

**Acceptance:** DOU company coverage ≥ 98 % `structured|parsed|derived`; zero rows whose company came from prose; DOU posted-date coverage ≥ 95 %.

### Phase 2 — Djinni via listing JSON-LD

6. New `DjinniListingSource` reading `JobPosting` JSON-LD from `/jobs/?primary_keyword=QA&page=N`; retire the RSS adapter and its 40 detail fetches.
7. Map `hiringOrganization`, `applicantLocationRequirements`, `jobLocationType` -> `remote`, `baseSalary`, `employmentType`, `validThrough`.

**Acceptance:** Djinni company and date coverage 100 %; location coverage ≥ 95 % (from 0 %); requests per run ≤ 12 (from 141).

### Phase 3 — Honest handling of blocked and partial sources

8. Robota.ua: stop fetching detail pages; store the teaser with `description_complete = false`; surface "Full description on Robota.ua" in the UI (D6).
9. Gate relevance classification on description completeness so teaser-only rows are not silently rejected (D7).
10. Disable the Work.ua adapter behind a config flag and remove the stale merged row (D9).
11. Align `config/sources.json` with `DEFAULT_VACANCY_SOURCES`, add the missing `robotaUa` key, and make the DOU category/search parameter explicit rather than hard-coded (D10, D11).

**Acceptance:** local and cloud runs collect the same source set; zero requests that are known in advance to return 403.

### Phase 4 — Enrichment queue and lifecycle

12. Add the schema columns from §6.3; migrate via Drizzle (`npm run db:generate`, then `check:db`).
13. Split discovery from enrichment; remove `MAX_DETAIL_FETCHES` in favour of a per-run budget plus `last_enriched_at` ordering (D5).
14. Add the closure sweep driven by `last_seen_at` and `valid_through` (D15).

**Acceptance:** DOU descriptions ≥ 1 000 chars for ≥ 90 % of rows within three sync cycles; no row older than 24 h without an enrichment attempt.

### Phase 5 — Storage and serving

15. SQL-side duplicate candidate selection keyed on `(source, external_id)` and a company/title index; drop the `LIMIT 1000` full-table load (D13).
16. Compute the public list at sync time; remove `sanitizeJobs` from the read path (D14).

### Phase 6 — Populate ATS boards

17. Curate a Greenhouse/Lever/Ashby board list for UA/EU product companies. The adapters already exist and produce rung-1 data for free.

---

## 8. Testing strategy — the part that must change first

The current suite cannot fail on any defect in §4. Fix the method, not just the assertions.

1. **Recorded fixtures, not invented ones.** Add `scripts/record-source-fixtures.ts` that downloads a live listing page, a live detail page and a live API response per source into `tests/fixtures/sources/<source>/<yyyy-mm-dd>.{html,json}` and commits them. Every parser test runs against recorded bytes. Replace the hand-written DOU and Work.ua fixtures.
2. **Fixture-freshness CI job** (weekly, non-blocking on PRs): re-download, re-parse, and diff the *extracted field set* against the recorded one. A markup change like `span.company -> a.company` produces a failing diff the day it happens instead of a year later.
3. **Per-field coverage assertions in the live smoke test.** Replace `assertCompanyCoverage(…, 0.8)` with per-source floors on `company_source ∈ {structured, parsed, derived}`, and assert **zero** `inferred` companies outside Lobby X. Sample the whole first page, not `listings[0]`.
4. **Golden-record tests**: for three known vacancies per source, assert exact expected company, description length band, and posted date.
5. **A regression test per defect** in §4 — in particular an `a.company` DOU card, a `?from=list_hot` URL producing a numeric `external_id`, and a 251-char teaser being classified `relevance_pending` rather than rejected.

---

## 9. Operational metrics

`vacancy_sync` already logs `seen/relevant/rejected/duplicates/inserted/updated` ([app/internal/n8n/vacancies-sync/route.ts](app/internal/n8n/vacancies-sync/route.ts)). Extend it per source with:

```
companyStructuredPct, companyMissingPct, companyInferredPct,
descriptionCompletePct, postedAtPct, locationKnownPct,
detailFetchFailures, requestCount, backlogSize
```

Fail (or alert on) a run where any source drops below its floor. `companyInferredPct > 0` outside Lobby X should be treated as a defect, not a warning. Today a source can silently fall from 98 % to 0 % company coverage with a green build — which is exactly what happened.

---

## 10. Legal and access notes

| Source | `robots.txt` | Access posture |
|---|---|---|
| DOU | 200, permits the QA category listing (`search=` disallowed for Yandex only) | No bot protection observed. Keep the descriptive User-Agent and modest rates |
| Djinni | 200, disallows `/jobs2`, `/q`, `/developers`, `/free-jobs`, `/set_lang` only — `/jobs/` and `/jobs/rss/` permitted | Clean |
| Lobby X | Disallows `/*?*`, which **covers the `wp-json` query URL currently in use** | Prefer the `/tor/<slug>/` pages, or seek permission for the API |
| Work.ua | 200, permits `/jobs/`, but the edge returns 403 to all automated clients | Do not work around. Pursue partner access or drop |
| Robota.ua | `robots.txt` itself is behind a Cloudflare managed challenge | Unambiguous refusal of automated access. Legacy `api.rabota.ua` still answers; treat it as tolerated, not sanctioned, and keep the request rate minimal |

---

## 11. Decisions needed

1. **Robota.ua and Work.ua** — accept teaser-only / disabled (recommended), pursue official partner access, or budget for a third-party provider (~$2 per 1 000 results)?
2. **Lobby X company** — schema-constrained LLM extraction against the existing `ai-service`, or leave `null` and display "Company not published"?
3. **Enrichment placement** — extend the existing hourly GitHub Actions runner to all sources (recommended, no subrequest ceiling), or move to Cloudflare Queues?
4. **ATS board list** — is there an existing target-company list to seed Greenhouse/Lever/Ashby, or should one be proposed?

---

## 12. Reproducing the measurements

```bash
curl -s https://gimmejob.gimmejob.workers.dev/api/public/jobs > jobs.json
```

Then count `company === "Unknown"`, `description.length < 400` and `postedAt == null` over `jobs`.

The existing live smoke test is:

```bash
npm run smoke:vacancies
```

Note that its company assertion currently accepts fabricated names, so it passes against the data shown in §3.1.

Per-adapter figures in §3.1 were produced by executing each adapter's `collect()` unmodified under `node --import tsx`, with `globalThis.fetch` wrapped to count requests.
