# GimmeJob visual design modes

GimmeJob keeps two visual modes on the same application structure:

- **New** — the default design. It uses the shared readability and hierarchy rules in `app/new-design.css`.
- **Old** — the previous production appearance. It uses the existing styles without the new design overrides.

The selector is rendered by the root layout and stores the user's choice in `localStorage` under `gimmejob-design`. The selected mode is applied as `data-design="new|old"` on the root `html` element before the main page content is parsed, which avoids duplicating routes or application state.

## Design direction

The new mode follows four rules:

1. **Readable before dense.** Normal content is targeted at roughly 15–16 px and supporting information at roughly 11–13 px. Important metadata should not depend on 7–10 px text.
2. **Fewer competing surfaces.** Cards, pastel navigation clusters, large radii, shadows, decorative backgrounds, uppercase labels, and letter spacing are reduced when they do not communicate state.
3. **Data remains primary.** Vacancy tables, interview questions, learning documents, source evidence, filters, and status information keep their meaning and interaction contracts; presentation changes do not alter the underlying data.
4. **One shared system.** Navigation, typography, surfaces, controls, focus treatment, and responsive behavior are changed through shared design-mode overrides rather than page copies.

## Implementation rules

- New-design rules must stay scoped beneath `html[data-design="new"]` except for the design switcher itself.
- Do not fork a page into old/new component trees only for appearance.
- New feature work should remain functional in both modes until the old mode is intentionally retired.
- Preserve semantic HTML, accessible names, keyboard focus, source attribution, saved preferences, localization, and public/private boundaries.
- Prefer fixing shared selectors before adding another page-specific override.

## Verification

For design changes, verify representative desktop, tablet, and phone layouts plus the main data-heavy surfaces. The canonical repository validation remains `npm run verify`, followed by PR CI, SonarQube Cloud, merge, production deployment, and a live smoke check.
