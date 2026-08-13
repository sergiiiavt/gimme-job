# Python knowledge base

Two independent, additive modules cover Python: a structured learning path (`content/python-learning/`) and a separate, deeply-researched interview question catalog (`content/python-interview/`). Neither touches the QA interview catalog documented in [`interview-knowledge-base.md`](interview-knowledge-base.md); the Python interview catalog reuses the exact same `InterviewKnowledgeBase` component and question schema under a second, independent content tree.

## Storage decision

Both modules live in this repository and deploy with the application. Git is the source of truth; D1 is not used for either.

```text
content/python-interview/
  catalog.ts           # build-time composition
  taxonomy.json         # 13 stable topics and labels
  sources.json           # research and validation catalog
  *-qa.json               # one file per topic (core-language, oop, concurrency, ...)

content/python-learning/
  catalog.ts                # build-time composition
  taxonomy.json              # 15 modules, Beginner to Expert
  beginner-lessons.json       # lessons grouped by level
  intermediate-lessons.json
  advanced-lessons.json
  expert-lessons.json
```

## Why the interview catalog is reused, not duplicated

`InterviewKnowledgeBase` (`app/public-site.tsx`) already takes a generic `catalog: InterviewCatalog` prop, so `content/python-interview/catalog.ts` is composed into that exact same shape (`title`, `description`, `methodology`, `taxonomy`, `sources`, `questions`) and rendered through the identical component under the `python-interview` section. Question IDs are namespaced with a `py-` prefix so they cannot collide with the QA catalog's IDs; personal progress tracking (`interview_progress` in D1, keyed by an arbitrary `questionId` string) works for both catalogs with no schema or API change.

## Question model (Python interview catalog)

Identical to the QA catalog's model: stable ID, level, prevalence band, category, question, concise answer, strong-answer signals, source IDs, tags, and an English/Ukrainian pair for every text field, plus a bilingual practical example. See [`interview-knowledge-base.md`](interview-knowledge-base.md#question-model) for the full field reference — nothing is different here except the `py-` ID prefix and a smaller, Python-specific `kind` vocabulary (`Theory`, `Practical`, `Troubleshooting`, `Performance`, `Design`, `Security`, `Tooling`).

## Lesson model (Python learning path)

The curriculum has no direct precedent in this codebase; it is modeled on the same bilingual philosophy as the interview catalog, adapted for teaching rather than Q&A:

```json
{
  "id": "py-lesson-generator-functions",
  "moduleId": "iterators-generators-decorators-functional",
  "level": "Advanced",
  "title": "Generator functions and yield",
  "titleUk": "...",
  "summary": "...",
  "summaryUk": "...",
  "concept": "The full explanation, rendered the same way an interview answer is.",
  "conceptUk": "...",
  "keyPoints": ["...", "..."],
  "keyPointsUk": ["...", "..."],
  "code": "def evens(limit):\n    ...",
  "codeCaption": "...",
  "codeCaptionUk": "...",
  "pitfalls": ["...", "..."],
  "pitfallsUk": ["...", "..."],
  "exercise": "...",
  "exerciseUk": "...",
  "tags": ["generators", "yield"],
  "sourceIds": ["python-docs-language-reference"]
}
```

`code` is plain text, not translated (code is language-agnostic); every prose field is bilingual. Lessons are rendered by `PythonLearningPath` (`app/public-site.tsx`), a dedicated component modeled on `InterviewKnowledgeBase`'s card layout, but simpler: no personal-progress tracking in v1, and a single-column body instead of the QA catalog's two-column answer/signals split, since a lesson has more sequential sections (concept, key points, code, pitfalls, exercise) than a Q&A pair does.

`content/python-learning/catalog.ts` reuses `content/python-interview/sources.json` directly rather than duplicating the source list, since both modules cite the same official Python documentation and PEPs.

## Editorial approach

- Real Python, GeeksforGeeks, InterviewBit, Toptal and DataCamp are cross-checked as coverage and prevalence inputs for the interview catalog, the same way DOU/Katalon/Indeed/GeeksforGeeks are used for the QA catalog — signals for what is commonly asked, never answer authorities.
- `docs.python.org` and the relevant PEP validate every technical claim, in both the interview catalog and the curriculum.
- Wording and answers are original.
- Both are intentionally smaller, expandable v1 collections (133 interview questions across 13 topics; 64 lessons across 15 modules) rather than an attempt to match the QA catalog's 672-question scale on day one — the QA catalog itself grew to that size over many additions, documented across its own multiple `*-qa.json` files.

## Validation and deployment

`npm run check:content` runs all three content validators in sequence: `scripts/validate-interview-content.mjs` (QA catalog, unchanged), `scripts/validate-python-interview-content.mjs`, and `scripts/validate-python-curriculum-content.mjs`. The Python validators enforce the same kind of rules as the QA validator — unique namespaced IDs, valid level/prevalence/module references, EN+UK length floors, matching EN/UK list lengths, known sources, every source referenced by at least one question or lesson — scaled to each collection's own (currently smaller, and rolling-minimum) baseline instead of the QA catalog's 672/19/67 floors.
