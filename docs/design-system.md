# GimmeJob visual design modes

GimmeJob keeps two visual modes on the same application structure:

- **New** — the default design.
- **Old** — the previous production appearance.

The selected mode is stored in `localStorage` under `gimmejob-design` and is applied as `data-design="new|old"` on the root `html` element before the main page content is parsed. Routes, application state, data and business logic are shared.

The **Old / New** selector is intentionally small and lives at the **very bottom of the scrollable primary navigation**. It is not a floating control and should not compete with page actions.

## Design rules

1. **Hierarchy is contextual, not global.** A reading paragraph, database cell, language switch, vacancy status and page title must not share the same scale merely because they all contain text.
2. **Preserve page geometry.** Shared design CSS must not change primary-sidebar widths, main-column offsets, playground panel geometry or other page contracts. Geometry belongs to the page that owns it.
3. **Utility controls stay quiet.** Language toggles, metadata chips, status labels, filter captions and secondary actions remain smaller than the content they control.
4. **Dense tools remain dense.** Database, WebSocket, traces and quick-reference pages prioritize scanability and working area. Monospace is reserved for code/data; normal UI uses the site system font.
5. **Reading pages get reading typography.** Learning documents and standalone interview answers use larger prose and comfortable line-height, but their navigation/metadata remain compact.
6. **Fewer competing surfaces.** Shadows, large radii, pastel panels and decorative effects are reduced unless they communicate interaction or state.
7. **Old and New share behavior.** Design work must not fork routes/components just to change appearance.

## Page-family review

### Primary navigation
- Keep the existing navigation geometry because several playgrounds intentionally align to the 220px compact sidebar.
- Reduce cluster decoration in New mode.
- Keep labels readable without turning navigation into body-sized text.
- Place the design selector after all navigation content so it appears only at the bottom of the scroll.

### About
- Preserve the architecture-flow grid and intrinsic card widths.
- The compact “Why / Tech stack” title is a section label, not a page hero; it must never inherit generic large-heading styles.
- Technical cards and source rails use compact typography because the page is diagram-like.

### Interview catalog
- Question wording is primary.
- Answer prose is normal reading text.
- Filters, tags, progress metadata and **EN / UA** are utility UI and stay small.
- Code remains monospace.

### Standalone interview question
- Behaves like a document: restrained title, readable answer, compact metadata and compact language selector.

### Learning documents
- Long-form prose uses reading typography.
- TOC, language selector, badges, source metadata and paging are deliberately smaller.

### Vacancies
- Dense operational table; do not inflate every cell/chip.
- Vacancy title is the strongest row element, with metadata/status subordinate.

### Database playground
- Dense workbench rather than article.
- SQL/editor/result data stays monospace; tabs, table tree and actions use normal UI font.
- Small labels remain small, with consistent radii and panel borders.

### WebSocket playground
- Chat text is readable.
- Connection controls and inspector guidance remain compact.
- Existing two-panel geometry is preserved.

### AI assistant and execution trace
- Assistant response text is conversational/readable.
- Trace remains a technical inspector with denser metadata and monospace values.
- Panel geometry and equal-height behavior are preserved.

### Quick reference
- Intentionally the densest reading surface on the site.
- Cards and rows should not be enlarged to long-form article scale.

### Games
- Canvas is the visual priority.
- Selector and control chrome stay compact.

### Resume
- Treat as a document, not a dashboard.
- Keep print-like hierarchy and compact supporting metadata.

## Verification

For visual changes:

- run `npm run verify`;
- run the design-mode source regressions;
- keep PR CodeQL and SonarQube Cloud green;
- merge only after checks pass;
- verify the production deployment and live page response.

Visual inspection should cover representative desktop and mobile layouts from every page family above. Source-level tests protect against the specific regression that caused the first New-design implementation to break page geometry.
