# Setup and first run

## Outcomes

Install a supported Docker environment, distinguish a working client from a running daemon, and run a service you can reach from the host. Use the official installation page for your OS rather than an unreviewed installation script.

## Choose the platform

| Host | Starting point | Important distinction |
| --- | --- | --- |
| Apple silicon Mac | Docker Desktop for Apple silicon | Prefer Linux ARM64 images; x86 images may require emulation |
| Intel Mac | Docker Desktop for Intel | Match the downloaded installer to the CPU |
| Windows | Docker Desktop with supported WSL 2 setup | Linux and Windows containers have different kernels and images |
| Linux | Docker Engine and Compose plugin | Follow the distribution-specific package instructions |

On a company laptop, use the approved installation and check applicable Desktop licensing. Engine, Desktop and a registry subscription are different products. Avoid hard-coding pricing or system requirements into a setup script; verify current official requirements.

## Verify client, server and plugins

```sh
docker version
docker info
docker compose version
docker buildx version
docker context ls
docker context show
```

`docker version` should show both Client and Server. Client-only output plus a connection error means that installing the CLI was not enough. Start Desktop or the Linux daemon and inspect the selected context. A context may target another machine; commands affect that daemon's containers, storage and ports.

## First short-lived container

```sh
docker run --rm hello-world
docker ps
docker ps -a
docker image ls
```

The greeting process exits successfully. With `--rm` its container disappears, so `docker ps` need not list anything. The image can still be listed locally. On restricted corporate networks, registry access may require an approved proxy and trusted CA configuration; do not disable TLS verification as a shortcut.

## First local service

```sh
docker run -d --name docker-course-web -p 127.0.0.1:18080:8000 python:3.13-slim python -m http.server 8000
curl --fail http://127.0.0.1:18080/
docker logs --tail 20 docker-course-web
docker stop docker-course-web
docker rm docker-course-web
```

Expected: an HTTP directory listing, then a stopped and removed container. The loopback binding makes the exercise local to the host. If port 18080 is occupied, choose another host port; leave the container port at 8000. Run the Python HTTP server only as a local exercise, without sensitive files.

## Permissions and troubleshooting

On Linux, membership in the `docker` group grants powerful control over the daemon, commonly equivalent to host root access. Rootless mode is a separate option with prerequisites and limitations. Do not fix socket permissions with `chmod 666`.

On Desktop, images and named volumes live in the Linux VM's managed storage. A missing Finder folder does not prove that the volume disappeared. On a remote context, `127.0.0.1` in a published-port binding refers to the remote host.

## Checkpoint and answer

**Question:** `docker --version` works, but `docker run hello-world` cannot connect. What should you inspect first?

**Answer:** Confirm the daemon is running, inspect `docker context show` and `docker context ls`, then check access to that endpoint. The CLI version proves only that the executable is installed. Reinstalling application dependencies cannot repair a daemon connection.

## Summary

Keep the client, daemon, context, architecture and published host port explicit. Continue when both a short process and a reachable local service work.

## Sources

- [Engine installation](https://docs.docker.com/engine/install/)
- [Mac installation](https://docs.docker.com/desktop/setup/install/mac-install/)
- [Windows installation](https://docs.docker.com/desktop/setup/install/windows-install/)
- [Contexts](https://docs.docker.com/engine/manage-resources/contexts/)
