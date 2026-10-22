# Docker learning capstone

A dependency-free Python API, persistent SQLite counter, and a separate Compose test service. This is a local teaching example: Python's standard-library HTTP server and the unauthenticated counter are not a production service.

Prerequisites: Docker Engine/Desktop running with Linux containers, a current `docker compose` plugin supporting `up --wait`, and a terminal. Shell examples use POSIX syntax; use WSL on Windows.

From the repository root:

```sh
cd examples/docker-learning
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 90
docker compose --profile checks run --rm --no-deps checks
curl --fail http://127.0.0.1:18080/counter
docker compose up -d --force-recreate --wait --wait-timeout 90 api
docker compose --profile checks run --rm --no-deps checks --require-existing
docker compose down
```

Expected: checks exit 0, the first run increments the counter, and the second run proves that it survived container replacement. `down` preserves the named volume; `down --volumes` deliberately deletes this project's data. If port 18080 is occupied, set `DOCKER_COURSE_PORT` to another unused port before `up` and use it in curl. The internal URL stays `http://api:8000`.

Inspect the system:

```sh
docker compose ps
docker compose logs --tail 50 api
docker compose exec api id
docker compose exec api python -c "import socket; print(socket.gethostbyname('api'))"
docker compose exec api python -c "from pathlib import Path; Path('/app/write-test').write_text('blocked')"
```

The last command should fail because `/app` is read-only. UID is 10001. `/data` remains writable through the volume. The image intentionally uses a readable minor-version tag; before a real release, resolve and record an approved digest, rebuild for security updates, and test the replacement.

API: `GET /health` reads the database and reports 200 or 503; `GET /counter` reads; `POST /counter` increments atomically; unknown GET/POST routes return JSON 404. A read-only health check does not prove all future writes will succeed.

Run application checks without Docker (Python 3.11+):

```sh
python3 -m unittest discover -s examples/docker-learning -p 'test_*.py' -v
```

Run that command from the repository root. It covers HTTP contracts, graceful shutdown, persistence after replacing the process, concurrent increments, and storage failure. The repository CI separately builds and runs the actual Compose stack, including persistence after replacing the container.

Read the full bilingual learning path at [Docker & containers](https://gimme-job.com/learn/docker).
