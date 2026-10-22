# BuildKit, caching and platforms

## Outcomes

Separate build tooling from runtime dependencies, reason about cache invalidation, protect build secrets, and understand why ARM64 and AMD64 builds differ.

## Cache is an optimization

BuildKit reuses matching build work. Put stable, expensive dependency steps before frequently changing application files. For Python or Node projects, copy the committed dependency files first, install from those files, and only then copy application source.

A cache hit does not prove security freshness. `--no-cache` skips build cache but does not by itself guarantee a fresh base image; `--pull` requests newer base metadata. Reproducibility requires explicit input versions as well as controlled caches.

## Multi-stage builds

This self-contained example creates a tiny site in one stage and copies only its artifact into the runtime:

```dockerfile
FROM python:3.13-slim AS build
WORKDIR /build
RUN mkdir /out && python -c "from pathlib import Path; Path('/out/index.html').write_text('<h1>Built artifact</h1>')"

FROM nginx:stable-alpine AS runtime
COPY --from=build /out/ /usr/share/nginx/html/
```

Save it as Dockerfile in an empty exercise directory. Build with `docker build -t docker-course-site .`, then run with `docker run --rm -p 127.0.0.1:18081:80 docker-course-site`. Expect a page saying “Built artifact”. This example teaches stage boundaries; the standard nginx image is not an example of the capstone's non-root hardening.

## Cache mounts and build secrets

A cache mount can preserve package download cache across builds without copying it into the final image. A secret mount makes a credential available during a selected build step. Neither mechanism prevents your own command from printing or copying sensitive content.

Illustrative private-dependency shape, requiring your own dependency files and approved package configuration:

```dockerfile
RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=secret,id=pip_config,target=/etc/pip.conf \
    python -m pip install -r requirements.txt
```

Supply the secret through `docker build --secret id=pip_config,src=private-pip.conf ...`. Do not pass credentials through ARG or ENV, and exclude the secret file from the context.

## Multi-platform images

An Apple silicon laptop commonly uses `linux/arm64`; many servers use `linux/amd64`. A multi-platform image index selects a suitable manifest. Compiled extensions and external binaries must support the target platform, not just the language interpreter.

Inspect before forcing emulation:

```sh
docker buildx ls
docker buildx imagetools inspect python:3.13-slim
```

Multi-platform builds can use emulation, native builders or cross-compilation. Emulation can be slower and hide platform-sensitive defects. A build for `linux/amd64` on ARM does not replace tests on the intended runtime.

## Output and failure modes

For a compatible builder, `--load` imports a single-platform build into the local image store. `--push` publishes output to a registry. Do not assume every Buildx driver loads successful builds into `docker image ls`. Multi-platform local loading depends on the image store and builder support; inspect the current setup.

Typical failures: unavailable architecture, native wheels missing, hard-coded x86 downloads, stale package cache, or copying build tools into the final stage. Diagnose the failing step and target platform.

## Checkpoint and answer

**Question:** A successful Buildx build is missing from `docker image ls`. Did it fail silently?

**Answer:** Not necessarily. The output may remain in the builder cache or be pushed remotely. Check the builder driver and output options. Use the appropriate `--load` or `--push` mode deliberately.

## Summary

Optimize repeated work, preserve explicit inputs, and test the artifact on its target platform. Cache, credentials and runtime contents have separate lifecycles.

## Sources

- [Cache optimization](https://docs.docker.com/build/cache/optimize/)
- [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Build secrets](https://docs.docker.com/build/building/secrets/)
- [Multi-platform builds](https://docs.docker.com/build/building/multi-platform/)
