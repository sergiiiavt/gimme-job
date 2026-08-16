# Deployment gates: making automatic delivery conditional on evidence

## What you should understand after this chapter

A deployment gate is a condition that must pass before software is allowed to move to the next delivery stage. The purpose is not to add ceremony. The purpose is to convert engineering evidence into an automatic release decision.

By the end of this chapter you should be able to design a gate sequence, distinguish pull-request validation from production deployment, choose where fail-fast behavior matters, and explain why a deployment pipeline should stop when its evidence is incomplete or contradictory.

## The mental model

A useful pipeline is a sequence of increasingly expensive questions.

```diagram
Source change
    |
    v
Can dependencies be installed safely?
    |
    v
Does static validation pass?
    |
    v
Does the code type-check?
    |
    v
Is generated/schema content consistent?
    |
    v
Does the production build succeed?
    |
    v
Do automated tests and coverage pass?
    |
    v
Is the deployment artifact valid?
    |
    v
Does the external Quality Gate pass?
    |
    v
Is this event allowed to deploy?
    |
    v
Production deployment
```

Every arrow is conditional. A failed gate prevents later stages from treating bad or incomplete evidence as acceptable.

## What a gate is — and what it is not

A test command is not automatically a deployment gate. It becomes a gate when its exit status or result controls whether the delivery flow is allowed to continue.

Examples of gates include:

- lint errors must be zero;
- TypeScript compilation must succeed;
- generated migrations must match the committed schema;
- required content validators must pass;
- automated tests must pass;
- coverage must satisfy the chosen policy;
- static-analysis Quality Gate must be green;
- only an approved branch/event may execute production deployment.

A dashboard that reports a failure but does not affect delivery is **observability**, not a gate.

## Pull-request validation and production deployment are different decisions

Pull requests need evidence that a proposed change is safe to merge. A production deployment needs evidence that the exact revision being released satisfies the deployment policy.

A common model is:

```diagram
Pull request
    |
    +--> run validation gates
    |
    +--> NEVER deploy production

Merge / push to main
    |
    +--> run the same validation gates again
    |
    +--> if all pass, deploy production
```

Re-running gates after merge avoids assuming that the merge result is identical to the isolated pull-request head.

## Order gates from cheap feedback to expensive confidence

Pipeline order affects both speed and diagnostic quality.

A practical ordering principle is:

1. Configuration and dependency checks.
2. Fast static checks such as lint and type-checking.
3. Generated-artifact and content consistency checks.
4. Production build.
5. Automated tests and coverage.
6. Deployment-artifact validation.
7. External quality analysis.
8. Production deployment.

There are exceptions, but the general rule is to avoid spending minutes on expensive stages when a cheap deterministic check could already reject the change.

## Gate design should answer one explicit question

A strong gate has a narrow responsibility.

| Gate | Question |
| --- | --- |
| Lint | Does the source violate configured static rules? |
| Type-check | Does the program satisfy the type system? |
| Schema drift | Does generated database state match what was committed? |
| Content validator | Does structured learning/content data satisfy repository invariants? |
| Build | Can the production artifact be produced? |
| Test suite | Does automated behavioral evidence pass? |
| Coverage | Did the change exercise enough measurable source code for the chosen policy? |
| Artifact validation | Is the built artifact deployable in the target runtime? |
| Quality Gate | Does centralized static-analysis policy accept the revision? |
| Event condition | Is this workflow invocation allowed to modify production? |

When one step tries to answer too many unrelated questions, failures become harder to diagnose.

## External Quality Gates must be awaited

External analysis systems often work asynchronously. Triggering a scan is not equivalent to waiting for the policy decision.

```diagram
BAD
CI -> submit scan -> continue -> deploy
             |
             +--> Quality Gate fails later

GOOD
CI -> submit scan -> wait for result
                       |
                 pass / fail
                       |
                  deploy only on pass
```

If deployment depends on an external policy, the pipeline must wait for the final status and convert failure into a failing CI step.

## Deployment conditions are gates too

A production command should not rely on the operator remembering when it is safe to run.

The workflow itself should encode the policy. Examples include:

- deploy only on a push to `main`;
- do not deploy during pull-request validation;
- require protected environment approval;
- require a release tag;
- require a successful previous job.

The exact policy depends on the project. The important part is that it is explicit and version controlled.

## Database migrations need a deliberate place in the sequence

Database schema changes are not just another file copy. The application and schema have compatibility requirements.

A simplified sequence can be:

```diagram
validated application artifact
        |
        v
apply ordered DB migrations
        |
        v
publish new application revision
        |
        v
verify runtime
```

For larger systems you may need backward-compatible migrations, phased releases, or expand/migrate/contract patterns. Even in a small system, migration failure must stop application deployment.

## Prevention gates and recovery controls solve different problems

A deployment gate tries to prevent a known class of unacceptable change from reaching production. Rollback, canary releases, feature flags, backups, and incident response help after deployment or during runtime failure.

You need both categories.

```diagram
Before deployment                After / during deployment
-----------------                -------------------------
Lint                             Health checks
Type-check                       Rollback
Tests                            Feature flags
Coverage                         Backups
Quality Gate                     Monitoring / alerts
Artifact validation              Incident response
```

A green pipeline is evidence, not proof that production cannot fail.

## Designing a useful gate sequence

For each proposed gate, write down:

- what failure it detects;
- what command or external policy produces the result;
- whether the result is deterministic;
- whether it blocks merge, deployment, or both;
- how long it takes;
- who owns failures;
- whether a later gate already checks the same thing better;
- what evidence is still missing after it passes.

This prevents the pipeline from becoming a long list of tools without an understandable release policy.

## A practical review checklist

When reviewing CI/CD, ask:

- Can a pull request accidentally deploy production?
- Does every critical validation command fail the workflow when it fails?
- Are asynchronous external gates actually awaited?
- Are database changes validated before deployment?
- Is the production artifact validated against the target platform?
- Are deployment credentials available only in the stage that needs them?
- Can a skipped deployment be distinguished from a successful deployment?
- Is the gate order efficient and understandable?
- Is there a separate runtime verification or recovery strategy after deployment?

## Connection to the next chapter

The next chapter follows these ideas through the actual GimmeJob production workflow. It maps every gate in `.github/workflows/ci.yml`, explains why pull requests validate but do not deploy, shows how SonarQube Cloud is awaited as a real blocking Quality Gate, and then traces the production deploy script through D1 migrations and Cloudflare Workers.

## Summary

Deployment gates turn automated checks into release policy. A good pipeline orders evidence deliberately, stops on failure, distinguishes validation from deployment, waits for external decisions, and encodes production eligibility directly in workflow logic.

## Sources

- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)
- [GimmeJob CI workflow](https://github.com/sergiiiavt/gimme-job/blob/main/.github/workflows/ci.yml)
- [GimmeJob SonarQube Cloud project](https://sonarcloud.io/summary/overall?id=sergiiiavt_gimme-job&branch=main)
- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
