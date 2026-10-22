# Storage, permissions and backups

## Outcomes

Select the correct storage type, explain why data survives or disappears, and distinguish a persistent volume from a tested backup.

## Storage choices

| Type | Useful for | Lifecycle and risk |
| --- | --- | --- |
| Container writable layer | Disposable working files | Removed with the container |
| Named volume | Application data managed by Docker | Survives container replacement; still depends on the host/storage system |
| Bind mount | Local source or explicitly managed host files | Depends on the daemon host's path and permissions |
| tmpfs | Temporary working data | Disappears on stop; memory-backed data may be written to swap |

Named volumes on Desktop are managed inside its Linux VM. Bind mounts refer to the daemon machine, not necessarily the machine running the CLI. Do not copy Docker's internal storage directories as an application backup strategy.

## A persistence experiment

```sh
docker volume create docker-course-data
docker run --rm --mount type=volume,src=docker-course-data,dst=/data python:3.13-slim python -c "from pathlib import Path; Path('/data/message').write_text('survives replacement')"
docker run --rm --mount type=volume,src=docker-course-data,dst=/data,readonly python:3.13-slim python -c "from pathlib import Path; print(Path('/data/message').read_text())"
docker volume inspect docker-course-data
```

Expect the second, newly created container to read the message. `--rm` removed the first container, not the named volume. When finished and only after deciding the exercise data is disposable, remove this specific volume with `docker volume rm docker-course-data`.

## Mounts hide existing paths

A bind mount over `/app` hides the image's `/app` content while mounted. A new empty volume may be initialized from files already present at the target path; an existing populated volume keeps its own content. Rebuilding the image does not overwrite an existing application's volume data.

This explains both missing dependencies under a development source mount and stale configuration inside reused volumes. Inspect mounts before blaming COPY.

## UID and writable directories

Linux permissions use numeric UID/GID. Running as UID 10001 requires writable data directories owned by or accessible to that identity. The capstone creates `/data` with the intended owner before a new volume is mounted. Existing volumes or arbitrary host bind mounts may have different ownership.

Avoid `chmod -R 777`. Identify the target path, container UID, host ownership, read-only settings and any SELinux policy. Change only the intended resource. A read-only root filesystem can coexist with explicitly writable volumes and tmpfs.

## Backup and restore workflow

A volume is persistence, not a backup. Define acceptable data loss (RPO) and restoration time (RTO), take a consistent application-aware backup, store it outside the same failure domain, and rehearse restoration to a different volume.

For the capstone's small SQLite database, use SQLite's backup API, then copy the completed backup out of the container:

```sh
docker compose exec api python -c "import sqlite3; source=sqlite3.connect('/data/counter.sqlite'); target=sqlite3.connect('/tmp/counter-backup.sqlite'); source.backup(target); target.close(); source.close()"
docker compose cp api:/tmp/counter-backup.sqlite ./counter-backup.sqlite
```

Run from `examples/docker-learning` after startup. Inspect the copied file with SQLite, restore into a separate test volume, and verify the counter through the API. Do not tar a live database directory and assume transaction consistency. Other databases require their own dump/snapshot procedures.

## Checkpoint and answer

**Question:** Is `docker compose down --volumes` equivalent to stopping the application?

**Answer:** No. `down` removes the stack's containers and networks; `--volumes` also removes declared non-external named volumes and attached anonymous volumes. It deliberately destroys this project's persisted data. Use it only when that data is expendable or recoverable.

## Summary

Document storage ownership, replacement behavior and recovery procedures. Test restoration, not merely the presence of backup files.

## Sources

- [Volumes](https://docs.docker.com/engine/storage/volumes/)
- [Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
- [tmpfs](https://docs.docker.com/engine/storage/tmpfs/)
