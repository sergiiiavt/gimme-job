# About Page — Content and Maintenance Contract

**Status:** Permanent project documentation  
**Applies to:** `app/about-site.tsx` and the data/content used by that page  
**Primary page:** `https://gimme-job.com/workspace/learn?section=about` and the equivalent public About view  
**Purpose of this document:** Define what belongs on the About page, how it must be written, how technology sections are added or changed, and how links/evidence are maintained over time.

---

## 1. What this page is

The About page is a compact technical map of GimmeJob.

It has two jobs:

1. Explain, in a few factual statements, why the site exists.
2. Show the real technologies currently used by the production project and how those technologies connect.

This page is **not**:

- a product marketing page;
- a generic portfolio page;
- a full architecture document;
- a list of every feature;
- a list of every library in `package.json`;
- a place to describe every business workflow;
- a roadmap;
- a changelog.

The page must remain short enough that a technical reviewer can understand the project quickly.

---

## 2. Permanent writing rule: factual, not promotional

Use direct technical language.

Prefer:

- `Code is built in GitHub Actions and deployed to Cloudflare.`
- `Application data is stored in Cloudflare D1.`
- `OpenAI is used for vacancy recognition, analysis, and drafting support.`
- `Operational summary data is exposed to Grafana.`

Avoid:

- `cutting-edge`;
- `next-generation`;
- `showcase`;
- `innovative`;
- `powerful`;
- `seamless`;
- `future-ready`;
- `revolutionary`;
- `best-in-class`;
- `built in public`;
- `living knowledge base`;
- `designed to empower`;
- other marketing-style filler.

If a sentence does not explain **what technology is used, what it does, or where it connects**, remove it.

---

## 3. Current page structure

Keep the page organized with a clear visual split between **purpose** and **technology**.

The current approved structure is:

- **Why I created this site** — an unnumbered group heading outside the bordered purpose-card area.
- Four numbered purpose cards (`01`–`04`) below that heading.
- **TECH STACK** — a second unnumbered group heading using the same visual style and horizontal indentation as `Why I created this site`.
- **1. Deployment**
- **2. Database**
- **3. OpenAI integration**
- **4. Grafana observability**

Only the four technology sections use the green section-number circles. The overview heading itself is deliberately unnumbered.

Do not add another technology section just because a new library is installed.

A new section is justified only when a new technology becomes a meaningful production subsystem or integration.

Examples of changes that normally **do not** justify a new top-level section:

- adding a React helper library;
- changing an ESLint rule;
- adding one API endpoint;
- adding a new interview category;
- adding another job source;
- refactoring a component;
- adding a utility script.

Examples that **may** justify a new top-level section:

- replacing D1 with a different production database;
- introducing a separate message queue used in production;
- adding a real production search/indexing service;
- adding a separate production authentication platform;
- introducing a second external AI provider used as a real subsystem.

Before adding a section, ask:

> Does this technology have its own production responsibility, integration boundary, and evidence/link worth showing?

If the answer is no, keep it inside an existing section or do not show it.

---

## 4. Section 1: Why I created this site

This section is purpose-oriented, not a technology diagram.

Keep exactly four purpose cards unless the project purpose itself changes.

The overview heading is outside the bordered purpose-card area and has no green section number or `OVERVIEW` eyebrow. Its only global action is `View source on GitHub`. Do not duplicate `Open interview catalog` in the heading; the interview catalog remains linked from the QA knowledge-base card.

### Card 1 — Find a job

Recommended wording:

**Title:** `Find a job`

**Description:**  
`Aggregates vacancies from four data sources into one place for review and analysis.`

This card explains the practical reason the application exists.

Do not expand it into a feature inventory.

### Card 2 — Create a technology playground

Recommended wording:

**Title:** `Create a technology playground`

**Description:**  
`A real production project for trying, integrating, and learning new technologies in practice.`

This card is intentionally broad. It covers current and future technologies without tying the purpose statement to a fixed list of vendors or categories.

Do not enumerate specific technologies here. The technology sections below show the technologies that are currently implemented.

### Card 3 — Use an AI-assisted development workflow

Recommended wording:

**Title:** `Use an AI-assisted development workflow`

**Description:**  
`The project is developed with Codex and Claude Code throughout the development workflow.`

This card describes the development approach, not the application-level OpenAI integration. Detailed runtime OpenAI usage belongs in the OpenAI integration section.

### Card 4 — Build a QA knowledge base

Recommended wording:

**Title:** `Build a QA knowledge base`

**Description:**  
`A structured knowledge base covering interview questions, learning paths, and different QA-related areas.`

Keep this card broad enough to cover interview preparation, learning paths, and other QA-related knowledge areas.

### Intro sentence

Recommended:

`Four practical goals: job search, technology experiments, AI-assisted development, and QA learning.`

Do not make this sentence longer than two lines on a normal desktop viewport.

---

## 5. Tech stack section 1: Deployment

### Purpose

Explain how source code reaches production.

### Current flow

```text
GitHub
   ↓
GitHub Actions
   ↓
Cloudflare Platform
   ├── Workers
   └── Static assets
   ↓
gimme-job.com
```

### Required information

Show:

- GitHub as the source repository;
- GitHub Actions as CI/CD;
- Cloudflare as the production deployment platform;
- Workers;
- static assets;
- production site link.

### Canonical links

Use the real repository name with the hyphen:

- Repository: `https://github.com/sergiiiavt/gimme-job`
- Actions: `https://github.com/sergiiiavt/gimme-job/actions`
- Workflow source, when useful: `https://github.com/sergiiiavt/gimme-job/blob/main/.github/workflows/ci.yml`
- Production: `https://gimme-job.com`

**Important:** do not use the old/non-canonical repository path `sergiiiavt/gimmejob`.

### When to update this section

Update it when:

- deployment provider changes;
- CI/CD provider changes;
- Workers stop being used;
- static asset delivery changes materially;
- production domain changes.

Do not update it for ordinary CI workflow refactoring unless the visible flow changes.

---

## 6. Tech stack section 2: Database

### Purpose

Explain the production persistence layer.

### Current flow

```text
Worker / application
       ↓
Cloudflare D1
       ↓
Application data
├── Jobs
├── Analyses
├── Settings
└── Observability
```

### Required information

Show D1 as the database technology, not just as another Cloudflare badge.

The page may summarize stored data into these four visual groups:

- `Jobs`
- `Analyses`
- `Settings`
- `Observability`

These are conceptual groups for the About page. They do not have to correspond one-to-one with every physical database table.

### Evidence links

Prefer links to project source:

- Schema: `https://github.com/sergiiiavt/gimme-job/blob/main/db/schema.ts`
- Migrations: `https://github.com/sergiiiavt/gimme-job/tree/main/drizzle`

If the schema changes, verify that the About page description is still true.

### Do not expose

Never expose:

- Cloudflare account IDs;
- database IDs that are not already intentionally public;
- secrets;
- connection credentials;
- tokens;
- internal admin URLs containing sensitive identifiers.

---

## 7. Tech stack section 3: OpenAI integration

### Purpose

Show the external AI integration as a technology flow.

Do not turn this section into a generic explanation of AI agents.

### Current conceptual flow

```text
Job text + candidate profile/context
                ↓
            OpenAI API
                ↓
     ┌──────────┼──────────┐
     ↓          ↓          ↓
Recognition   Analysis    Drafts
```

Also show the deterministic fallback as a separate small note:

```text
Fallback: deterministic logic when AI is unavailable.
```

### Recommended wording

Section description:

`OpenAI is used for vacancy recognition, analysis, and drafting support.`

Output labels:

- `Recognition` — extract or structure vacancy information;
- `Analysis` — score, match, and explain;
- `Drafts` — resume/application drafting support.

### Evidence links

Use project source where possible:

- Production analysis implementation:  
  `https://github.com/sergiiiavt/gimme-job/blob/main/app/api/_jobpilot.ts`
- Local analyst implementation/instructions:  
  `https://github.com/sergiiiavt/gimme-job/blob/main/agent/src/analyst.ts`

Do not link to a line number unless the line is expected to remain stable. File-level links are safer for long-lived documentation.

### Accuracy rule

Do not claim that OpenAI is used for a function unless the production code actually uses it.

Do not describe deterministic logic as AI.

Do not imply that the system automatically contacts employers if it does not.

Do not expose prompts containing secrets or personal data. It is acceptable to link to prompt/instruction source files that are intentionally public.

---

## 8. Tech stack section 4: Grafana observability

### Purpose

Explain the long-term/summary observability path.

### Current conceptual flow

```text
Application events ─┐
                    ├──> D1 / observability summary API ───> Grafana
D1 summary data ────┘                                  ├── Dashboards
                                                       ├── Alerts
                                                       └── Export / analysis
```

The page may simplify the diagram visually as:

```text
App events + D1 summary API → Grafana → Dashboards / Alerts / Export
```

### Current production observability endpoints

The implementation currently includes:

- `/api/observability/health`
- `/api/observability/summary`
- optional `?days=<1..3650>` on the summary endpoint.

Both observability endpoints are protected by the Grafana bearer token. Do **not** publish or embed that token.

### Grafana dashboard link

A real dashboard link may be shown only when a real, shareable URL is known.

Rules:

1. Never invent a Grafana dashboard URL.
2. Never put credentials or access tokens in the URL.
3. If the dashboard is private and cannot be safely linked, show the label `Grafana dashboard` without a clickable destination, or omit the destination.
4. When a shareable dashboard URL is added, update this document or the page content data at the same time.

### Cloudflare native logs

Cloudflare Workers Logs are a separate short-retention debugging source.

They may be represented inside the observability section as a small auxiliary box such as:

`Cloudflare Workers Logs — recent request/runtime debugging`

Do not imply that native Cloudflare logs are the long-term store if long-term selected observability data is stored in D1.

Do not create a separate top-level Cloudflare Logs section unless the page is deliberately expanded later.

---

## 9. Link policy

Technology sections should contain links because the page should be verifiable.

Good link destinations:

- source repository;
- CI workflow;
- production site;
- source file implementing the integration;
- database schema/migrations;
- public/shareable dashboard;
- public interview catalog.

### Link rules

Every link must satisfy all of the following:

- destination exists;
- label explains what will open;
- external links open in a new tab;
- external links use `rel="noreferrer"`;
- no secrets in the URL;
- no placeholder `#` links;
- no invented domain;
- no dead `workers.dev` URL just to fill the UI;
- use the canonical `gimme-job` repository path.

If a link does not exist yet, omit it or render a non-clickable label.

---

## 10. Source-of-truth map

Before editing page copy, verify it against the relevant project source.

| Page item | Primary source of truth |
|---|---|
| Repository | `https://github.com/sergiiiavt/gimme-job` |
| Deployment | `.github/workflows/ci.yml`, Cloudflare deployment scripts/config |
| Runtime | Worker/deployment code under `worker/` and app build/deploy scripts |
| Database | `db/schema.ts`, `drizzle/` |
| OpenAI integration | `app/api/_jobpilot.ts`, `agent/src/analyst.ts` |
| Observability tables | `db/schema.ts`, `drizzle/` |
| Observability API | `worker/index.ts` |
| About page content | `app/about-site.tsx` and its content/config module if present |
| Site navigation | `app/site-navigation.tsx` |
| About layout refinements | `app/about-site-layout.css` |
| Global page styles | `app/globals.css` |

The About page is a summary. These files are the evidence.

---

## 11. Visual maintenance rules

The visual structure is intentionally consistent.

### Group heading and horizontal section rule

`Why I created this site` and `TECH STACK` are peer-level visual group headings. They must:

- use the same typography, color, casing treatment, and horizontal indentation;
- sit outside the bordered content/technology cards;
- remain unnumbered;
- avoid decorative `OVERVIEW` labels or other extra eyebrow text.

The four purpose cards live inside their own bordered area below `Why I created this site`. Their internal `01`–`04` numbers remain.

Technology sections remain full-width horizontal bands/cards and restart green-circle numbering at `1` after the `TECH STACK` heading.

Each technology section has:

1. section number;
2. title;
3. one short description;
4. diagram/content area;
5. relevant links.

Descriptions stay left-aligned but should be vertically centered against the corresponding technology flow on desktop.

Do not replace this with a long article.

### Spacing, density, and intrinsic sizing rule

The page should be compact and consistent. **Do not stretch technology cards merely to fill the available row width.**

- technology flow nodes are content-sized (`fit-content`/intrinsic sizing) within sensible readability limits;
- a flow row is allowed to end before the right edge of the section; unused space at the end of the row is preferable to artificial blank space inside cards;
- do not use equal-width grid columns simply to make a flow fill the row;
- compound nodes may naturally be wider when their content requires it (for example Cloudflare with Workers + Static assets);
- use the same horizontal section padding throughout the page;
- use the same compact gap rhythm between description column, nodes, arrows, nested cards, and links;
- use consistent card padding and internal vertical spacing across Deployment, Database, OpenAI, and Grafana;
- keep arrows short and consistent;
- preserve readable wrapping instead of creating oversized cards;
- on narrower screens, flows may stack vertically rather than squeezing or stretching cards.

When adjusting one technology row, review all technology rows together. Alignment should come from consistent padding/gaps, **not from forcing all cards to the same width**.

### Card rule

Small nodes/cards must:

- use the same border radius family;
- use subtle borders;
- use restrained shadows;
- have short labels;
- avoid paragraphs longer than 2–3 short lines;
- use icons only as support, never as the only label.

### Arrow rule

Arrows indicate real data/deployment flow.

Use arrows only when there is a directional relationship.

Do not use arrows decoratively.

Examples:

- GitHub → GitHub Actions: yes.
- GitHub Actions → Cloudflare: yes.
- D1 → Jobs: not literally data movement, but acceptable as a visual decomposition of stored data.
- Grafana → OpenAI: no, unless a real integration is implemented.

### Color rule

Colors identify categories, not status or marketing emphasis.

Suggested stable accents:

- green: core/site/general;
- blue: CI/data/analysis;
- orange: Cloudflare/Grafana/infrastructure;
- purple: AI/drafting/knowledge.

Do not add many new accent colors.

### Logo/icon rule

Prefer:

- local SVG assets;
- inline SVG;
- simple technical icons.

Avoid:

- remote image hotlinks;
- emoji as production icons;
- large raster logos;
- decorative stock illustrations.

Brand icon plus brand text is preferred because the text remains understandable even if the icon changes.

---

## 12. Responsive behavior that must be preserved

The page must work at:

- large desktop;
- ordinary laptop;
- tablet;
- mobile.

Expected behavior:

### Desktop

- four purpose cards in one row;
- technology flows primarily left-to-right;
- all horizontal sections fit inside the content width.

### Medium width

- purpose cards may become 2×2;
- flow nodes may wrap into multiple rows;
- no text may overlap arrows.

### Mobile

- one card per row;
- flow becomes top-to-bottom;
- arrows point downward or are replaced by a simple vertical connector;
- link pills wrap;
- no horizontal page scrolling.

Never solve responsiveness by shrinking text until it is unreadable.

---

## 13. What future maintainers should edit

Prefer a data-driven page.

If the implementation contains an `about-site-content.ts` or equivalent content/config file:

- update labels, descriptions, links, and node definitions there;
- update JSX only when the structure itself changes.

If content is still inline in `about-site.tsx`, keep related content grouped at the top of the file as typed constants.

Do not duplicate the same URL in many markup locations if a shared constant can be used.

Recommended shared constants:

```ts
const PROJECT_URL = "https://gimme-job.com";
const REPO_URL = "https://github.com/sergiiiavt/gimme-job";
const ACTIONS_URL = `${REPO_URL}/actions`;
const SCHEMA_URL = `${REPO_URL}/blob/main/db/schema.ts`;
const MIGRATIONS_URL = `${REPO_URL}/tree/main/drizzle`;
const JOBPILOT_URL = `${REPO_URL}/blob/main/app/api/_jobpilot.ts`;
const ANALYST_URL = `${REPO_URL}/blob/main/agent/src/analyst.ts`;
```

A Grafana URL should be a separate constant and should exist only when a real URL is known.

---

## 14. Update procedure

When a technology changes:

1. Identify what changed in production.
2. Verify the new state in code/config.
3. Decide whether it changes an existing section or just a link/label.
4. Update the About page data.
5. Remove obsolete labels and dead links.
6. Search the repository for old technology names/URLs.
7. Update tests that intentionally assert About-page content.
8. Run project checks.
9. Verify public and personal About views.
10. Verify desktop and mobile layout.

Useful search examples:

```bash
rg -n "Technology stack|How vacancy analysis works|gimmejob|about-mechanism|about-stack-list" .
rg -n "gimme-job.com|sergiiiavt/gimme-job|observability/summary|OpenAI" app docs tests
```

---

## 15. Testing requirements after About-page maintenance

At minimum run:

```bash
npm run lint
npm run check:agent
npm run build
```

Then run relevant tests, especially tests that render the site or assert About-page content.

For a final change, prefer:

```bash
npm test
```

Do not weaken unrelated tests merely to make an About-page change pass.

If an old test explicitly checks text that was intentionally removed, update that test to the new approved wording.

---

## 16. Content acceptance checklist

Before merging an About-page content change, confirm:

- [ ] `Why I created this site` and `TECH STACK` use the same group-heading style and indentation.
- [ ] The overview heading is outside the bordered purpose-card area and has no green section number or `OVERVIEW` eyebrow.
- [ ] Technology sections restart green-circle numbering at `1`.
- [ ] Technology cards are content-sized and are not stretched simply to fill a row.
- [ ] Spacing/padding is consistent across all technology flows.
- [ ] The intro contains the four current purpose cards: Find a job, Create a technology playground, Use an AI-assisted development workflow, and Build a QA knowledge base.
- [ ] Copy is factual and concise.
- [ ] There is no marketing filler.
- [ ] Every visible technology is actually used by the project.
- [ ] Every directional arrow represents a real or intentionally simplified relationship.
- [ ] The repository URL uses `sergiiiavt/gimme-job`.
- [ ] There are no placeholder links.
- [ ] There are no secrets or tokens.
- [ ] D1 is represented as the database.
- [ ] OpenAI is represented only for actual OpenAI-backed behavior.
- [ ] Deterministic fallback is not described as AI.
- [ ] Grafana is described as visualization/dashboard/alerting, not the primary long-term data store.
- [ ] Cloudflare native logs are not described as long-term storage.
- [ ] Public and personal views both render correctly.
- [ ] Desktop and mobile layouts work.
- [ ] Lint/build/tests pass.

---

## 17. Examples: what belongs and what does not

### Good addition

The project adds a real production Redis-compatible cache.

Possible change:

```text
Application → D1
           ↘ Cache service
```

Add it only if it is actually deployed and important enough to explain.

### Bad addition

A new NPM package is added for string formatting.

Do not add it to the About page.

### Good update

GitHub Actions is replaced by another CI provider.

Update the Deployment flow and link.

### Bad update

A workflow file is renamed but the deployment flow is unchanged.

Only fix the source link if necessary.

### Good update

OpenAI is no longer used in production.

Remove the OpenAI section or replace it with the actual provider/technology.

### Bad update

Keep the OpenAI section because it looks good visually even though the integration was removed.

The page must reflect reality.

---

## 18. Core principle

**The About page is a visual, verifiable map of technologies that are actually used by GimmeJob.**

When in doubt:

- show less;
- use factual wording;
- link to evidence;
- do not invent;
- do not market.
