# Beyond Docker: the container ecosystem

## Outcomes

Place related tools in the correct layer. Know which skills transfer and which operational responsibilities require a separate learning path.

## Standards, runtime and application model

| Layer | Examples | Main concern |
| --- | --- | --- |
| Artifact and runtime standards | OCI | Compatible formats and execution contracts |
| Runtime components | containerd, runc | Image/container lifecycle and process execution |
| Container engine and developer interface | Docker Engine, Podman | Local or remote container management |
| Application description | Compose | Services, configuration, networks and volumes |
| Cluster orchestration | Kubernetes, Swarm | Placement, reconciliation and multi-host operation |

Do not treat all these names as competing replacements. Docker can use containerd; Kubernetes can run OCI-compatible images through a suitable CRI runtime without Docker Engine being installed on nodes.

## Podman and alternative desktop environments

Podman provides container-management workflows and supports rootless operation. Many familiar commands have similar shapes, but networking, Compose integration, sockets, volumes and Desktop VM behavior must be tested. Compatibility is not universal identity.

Choose the environment supported by your team, operating system and CI. Validate Compose features, authentication, architecture, mounts and test-library integration before switching an existing project.

## What Kubernetes adds

Kubernetes manages desired state across a cluster. Learn Pods, Deployments, Services, configuration, secrets, readiness/liveness/startup probes, resource requests/limits, storage and rollout behavior. A Pod is the scheduling unit and can contain cooperating containers; it is not simply a renamed Docker image.

Compose files are not directly equivalent to Kubernetes objects. Stateful workloads require explicit storage and backup design. Cluster availability also depends on the control plane, network and storage implementation. Kubernetes introduces operational work; it is not a mandatory prerequisite for a small single-host application.

## Swarm and managed platforms

Swarm mode integrates multi-host service management into Docker Engine. Learn its service model, overlay networking, secrets, placement and updates if your actual runtime uses it. Do not assume all Compose attributes map unchanged to Swarm stack deployments.

Managed container platforms can handle scheduling and ingress, but differ in storage, networking, job lifetimes, scaling and secret interfaces. Choose against concrete requirements: stateless request serving, background work, durable state, GPU needs, regional constraints and operational ownership.

## A practical next-step decision

| Need | Sensible next investigation |
| --- | --- |
| Reproduce a local multi-service app | Compose and the capstone |
| Disposable test databases | Testcontainers and framework fixtures |
| Consistent editor/tooling environment | Development Containers |
| One small host with accepted downtime | Hardened Compose and recovery practice |
| Automated placement and recovery across hosts | Kubernetes, Swarm or a managed platform |

GPU containers, privileged device access and Windows containers are specialized extensions. They need compatible host drivers, supported runtimes and separate security analysis; adding a Dockerfile does not supply missing host capabilities.

## Checkpoint and answer

**Question:** A Kubernetes node uses containerd instead of Docker Engine. Must you rewrite the application because its image was built with Docker?

**Answer:** Usually the build tool is not the issue: compatible OCI images can run through the node runtime. Verify platform, image access and application requirements. Rewrite the deployment configuration to Kubernetes concepts rather than assuming Docker-specific host mounts or Compose semantics transfer unchanged.

## Summary

Transfer image, process, networking, storage and security knowledge. Learn orchestration when system requirements demand its additional capabilities and responsibilities.

## Sources

- [OCI](https://opencontainers.org/about/overview/)
- [containerd](https://containerd.io/)
- [Podman](https://podman.io/docs)
- [Kubernetes](https://kubernetes.io/docs/concepts/overview/)
- [Swarm](https://docs.docker.com/engine/swarm/)
