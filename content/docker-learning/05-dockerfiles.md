# Writing Dockerfiles

## Outcomes

Build a small application image and explain every instruction. The examples refer to the [complete capstone files](https://github.com/sergiiiavt/gimme-job/tree/main/examples/docker-learning); check out the repository before running commands. A Dockerfile is a build input, not a shell script executed when the container starts.

## Context and file boundaries

In `docker build -f path/Dockerfile context-directory`, the last argument defines the build context. `COPY` reads from that context, not from an arbitrary path next to the Dockerfile. Prefer the smallest useful context. Use `.dockerignore` to exclude credentials, Git history, caches, local environments and generated output.

The capstone uses an allow-list: exclude everything, then include only `app.py`, `checks.py`, `Dockerfile` and `.dockerignore`. A `.gitignore` does not replace `.dockerignore`.

## Instruction semantics

| Instruction | Purpose and trap |
| --- | --- |
| `FROM` | Selects a base and starts a stage; base tags can move |
| `WORKDIR` | Sets the directory for later instructions and startup |
| `COPY` | Copies explicit build inputs into the image |
| `RUN` | Executes during build; does not become the startup command |
| `ARG` / `ENV` | Build input / environment default; neither is a secret store |
| `USER` | Sets the user for later build instructions and runtime |
| `EXPOSE` | Documents a container port; does not publish it |
| `CMD` / `ENTRYPOINT` | Default command / executable entry point; overrides differ |

Use `COPY` for ordinary files. Use `ADD` only when its additional behavior, such as extraction, is intentional.

## A minimal readable image

This teaching fragment expects an `app.py` serving port 8000 without writing into `/app`:

```dockerfile
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY app.py ./
USER 10001:10001
EXPOSE 8000
CMD ["python", "app.py"]
```

It is a fragment, not the full persistence example: the capstone Dockerfile additionally creates and assigns ownership of `/data`, includes the checker, and defines health checks. Numeric users can run without a username entry, but some applications require a home directory or account metadata.

## Build and run the complete example

From the repository root:

```sh
docker build -t gimmejob-docker-course:local examples/docker-learning
docker image inspect gimmejob-docker-course:local --format '{{.Config.User}}'
docker run --rm gimmejob-docker-course:local python -c "import os; print(os.getuid())"
```

Expect user `10001:10001` and UID 10001. The command after the image overrides its CMD. An image with an ENTRYPOINT may interpret those arguments differently; inspect the configuration before assuming an override launches a shell.

## Common mistakes

Copying the whole repository before installing dependencies invalidates expensive cache steps on every source change. Deleting secrets later leaves earlier layers exposed. Installing packages interactively inside a running container creates unreviewed changes that vanish on replacement. Shell-form startup can complicate signal handling.

For package installation, commit dependency locks and use the package manager's reproducible installation mode. Keep compilers and build credentials out of the final runtime image when possible.

## Checkpoint and answer

**Question:** The Dockerfile contains `EXPOSE 8000`, but the host cannot reach port 8000. What is missing?

**Answer:** EXPOSE is metadata. Publish an appropriate host mapping, such as `127.0.0.1:18080:8000`, and verify the application listens on the container interface. Binding the application only to its own loopback can also prevent access through a published port.

## Summary

Make context, inputs, user, writable paths and startup explicit. Next, optimize the build without weakening those boundaries.

## Sources

- [Dockerfile reference](https://docs.docker.com/reference/dockerfile/)
- [Build context](https://docs.docker.com/build/concepts/context/)
- [Build best practices](https://docs.docker.com/build/building/best-practices/)
