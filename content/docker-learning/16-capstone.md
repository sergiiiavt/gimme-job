# Capstone and command reference

## Outcomes

Prove that you can build, explain, run, test, replace and diagnose a complete application. This local exercise uses a Python API, SQLite volume and separate checker; it intentionally requires no cloud account, registry login or external application dependency.

## Files and behavior

Get the [repository example](https://github.com/sergiiiavt/gimme-job/tree/main/examples/docker-learning). If starting without a checkout:

```sh
git clone https://github.com/sergiiiavt/gimme-job.git
cd gimme-job/examples/docker-learning
```

| File | Purpose |
| --- | --- |
| `app.py` | HTTP API, transactional counter, health and graceful shutdown |
| `checks.py` | API assertions executed from another container |
| `Dockerfile` | Non-root image and health check |
| `.dockerignore` | Explicitly limited build inputs |
| `compose.yaml` | Services, loopback publication, volume and restrictions |
| `test_capstone.py` | Application tests without a Docker dependency |

`GET /health` checks a database read, `GET /counter` reads the value, and `POST /counter` increments it. Unknown GET/POST routes return JSON 404. The health probe does not mutate data or prove that every future write will succeed. The unauthenticated API and Python standard-library HTTP server are for local learning.

## Build, test and replace

From the example directory:

```sh
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 90
docker compose --profile checks run --rm --no-deps checks
curl --fail http://127.0.0.1:18080/counter
docker compose up -d --force-recreate --wait --wait-timeout 90 api
docker compose --profile checks run --rm --no-deps checks --require-existing
```

Both checker runs must exit 0. The second must find an existing nonzero counter after replacement. The first build needs access to the base-image registry. If the host port is occupied, choose another `DOCKER_COURSE_PORT`; the internal API address remains unchanged.

## Inspect the restrictions

```sh
docker compose exec api id
docker compose exec api python -c "from pathlib import Path; Path('/app/write-test').write_text('blocked')"
docker compose logs --tail 30 api
```

Expect UID 10001. The write into `/app` must fail because the root filesystem is read-only. API writes to `/data` should still work. Explain why dropping capabilities, enabling no-new-privileges, bounding processes and selecting a rotated logging driver are useful without claiming they prove complete security.

## Recovery exercise

Create a consistent SQLite backup using the storage chapter's commands. Read the copy, restore into a separate disposable environment with correct ownership, and verify the counter. Do not overwrite the original volume during the rehearsal.

Stop with `docker compose down`; start again and confirm the retained data. Use `down --volumes` only for an intentional reset of this exercise's data. Distinguish image removal, container removal and volume deletion in your explanation.

## Command reference

| Task | Command |
| --- | --- |
| Daemon and context | `docker info`, `docker context show` |
| Images and disk | `docker image ls`, `docker system df` |
| Resolved model | `docker compose config --quiet` |
| Start and wait | `docker compose up -d --wait` |
| State and logs | `docker compose ps -a`, `docker compose logs --tail 50 api` |
| Run a checker | `docker compose --profile checks run --rm --no-deps checks` |
| Replace API | `docker compose up -d --force-recreate --wait api` |
| Stop and remove stack | `docker compose down` |

The checker command assumes the API is already healthy. Verify context and project before any command that changes or removes resources.

## Completion checkpoint and answer

**Task:** Explain a failed readiness probe, prove that data survives replacement, identify the actual user and writable paths, then describe a safe release and rollback.

**Answer criteria:** Evidence includes health/log output, successful container-level checks before/after replacement, UID/mount inspection, an identified release artifact, tested recovery and schema compatibility. Add a real server, authentication, TLS, off-host backups and monitoring before adapting the design for public production use.

## Summary

You have completed the path when you can explain both a working run and its failure modes. Continue with the existing [Cloud & DevOps path](/learn/cloud-devops), [networking](/learn/networking) or [test automation](/learn/automation) according to the system you need to build or verify.

## Sources

- [Complete source](https://github.com/sergiiiavt/gimme-job/tree/main/examples/docker-learning)
- [Compose](https://docs.docker.com/compose/)
- [Volumes](https://docs.docker.com/engine/storage/volumes/)
- [Container execution](https://docs.docker.com/engine/containers/run/)
