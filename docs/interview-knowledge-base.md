# Interview knowledge base

## Storage decision

The public knowledge base lives in this repository and is deployed with the application. Git is the source of truth; D1 is not used for public questions or answers.

```text
content/interview/
  catalog.ts          # build-time composition
  common-qa.json      # original core collection
  canonical-baseline.json # directly searchable topic baseline
  database-sql-qa.json # audited database and SQL coverage
  observability-production-qa.json # audited observability and production coverage
  restored-coverage-qa.json # valuable coverage restored from history
  expanded-qa.json    # broad canonical coverage
  taxonomy.json       # stable sections and labels
  sources.json        # research and validation catalog

public/content/interview/
  <question-id>/      # images and diagrams referenced by a question
```

The public site contains only production-ready content. Drafts exist in Git branches and pull requests, so public records do not need `draft`, `reviewed`, or `needs-update` fields. `lastReviewedAt` is collection metadata; requested updates are tracked with GitHub issues and normal pull requests.

## Question model

Every question has a stable ID, level, prevalence band, category, original question wording, concise answer, strong-answer signals, source IDs and optional tags or media.

```json
{
  "id": "risk-based-selection",
  "level": "Junior",
  "prevalence": "Very common",
  "category": "Test design",
  "question": "If you cannot run every test, how do you select the most valuable subset?",
  "shortAnswer": "...",
  "strongAnswerSignals": ["impact and likelihood", "residual risk"],
  "tags": ["risk", "planning"],
  "media": [{
    "src": "/content/interview/risk-based-selection/risk-matrix.svg",
    "alt": "A five by five risk matrix combining likelihood and impact",
    "caption": "A simple prioritization model.",
    "credit": "Original GimmeJob diagram"
  }],
  "sourceIds": ["istqb-ctfl-v4"]
}
```

Images require an accessible alternative, caption and credit. Original diagrams use SVG; raster screenshots should use WebP or AVIF. Large or user-uploaded media can move to R2 later without moving the public text to a database.

## Editorial approach

- DOU, Katalon, Indeed and GeeksforGeeks are cross-checked as coverage and prevalence inputs rather than answer authorities.
- Duplicate and obsolete trivia is consolidated into canonical questions.
- Wording and answers are original.
- Official syllabi, standards, specifications and product documentation validate technical claims.
- `sources.json` documents why each source is used.

The catalog currently contains 566 canonical questions across 18 topics and 46 sources. The generator preserves every existing stable question ID and allows reviewed additions to increase the total; the validated minimum advances with the catalog so the count cannot regress. Its four prevalence bands are editorial signals, not invented percentages: **Very common**, **Common**, **Occasional**, and **Specialist**. The default view sorts most-common first; editorial, Junior-to-Lead, and alphabetical sorting remain available.

The catalog module is loaded only after the Interview section is opened. Filtering and search operate over the full in-memory catalog, but pagination renders no more than 60 question rows at once.

## Private D1 data

D1 remains appropriate for changeable user-specific state:

```text
interview_progress
  question_id
  status          # new, learning, ready, revisit
  confidence      # 1-5
  private_notes
  bookmarked
  last_reviewed_at
  next_review_at
```

The private progress status is unrelated to editorial publication status.

## Validation and deployment

`npm run check:content` enforces the current 566-question minimum, 18 topics, 46 sources, four specialist topics, prevalence values, duplicate IDs, known categories and sources, complete answers, answer signals, and valid media. Pull-request CI then runs lint, type checking, the production build and Cloudflare artifact validation before merge. Production deployment is available only from the GitHub Actions workflow after changes reach `main`.
