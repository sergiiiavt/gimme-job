# About page content maintenance

This document defines how to maintain the About page at `app/about-site.tsx` and `app/about-site-content.ts`.

## Scope and purpose

The About page is a static technical overview. It explains architecture and integrations. It is not a dashboard, not an admin surface, and not marketing copy.

The page must keep exactly five sections:

1. What this site is
2. Deployment
3. Database
4. OpenAI integration
5. Grafana observability

Do not add extra top-level sections unless explicitly requested.

## Source of truth

- Structure and rendering: `app/about-site.tsx`
- Content constants and links: `app/about-site-content.ts`
- Styles: `app/globals.css` in the About block

Keep content data-driven. Repeated values must come from constants/arrays, not duplicated inline strings.

## Writing rules

- Keep tone neutral and technical.
- Use short factual descriptions.
- Avoid promotional language and hype.
- Keep node/card text concise.

## Link policy

- Use canonical repository links with `https://github.com/sergiiiavt/gimme-job`.
- Do not use `sergiiiavt/gimmejob`.
- Do not invent URLs.
- Do not use placeholder `#` links for missing destinations.
- If a destination is unknown (for example Grafana dashboard URL), render a non-clickable chip.

## Protected endpoint policy

Do not expose protected production endpoints as normal public links on the About page.

Examples currently protected by bearer token:

- `/api/observability/health`
- `/api/observability/summary`

For public About content, link to implementation source files instead.

## Security and privacy

Never expose credentials or secrets in page content, constants, or links:

- API keys/tokens
- bearer tokens
- passwords
- private session identifiers

## Visual maintenance rules

- Keep the existing five-section architecture.
- Keep reusable helpers (`TechNode`, `TechLink`, `FlowArrow`, inline SVG icon renderer).
- Keep About selectors prefixed with `about-tech-`.
- Remove dead About CSS selectors when markup changes.
- Preserve responsive behavior and avoid horizontal overflow on mobile.

## Accessibility rules

- Exactly one page `h1` for About overview.
- Sections 2-5 use `h2`.
- Keep valid `aria-labelledby` wiring for sections.
- Keep actions as real anchor elements.
- External links use `target="_blank"` and `rel="noreferrer"`.

## Change checklist

Before completing About page edits:

1. Verify section order and headings are unchanged.
2. Verify canonical repo URL usage.
3. Verify protected endpoint URLs are not exposed as public links.
4. Verify no obsolete classes remain in About CSS.
5. Update tests if visible content/structure changed.
6. Run validation commands required by repository policy.
