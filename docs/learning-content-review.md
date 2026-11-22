# Reviewing learning content

Several learning paths are published with a yellow banner: **Waiting for review** or **Review required**. The banner means the material is public and retrievable, but nobody has yet confirmed it as correct and finished. This document is the checklist for removing a banner, and the list of places that change when you do.

## Where the banners are

| Learning path | Route | Banner | Page component |
|---|---|---|---|
| Git & collaboration | `/learn/git` | Review required | `app/git-learning-page.tsx` (also `status: "under-review"` in `content/git-learning/catalog.ts` and the "Review required" source label) |
| API & integration | `/learn/api` | Review required | `app/api-integration-page.tsx` |
| Generative AI & LLM | `/learn/llm` | Waiting for review | `app/llm-testing-page.tsx` |
| AI agents & MCP | `/learn/agentic` | Waiting for review | `app/agentic-learning-page.tsx` |
| Programming (Python, C#) | `/learn/programming` | Waiting for review | `app/programming-learning-page.tsx` (`showReviewBanner`) |
| SQL | `/learn/data` | Waiting for review | `app/data-learning-page.tsx` (`showReviewBanner`, the "Under review" source label and `status: "under-review"` in `content/data-learning/catalog.ts`) |
| Embedded & IoT | `/learn/embedded` | Waiting for review | `app/embedded-iot-page.tsx` |
| Performance & reliability | `/learn/performance` | Waiting for review | `app/performance-testing-page.tsx` |
| Cloud & DevOps | `/learn/cloud-devops` | Waiting for review | `app/cloud-devops-page.tsx` |

Review one path at a time. Git and API carry the stronger "Review required" label, so start there.

## Checklist for one learning path

Go through every published chapter in both languages.

**Correctness**
- Every factual claim agrees with the chapter's cited sources. Open the source registry under the chapter and spot-check the claims that matter most.
- Versions, dates and defaults are still current (tool versions, specification revisions, CLI flags, API names).
- Commands and code do what the text says. Runnable Python and SQL blocks run in the page and print the expected result.
- Nothing contradicts another chapter of the same path or the interview answers on the same topic.

**Completeness**
- The chapter covers what its description and navigation label promise.
- Prerequisites and "next" links point to published chapters, not placeholders.
- Diagrams, tables and examples are present where the text refers to them.

**Language**
- The English and Ukrainian versions say the same thing. Code blocks are identical in both.
- The Ukrainian text reads as natural technical Ukrainian, with English terms only where practitioners use them.
- No leftover drafting notes, "TODO", or text addressed to the author.

**Presentation**
- Each chapter opens and reads well on a phone: no horizontal scrolling outside tables and code blocks.
- Section deep links (`?topic=…&section=…`) open the right section.
- The page title and description in search results make sense for that chapter.

## Removing the banner

When a path passes the checklist:

1. Remove the `<style>{…BannerStyle}</style>` line (or the `showReviewBanner` condition) from its page component.
2. If the catalog has `status: "under-review"` or a custom `sourceStatusLabel` such as "Review required" or "Under review", change it to match the reviewed state.
3. Update `tests/learning-review-status.test.mjs`, which pins which pages show a banner, so it asserts that the reviewed page no longer shows one.
4. Run `npm run verify`, open the path in the browser in both languages, and ship it as its own pull request named after the path ("Mark Git learning path as reviewed").

Keep notes of anything you corrected during the review in that pull request, so the next review knows what changed.
