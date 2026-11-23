# Hands-on lab: Copilot in the gimme-job repository

One lab, done in this repository, touches every GH-300 domain. Work on an `agent/*` branch and follow `AGENTS.md`.

## Step 1: Repository instructions

Read `.github/copilot-instructions.md` and confirm it points to `AGENTS.md` rather than duplicating rules. Ask Copilot Chat a question about repository policy and check that its answer reflects those instructions.

## Step 2: Path-specific test rules

Add a draft `.github/instructions/tests.instructions.md` with `applyTo: "tests/**"` that states the test-design rules from `AGENTS.md`. Ask Copilot to write a test and confirm it follows them. Decide with the team before committing it.

## Step 3: A reusable prompt file

Write `.github/prompts/catalog-validation-tests.prompt.md` that asks for edge cases from the catalog schema first, then one test per case. Run it from chat.

## Step 4: Agent mode

Use agent mode to add tests for an interview-catalog validator. Approve each terminal command, watch it read failures and retry, and review every assertion against the schema rather than the implementation.

## Step 5: Code review and CLI

Open a draft pull request and request Copilot code review; check that it applies the repository's standards. Then run one Copilot CLI session in the terminal to explain a script in `scripts/` and propose a small refactor.

## Step 6: Safeguards

In a test organization, or by reading the settings pages, find the content exclusion settings, the public-code filter, the feature policies and the audit log entries for Copilot. Note which ones your own plan exposes.
