# Observability and troubleshooting

## Outcomes

Turn symptoms into testable hypotheses. Inspect process state, logs, health, networking, resources and storage before changing the system.

## A diagnostic sequence

From the capstone directory:

```sh
docker compose ps -a
docker compose logs --tail 100 api
docker compose ps -q api
docker stats --no-stream
docker system df
```

Use the API container ID from `ps -q` with `docker inspect CONTAINER_ID` to inspect state, mounts and health history. Do not publish full inspect output without checking for credentials. Record the symptom, start time, recent change, affected artifact and environment before restarting.

## Symptom-to-evidence map

| Symptom | First evidence | Likely classes of cause |
| --- | --- | --- |
| Exits immediately | Logs, command, exit status | Missing file, invalid config, completed one-shot job |
| Runs but unavailable | Health, listening address, DNS, ports | Wrong endpoint, startup race, failed dependency |
| Exit 137 | OOMKilled, events, host memory | SIGKILL, possibly memory pressure |
| Permission denied | User, mount target, ownership | UID mismatch, read-only path, host policy |
| Wrong executable format | Image platform, binary platform | ARM/x86 mismatch or invalid executable |
| Disk grows | Logs, images, build cache, volumes | Unbounded logs, retained builds, application data |

Treat the right-hand column as hypotheses. Confirm with evidence; do not equate an exit code with a single diagnosis.

## Logs, metrics and traces

Write application logs to stdout/stderr so the configured driver can collect them. Include timestamp, severity, request/correlation ID and useful context without credentials. Some drivers or configurations limit what `docker logs` can retrieve.

The default `json-file` driver needs rotation configuration to avoid unbounded growth. The capstone selects `local`. Resource metrics describe the container and host; application latency, errors and traces explain user-visible behavior. `docker stats` is a local snapshot, not a monitoring history.

## Resource limits and performance

Containers do not receive a private unlimited machine. Configure and validate memory, CPU and process limits. A CPU quota can throttle a busy service; memory pressure can terminate it. Desktop VM limits can constrain all containers even when the laptop has more physical RAM.

Inspect the application's working set and workload rather than guessing a production memory limit from this small capstone. Native Linux and Desktop bind mounts may have different performance. Emulation adds another variable when comparing laptop and server results.

## Minimal-image debugging

Start with tools already present: the capstone has Python, so use its DNS and HTTP libraries. Do not assume `bash`, `ps`, `curl` or a package manager exists in another runtime image. Prefer approved temporary diagnostic tools instead of installing packages into production containers interactively.

When a service is stopped, `exec` cannot inspect it. Read logs and metadata, inspect the image configuration, or reproduce its startup in an isolated environment with the same inputs.

## Checkpoint and answer

**Question:** The service works after every restart, then fails again hours later. Is adding more restarts a complete fix?

**Answer:** No. It may temporarily reset leaked memory, exhausted connections, full temporary storage or stale dependency state. Capture resource and application evidence across time, reproduce the trigger and fix the underlying cause. A restart policy can support recovery without being the diagnosis.

## Summary

Collect evidence before teardown. Separate application, container, daemon, VM and host failures, and keep enough history to explain recurring incidents.

## Sources

- [Resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)
- [Logging drivers](https://docs.docker.com/engine/logging/configure/)
- [Running containers](https://docs.docker.com/engine/containers/run/)
