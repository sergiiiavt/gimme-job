# Prompting, productivity & testing

Two GH-300 domains of 10–15% each. For a QA engineer this is the most directly useful chapter.

## Prompt structure

GitHub teaches the **4 S's**:

- **Single:** one task per prompt.
- **Specific:** say exactly what you want, including constraints.
- **Short:** concise, without losing the specifics.
- **Surround:** give context, such as related files open and a descriptive comment.

## Zero-shot and few-shot

Zero-shot gives only the instruction. Few-shot adds one or more examples of the desired output, which fixes format and edge cases. For a parser, an input and output example in the comment does more than a longer description.

## Chat history and prompt files

Chat uses earlier turns as context, so start a new chat when the topic changes. Save prompts the team repeats as `.github/prompts/*.prompt.md` so everyone gets consistent results.

## Productivity uses

- Generate boilerplate, refactor, and write documentation.
- Explain unfamiliar code to reduce context switching.
- Generate sample and test data.
- Modernise legacy code, for example translating a module to a newer framework, then verify behaviour with tests.

## Testing with Copilot

- `/tests` generates unit tests for the selection; agent mode can add integration tests and run them.
- Ask for **edge cases from the specification first**, then a test for each. Generated tests otherwise mirror the code they read and assert its current behaviour, including bugs.
- Review every assertion: a green suite proves nothing if the expected values came from the implementation.
- Ask Copilot for security improvements and performance optimisations, then verify them like any other change.

## Worked example

Copilot-generated tests all pass and a known date-parsing bug still ships. The tests asserted what the code did, not what the spec required. Prompt: "List edge cases for this parser from the specification, then write one test per case with the expected output from the spec."
