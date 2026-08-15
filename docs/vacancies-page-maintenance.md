# Vacancies Page — UI and Maintenance Contract

**Status:** Permanent project documentation  
**Applies to:** `app/vacancies-page.tsx`, `app/vacancies-page.css`, and the `/workspace` vacancies route  
**Purpose:** Keep the vacancies page compact, useful, and consistent while preserving the distinction between public and personal views.

---

## 1. Core layout rule

The vacancies page is a compact table/card hybrid. It must not stretch vacancy content across a large empty row simply because horizontal space is available.

On desktop, use meaningful columns instead of blank space:

```text
Personal:
[select] [vacancy] [match] [posted] [status]

Public:
[vacancy] [posted]
```

The vacancy identity column contains:

- title;
- company and location;
- source chip;
- Remote chip when applicable;
- salary chip when collected;
- `Бронювання` chip when detected.

Do not create wide empty middle areas. Column widths should be intentionally bounded and the vacancy column should receive the flexible space.

---

## 2. Public vs personal view

The same `/workspace` route supports two UI modes based on the `authenticated` value returned by `/api/dashboard`.

### Public / unauthenticated view

Show only information appropriate for the public vacancy browser:

- vacancy title;
- company;
- location;
- source;
- Remote;
- salary when available;
- `Бронювання` when detected;
- posted date;
- public aggregate stats such as Total, Remote, and Reservation;
- search;
- vacancy details and external vacancy/apply links.

Do **not** render personal workflow information in the public UI:

- selection checkboxes;
- bulk Analyze controls;
- AI match score/verdict;
- pipeline status;
- agent feedback (`Relevant` / `Not relevant`);
- personal Applied/Interview counters;
- tailored resume;
- application draft;
- personal analysis panel.

Show a `Sign in for personal tools` link instead of personal action buttons.

### Personal / authenticated view

Show the full working view:

- Sync jobs;
- Analyze / Analyze selected;
- row checkboxes;
- status filter;
- Total / New / Applied / Interviews counters;
- Match column with AI score and verdict;
- Posted column;
- Status column;
- Relevant / Not relevant chips;
- tracking controls in vacancy details;
- analysis panel;
- tailored resume and application draft.

The public and personal views should share the same visual language and vacancy identity layout. Personal mode adds workflow columns; it is not a separate visual product.

---

## 3. Privacy boundary

Hiding personal data in React is a presentation rule, **not a security boundary**.

Server/API code must remain responsible for deciding which fields an unauthenticated request may receive. Never rely only on CSS, conditional rendering, or hidden DOM elements to protect personal data.

If `/api/dashboard` public response behavior changes, review this page at the same time.

---

## 4. Density and spacing

Target approximately 70–80 px per desktop vacancy row under normal content.

Rules:

- use consistent horizontal row padding;
- use consistent 8–12 px column gaps;
- keep chips compact;
- avoid large vertical padding around title/meta/chips;
- do not equalize columns by adding empty width;
- keep Match, Posted, and Status columns compact;
- let the Vacancy column consume remaining useful width;
- preserve readable wrapping on smaller screens instead of shrinking text excessively.

The goal is to show materially more vacancies per viewport than the previous tall feed layout.

---

## 5. Match column

The Match column is personal-only.

When analysis exists, display:

```text
<score>
<verdict>
```

Example:

```text
91
Strong
```

When analysis is absent:

```text
—
Not analyzed
```

Do not invent a score and do not infer one from vacancy tags.

---

## 6. Posted column

Use a compact visible date such as:

```text
15 Aug
```

Keep the full date available through the semantic `<time>` value/title where useful.

Do not push the date to a random location inside the title row with `justify-content: space-between`. It is a real column.

---

## 7. Status column

Status is personal workflow data.

Keep existing status values and semantic colors:

- New;
- Interested;
- Applied;
- Interview;
- Offer;
- Rejected;
- Not interested;
- Archived.

Do not expose this column in the public list merely to fill horizontal space.

---

## 8. Reservation visibility

`Бронювання` is high-value vacancy information and should remain visually easy to find.

Keep it next to the vacancy identity/source chips, not in a distant metadata column.

Do not reduce it to plain gray text.

---

## 9. Header and filters

Keep the header compact.

### Personal

```text
Vacancies                    [Sync jobs] [Analyze]
                              Total | New | Applied | Interviews
```

Filters:

```text
[Search vacancies................................] [All statuses]
```

### Public

```text
Vacancies                    [Sign in for personal tools]
                              Total | Remote | Reservation
```

Filters:

```text
[Search vacancies..............................................]
```

Do not show a personal status filter in public mode.

---

## 10. Detail view

### Personal

Retain the current two-area detail view:

- vacancy information/tracking;
- analysis + tailored resume/application draft.

### Public

Render only the vacancy information section. Do not render personal analysis, tailored resume, application draft, match score, tracking status, or feedback controls.

External vacancy and apply links remain available.

---

## 11. Responsive behavior

### Desktop

Use the explicit columns described above.

### Tablet

Preserve the vacancy identity as the dominant column. Match/date/status may compress or move into a secondary row.

### Mobile

Use a stacked row:

```text
[checkbox] Vacancy title
           Company · location
           [chips]
           Match                    Posted
           Status
```

Public mobile rows omit personal-only lines.

No horizontal page scrolling is acceptable.

---

## 12. Source-of-truth map

| Concern | Source |
|---|---|
| Vacancies UI / behavior | `app/vacancies-page.tsx` |
| Vacancies-specific layout | `app/vacancies-page.css` |
| `/workspace` route | `app/workspace/page.tsx` |
| Shared UI styles | `app/globals.css` |
| Sidebar public/personal switch | `app/site-navigation.tsx` |
| Dashboard/job API behavior | `app/api/_jobpilot.ts`, `worker/index.ts` |
| Database | `db/schema.ts`, `drizzle/` |

---

## 13. Maintenance rules

When changing the page:

1. Verify both unauthenticated and authenticated rendering.
2. Verify a vacancy with analysis and one without analysis.
3. Verify a vacancy with `Бронювання`.
4. Verify Remote and non-Remote vacancies.
5. Verify long titles/company/location text.
6. Verify search and personal status filtering.
7. Verify Select all / Clear / Analyze selected in personal mode.
8. Verify public mode has no personal workflow UI.
9. Verify desktop, tablet, and mobile layouts.
10. Run lint/build/tests before merging.

Do not reintroduce the old pattern where date/status are pushed to the far side of a mostly empty row.

---

## 14. Acceptance checklist

- [ ] Vacancy rows are compact.
- [ ] There is no large blank middle area created by layout stretching.
- [ ] Vacancy is the only flexible-width main column.
- [ ] Personal view has Match / Posted / Status columns.
- [ ] Public view has Vacancy / Posted only.
- [ ] Public UI does not render personal analysis, tracking, feedback, resume, or draft content.
- [ ] `Бронювання` remains easy to scan.
- [ ] Search works in both modes.
- [ ] Status filter exists only in personal mode.
- [ ] Mobile layout has no horizontal scroll.
- [ ] Personal detail workflow still works.
- [ ] External vacancy/apply links still work.
- [ ] Lint/build/tests pass.
