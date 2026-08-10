# Interview knowledge base: storage plan

## Decision

Keep the interview knowledge base in this repository for the first version. Do not create a separate repository yet.

- Store reviewed public content as Markdown files under `content/interview/`.
- Keep images or downloadable documents out of D1; use repository assets for small static files and R2 only if uploads are added later.
- Use the existing D1 database only for private, changeable user data such as notes, bookmarks, confidence, and review progress.
- Treat Git history and pull requests as the review and rollback mechanism for the public answers.

This keeps the content close to the UI, makes every change reviewable, and avoids editing long answers through SQL or a database console.

## Proposed content structure

```text
content/interview/
  qa-foundations/
  test-strategy/
  automation/
  api-and-databases/
  leadership/
  system-design/
  behavioural/
```

Use one Markdown file per question. Suggested front matter:

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

The `question_id` points to the stable ID in the Markdown file. If browser-based content editing is required later, the Markdown files can be imported into D1 during CI while Git remains the source of truth.

## When a separate repository would make sense

Create a separate content repository only if the knowledge base gets a separate owner, permissions, release cycle, or must be reused by several applications. None of those conditions exists yet.

## First content milestone

1. Define the taxonomy above.
2. Add 30 high-value QA Lead questions with concise answers and sources.
3. Add section and tag filters.
4. Add private progress and notes in D1.
5. Map recurring vacancy requirements to relevant questions.
