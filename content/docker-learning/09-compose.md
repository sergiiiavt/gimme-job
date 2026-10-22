# Docker Compose applications

## Outcomes

Describe an application with services, networks and volumes, validate its resolved configuration, wait for readiness, and run isolated test services. Use the current `docker compose` plugin syntax. The obsolete top-level `version` field is unnecessary in new Compose files.

## Application model

A service is a configuration for containers, not the same object as an image. Multiple services can use the same image with different commands. A project groups resources; service names provide internal addresses. Named volumes preserve data separately from container replacement.

In the capstone, `api` is long-running and `checks` is a short-lived process from the same image. The checker is behind a profile so ordinary startup does not launch tests.

## Read a minimal configuration

This is an explanatory excerpt from the full, hardened capstone configuration:

```yaml
services:
  api:
    build: .
    image: gimmejob-docker-course:local
    ports:
      - "127.0.0.1:18080:8000"
    volumes:
      - counter-data:/data
  checks:
    image: gimmejob-docker-course:local
    profiles: [checks]
    entrypoint: [python, checks.py]
    depends_on:
      api:
        condition: service_healthy
volumes:
  counter-data:
```

The image Dockerfile supplies the API health check. Without a health check on a dependency, `service_healthy` is not a valid readiness strategy. The full file also supplies the checker's API URL and disables the inherited API probe on the test-only service.

## Operate the stack

From `examples/docker-learning`:

```sh
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 90
docker compose ps
docker compose --profile checks run --rm --no-deps checks
docker compose logs --tail 50 api
docker compose down
```

`up` reconciles services and can replace changed containers; `start` only starts existing ones. `run` creates a one-off container; `exec` uses an existing running container. Here `--no-deps` is appropriate because `up --wait` already started and checked the API. Without that preparation, allow dependency startup.

## Dependencies and recovery

Short-form `depends_on` gives ordering, not application readiness. Use `service_healthy` for a health-gated dependency and `service_completed_successfully` for a successful one-shot prerequisite such as a migration.

Startup gating does not replace runtime retries. A database can fail after startup. Clients need bounded retries, timeouts and reconnection. A restart policy does not turn a single host into a highly available platform.

## Projects, profiles and overrides

Use a distinct project name with `-p` for parallel environments. Project naming isolates default networks and named volumes, but explicitly named resources and fixed host ports can still collide. Parameterize ports or avoid publication for internal CI tests.

Profiles enable optional tools; multiple `-f` files combine configuration. Merging has defined rules and is not simply replacing one YAML object with another. Always inspect `docker compose ... config` using the same files, environment and project inputs as deployment. Resolved output may contain secrets: do not publish it blindly.

## Checkpoint and answer

**Question:** The database starts before the API, but the API sometimes fails its first connection. Why?

**Answer:** Process start is not readiness. Add a meaningful database health check and a dependency health condition, then retain application reconnection for later failures. A fixed sleep only guesses at readiness.

## Summary

Treat Compose as an application model with explicit startup and state. Validate the actual merged model and preserve failure evidence before removing containers.

## Sources

- [Compose overview](https://docs.docker.com/compose/)
- [Startup order](https://docs.docker.com/compose/how-tos/startup-order/)
- [Compose specification](https://docs.docker.com/reference/compose-file/)
