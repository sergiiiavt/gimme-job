# Docker: foundations and learning sequence

## Outcomes and prerequisites

Learn to package an application, explain its isolation boundaries, and reproduce the same environment. You need basic terminal commands, files and permissions, HTTP ports, Git, and the idea of a process. You do not need Kubernetes first. Examples use Linux containers and POSIX shell syntax; on Windows use WSL for shell examples.

Follow chapters 1–5 for first principles, 6–10 for complete applications, 11–14 for verification and operations, then the ecosystem and capstone. Move on when you can explain the checkpoint, not after memorizing a command list.

## What a container actually is

A container runs one or more processes with an isolated view of resources. Linux namespaces separate views of processes, mounts, networks and other resources; control groups account for and limit resources. The process still uses a kernel. A container is not a complete virtual machine and is not automatically a strong boundary for hostile code.

On native Linux, Linux containers usually share the host kernel. Docker Desktop runs Linux containers through a Linux virtual machine on macOS and Windows. A Linux image does not acquire the macOS kernel or turn into a native Windows executable.

## Vocabulary and responsibilities

| Component | Responsibility |
| --- | --- |
| Dockerfile | Instructions used to build an image |
| Image | Filesystem layers and runtime defaults |
| Container | A created instance with configuration and writable state |
| Registry | Stores and distributes image manifests and blobs |
| Docker CLI | Sends requests to a selected daemon |
| Docker Engine | Creates and manages container resources |
| BuildKit / Buildx | Build execution / CLI interface to builders |
| Compose | Describes services, networks and volumes for an application |

Docker commonly uses containerd and a low-level runtime such as runc beneath Engine. OCI defines interoperable image, runtime and distribution specifications. These layers explain why an image can be built by one tool and run by another compatible platform.

## What Docker solves and leaves to you

Packaging dependencies reduces environment drift. It does not freeze remote APIs, database contents, host architecture or secrets. Identical images can behave differently with different environment variables, mounts and resource limits.

Keep durable application data outside the disposable container layer. Keep credentials outside the image. Build once and promote the tested artifact between environments, supplying environment-specific configuration at runtime.

## A first experiment

After completing setup, run:

```sh
docker run --rm python:3.13-slim python -c "import platform; print(platform.system(), platform.machine())"
```

Expect Linux and the selected image architecture, including on a Mac. The command can download an image, runs a process, prints output and removes the container after exit. The downloaded image remains. A first run needs registry access; later runs can reuse local content.

## Common mistakes

- Treating an image as a running service: an image has no live process.
- Assuming isolation guarantees security: host access, capabilities and the socket change the risk.
- Expecting a container to keep running after its main process exits.
- Using containers for all workloads without considering native tooling or managed services.

## Checkpoint and answer

**Question:** Two containers use the same image. One loses uploaded files after replacement; the other preserves them. Why?

**Answer:** The image specifies initial files. Persistence depends on runtime storage. Files in the disposable writable layer disappear with that container; a correctly mounted persistent volume survives replacement. The image name alone does not describe the deployed system.

## Summary

Understand the process, image, runtime configuration and storage as separate concerns. Next, verify the actual Docker daemon and the platform that will run your commands.

## Sources

- [Docker concepts](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/)
- [Engine security](https://docs.docker.com/engine/security/)
- [OCI specifications](https://opencontainers.org/about/overview/)
