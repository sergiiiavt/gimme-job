# About Page Rebuild — Detailed Implementation Specification

**Status:** Implementation task specification  
**Target repository:** `sergiiiavt/gimme-job`  
**Target component:** `app/about-site.tsx`  
**Target styles:** `app/globals.css`  
**Recommended content/config module:** `app/about-site-content.ts`  
**Design goal:** Rebuild the current About page into the approved five-section technical overview.

> This document is intentionally explicit. Follow it literally. Do not redesign the architecture, do not add extra sections, and do not substitute a generic landing page.

---

# 0. Read this before changing code

The current About page already exists in:

```text
app/about-site.tsx
```

It currently renders:

- `Technology stack`;
- a list of technology groups;
- `How vacancy analysis works`;
- project links.

Existing About-specific styles are in `app/globals.css` under the comment:

```css
/* Project intro */
```

Current classes include:

```text
.about-page
.about-intro
.about-links
.about-stack-list-row
.about-mechanism
.about-mechanism-links
.about-mechanism-source
```

The component accepts:

```ts
mode?: "public" | "personal"
```

Do not remove this mode contract.

The same About component is used in the shared public/private site structure. Do not build a second unrelated About page.

The site shell/sidebar/navigation already exists. Do not redesign or replace it for this task.

---

# 1. Exact task

Replace the current About-page body with a visual technical overview made of five horizontal sections:

1. `What this site is`
2. `Deployment`
3. `Database`
4. `OpenAI integration`
5. `Grafana observability`

The page must look like the approved mockup concept:

- white/light background;
- existing left navigation remains;
- content uses wide horizontal bordered sections;
- clean technical cards;
- small icons;
- arrows showing technology flow;
- short factual text;
- small link pills to repositories, source, sites, APIs, or dashboards;
- no marketing-style copy;
- no large illustration;
- no hero artwork;
- no animation required.

---

# 2. Non-goals

Do **not**:

- redesign `SiteSidebar`;
- change the app router;
- change authentication;
- change Worker APIs;
- change D1 schema;
- change observability implementation;
- add a new UI framework;
- add an icon dependency;
- add a charting library;
- add Tailwind component abstractions;
- make network requests from the About page;
- introduce client-side state;
- add `"use client"` to `about-site.tsx`;
- add an editor/CMS;
- create a marketing hero;
- add more technology sections;
- rewrite unrelated CSS;
- change job/interview functionality.

This is a static server-rendered overview page.

---

# 3. First repository checks

Before editing, inspect the current tree and search for dependencies on old About-page text/classes.

Run:

```bash
git status --short
rg -n "Technology stack|How vacancy analysis works|about-stack-list|about-mechanism|about-intro|sergiiiavt/gimmejob" app tests docs
```

Important:

- preserve unrelated user changes;
- do not discard files that are already modified;
- note any tests that assert the old About-page headings;
- note any use of the wrong repository URL `sergiiiavt/gimmejob`.

The canonical repository is:

```text
https://github.com/sergiiiavt/gimme-job
```

The hyphen is required.

---

# 4. Recommended file organization

Use three existing/new code locations only:

```text
app/
├── about-site.tsx
├── about-site-content.ts       # create this
└── globals.css
```

Do not create a large component directory for this one page.

## `app/about-site-content.ts`

Purpose:

- centralize labels;
- centralize links;
- centralize section/node data;
- make future updates easy;
- prevent URLs from being duplicated across JSX.

This file contains plain TypeScript data and types only.

No JSX is required here.

## `app/about-site.tsx`

Purpose:

- small presentational helper components;
- semantic page markup;
- inline SVG icon renderer;
- section composition.

## `app/globals.css`

Purpose:

- all visual/layout styles;
- prefix new selectors with `about-tech-` to avoid collisions.

---

# 5. Data model to create

Create `app/about-site-content.ts`.

Use types similar to the following.

Do not over-engineer generics.

```ts
export type AboutIcon =
  | "search"
  | "code"
  | "ai"
  | "book"
  | "github"
  | "actions"
  | "cloudflare"
  | "worker"
  | "asset"
  | "database"
  | "jobs"
  | "analysis"
  | "settings"
  | "observability"
  | "document"
  | "openai"
  | "recognition"
  | "draft"
  | "fallback"
  | "grafana"
  | "dashboard"
  | "alert"
  | "export";

export interface AboutLink {
  label: string;
  href?: string;
  external?: boolean;
}

export interface PurposeCard {
  number: string;
  title: string;
  description: string;
  icon: AboutIcon;
  accent: "green" | "blue" | "purple" | "orange";
  link?: AboutLink;
}
```

You may add one or two small types for flow nodes, but keep them obvious.

The implementation must remain understandable by reading one file.

---

# 6. Canonical URL constants

Create and reuse constants.

Use:

```ts
export const PROJECT_URL = "https://gimme-job.com";
export const REPO_URL = "https://github.com/sergiiiavt/gimme-job";
export const ACTIONS_URL = `${REPO_URL}/actions`;
export const CI_WORKFLOW_URL = `${REPO_URL}/blob/main/.github/workflows/ci.yml`;
export const DB_SCHEMA_URL = `${REPO_URL}/blob/main/db/schema.ts`;
export const MIGRATIONS_URL = `${REPO_URL}/tree/main/drizzle`;
export const JOBPILOT_URL = `${REPO_URL}/blob/main/app/api/_jobpilot.ts`;
export const ANALYST_URL = `${REPO_URL}/blob/main/agent/src/analyst.ts`;
export const OBSERVABILITY_HEALTH_URL = `${PROJECT_URL}/api/observability/health`;
export const OBSERVABILITY_SUMMARY_URL = `${PROJECT_URL}/api/observability/summary?days=30`;
```

Do **not** put bearer tokens into any URL or frontend constant.

## Grafana URL

Search the repository for a real shareable Grafana dashboard URL.

If one exists, use it.

If no real dashboard URL exists:

- do not invent one;
- do not use `https://grafana.com` as if it is the dashboard;
- do not use `#`;
- render the text `Grafana dashboard` as a non-clickable neutral chip, or omit its destination;
- add a code comment:

```ts
// TODO: add the real shareable Grafana dashboard URL when available.
```

## Workers URL

Likewise, do not invent a Workers URL.

If the production site `https://gimme-job.com` is the canonical public destination, use that.

---

# 7. Exact top-level component structure

`AboutSite` should approximately render:

```tsx
<div className="kb-content about-page about-tech-page">
  <header className="about-tech-page-header">
    ...
  </header>

  <section className="about-tech-section about-tech-overview">
    ...
  </section>

  <section className="about-tech-section">
    ...Deployment...
  </section>

  <section className="about-tech-section">
    ...Database...
  </section>

  <section className="about-tech-section">
    ...OpenAI integration...
  </section>

  <section className="about-tech-section">
    ...Grafana observability...
  </section>
</div>
```

Do not nest all five sections inside one giant card.

Each section must visually read as a separate horizontal band.

---

# 8. Page header

The page header should be simple.

Left side:

```text
OVERVIEW
What this site is
A personal job-search tool, a technical sandbox, AI-assisted workflows, and a structured knowledge base.
```

Right side: two actions.

1. `View source on GitHub`
2. `Open interview catalog`

## GitHub action

Use:

```text
https://github.com/sergiiiavt/gimme-job
```

External link:

```tsx
target="_blank"
rel="noreferrer"
```

## Interview action

Preserve the existing `mode` behavior unless inspection of the current router proves a better existing route.

The current component already distinguishes public/personal mode. Keep that behavior rather than changing navigation during this design task.

Example:

```ts
const interviewHref =
  mode === "personal"
    ? "/workspace/learn?section=interview"
    : "#interview";
```

If the public view already provides a stronger canonical internal route, use the existing project convention. Do not invent a route.

---

# 9. Section number component

Create a tiny helper:

```tsx
function SectionNumber({ children }: { children: React.ReactNode }) {
  return <span className="about-tech-section-number">{children}</span>;
}
```

Visual target:

- circle;
- about 32–36 px;
- pale green background;
- dark green number;
- bold;
- not decorative only; number can remain visible to screen readers.

Suggested CSS:

```css
.about-tech-section-number {
  align-items: center;
  background: #edf5ef;
  border: 1px solid #dce8df;
  border-radius: 999px;
  color: #2f6e50;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 850;
  height: 34px;
  justify-content: center;
  width: 34px;
}
```

---

# 10. Section 1 — exact content

Title:

```text
What this site is
```

Eyebrow:

```text
OVERVIEW
```

Subtitle:

```text
A personal job-search tool, a technical sandbox, AI-assisted workflows, and a structured knowledge base.
```

Render four equal cards on desktop.

## Card 01

```text
Job search tool
Collects vacancies, stores analysis, and helps review opportunities.
```

Icon: search/magnifier-like line icon.

Accent: green.

Link:

```text
Production site
https://gimme-job.com
```

## Card 02

```text
Technology sandbox
Used to test deployment, integrations, and production-style workflows.
```

Icon: code brackets.

Accent: blue.

Link:

```text
GitHub repo
https://github.com/sergiiiavt/gimme-job
```

## Card 03

```text
AI-assisted workflows
Uses OpenAI for recognition, analysis, and draft generation where useful.
```

Icon: simple AI/network/brain-like technical line icon.

Accent: purple.

Link:

```text
Implementation
https://github.com/sergiiiavt/gimme-job/blob/main/app/api/_jobpilot.ts
```

Do not use a fake Workers URL just to fill this card.

## Card 04

```text
Interview knowledge base & learning path
Stores interview questions and structured learning topics for ongoing study.
```

Icon: open book.

Accent: orange.

Link:

```text
Interview catalog
```

Destination uses the same mode-specific internal route as the page header.

---

# 11. Purpose-card markup

Use semantic articles.

Approximate structure:

```tsx
<article className={`about-tech-purpose-card accent-${card.accent}`}>
  <div className="about-tech-purpose-card-top">
    <Icon kind={card.icon} />
    <span className="about-tech-purpose-number">{card.number}</span>
  </div>

  <h2>{card.title}</h2>
  <p>{card.description}</p>

  <TechLink ... />
</article>
```

Do not put the entire card inside an anchor.

Only the link row is clickable.

This avoids confusing semantics when the card contains multiple content types.

---

# 12. Purpose-card desktop dimensions

Target, not absolute pixel perfection:

- grid: 4 columns;
- gap: 12–14 px;
- card min-height: ~160–180 px;
- card padding: 18–20 px;
- border radius: 12 px;
- border: `1px solid #dfe4df`;
- background: white;
- shadow: very subtle or none;
- title: 14–16 px;
- description: 11–12 px;
- line-height: ~1.55.

Do not make these cards huge.

The content should fit in the first viewport on a normal desktop together with part of the Deployment section.

---

# 13. Icon implementation

There is no dedicated icon package in the current dependencies.

Do not add one only for this page.

Create one small SVG component:

```tsx
function AboutIcon({ kind, className }: { kind: AboutIcon; className?: string }) {
  switch (kind) {
    ...
  }
}
```

Requirements:

- `viewBox="0 0 24 24"`;
- `width="1em"`;
- `height="1em"`;
- mostly `fill="none"`;
- `stroke="currentColor"`;
- `strokeWidth={1.8}`;
- `strokeLinecap="round"`;
- `strokeLinejoin="round"`;
- `aria-hidden="true"`.

For brand technologies:

- GitHub;
- GitHub Actions;
- Cloudflare;
- D1;
- OpenAI;
- Grafana;

the exact trademark shape is not required for functionality.

If an official local SVG already exists in the repository, use it.

Otherwise use a simple recognizable technical glyph inside a colored badge plus the text brand name next to it.

**Do not hotlink remote logo images.**

**Do not use emoji as icons.**

The label text must always identify the technology even if the icon is generic.

---

# 14. Link-pill helper

Create one helper for small destination rows.

Example:

```tsx
function TechLink({
  label,
  href,
  external = true,
}: AboutLink) {
  if (!href) {
    return (
      <span className="about-tech-link about-tech-link-disabled">
        <span>{label}</span>
      </span>
    );
  }

  return (
    <a
      className="about-tech-link"
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      <span>{label}</span>
      <svg ... aria-hidden="true" />
    </a>
  );
}
```

Visual:

- height around 30–34 px;
- thin border;
- background `#fbfcfb`;
- green/gray text;
- small external-link icon;
- no underline by default;
- hover border darkens;
- focus-visible uses existing global focus behavior.

Do not show the full long URL as primary text in every card.

Prefer:

```text
Repo ↗
Actions ↗
Production site ↗
Schema ↗
Migrations ↗
Instructions ↗
API summary ↗
Health ↗
```

If useful, a small muted hostname may appear beside the label, but do not make long URLs dominate the layout.

---

# 15. Generic technology node component

Create a reusable node for the technology diagrams.

Example:

```tsx
interface TechNodeProps {
  icon: AboutIcon;
  title: string;
  description?: string;
  accent?: "green" | "blue" | "purple" | "orange" | "neutral";
  links?: AboutLink[];
  children?: React.ReactNode;
}
```

Markup:

```tsx
<article className={`about-tech-node accent-${accent ?? "neutral"}`}>
  <header>
    <span className="about-tech-node-icon">
      <AboutIcon kind={icon} />
    </span>
    <strong>{title}</strong>
  </header>

  {description && <p>{description}</p>}

  {children}

  {links?.length ? (
    <div className="about-tech-node-links">...</div>
  ) : null}
</article>
```

Keep nodes visually consistent across Deployment, Database, OpenAI, and Grafana sections.

---

# 16. Arrow implementation

Arrows must be real DOM/SVG elements, not text characters like `→` positioned manually.

Create:

```tsx
function FlowArrow({ vertical = false }: { vertical?: boolean }) {
  return (
    <span
      className={`about-tech-flow-arrow${vertical ? " vertical" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 16">
        <path d="M1 8h42" />
        <path d="m38 3 5 5-5 5" />
      </svg>
    </span>
  );
}
```

Style:

```css
.about-tech-flow-arrow {
  align-items: center;
  color: #88948e;
  display: flex;
  justify-content: center;
  min-width: 34px;
}

.about-tech-flow-arrow svg {
  height: 16px;
  overflow: visible;
  width: 44px;
}

.about-tech-flow-arrow path {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5;
}
```

On mobile, either:

- rotate the SVG `90deg`; or
- use a vertical variant.

Do not absolutely position long connector lines across the page. Absolute lines become fragile when text wraps.

---

# 17. Generic section layout

For sections 2–5 use this pattern:

```tsx
<section className="about-tech-section" aria-labelledby="about-deployment-title">
  <div className="about-tech-section-heading">
    <SectionNumber>2</SectionNumber>
    <div>
      <h2 id="about-deployment-title">Deployment</h2>
      <p>...</p>
    </div>
  </div>

  <div className="about-tech-section-body">
    ...flow...
  </div>
</section>
```

Desktop:

```css
.about-tech-section {
  background: #fff;
  border: 1px solid #dfe4df;
  border-radius: 14px;
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(210px, .28fr) minmax(0, 1fr);
  padding: 20px 22px;
}
```

The exact column values can be tuned, but left description must remain narrower than the diagram area.

For Overview, use a special full-width content layout rather than this two-column split.

---

# 18. Section 2 — Deployment exact implementation

Title:

```text
Deployment
```

Description:

```text
Code is stored in GitHub, built in GitHub Actions, and deployed on Cloudflare.
```

Flow:

```text
[ GitHub ] → [ GitHub Actions ] → [ Cloudflare Platform ]
                                        ├─ Workers
                                        └─ Static assets
```

## GitHub node

Title:

```text
GitHub
```

Small description:

```text
Source repository
```

Links:

- `Repo` → `https://github.com/sergiiiavt/gimme-job`

## GitHub Actions node

Title:

```text
GitHub Actions
```

Description:

```text
Build, checks, and deployment workflow
```

Links:

- `Actions` → `https://github.com/sergiiiavt/gimme-job/actions`
- optional `Workflow` → `.github/workflows/ci.yml` source URL.

## Cloudflare node

Title:

```text
Cloudflare Platform
```

Inside the node, render two small child tiles:

### Workers

```text
Workers
Edge/runtime execution
```

### Static assets

```text
Static assets
Frontend assets served with the deployment
```

Bottom link:

- `Production site` → `https://gimme-job.com`

Do not add D1 inside this Deployment node; D1 has its own Database section.

---

# 19. Deployment flow CSS

Use:

```css
.about-tech-deployment-flow {
  align-items: stretch;
  display: grid;
  gap: 10px;
  grid-template-columns:
    minmax(150px, .8fr)
    44px
    minmax(170px, .9fr)
    44px
    minmax(300px, 1.5fr);
}
```

For the Cloudflare inner tiles:

```css
.about-tech-node-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 10px;
}
```

Child tile:

- background `#fafbf9`;
- border `1px solid #e4e8e4`;
- radius `8px`;
- padding `10px`.

---

# 20. Section 3 — Database exact implementation

Title:

```text
Database
```

Description:

```text
Application data is stored in Cloudflare D1.
```

Flow:

```text
[ Worker app ] → [ D1 Database ] → [ Jobs | Analyses | Settings | Observability ]
```

## Worker node

Title:

```text
Worker app
```

Description can be omitted or:

```text
Application reads and writes
```

## D1 node

Title:

```text
D1 Database
```

Description:

```text
Production application storage
```

Links:

- `Schema` → `https://github.com/sergiiiavt/gimme-job/blob/main/db/schema.ts`
- `Migrations` → `https://github.com/sergiiiavt/gimme-job/tree/main/drizzle`

## Data group

Render four compact child cards.

### Jobs

Description:

```text
Stored vacancies
```

### Analyses

Description:

```text
Analysis results
```

### Settings

Description:

```text
Application settings
```

### Observability

Description:

```text
Events and snapshots
```

Do not list every table.

The purpose is to communicate the database technology and major data categories.

---

# 21. Database flow layout

Desktop recommended grid:

```css
.about-tech-database-flow {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns:
    minmax(120px, .6fr)
    44px
    minmax(180px, .8fr)
    44px
    minmax(420px, 1.8fr);
}
```

Data-group child grid:

```css
.about-tech-data-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
```

At narrower widths it may become 2×2.

---

# 22. Section 4 — OpenAI integration exact implementation

Title:

```text
OpenAI integration
```

Description:

```text
OpenAI is used for vacancy recognition, analysis, and drafting support.
```

Flow:

```text
[ Job text + profile ] → [ OpenAI API ] → [ Recognition | Analysis | Drafts ]

                            [ Fallback: deterministic logic when AI is unavailable ]
```

The fallback is not downstream from OpenAI. It is an alternate behavior.

Visually place it to the right or below the main output group.

## Input node

Title:

```text
Job text + profile
```

Description:

```text
Vacancy text and candidate context
```

## OpenAI node

Title:

```text
OpenAI API
```

Links:

- `Production code` → `app/api/_jobpilot.ts` GitHub URL
- `Local analyst` → `agent/src/analyst.ts` GitHub URL

## Output cards

### Recognition

```text
Extract structured vacancy information
```

### Analysis

```text
Score, match, and explain
```

### Drafts

```text
Resume and application drafting support
```

## Fallback card

Title:

```text
Fallback
```

Description:

```text
Deterministic logic when AI is unavailable.
```

Use a neutral border/dashed style so it reads as an alternate path, not a fourth OpenAI result.

---

# 23. OpenAI layout

Use a main grid similar to:

```css
.about-tech-ai-flow {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns:
    minmax(150px, .7fr)
    44px
    minmax(180px, .8fr)
    44px
    minmax(330px, 1.4fr)
    minmax(150px, .65fr);
}
```

Output grid:

```css
.about-tech-output-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
```

Fallback:

```css
.about-tech-fallback {
  border-style: dashed;
  background: #fbfcfb;
}
```

Do not draw an arrow from Drafts to Fallback.

---

# 24. Section 5 — Grafana observability exact implementation

Title:

```text
Grafana observability
```

Description:

```text
Operational events and summary data are exposed to Grafana for dashboards and alerts.
```

Primary visual flow:

```text
[ App events      ] ─┐
                     ├→ [ Grafana ] → [ Dashboards | Alerts | Export ]
[ D1 summary API  ] ─┘
```

## Source card 1

Title:

```text
App events
```

Description:

```text
Selected runtime events and errors
```

## Source card 2

Title:

```text
D1 summary API
```

Description:

```text
Aggregated observability metrics and statistics
```

Link:

- `API summary` → `https://gimme-job.com/api/observability/summary?days=30`

Important: the endpoint requires authorization. A public click may return an auth response. Do not put the bearer token in the page. If exposing a protected endpoint as a link is considered unhelpful, link instead to the implementation source in `worker/index.ts`.

## Grafana node

Title:

```text
Grafana
```

Description:

```text
Dashboards and alerting
```

Links:

- real Grafana dashboard URL only if known;
- `Health endpoint` → `https://gimme-job.com/api/observability/health`;
- `Summary endpoint` only if intentionally linked.

## Output cards

### Dashboards

```text
System and usage metrics
```

### Alerts

```text
Thresholds and notifications
```

### Export

```text
Data used for further analysis
```

---

# 25. Cloudflare Workers Logs inside observability

Do not create a sixth top-level section for this implementation.

If the page needs to show Cloudflare native logs now, add one small auxiliary card inside the Grafana/observability section:

```text
Cloudflare Workers Logs
Recent request/runtime debugging
```

It must be visually separate from the `App events → D1 → Grafana` long-term path.

Do not draw a line that falsely claims Workers Logs are stored in D1 or automatically forwarded to Grafana unless that integration actually exists.

Suggested visual:

```text
Long-term / selected data:
App events + D1 summary → Grafana

Recent debugging:
Cloudflare Workers Logs
```

If this makes the section too crowded, omit the auxiliary card in the first implementation and keep the page faithful to the approved mockup.

---

# 26. Observability flow connectors

The two source cards can be stacked.

Avoid complicated SVG line routing.

Use a wrapper:

```tsx
<div className="about-tech-observability-sources">
  <TechNode ... />
  <TechNode ... />
</div>

<FlowArrow />

<TechNode title="Grafana" ... />

<FlowArrow />

<div className="about-tech-output-grid">...</div>
```

This simplifies the visual to:

```text
[source stack] → Grafana → [output grid]
```

That is preferable to fragile branching connector geometry.

---

# 27. Section shell styles

Add a new CSS block near the existing `/* Project intro */` styles.

Rename the comment to something clear, for example:

```css
/* About / technology overview */
```

Primary page:

```css
.about-tech-page {
  max-width: 1480px;
  width: 100%;
}
```

Page header:

```css
.about-tech-page-header {
  align-items: start;
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr) auto;
  margin-bottom: 14px;
}
```

Header title:

```css
.about-tech-page-header h1 {
  font-size: clamp(32px, 4vw, 46px);
  letter-spacing: -.045em;
  line-height: 1;
  margin: 0;
}
```

Eyebrow:

```css
.about-tech-eyebrow {
  color: #397657;
  display: block;
  font-size: 9px;
  font-weight: 850;
  letter-spacing: .12em;
  margin-bottom: 7px;
  text-transform: uppercase;
}
```

Subtitle:

```css
.about-tech-page-header p {
  color: #68756e;
  font-size: 12px;
  line-height: 1.6;
  margin: 9px 0 0;
  max-width: 760px;
}
```

Section stack:

```css
.about-tech-section + .about-tech-section {
  margin-top: 10px;
}
```

---

# 28. Section heading styles

Recommended:

```css
.about-tech-section-heading {
  align-items: flex-start;
  display: flex;
  gap: 14px;
  min-width: 0;
}

.about-tech-section-heading h2 {
  font-size: 19px;
  letter-spacing: -.025em;
  line-height: 1.15;
  margin: 2px 0 0;
}

.about-tech-section-heading p {
  color: #65716b;
  font-size: 11px;
  line-height: 1.55;
  margin: 7px 0 0;
  max-width: 240px;
}
```

Do not use giant headings in the technology rows.

The hierarchy should be:

- page H1 largest;
- section H2;
- node title;
- description.

---

# 29. Node visual styles

Base:

```css
.about-tech-node {
  background: #fff;
  border: 1px solid #dfe4df;
  border-radius: 10px;
  min-width: 0;
  padding: 13px;
}

.about-tech-node > header {
  align-items: center;
  display: flex;
  gap: 9px;
}

.about-tech-node > header strong {
  font-size: 12px;
  line-height: 1.25;
}

.about-tech-node p {
  color: #6a756f;
  font-size: 10px;
  line-height: 1.5;
  margin: 8px 0 0;
}
```

Icon:

```css
.about-tech-node-icon {
  align-items: center;
  border-radius: 8px;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 20px;
  height: 34px;
  justify-content: center;
  width: 34px;
}
```

Accent backgrounds must be pale, not saturated.

Example:

```css
.accent-green .about-tech-node-icon { background: #e8f5ed; color: #21734d; }
.accent-blue .about-tech-node-icon { background: #edf3ff; color: #356dd7; }
.accent-purple .about-tech-node-icon { background: #f3edfb; color: #7650b7; }
.accent-orange .about-tech-node-icon { background: #fff1e6; color: #d56d17; }
```

---

# 30. Brand-specific accent guidance

Use restrained brand-adjacent color only on the icon badge.

Suggested:

- GitHub: neutral/dark;
- GitHub Actions: blue;
- Cloudflare: orange;
- D1: blue;
- OpenAI: green;
- Grafana: orange.

Do not tint whole sections with strong brand colors.

The site should still look like GimmeJob, not a collage of vendor landing pages.

---

# 31. Overview card styles

Grid:

```css
.about-tech-purpose-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 16px;
}
```

Card:

```css
.about-tech-purpose-card {
  background: #fff;
  border: 1px solid #dfe4df;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  min-height: 170px;
  padding: 17px;
}
```

Title:

```css
.about-tech-purpose-card h2 {
  font-size: 14px;
  letter-spacing: -.015em;
  line-height: 1.3;
  margin: 13px 0 0;
}
```

Description:

```css
.about-tech-purpose-card p {
  color: #66726c;
  font-size: 11px;
  line-height: 1.55;
  margin: 7px 0 14px;
}
```

Link should sit at bottom:

```css
.about-tech-purpose-card .about-tech-link {
  margin-top: auto;
}
```

---

# 32. Page actions

Use a horizontal action group on desktop.

```css
.about-tech-actions {
  display: flex;
  gap: 8px;
}
```

Primary GitHub button:

- dark green/near-black background;
- white text.

Secondary interview button:

- white;
- border.

Suggested common:

```css
.about-tech-action {
  align-items: center;
  border: 1px solid #d6ddd7;
  border-radius: 8px;
  display: inline-flex;
  font-size: 11px;
  font-weight: 800;
  gap: 8px;
  min-height: 40px;
  padding: 0 13px;
}
```

Do not make them oversized.

---

# 33. Responsiveness — desktop > 1200 px

Expected:

- page uses existing content width;
- four overview cards in one row;
- section heading left, diagram right;
- Deployment is one horizontal line;
- Database is one horizontal line;
- OpenAI flow is mostly one line;
- Grafana flow is one line.

No horizontal scroll.

---

# 34. Responsiveness — 900 to 1200 px

At this width:

- keep sidebar behavior from existing app;
- section may change from 2-column outer layout to 1-column;
- heading appears above diagram;
- overview cards become 2×2 if needed;
- diagram node groups may wrap.

Suggested:

```css
@media (max-width: 1180px) {
  .about-tech-section {
    grid-template-columns: 1fr;
  }

  .about-tech-section-heading p {
    max-width: 720px;
  }

  .about-tech-purpose-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

---

# 35. Responsiveness — <= 820/900 px

The existing site navigation already changes behavior around this range.

Do not override the navigation system.

For About content:

- keep width 100%;
- reduce section padding;
- flow becomes stacked;
- arrows become vertical.

Do not use fixed widths that assume the sidebar remains visible.

---

# 36. Responsiveness — <= 700 px

Convert flow grids to one column.

Example:

```css
@media (max-width: 700px) {
  .about-tech-page-header {
    grid-template-columns: 1fr;
  }

  .about-tech-actions {
    flex-wrap: wrap;
  }

  .about-tech-purpose-grid {
    grid-template-columns: 1fr;
  }

  .about-tech-deployment-flow,
  .about-tech-database-flow,
  .about-tech-ai-flow {
    grid-template-columns: 1fr;
  }

  .about-tech-flow-arrow {
    min-height: 28px;
    transform: rotate(90deg);
  }

  .about-tech-data-grid,
  .about-tech-output-grid {
    grid-template-columns: 1fr;
  }
}
```

Important: if all arrows are rotated by CSS, make sure they remain centered and do not create excessive width.

---

# 37. Text wrapping rules

Every grid child must include:

```css
min-width: 0;
```

Long links:

```css
overflow-wrap: anywhere;
```

But prefer short link labels instead of displaying full URLs.

Titles should wrap naturally.

Do not use:

```css
white-space: nowrap;
```

on technology names if it causes mobile overflow.

Use nowrap only on short pill labels when safe.

---

# 38. Accessibility

Required:

- `section` elements have `aria-labelledby`;
- each section title has an `id`;
- external links have meaningful accessible text;
- icons are `aria-hidden` because visible labels provide meaning;
- arrows are `aria-hidden`;
- do not convey meaning by color alone;
- focus-visible state remains visible;
- no click handler on plain `div`;
- no nested anchors;
- no empty `href`;
- no `href="#"` placeholder;
- heading hierarchy remains valid: one H1, then H2 section titles, H3/node titles only if needed.

For visual cards where node titles are not headings, `<strong>` is acceptable to avoid excessive heading nesting.

---

# 39. Do not expose secrets

The page is public or can be rendered in a public context.

Never render:

- `GRAFANA_READ_TOKEN`;
- `APP_PASSWORD`;
- OpenAI API keys;
- Gmail tokens;
- Cloudflare API tokens;
- session secrets;
- D1 credentials;
- authorization headers.

The observability API can be named without exposing its credentials.

---

# 40. Existing About CSS cleanup

After the new page is working, remove obsolete selectors if they are no longer used:

```text
.about-stack-list-row
.about-mechanism
.about-mechanism-links
.about-mechanism-source
```

Do not remove `.about-page` if the new implementation still uses it.

Do not delete generic `.about-links` blindly if another page uses it. Search first:

```bash
rg -n "about-links|about-stack-list-row|about-mechanism" app
```

Only remove selectors proven unused.

---

# 41. Do not touch unrelated global CSS

`app/globals.css` is already large.

Add one clearly delimited block:

```css
/* About / technology overview */
/* ... */

/* End About / technology overview */
```

Keep all new selectors prefixed with:

```text
about-tech-
```

Exceptions:

- existing `.about-page` may be retained.

Do not create generic selectors such as:

```css
.card
.node
.flow
.link
.section
```

They can break other pages.

---

# 42. Public/personal behavior

`AboutSite` accepts a `mode`.

Preserve:

```ts
export default function AboutSite({
  mode = "public",
}: {
  mode?: "public" | "personal";
})
```

Do not add page state.

Use `mode` only where a destination truly differs, primarily the interview catalog link.

The visual design should be the same in public and personal modes.

---

# 43. Current navigation is out of scope

Do not edit `app/site-navigation.tsx` unless a failing link proves that the existing route contract requires a tiny correction.

Do not:

- rename sidebar items;
- add About subsections;
- change sidebar widths;
- change Career/Learning groups.

This task is only the About-page body.

---

# 44. Tests to search/update

Search test files for old text:

```bash
rg -n "Technology stack|How vacancy analysis works|Local CLI instructions|Production instructions" tests
```

If tests intentionally assert the old About page:

- replace old expected headings with the new approved headings;
- add assertions for the new stable structure;
- do not remove coverage.

Good stable assertions:

- page contains `What this site is`;
- page contains `Deployment`;
- page contains `Database`;
- page contains `OpenAI integration`;
- page contains `Grafana observability`;
- page contains canonical repo URL with `gimme-job`;
- page does not contain old repository URL `sergiiiavt/gimmejob`.

Avoid tests that assert fragile exact CSS class order.

---

# 45. Add or update rendered HTML test coverage

If `tests/rendered-html.test.mjs` already covers the About view, extend that test.

Otherwise add a focused test.

Verify at least:

```text
What this site is
Job search tool
Technology sandbox
AI-assisted workflows
Interview knowledge base & learning path
Deployment
GitHub Actions
Cloudflare Platform
Database
D1 Database
OpenAI integration
OpenAI API
Grafana observability
```

Also assert the canonical repository link:

```text
https://github.com/sergiiiavt/gimme-job
```

If easy, assert absence of:

```text
https://github.com/sergiiiavt/gimmejob
```

---

# 46. Build/test sequence

After implementation:

```bash
npm run lint
npm run check:agent
npm run build
```

Then run focused tests:

```bash
node --test tests/rendered-html.test.mjs
node --test tests/interview-catalog.test.mjs
```

Finally:

```bash
npm test
```

If a command fails:

1. read the real failure;
2. fix only the relevant code;
3. do not bypass tests;
4. do not loosen unrelated validation.

---

# 47. Visual QA checklist — 1760×900-ish desktop

Open:

```text
https://gimme-job.com/workspace/learn?section=about
```

or local equivalent.

Check:

- left navigation remains unchanged;
- content begins to the right of navigation;
- page header aligns correctly;
- GitHub and Interview actions do not overlap;
- four purpose cards fit in one row at large width;
- each horizontal section has the same width;
- section numbers align;
- section descriptions align;
- arrows are centered between nodes;
- cards do not have random heights;
- no arrow crosses text;
- no full URL destroys layout;
- no section is excessively tall;
- D1 section clearly reads as database;
- OpenAI section clearly shows input → API → outputs;
- fallback looks secondary;
- Grafana section clearly shows sources → Grafana → outputs.

---

# 48. Visual QA checklist — ordinary laptop

Test around:

```text
1366 × 768
```

Check:

- no horizontal page scrollbar;
- overview may remain 4 columns if comfortable, otherwise 2×2;
- technology rows do not squeeze text below readable size;
- action buttons wrap if needed;
- diagrams can wrap or stack before they become cramped.

Do not force the desktop flow into one line if it becomes unreadable.

---

# 49. Visual QA checklist — mobile

Test around:

```text
390 × 844
```

Check:

- existing navigation/mobile menu still works;
- page has no horizontal overflow;
- purpose cards are one per row;
- section heading is above flow;
- each tech node is full width;
- arrows point down;
- link pills wrap;
- text is at least approximately 11–12 px for descriptions;
- buttons are tappable;
- no clipped SVG.

---

# 50. Exact copy review

Before finishing, scan the page and remove promotional language.

The following words/phrases should generally not appear:

```text
showcase
cutting-edge
innovative
powerful
seamless
future-ready
revolutionary
best-in-class
living knowledge base
built in public
designed to help you succeed
```

Approved tone is technical and neutral.

---

# 51. Content density rule

A technology node should normally contain:

- icon;
- title;
- at most one short description;
- 0–2 links.

Do not put a paragraph inside every node.

A top purpose card may contain:

- icon;
- number;
- title;
- 1 short description;
- 1 link.

If text exceeds this, move detail to repository documentation instead.

---

# 52. Link visual rule

The generated design concept includes links inside technology areas.

Implement them consistently.

A section should not have five different button styles.

Use:

- primary page actions for the two top-right actions;
- one small reusable link-pill style everywhere else.

Do not style repository links like giant CTA buttons.

---

# 53. External-link icon

Use a tiny inline SVG.

Example path structure:

```tsx
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M14 5h5v5" />
  <path d="M10 14 19 5" />
  <path d="M19 13v6H5V5h6" />
</svg>
```

Keep it approximately 12–13 px.

---

# 54. Borders and shadows

The page should look structured, not floating.

Use:

- 1 px borders as primary separation;
- very light shadows only where necessary.

Suggested:

```css
box-shadow: 0 8px 26px rgba(28, 39, 35, .035);
```

Do not use strong card shadows.

Do not use gradients.

---

# 55. Backgrounds

Use existing site background.

Main horizontal sections:

```text
white
```

Nested nodes:

```text
white or #fafbf9
```

Pale accent fills only behind icons or small chips.

Do not assign different full-section background colors to each vendor.

---

# 56. Typography

Use the existing global font stack.

Do not import Google Fonts.

Do not modify global body typography.

Approximate hierarchy:

| Element | Size |
|---|---:|
| Page H1 | 32–46 px responsive |
| Section H2 | 18–20 px |
| Purpose card title | 14–16 px |
| Node title | 11–13 px |
| Body description | 10–12 px |
| Eyebrow/chip | 8–10 px |

Use existing GimmeJob typography and letter-spacing style.

---

# 57. Performance

The page must remain lightweight.

Do not:

- fetch dashboard data;
- query D1;
- call OpenAI;
- load remote logos;
- load a chart bundle;
- add animation framework.

All visible content is static metadata.

The page is an explanation of systems, not a live dashboard.

---

# 58. Security

All links are read-only/documentation destinations.

Do not add a UI that can:

- trigger deployment;
- call sync;
- run analysis;
- expose admin functions;
- expose Grafana auth;
- expose D1 console auth.

The page may link to safe source/dashboard destinations only.

---

# 59. Maintainability requirement

After implementation, future content changes should not require rewriting layout JSX.

This is why the content/config module is recommended.

At minimum:

- canonical URLs live in constants;
- purpose cards come from an array;
- repeated link rendering uses a helper;
- repeated icons use one icon component;
- repeated technology nodes use one node component.

Do not create a separate React component for every individual node.

---

# 60. Suggested implementation order

Follow this order.

### Step 1

Create `app/about-site-content.ts`.

Add:

- types;
- URL constants;
- purpose-card data.

### Step 2

Refactor `app/about-site.tsx`.

First implement:

- page header;
- actions;
- reusable `AboutIcon`;
- `TechLink`;
- `SectionNumber`;
- `TechNode`.

### Step 3

Implement Overview section.

Do not continue until four-card rendering is correct.

### Step 4

Implement Deployment flow.

### Step 5

Implement Database flow.

### Step 6

Implement OpenAI flow.

### Step 7

Implement Grafana observability flow.

### Step 8

Add/replace About CSS.

### Step 9

Add responsive CSS.

### Step 10

Search/remove obsolete About CSS.

### Step 11

Update tests.

### Step 12

Run lint/build/tests.

### Step 13

Do desktop/mobile visual QA.

Do not attempt to rewrite the page, CSS, tests, and unrelated navigation in one giant unreviewed change.

---

# 61. Implementation sanity checks after each section

After Overview:

- four cards render;
- links correct;
- no overflow.

After Deployment:

- arrows align;
- Cloudflare child tiles fit.

After Database:

- D1 is central;
- four data cards fit.

After OpenAI:

- fallback is visually separate;
- output group has three cards.

After Grafana:

- source stack, Grafana, output group are clear;
- no token is exposed.

---

# 62. What “done” means

The task is complete only when all of the following are true:

- [ ] Current `Technology stack` layout is removed.
- [ ] Current `How vacancy analysis works` long text block is removed.
- [ ] Page uses five approved horizontal sections.
- [ ] Section 1 contains four purpose cards.
- [ ] Deployment shows GitHub → GitHub Actions → Cloudflare.
- [ ] Database shows Worker → D1 → major data categories.
- [ ] OpenAI shows input → OpenAI → recognition/analysis/drafts.
- [ ] Deterministic fallback is visible.
- [ ] Grafana shows observability sources → Grafana → outputs.
- [ ] Links exist inside technical sections.
- [ ] Canonical repository URL uses `gimme-job`.
- [ ] No fake Grafana URL exists.
- [ ] No secret/token exists in markup.
- [ ] No new icon dependency was installed.
- [ ] No client-side state was added.
- [ ] Existing sidebar/navigation still works.
- [ ] Public and personal About views still work.
- [ ] Desktop layout matches the approved concept closely.
- [ ] Mobile layout has no horizontal overflow.
- [ ] Old unused About styles are removed after verification.
- [ ] Tests are updated rather than disabled.
- [ ] Lint passes.
- [ ] Build passes.
- [ ] Relevant tests pass.

---

# 63. Final instruction to the implementation assistant

Do not reinterpret this task.

Do not make it “more modern” by changing the site shell.

Do not add additional technologies because they appear in `package.json`.

Do not replace diagrams with a bullet list.

Do not add marketing copy.

Do not invent links.

Implement the five-section page described above using the existing GimmeJob visual system, static React markup, scoped CSS, simple inline SVG icons, and verifiable project links.
