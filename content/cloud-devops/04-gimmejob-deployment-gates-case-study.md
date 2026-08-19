# Real implementation: GimmeJob production deployment gates

> **CASE STUDY · GIMMEJOB** — This chapter traces the exact production delivery path used by the repository and shows how to reproduce the same gate model in another project.

## What we are building

GimmeJob separates pull-request validation from production deployment. Pull requests run the full quality gate. After merge, deployment starts independently from `main`, while a smaller code-quality job refreshes SonarQube Cloud's `main` baseline for future PR comparisons.

```diagram
Pull request -------------------------> Validate
                                         |
                                         +--> npm run verify
                                         +--> Sonar Quality Gate (wait)
                                         |
                                         +--> fail: cannot merge
                                         |
                                         +--> pass -> merge to main
                                                       |        |
                                                       v        v
                                              production      Sonar main
                                              deployment      refresh
                                                       |        |
                                                       |        +--> build
                                                       |        +--> coverage
                                                       |        +--> scan
                                                       |
                                                       +--> build exact main commit
                                                       +--> D1 migrations
                                                       +--> Worker + secrets
                                                       +--> production smoke
```

The workflow therefore has three decisions: **Is the PR technically acceptable?**, **Is Sonar's main baseline current?**, and **Can the already-approved `main` revision be released successfully?**

## Requirements and constraints

The production delivery flow is designed around several explicit requirements:

- every pull request must run the repository validation suite;
- pull requests must never deploy production;
- `main` must be protected so changes arrive through a validated PR;
- generated Drizzle migration metadata must match the committed schema;
- learning/interview content invariants must be validated as code;
- test coverage must be collected in LCOV form for Sonar analysis;
- the Cloudflare artifact must be checked before a real deployment;
- the SonarQube Cloud Quality Gate must finish successfully before a PR can merge;
- Sonar's `main` baseline must still be refreshed after merge, without gating deployment;
- production credentials must come from GitHub secrets and variables;
- D1 migrations must be applied before the new Worker revision is deployed;
- an in-progress production deployment must not be cancelled by a newer push.

## Repository map

| File | Responsibility | Learning point |
| --- | --- | --- |
| `.github/workflows/ci.yml` | PR validation, PR Sonar gate, lightweight `main` Sonar refresh | quality policy is separate from release mutation |
| `.github/workflows/deploy.yml` | serialized production deployment and smoke verification | release work has its own workflow boundary |
| `scripts/deploy-cloudflare.mjs` | deployment preconditions, D1 discovery/creation, migration, Worker + secret deployment | deployment itself is executable policy |
| `sonar-project.properties` | Sonar source/coverage configuration and exclusions | quality analysis must match the build/test model |
| `drizzle/` and `db/schema.ts` | database schema and migration history | schema drift is checked before deployment |
| `scripts/validate-*-content.mjs` | content-specific invariants | non-code production data can have gates too |

The workflows remain small enough to read end to end, which makes them useful teaching examples.

## Gate 1: dependency installation

The workflow checks out the full repository history and uses the pinned Node runtime expected by the project.

Dependencies are installed with:

```bash
npm ci --ignore-scripts
```

`npm ci` makes the install depend on the committed lockfile. `--ignore-scripts` avoids executing arbitrary package lifecycle scripts during dependency installation. The important learning point is that the dependency step is part of the trust boundary, not merely setup boilerplate.

## Gate 2: lint and agent type-check

Two fast source-level gates run early as part of `npm run verify`:

```bash
npm run lint
npm run check:agent
```

Lint catches configured static-rule violations. The agent type-check verifies the separately configured TypeScript surface used by the local agent code.

If either command exits non-zero, GitHub Actions stops the PR job and the revision cannot pass `Validate`.

## Gate 3: database schema drift

The canonical verification command regenerates Drizzle migration metadata and then asks Git whether generation changed committed schema/migration files.

```bash
npm run db:generate
git diff --exit-code -- db/schema.ts drizzle
```

This converts a common repository hygiene problem into a merge gate. If a developer changed the schema but forgot to commit the generated migration result, CI rejects the revision before it can reach `main`.

## Gate 4: structured content validation

GimmeJob contains large structured knowledge bases, so content correctness is treated as part of application correctness.

```bash
npm run check:content
```

That command runs validators for interview material, Python content, automation curriculum, QA fundamentals, and the Cloud & DevOps curriculum introduced by this change.

The important pattern is transferable: if production behavior depends on JSON, Markdown, configuration, fixtures, prompts, policies, or other structured content, encode the assumptions and run them as gates.

## Gate 5: production build

PR verification creates the real production artifact before running the later platform-specific checks.

```bash
npm run build
```

A successful development server is not sufficient evidence. The actual production build path must succeed because it can exercise different bundling, server/runtime, and asset behavior.

Production deliberately builds again after merge because it must deploy the exact commit that reached `main`, not a PR merge reference or an artifact whose commit provenance needs separate validation.

## Gate 6: automated tests and coverage

The repository then runs the test process that produces LCOV coverage:

```bash
npm run test:coverage
```

The output is used by SonarQube Cloud later in the PR job. This is an example of evidence flowing between gates: tests produce both pass/fail behavior and coverage data that another policy engine consumes.

After merge, the smaller Sonar-main refresh repeats only the build and coverage collection required for an accurate main-branch analysis. It does not rerun lint, content checks, schema-drift checks, or the Cloudflare dry run, and it does not gate deployment.

## Gate 7: Cloudflare deployment-artifact validation

Before a PR can merge, the repository executes its deployment script in dry-run mode through:

```bash
npm run check:cloudflare
```

The deploy script verifies that the production artifact exists, generates a temporary deployment configuration, attaches a dry-run D1 binding, creates a temporary non-production secrets file, and invokes Wrangler deploy with `--dry-run` and `--secrets-file`.

```diagram
Production build
      |
      v
check:cloudflare
      |
      +--> confirm dist/server artifact exists
      +--> create temporary Wrangler config
      +--> attach dry-run D1 binding
      +--> create temporary dummy secrets file
      +--> wrangler deploy --dry-run --secrets-file ...
      |
      v
Artifact and deploy arguments are structurally valid
```

This gate checks the actual target-platform packaging rather than assuming that a generic application build is enough.

The deployment CLI itself is operational repository tooling executed after Node's coverage collection has finished. It is therefore explicitly excluded from Sonar LCOV attribution, while the real Wrangler dry-run remains a hard PR gate.

## Gate 8: SonarQube Cloud Quality Gate

The PR Sonar step is configured with two critical arguments:

```text
-Dsonar.qualitygate.wait=true
-Dsonar.qualitygate.timeout=300
```

`wait=true` changes Sonar from a reporting-only integration into a real merge gate. The workflow does not simply upload analysis and continue. It waits for the server-side Quality Gate result.

```diagram
GitHub Actions
      |
      v
Submit PR Sonar analysis
      |
      v
Wait for server-side Quality Gate
      |
      +--> FAIL -> Validate fails -> PR cannot merge
      |
      +--> PASS -> PR is eligible to merge
```

Sonar's PR analysis compares against the most recently analyzed target branch, so `main` is still analyzed after merges. That `main` refresh is independent of deployment and does not wait on the quality gate because the PR already supplied the release decision.

## Gate 9: protected-main boundary

The optimized design depends on GitHub enforcing the merge path. `main` should require:

- a pull request before merging;
- the `Validate` status check;
- the branch to be up to date before merging;
- no ordinary direct-push bypass;
- no force pushes or branch deletion.

For the current solo-maintainer workflow, another human approval is not required. The purpose is to force changes through the validated PR path, not to create a reviewer ceremony.

This repository rule replaces the old assumption that a second full validation pass on a direct `main` push was the production safety boundary.

## Step 10: production workflow isolation

A push to `main` starts `.github/workflows/deploy.yml`. The production workflow does not depend on the Sonar-main refresh and does not repeat `npm run verify`.

It uses a dedicated concurrency group with:

```yaml
cancel-in-progress: false
```

This means a newer `main` revision queues behind an in-progress production release instead of cancelling a migration or Worker deployment halfway through.

## Step 11: prepare D1 and apply migrations

`scripts/deploy-cloudflare.mjs` refuses to perform a real production deployment unless it is running inside GitHub Actions.

It validates the required production environment, resolves or creates the `gimmejob-db` D1 database, generates the production Wrangler configuration, and applies remote migrations before publishing the new Worker revision.

```diagram
Validated main revision
      |
      v
Resolve production D1 database
      |
      +--> create database if absent
      |
      v
Generate production Wrangler config
      |
      v
Apply D1 migrations --remote
      |
      +--> failure -> stop deployment
      |
      v
Deploy Worker
```

Migration failure therefore prevents the application deployment from continuing.

## Step 12: deploy the Worker and runtime secrets

After migrations succeed, Wrangler publishes the production Worker and runtime secrets in one deployment:

```bash
wrangler deploy --config <generated-config> --secrets-file <temporary-secrets-file>
```

The temporary file contains required application secrets plus configured optional Google OAuth and OpenAI secrets. Existing Cloudflare secrets not present in the file are preserved by Wrangler. The temporary file is removed after the deployment attempt and is never committed.

This replaces the previous sequence of one code deploy followed by multiple `wrangler secret put` operations, each of which could create another Worker version/deployment.

Vacancy synchronization is also no longer part of this script. It remains a separate scheduled operational workflow, so a third-party vacancy-source failure cannot turn an otherwise successful code release red.

After deployment, the workflow checks only production health: the public site must respond successfully and `/api/health` must report success. Historical page-copy assertions belong in tests/content validators rather than deployment smoke checks.

## Reproduce it yourself

To reproduce this gate model in another repository:

1. Put the complete deterministic quality contract behind one canonical command.
2. Run that full contract on pull requests.
3. Wait for external quality services when their result is part of the merge decision.
4. Protect the production branch so only validated, up-to-date PRs can change it.
5. If an external service needs a current target-branch baseline, refresh only the data it requires after merge and keep that job independent of deployment.
6. Build the exact production commit in the deployment workflow.
7. Add a target-platform dry run to PR validation.
8. Inject production credentials only into the deployment workflow.
9. Make the deployment script validate that it is running in the intended environment.
10. Apply database migrations before publishing the application revision when your compatibility model requires that order.
11. Serialize production mutations rather than cancelling them in progress.
12. Upload code and runtime secrets together when the platform supports an atomic release path.
13. Keep scheduled data collection independent from code deployment.
14. Keep post-deployment smoke tests focused on runtime health.

The exact commands will differ, but the evidence flow should remain explicit.

## Verification

You can verify the design at four levels.

**Pull request behavior:** open a PR and confirm `Validate` runs while both production deployment and `Refresh Sonar main` are skipped.

**Gate behavior:** intentionally break one safe non-production condition on a branch, such as lint or a content invariant, and confirm `Validate` fails before the PR can merge.

**Main quality behavior:** after merge, confirm `Refresh Sonar main` runs build + coverage + Sonar analysis without rerunning the full verification suite and without blocking production deployment.

**Main deployment behavior:** confirm the production workflow builds the exact `main` revision, applies D1 migrations, performs one Worker deployment with the secrets file, and finishes with the public/health smoke checks.

For Sonar on a PR, the workflow log should show that the action waits for the Quality Gate result rather than ending immediately after analysis submission.

## Why these decisions

**Why keep the full validation on the PR only?** With protected `main` and a strict required check, that is the merge boundary where the result can still prevent bad code from entering production. Repeating the same full suite after merge adds cost without changing the merge decision.

**Why still analyze `main` in Sonar?** Pull-request analysis compares against the most recent target-branch analysis. Keeping `main` current preserves accurate future PR comparisons and the main-branch dashboard.

**Why run build + coverage again for the Sonar main refresh?** The coverage report is produced by CI and is not promoted automatically from a PR analysis. Reusing PR artifacts would require artifact provenance and commit-matching plumbing that is more complex than this small independent refresh.

**Why make content validation a gate?** The site ships knowledge-base data as part of the product. Broken taxonomy, missing source references, or malformed Markdown can be production defects even when TypeScript compiles.

**Why validate the Cloudflare artifact before merge?** Build success and target-platform deployability are different questions.

**Why keep deployment logic in a script instead of a long YAML block?** D1 discovery, temporary configuration generation, migration order, secrets-file construction, and platform invocation remain clearer as executable code than as deeply nested workflow shell fragments.

## Failure modes

| Failure | Gate that should catch it | Expected result |
| --- | --- | --- |
| ESLint violation | PR verification | `Validate` fails |
| Type error in agent code | PR verification | `Validate` fails |
| schema changed without committed generated migration | Drizzle drift check | `Validate` fails |
| malformed learning taxonomy | content validator | `Validate` fails |
| production bundling problem | PR build | `Validate` fails |
| failing test | PR test coverage step | `Validate` fails |
| malformed Cloudflare artifact/deploy args | dry-run artifact gate | `Validate` fails |
| Sonar PR Quality Gate red | awaited Sonar step | `Validate` fails; PR cannot merge |
| stale PR after another merge | protected-main strict check | branch must update and revalidate |
| Sonar main refresh failure | post-merge quality job | deployment remains independent; baseline refresh is red |
| missing required runtime secret | deployment script | production deployment fails before publish |
| D1 migration error | deployment script | Worker publish does not continue |
| Cloudflare deployment error | deployment script | production workflow fails |
| public runtime unavailable after release | production smoke | production workflow fails |
| vacancy source error | vacancy-sync workflow | code deployment is unaffected |

A useful pipeline makes the location of failure meaningful. The stage that rejects a revision should tell you which class of evidence is missing.

## Current boundaries and future extensions

The current production pipeline is automatic after a validated PR reaches protected `main`. It does **not** currently use a GitHub Environment manual approval as an additional production gate. That is a conscious description of the present implementation, not an omitted tutorial step.

The post-deployment verification is intentionally small: it confirms the public runtime and health endpoint rather than duplicating page-level regression tests. A future extension could add canary deployment or automatic rollback if the operational risk justifies the additional machinery.

## Summary

GimmeJob's delivery model now has separate evidence and mutation boundaries. Pull requests run the full source, schema, content, build, test, coverage, Cloudflare dry-run, and Sonar quality gates. Protected `main` is the handoff. After merge, a lightweight Sonar job refreshes the analysis baseline while the production workflow independently builds the exact revision, applies D1 migrations, publishes the Worker and secrets once, and verifies runtime health.

The practical lesson is that “automatic deployment” should not mean “repeat every check after merge.” It should mean **validate once at the enforced merge boundary, then keep production release work focused on the operations that can only happen in production**.

## Sources

- [Code-quality workflow](https://github.com/sergiiiavt/gimme-job/blob/main/.github/workflows/ci.yml)
- [Production deploy workflow](https://github.com/sergiiiavt/gimme-job/blob/main/.github/workflows/deploy.yml)
- [Cloudflare deployment implementation](https://github.com/sergiiiavt/gimme-job/blob/main/scripts/deploy-cloudflare.mjs)
- [GimmeJob SonarQube Cloud project](https://sonarcloud.io/summary/overall?id=sergiiiavt_gimme-job&branch=main)
- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 migrations documentation](https://developers.cloudflare.com/d1/reference/migrations/)
