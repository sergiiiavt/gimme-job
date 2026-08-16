# Real implementation: GimmeJob production deployment gates

> **CASE STUDY · GIMMEJOB** — This chapter traces the exact production delivery path used by the repository and shows how to reproduce the same gate model in another project.

## What we are building

GimmeJob uses one main GitHub Actions workflow for pull-request validation and production deployment. The same validation sequence runs for both pull requests and `main`, but the actual Cloudflare deployment step is conditionally enabled only for a push or manual workflow dispatch.

```diagram
Pull request -----------------------------+
                                           |
Push to main ------------------------------+--> validate job
                                           |       |
Manual workflow dispatch -----------------+       +--> npm ci --ignore-scripts
                                                   +--> lint
                                                   +--> agent type-check
                                                   +--> Drizzle schema drift check
                                                   +--> content validation
                                                   +--> Rewild asset validation
                                                   +--> production build
                                                   +--> tests + LCOV coverage
                                                   +--> Cloudflare artifact validation
                                                   +--> SonarQube Cloud scan + WAIT for Quality Gate
                                                           |
                                                           +--> fail: stop
                                                           |
                                                           +--> pass
                                                                  |
                                                                  v
                                          Is event push/workflow_dispatch?
                                                |            |
                                               no           yes
                                                |            |
                                         validation only     v
                                                     deploy Worker + D1
```

The workflow therefore has two decisions: **Is the revision technically acceptable?** and **Is this workflow invocation allowed to modify production?**

## Requirements and constraints

The production delivery flow is designed around several explicit requirements:

- every pull request must run the repository validation suite;
- pull requests must never deploy production;
- a push to `main` must pass the same validation before deployment;
- generated Drizzle migration metadata must match the committed schema;
- learning/interview content invariants must be validated as code;
- test coverage must be collected in LCOV form for Sonar analysis;
- the Cloudflare artifact must be checked before a real deployment;
- the SonarQube Cloud Quality Gate must finish successfully before deployment continues;
- production credentials must come from GitHub secrets and variables;
- D1 migrations must be applied before the new Worker revision is deployed.

## Repository map

| File | Responsibility | Learning point |
| --- | --- | --- |
| `.github/workflows/ci.yml` | event triggers, validation order, Sonar gate, deployment condition, secret injection | the delivery policy lives in version control |
| `scripts/deploy-cloudflare.mjs` | deployment preconditions, D1 discovery/creation, migration, Worker deployment, secret updates | deployment itself is also executable policy |
| `sonar-project.properties` | Sonar source/coverage configuration and exclusions | quality analysis must match the build/test model |
| `drizzle/` and `db/schema.ts` | database schema and migration history | schema drift is checked before deployment |
| `scripts/validate-*-content.mjs` | content-specific invariants | non-code production data can have gates too |

The workflow is small enough to read end to end, which makes it a useful teaching example.

## Gate 1: dependency installation

The workflow checks out the full repository history and uses the pinned Node runtime expected by the project.

Dependencies are installed with:

```bash
npm ci --ignore-scripts
```

`npm ci` makes the install depend on the committed lockfile. `--ignore-scripts` avoids executing arbitrary package lifecycle scripts during dependency installation. The important learning point is that the dependency step is part of the trust boundary, not merely setup boilerplate.

## Gate 2: lint and agent type-check

Two fast source-level gates run early:

```bash
npm run lint
npm run check:agent
```

Lint catches configured static-rule violations. The agent type-check verifies the separately configured TypeScript surface used by the local agent code.

If either command exits non-zero, GitHub Actions stops the job and no later deployment stage runs.

## Gate 3: database schema drift

The workflow regenerates Drizzle migration metadata and then asks Git whether generation changed committed schema/migration files.

```bash
npm run db:generate
git diff --exit-code -- db/schema.ts drizzle
```

This converts a common repository hygiene problem into a deployment gate. If a developer changed the schema but forgot to commit the generated migration result, CI rejects the revision before production.

## Gate 4: structured content validation

GimmeJob contains large structured knowledge bases, so content correctness is treated as part of application correctness.

```bash
npm run check:content
```

That command runs validators for interview material, Python content, automation curriculum, QA fundamentals, and the Cloud & DevOps curriculum introduced by this change.

The important pattern is transferable: if production behavior depends on JSON, Markdown, configuration, fixtures, prompts, policies, or other structured content, encode the assumptions and run them as gates.

## Gate 5: production build

The workflow creates the real production artifact before running the later platform-specific checks.

```bash
npm run build
```

A successful development server is not sufficient evidence. The actual production build path must succeed because it can exercise different bundling, server/runtime, and asset behavior.

## Gate 6: automated tests and coverage

The repository then runs the test process that produces LCOV coverage:

```bash
npm run test:coverage
```

The output is used by SonarQube Cloud later in the job. This is an example of evidence flowing between gates: tests produce both pass/fail behavior and coverage data that another policy engine consumes.

## Gate 7: Cloudflare deployment-artifact validation

Before using production Cloudflare credentials to publish the application, the repository executes its deployment script in dry-run mode through:

```bash
npm run check:cloudflare
```

The deploy script verifies that the production artifact exists, generates a temporary deployment configuration, attaches a dry-run D1 binding, and invokes Wrangler deploy with `--dry-run`.

```diagram
Production build
      |
      v
check:cloudflare
      |
      +--> confirm dist/server artifact exists
      +--> create temporary Wrangler config
      +--> attach dry-run D1 binding
      +--> wrangler deploy --dry-run
      |
      v
Artifact is structurally deployable
```

This gate checks the actual target-platform packaging rather than assuming that a generic application build is enough.

## Gate 8: SonarQube Cloud Quality Gate

The Sonar step is configured with two critical arguments:

```text
-Dsonar.qualitygate.wait=true
-Dsonar.qualitygate.timeout=300
```

`wait=true` changes Sonar from a reporting-only integration into a real deployment gate. The workflow does not simply upload analysis and continue. It waits for the server-side Quality Gate result.

```diagram
GitHub Actions
      |
      v
Submit Sonar analysis
      |
      v
Wait for server-side Quality Gate
      |
      +--> FAIL -> CI job fails -> no deploy
      |
      +--> PASS -> continue
```

This behavior is especially important because an asynchronous quality platform can otherwise report a red project after the application has already been deployed.

## Gate 9: production-event condition

Passing every technical gate still does not automatically mean “deploy.” The deployment step contains an explicit event condition:

```yaml
if: github.event_name == 'push' || github.event_name == 'workflow_dispatch'
```

For this workflow, a pull request therefore reaches the end of validation and stops. A push to `main` or a manual dispatch is eligible to execute the production step.

This is a deployment gate even though it is not a test.

## Step 10: validate deployment secrets

The production step receives its credentials from GitHub secrets and configuration from repository variables.

Before invoking the deploy implementation, the shell wrapper checks for the core required secrets. If they are not configured, the current workflow deliberately logs a notice and exits the deployment step successfully rather than attempting a partial Cloudflare deployment.

That behavior should be read as an explicit project policy. In another project you might choose to fail instead. The key lesson is that missing production configuration must have intentional semantics.

## Step 11: prepare D1 and apply migrations

`scripts/deploy-cloudflare.mjs` refuses to perform a real production deployment unless it is running inside GitHub Actions.

It then resolves or creates the `gimmejob-db` D1 database, generates the production Wrangler configuration, and applies remote migrations before publishing the new Worker revision.

```diagram
Validated revision
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

After migrations succeed, Wrangler deploy publishes the production Worker.

The deploy script then writes application secrets such as the application password, Grafana read token, n8n ingest token, optional Google OAuth credentials, and optional OpenAI credentials using Wrangler's secret interface.

The repository contains the **names and validation rules** for secrets, while GitHub contains the actual production values.

## Reproduce it yourself

To reproduce this gate model in another repository:

1. Configure one workflow for both pull requests and the protected production branch.
2. Put cheap deterministic checks first: dependency policy, lint, and type-checking.
3. Add generated-artifact drift checks for anything developers can forget to commit.
4. Add validators for structured production content, not only source code.
5. Build the exact production artifact in CI.
6. Run automated tests and export coverage in the format required by your quality platform.
7. Add a target-platform dry run before a real deployment.
8. Configure external analysis so CI waits for its final pass/fail decision.
9. Encode the production-event condition directly in workflow YAML.
10. Inject production credentials only into the deployment step.
11. Make the deployment script validate that it is running in the intended environment.
12. Apply database migrations before publishing the application revision when your compatibility model requires that order.
13. Fail immediately when a migration or deployment command fails.
14. Add post-deployment health verification if your runtime requires stronger confirmation than the platform deployment response.

The exact commands will differ, but the evidence flow should remain explicit.

## Verification

You can verify the design at three levels.

**Pull request behavior:** open a PR and confirm the validation job runs while the Cloudflare deployment step is skipped.

**Gate behavior:** intentionally break one safe non-production condition on a branch, such as lint or a content invariant, and confirm the job fails before reaching deployment eligibility.

**Main deployment behavior:** after merging an acceptable revision, confirm the `main` workflow passes every gate before the deployment step starts.

For Sonar specifically, the workflow log should show that the action waits for the Quality Gate result rather than ending immediately after analysis submission.

For the production deploy, the execution order should show D1 migrations before the Worker publish command.

## Why these decisions

**Why one validation job?** The current repository is small enough that a linear job is easy to understand and guarantees ordering without cross-job artifact complexity.

**Why run validation again on `main` after PR checks?** The merge result is the production candidate. Revalidating it avoids treating earlier PR evidence as automatically valid for a different commit SHA.

**Why make content validation a gate?** The site ships knowledge-base data as part of the product. Broken taxonomy, missing source references, or malformed Markdown can be production defects even when TypeScript compiles.

**Why wait for Sonar?** A Quality Gate only protects deployment when its final result controls the workflow.

**Why validate the Cloudflare artifact before deployment?** Build success and target-platform deployability are different questions.

**Why keep deployment logic in a script instead of a long YAML block?** Complex sequencing, validation, D1 discovery, temporary configuration generation, and secret updates are easier to test and reason about as executable application code than as deeply nested workflow shell fragments.

## Failure modes

| Failure | Gate that should catch it | Expected result |
| --- | --- | --- |
| ESLint violation | lint | job stops before build |
| Type error in agent code | type-check | job stops before build |
| schema changed without committed generated migration | Drizzle drift check | `git diff --exit-code` fails |
| malformed learning taxonomy | content validator | content gate fails |
| production bundling problem | build | no test/deploy stage proceeds |
| failing test | test coverage step | no artifact/Sonar/deploy continuation |
| malformed Cloudflare artifact | dry-run artifact gate | no production Wrangler deploy |
| Sonar Quality Gate red | awaited Sonar step | CI fails and deployment is blocked |
| PR event | deployment event condition | validation succeeds, deploy is skipped |
| D1 migration error | deployment script | Worker publish does not continue |
| missing required runtime secret | deployment precondition | deployment follows the workflow's explicit missing-secret policy |

A useful pipeline makes the location of failure meaningful. The stage that rejects a revision should tell you which class of evidence is missing.

## Current boundaries and future extensions

The current production pipeline is automatic after a successful `main` validation. It does **not** currently use a GitHub Environment manual approval as an additional production gate. That is a conscious description of the present implementation, not an omitted tutorial step.

The workflow also focuses mainly on pre-deployment evidence. A future extension could add a dedicated post-deployment synthetic health check, deployment environment approvals, canary strategy, or automatic rollback. Those would complement the existing gates rather than replace them.

## Summary

GimmeJob's production deployment is a chain of explicit evidence. Pull requests and `main` both pass source, schema, content, build, test, coverage, target-platform, and Sonar gates. Only eligible events may enter the production step. The deploy script then prepares D1, applies migrations, publishes the Worker, and writes runtime secrets.

The practical lesson is that “automatic deployment” should never mean “deploy immediately after push.” It should mean **automatically deploy when the repository can prove that the configured release policy has been satisfied**.

## Sources

- [CI and Cloudflare deploy workflow](https://github.com/sergiiiavt/gimme-job/blob/main/.github/workflows/ci.yml)
- [Cloudflare deployment implementation](https://github.com/sergiiiavt/gimme-job/blob/main/scripts/deploy-cloudflare.mjs)
- [GimmeJob SonarQube Cloud project](https://sonarcloud.io/summary/overall?id=sergiiiavt_gimme-job&branch=main)
- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 migrations documentation](https://developers.cloudflare.com/d1/reference/migrations/)
