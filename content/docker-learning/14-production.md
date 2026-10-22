# Production delivery and operations

## Outcomes

Design a controlled single-host release, identify its availability limits, and plan verification, backups and rollback. The capstone illustrates mechanisms; its unauthenticated standard-library HTTP server is a local exercise, not a production deployment template.

## Define the operating contract

List the public entry point, TLS termination, authentication, application image digest, runtime configuration, secrets, persistent data, resource budgets, owners and recovery objectives. Use a production-grade application server and an approved reverse proxy or managed ingress.

Expose only required ports. Keep databases private, protect SSH/remote daemon access and apply host security updates. Docker does not configure domain ownership, certificates, application authorization or off-host backups for you.

## Release sequence

| Step | Required evidence |
| --- | --- |
| Build and test | Exact source and artifact identity, successful gates |
| Prepare | Valid configuration, secrets available, storage and backup ready |
| Migrate | Compatible schema transition and recovery plan |
| Replace | Intended digest running with correct configuration |
| Verify | External request, readiness, key user operation and logs |
| Observe | Error rate, latency, resources and data correctness |

Do not rebuild production independently from the tested artifact. Use an approved registry reference and retain the previous release identity.

## Compose deployment shape

For a stack already configured with registry images, the command shape is:

```sh
docker compose -f compose.yaml -f compose.production.yaml config --quiet
docker compose -f compose.yaml -f compose.production.yaml pull
docker compose -f compose.yaml -f compose.production.yaml up -d --wait --wait-timeout 120
```

`compose.production.yaml` is a placeholder for your reviewed deployment override, not a file supplied by the capstone. It should select the release image, remove development mounts and apply deliberate runtime limits. Inspect the merged configuration before running it.

## Availability and restart behavior

Compose on one host can be appropriate for a small system with accepted recovery times. It does not automatically provide host failover or zero-downtime rolling updates. Replacing a sole application instance can interrupt requests.

Restart policies can help after process exits. They do not repair failed disks, a dead host, incompatible migrations or an unhealthy process that stays alive. Use external monitoring and documented recovery, then move to an orchestrator or managed platform when requirements justify it.

## Data, rollback and disaster recovery

Application rollback means selecting a previous artifact and compatible configuration. It does not reverse database migrations. Use backward-compatible expand/contract changes when practical, test both application versions against the transition, and plan destructive changes separately.

Rehearse restoring backups to a different host or volume. Include secrets and encryption-key recovery without storing them insecurely beside data. Define what happens if the server is permanently lost, not merely if a container restarts. Set log retention and disk alerts before disk exhaustion.

## Checkpoint and answer

**Question:** A new release changes a database column incompatibly. Can switching to the old image digest guarantee rollback?

**Answer:** No. The old application may be incompatible with the new schema or data. Recovery requires a compatible migration strategy or a tested restore/forward-fix plan, with explicit data-loss implications.

## Summary

Release an identified artifact, verify an actual user operation and prepare data recovery. Match platform complexity to availability and operational requirements.

## Sources

- [Compose in production](https://docs.docker.com/compose/how-tos/production/)
- [Restart policies](https://docs.docker.com/engine/containers/start-containers-automatically/)
- [Logging](https://docs.docker.com/engine/logging/configure/)
- [Volume backup and restore](https://docs.docker.com/engine/storage/volumes/)
