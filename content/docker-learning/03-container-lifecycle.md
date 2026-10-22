# Container lifecycle and processes

## Outcomes

Create, start, inspect and remove containers without confusing them with images. Explain exit codes, signals, PID 1, health status and restart policies.

## State and command model

| Command | Effect |
| --- | --- |
| `docker run` | Creates a new container and starts it |
| `docker start` | Starts an existing stopped container with its saved configuration |
| `docker stop` | Sends the configured stop signal, then force-kills after the timeout |
| `docker restart` | Stops and starts the existing container |
| `docker rm` | Removes the container and its writable layer |
| `docker exec` | Starts an additional process inside a running container |

A changed environment variable in your shell does not reconfigure an existing container. Recreate it with the intended inputs. Restarting is not rebuilding, and rebuilding is not replacing a running container.

## Inspect before changing anything

```sh
docker run -d --name lifecycle-demo python:3.13-slim python -m http.server 8000
docker ps -a
docker inspect --format '{{json .State}}' lifecycle-demo
docker top lifecycle-demo
docker logs --tail 30 lifecycle-demo
docker exec lifecycle-demo python -c "import os; print(os.getpid())"
docker stop --timeout 10 lifecycle-demo
docker inspect --format '{{.State.ExitCode}}' lifecycle-demo
docker rm lifecycle-demo
```

`exec` needs a running container and an executable present in the image. Minimal images may have neither `bash` nor `curl`. An additional `exec` process is not the service's original process.

## PID 1 and graceful shutdown

Docker observes the container's main process. Exec-form `CMD ["python", "app.py"]` avoids inserting an unnecessary shell. A shell wrapper should use `exec` when handing off to the application so signals reach it. Applications must handle shutdown and finish or cancel work within the allowed time.

An init process, enabled with `--init` or Compose `init: true`, helps forward signals and reap orphaned children. It does not add correct transaction handling to the application. Verify shutdown by sending SIGTERM and checking completion, exit status and durable data.

## Running, healthy and ready

Running means the main process has not exited. A Docker health check is an additional command with success/failure state. Readiness should reflect whether the service can serve the intended operation; a process can be running while its database is unavailable.

An unhealthy status by itself does not cause Docker Engine to restart a standalone container. A restart policy responds to process exits according to that policy. Compose dependency health conditions govern startup ordering; they do not continuously repair all dependent services.

## Exit codes and cleanup

Exit 0 normally indicates successful process completion; nonzero means a failure according to that program. Code 137 can result from SIGKILL, including OOM termination, but is not sufficient evidence of OOM. Check `.State.OOMKilled`, daemon events and host metrics.

Remove the exercise container by name. Broad prune commands affect other projects sharing the daemon. Inspect `docker system df` and resource ownership before cleanup; do not use global deletion as routine troubleshooting.

## Checkpoint and answer

**Question:** A container is unhealthy, has `restart: unless-stopped`, and keeps running. Is the restart policy broken?

**Answer:** No. The main process has not exited. Health state and the restart trigger are separate. Diagnose the failed probe and application behavior; decide whether the application should exit, recover internally, or be managed by an orchestrator.

## Summary

Read state and logs before restarting. Use replacement for configuration changes and test graceful shutdown explicitly.

## Sources

- [Running containers](https://docs.docker.com/engine/containers/run/)
- [Dockerfile startup and health semantics](https://docs.docker.com/reference/dockerfile/)
- [Restart policies](https://docs.docker.com/engine/containers/start-containers-automatically/)
