# Real implementation: GimmeJob production deployment gates

> **CASE STUDY · GIMMEJOB** — This chapter traces the production delivery path used by the repository and explains why validation and deployment are intentionally separate.

## What we are building

GimmeJob uses two GitHub Actions workflows with different responsibilities:

```diagram
Pull request
    |
    v
PR CI
    +--> npm ci --ignore-scripts
    +--> npm run verify
    +--> SonarQube Cloud Quality Gate
    |
    +--> fail: PR cannot merge
    |
    +--> pass
            |
            v
      merge to main
            |
            v
Production deploy
    +--> npm ci --ignore-scripts
    +--> build actual main commit
    +--> apply D1 migrations
    +--> deploy Worker + runtime secrets once
    +--> lightweight production smoke checks
```

The important boundary is simple:

- **PR CI answers:** is this change acceptable to merge?
- **production deployment answers:** can this already-approved `main` revision be released successfully?

The deployment workflow therefore does not repeat lint, tests, coverage, Cloudflare dry-run validation, or Sonar analysis.

## Why the workflows are separate

The previous implementation used one workflow for pull requests and `main`. A merged change was validated on the PR and then the same quality suite ran again after merge before deployment. The deployment job also built the application again.

That produced repeated work without creating much additional evidence:

- lint and type checking ran twice;
- content and schema validation ran twice;
- tests and coverage ran twice;
- the Cloudflare dry run ran twice;
- Sonar analysis ran twice;
- the production artifact was built once in PR validation, once in post-merge validation, and once again for deployment.

The refactored design validates once at the merge boundary and rebuilds only what production actually needs: the final `main` commit.

## Repository map

| File | Responsibility |
| --- | --- |
| `.github/workflows/ci.yml` | pull-request validation and Sonar quality gate |
| `.github/workflows/deploy.yml` | serialized production deployment after `main` changes |
| `package.json` | canonical deterministic verification command |
| `scripts/deploy-cloudflare.mjs` | D1 preparation, migrations, generated Wrangler config, one Worker deployment |
| `sonar-project.properties` | Sonar source and coverage configuration |
| `drizzle/` and `db/schema.ts` | database schema and migration history |

## PR gate: canonical repository verification

The PR workflow installs from the committed lockfile:

```bash
npm ci --ignore-scripts
```

It then runs the repository's single deterministic quality contract:

```bash
npm run verify
```

That command already contains the detailed gates:

```text
lint
agent TypeScript check
content validators
asset validators
Drizzle generation drift check
production build
tests + LCOV coverage
Cloudflare deployment dry run
```

Keeping this logic in `package.json` avoids duplicating the same list in workflow YAML.

## PR gate: SonarQube Cloud

After deterministic verification succeeds, the workflow runs SonarQube Cloud and waits for the remote Quality Gate:

```text
-Dsonar.qualitygate.wait=true
-Dsonar.qualitygate.timeout=300
```

The PR is not considered acceptable until the server-side quality decision finishes successfully.

## Main protection is part of the design

Removing duplicate post-merge CI is safe only when `main` cannot be changed arbitrarily.

The companion GitHub repository rule should require:

1. changes to `main` through a pull request;
2. the `Validate` status check before merge;
3. the PR branch to be up to date with `main` before merge;
4. no direct force-push or branch deletion bypass.

For a solo-maintainer repository, the PR requirement does not need to require another human approval. The goal is to force the validated merge path, not to invent an unnecessary reviewer process.

The "branch must be up to date" rule matters because PR evidence must apply to the state that will actually be merged. If another PR changed `main` after a check passed, the stale PR should be revalidated against the new base before merge.

## Production build

After a validated PR reaches `main`, the deployment workflow performs a fresh build:

```bash
npm run build
```

This is intentional rather than duplicate CI. Pull-request checks can run against GitHub's PR merge reference; production must build the exact commit now present on `main`.

Reusing a PR artifact would require artifact retention, lookup, trust and commit-matching logic. For this repository, rebuilding is simpler and less error-prone.

## Production deployments are serialized

Production uses one concurrency group with:

```yaml
cancel-in-progress: false
```

A newer push therefore does not cancel a deployment that may already be applying migrations or publishing a Worker revision. Releases queue and complete in order instead.

Cancelling stale PR validation is useful. Cancelling an in-progress production mutation is not.

## D1 migration boundary

`scripts/deploy-cloudflare.mjs` refuses a real deployment outside GitHub Actions.

For production it:

1. validates required environment values;
2. resolves or creates `gimmejob-db`;
3. generates the production Wrangler configuration;
4. applies remote D1 migrations;
5. deploys the Worker.

```diagram
main build
    |
    v
resolve D1
    |
    v
apply migrations
    |
    +--> fail: stop
    |
    v
deploy Worker
```

Migration failure prevents the Worker release from continuing.

## Runtime secrets are deployed with the Worker

The deployment receives secret values from GitHub Actions, writes a temporary runner-local secrets file with restricted permissions, and passes it to Wrangler with the Worker deployment.

Conceptually:

```bash
wrangler deploy --config <generated-config> --secrets-file <temporary-secrets-file>
```

This matters because repeatedly running `wrangler secret put` after a code deployment creates additional Worker versions and deployments. Uploading the secrets with the code keeps one logical release as one Worker deployment.

Secrets not included in the temporary file remain managed by Cloudflare. The temporary file is removed in the deployment script's cleanup path and is never committed.

## Vacancy synchronization is not deployment

Vacancy collection is operational data work, not part of releasing application code.

The old deployment path refreshed the vacancy catalog after publishing the Worker. That created an undesirable dependency: a scraper or source failure could make an otherwise successful code deployment appear failed.

Vacancy synchronization now stays in its own scheduled workflow. Code deployment and data ingestion can therefore fail, retry and be monitored independently.

## Post-deployment smoke checks

The production workflow keeps smoke verification, but only for runtime health:

- the public site must respond successfully;
- `/api/health` must return its successful health payload.

Deployment smoke checks do not assert historical page copy such as individual learning-card labels. Those assertions belong in repository tests and content validators, where a copy change does not create a false infrastructure incident.

## What still runs only once

| Check | PR | Deploy |
| --- | --- | --- |
| lint | yes | no |
| type check | yes | no |
| content validation | yes | no |
| Drizzle drift check | yes | no |
| tests | yes | no |
| coverage | yes | no |
| Cloudflare dry run | yes | no |
| Sonar Quality Gate | yes | no |
| production build | yes | yes, exact `main` commit |
| D1 remote migrations | no | yes |
| real Worker deployment | no | yes |
| live smoke check | no | yes |

The repeated production build is the only deliberate overlap.

## Failure modes

| Failure | Where it should fail |
| --- | --- |
| ESLint violation | PR CI |
| agent TypeScript error | PR CI |
| malformed content | PR CI |
| missing generated migration | PR CI |
| failing automated test | PR CI |
| insufficient coverage / Sonar issue | PR CI |
| malformed Cloudflare artifact | PR CI dry run |
| stale PR after `main` changed | GitHub branch protection / required fresh check |
| missing production secret | deployment script |
| D1 migration failure | deployment script before Worker publish |
| Cloudflare deployment failure | deployment script |
| public runtime unavailable after release | production smoke check |
| vacancy source unavailable | vacancy-sync workflow, not code deployment |

A useful pipeline makes the location of failure meaningful.

## Reproduce this model

1. Put deterministic quality checks behind one canonical command.
2. Run that command on pull requests, not again after merge.
3. Add any credentialed remote quality service to the PR gate.
4. Protect the production branch so only validated, up-to-date PRs can merge.
5. Build the exact production commit in the deployment workflow.
6. Serialize production mutations and do not cancel them mid-run.
7. Keep migrations immediately before the application release when compatibility requires it.
8. Upload runtime secrets with the Worker release instead of creating multiple secret-only releases.
9. Keep data collection, scheduled jobs and other operational workflows independent from code deployment.
10. Use a small health-oriented post-deployment smoke test; keep regression assertions in the test suite.

## Summary

The optimized GimmeJob pipeline does less work while preserving the important evidence boundary:

```text
PR = prove quality once
main = release the proven change
production smoke = prove the release is alive
```

The goal is not to maximize the number of gates. It is to put each gate in the one place where it provides useful evidence.

## Sources

- [PR CI workflow](https://github.com/sergiiiavt/gimme-job/blob/main/.github/workflows/ci.yml)
- [Production deploy workflow](https://github.com/sergiiiavt/gimme-job/blob/main/.github/workflows/deploy.yml)
- [Cloudflare deployment implementation](https://github.com/sergiiiavt/gimme-job/blob/main/scripts/deploy-cloudflare.mjs)
- [GimmeJob SonarQube Cloud project](https://sonarcloud.io/summary/overall?id=sergiiiavt_gimme-job&branch=main)
- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 migrations documentation](https://developers.cloudflare.com/d1/reference/migrations/)
