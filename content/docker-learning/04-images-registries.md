# Images, registries and artifact identity

## Outcomes

Explain image layers, distinguish tags from digests, inspect the target platform, and move a tested artifact through a registry without exposing credentials.

## Filesystem layers and metadata

An image combines filesystem layers with configuration such as a default command, working directory and environment. Layers are reused across images when content matches. A running container adds a writable layer; changing it does not update the source image.

Deleting a secret in a later build layer does not remove it from an earlier layer. A smaller visible filesystem does not prove that historical layer content is absent. Exclude sensitive files before the build receives them.

## Names, tags and digests

| Reference | Meaning |
| --- | --- |
| `python:3.13-slim` | Repository plus a readable, mutable tag |
| `registry.example.com/team/api:release-42` | Fully qualified repository and tag |
| `repository@sha256:...` | Content-addressed manifest or image-index identity |

Tags can move. A digest identifies specific content, but an image index digest can point to multiple platform-specific manifests. Record the index and platform context when investigating differences between ARM64 and AMD64.

Digest pinning improves artifact identity; it does not install future security fixes. Schedule rebuilds and update approved digests with validation.

## Inspect a real image

```sh
docker pull python:3.13-slim
docker image inspect python:3.13-slim --format '{{json .RepoDigests}}'
docker image inspect python:3.13-slim --format '{{.Os}}/{{.Architecture}}'
docker image history python:3.13-slim
docker buildx imagetools inspect python:3.13-slim
```

Copy a complete digest from inspection when pinning; never copy the `sha256:...` abbreviation as an executable reference. History helps explain layers but does not replace source review or vulnerability analysis.

## Registry workflow

Build locally, run checks, assign an immutable release identity, authenticate to the intended registry, then push. Use a credential helper or CI secret input. `docker login --password-stdin` avoids placing a password directly in command arguments, but the upstream input must also avoid logs and shell history.

For your own registry, replace the example hostname and namespace before using these command shapes:

```sh
docker tag gimmejob-docker-course:local registry.example.com/team/docker-course:release-1
docker push registry.example.com/team/docker-course:release-1
```

The local capstone must be built first, and that example registry is a placeholder. A local tag does not publish anything. Registry permissions, network access and retention policies are independent concerns.

## Promotion and reproducibility

Promote the same tested digest rather than rebuilding separately for staging and production. Retain the Dockerfile revision, dependency locks, build parameters, platform and scan evidence. A moving base tag, unlocked dependency or downloaded script can change a rebuild from identical source.

Pull failures may mean wrong credentials, absent repository, missing platform, rate limits or network errors. Diagnose the actual response before substituting an unrelated public image.

## Checkpoint and answer

**Question:** Staging and production both use `api:latest`. Does this prove the same build is running?

**Answer:** No. The tag may have moved, hosts may have cached different images, and platform manifests may differ. Compare the deployed artifact digest and platform, then compare runtime configuration. A matching human-readable tag is insufficient.

## Summary

Use tags for convenient naming and digests for release identity. Keep credentials out of images, preserve evidence, and plan how pinned artifacts receive updates.

## Sources

- [Image layers](https://docs.docker.com/get-started/docker-concepts/building-images/understanding-image-layers/)
- [Pull by digest](https://docs.docker.com/reference/cli/docker/image/pull/)
- [Registry login](https://docs.docker.com/reference/cli/docker/login/)
- [OCI](https://opencontainers.org/about/overview/)
