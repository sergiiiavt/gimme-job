# Interview knowledge base: storage plan

## Decision

Keep the interview knowledge base in this repository for the first version. Do not create a separate repository yet.

- Store reviewed public content as versioned collection files under `content/interview/`. The first collection is `common-qa.json`; use Markdown later for answers that need long-form examples or diagrams.
- Keep images or downloadable documents out of D1; use repository assets for small static files and R2 only if uploads are added later.
- Use the existing D1 database only for private, changeable user data such as notes, bookmarks, confidence, and review progress.
- Treat Git history and pull requests as the review and rollback mechanism for the public answers.

This keeps the content close to the UI, makes every change reviewable, and avoids editing long answers through SQL or a database console.

## Content structure

```text
content/interview/
  common-qa.json
  qa-lead.json          # next collection
  automation.json       # later, when the common set grows
  long-form/            # optional Markdown deep dives
```

Each short structured question has a stable ID, level, category, concise answer, strong-answer signals, and source IDs. Collection metadata records its version, review date, and source registry. The site never copies a third-party question bank verbatim.

Use Markdown only when a topic needs a detailed article. Suggested front matter:

```yaml
id: risk-based-testing
title: What is risk-based testing?
section: test-strategy
level: lead
tags: [risk, planning, coverage]
roles: [qa-lead, test-lead, senior-qa]
updatedAt: 2026-08-10
```

Suggested body sections:

1. Short answer
2. Detailed answer
3. Practical example
4. Common follow-up questions
5. Sources

## D1 data for the private workspace

Do not duplicate the full public answer text in D1. Store only user-specific state:

```text
interview_progress
  question_id
  status          # new, learning, ready, revisit
  confidence      # 1-5
  private_notes
  last_reviewed_at
  next_review_at
```

The `question_id` points to the stable ID in repository content. If browser-based editing is required later, an editor can create pull requests or publish reviewed revisions while Git remains the source of truth.

## Update and maintenance workflow

1. Add or edit a question in the relevant collection file.
2. Keep the existing ID when wording or answers change; create a new ID only for a genuinely different question.
3. Update `lastReviewedAt` when the collection is checked against its sources.
4. Run `npm run check:content`. CI rejects duplicate IDs, unsupported levels, missing answers, weak rubrics, or unknown sources.
5. Review and deploy through the normal pull-request and CI flow. Git provides diffs, authorship, rollback, and release history.

Review evergreen fundamentals annually. Review tool-, standard-, security-, AI-, and market-dependent material every three to six months.

## When a separate repository would make sense

Create a separate content repository only if the knowledge base gets a separate owner, permissions, release cycle, or must be reused by several applications. None of those conditions exists yet.

## First content milestone

1. The common 30-question QA core, search, level filter, topic filter, concise answers, rubrics, and sources are implemented.
2. Add a dedicated QA Lead collection with deeper scenario questions.
3. Add private progress and notes in D1.
4. Map recurring vacancy requirements to relevant questions.
