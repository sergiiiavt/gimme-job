# Container testing and CI

## Outcomes

Use containers as test infrastructure without confusing containerization with test coverage. Separate application tests, image checks, integration tests and release gates.

## Verification layers

| Layer | Evidence |
| --- | --- |
| Application | Correct behavior, negative cases, concurrency and failure handling |
| Image | Correct files, user, architecture and startup command |
| Stack | DNS, readiness, mounts, permissions and service interaction |
| Release | Approved digest, scan policy, reproducible inputs and deployment smoke checks |

Unit tests can run without Docker. Integration tests should use the same database engine/version family and migration path as the intended system when those details affect behavior. A container does not remove test-data design or cleanup responsibilities.

## Run the capstone checks

From the repository root, test application behavior without Docker:

```sh
python3 -m unittest discover -s examples/docker-learning -p 'test_*.py' -v
```

Then, from the capstone directory:

```sh
docker compose up --build -d --wait --wait-timeout 90
docker compose --profile checks run --rm --no-deps checks
docker compose up -d --force-recreate --wait --wait-timeout 90 api
docker compose --profile checks run --rm --no-deps checks --require-existing
```

The first suite covers contracts, concurrent increments, storage failure, persistence after process replacement and graceful shutdown. The stack checks additionally exercise container DNS and persistence after container replacement. Successful `docker build` alone establishes neither.

## CI job design

A reliable pipeline checks out an exact revision, validates configuration, builds, starts dependencies with bounded readiness waits, executes tests, captures logs on failure, and cleans only its own resources. Preserve the original failure status when cleanup runs.

Use unique project names and avoid shared fixed ports in parallel jobs. Do not expose registry credentials or a powerful daemon socket to untrusted pull-request code. Publish only after checks succeed; record the digest used by the release. Use official build actions with reviewed versions, constrained permissions and appropriate cache access.

## Testcontainers and framework integration

Testcontainers lets tests start disposable dependencies and discover mapped endpoints. Language APIs and supported modules vary: use the official documentation for the chosen Python, Java, .NET or Node library. Wait for meaningful readiness, not a fixed sleep.

Pytest fixtures can own dependency lifecycle; Robot Framework can call a controlled setup library; Playwright can target an application URL from the stack. Keep application assertions in the chosen test framework rather than embedding the entire suite in shell scripts. Browser dependencies and system libraries still need compatible images.

## Failure evidence and flakiness

On failure, capture service logs, exit status, health history and resource state before teardown. Avoid retaining credentials or real customer records. Give timeouts diagnostic messages: image pull failure, readiness failure and failed assertion are different outcomes.

Cache speeds builds, not correctness. Reusing mutable database state between CI jobs can hide migration failures and create order-dependent tests. Reset or uniquely namespace fixtures while preserving only intentionally reusable caches.

## Checkpoint and answer

**Question:** A CI job reports success even though the test container exited nonzero. What should you inspect?

**Answer:** Inspect how the runner propagates that container's exit code. Starting detached containers or successfully running cleanup can mask a test failure. Use a one-off `compose run` whose exit status is checked, or an explicitly configured exit-code policy for the stack.

## Summary

Test behavior and packaging separately, preserve evidence and propagate failure. Containers make dependencies reproducible when inputs and lifecycle are controlled.

## Sources

- [Official Docker GitHub Actions](https://docs.docker.com/build/ci/github-actions/)
- [Compose reference](https://docs.docker.com/reference/compose-file/)
- [Testcontainers](https://testcontainers.com/)
