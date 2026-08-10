# Interview knowledge base

## Storage decision

The public knowledge base lives in this repository and is deployed with the application. Git is the source of truth; D1 is not used for public questions or answers.

```text
content/interview/
  catalog.ts          # build-time composition
  common-qa.json      # original core collection
  expanded-qa.json    # broad canonical coverage
  taxonomy.json       # stable sections and labels
  sources.json        # research and validation catalog

public/content/interview/
  <question-id>/      # images and diagrams referenced by a question
```

The public site contains only production-ready content. Drafts exist in Git branches and pull requests, so public records do not need `draft`, `reviewed`, or `needs-update` fields. `lastReviewedAt` is collection metadata; requested updates are tracked with GitHub issues and normal pull requests.

## Question model

Every question has a stable ID, level, category, original question wording, concise answer, strong-answer signals, source IDs and optional tags or media.

```json
{
  "id": "risk-based-selection",
  "level": "Junior",
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

- Community question banks, including DOU, are coverage inputs rather than answer authorities.
- Duplicate and obsolete trivia is consolidated into canonical questions.
- Wording and answers are original.
- Official syllabi, standards, specifications and product documentation validate technical claims.
- `sources.json` documents why each source is used.

The first broad release contains 120 canonical questions across 14 topics and 22 sources.

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

`npm run check:content` rejects duplicate IDs, unknown categories or sources, incomplete answers, missing answer signals, invalid media metadata and missing image files. Pull-request CI then runs lint, type checking, the production build and Cloudflare artifact validation before merge.
