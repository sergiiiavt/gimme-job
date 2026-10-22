# Security and the image supply chain

## Outcomes

Define a practical threat model, reduce container privileges, protect build and runtime credentials, and interpret scans and artifact attestations correctly.

## Isolation is layered

Containers share important host resources. An application bug, excessive capabilities, writable host mount or exposed daemon can change the security boundary. Choose stronger isolation for hostile workloads when the threat model demands it.

Running the application as non-root reduces privileges inside the container. Rootless Docker also runs the daemon without host root privileges. These are different controls; one does not imply the other. Neither removes all kernel or application vulnerabilities.

## Harden runtime configuration

The capstone demonstrates compatible controls:

```yaml
read_only: true
cap_drop: [ALL]
security_opt: ["no-new-privileges:true"]
mem_limit: 128m
pids_limit: 64
```

Its image declares UID/GID 10001, `/data` is a writable volume, and `/tmp` is tmpfs. Validate required writes and syscalls before applying controls to another application. Seccomp and host policies such as AppArmor/SELinux add restrictions; do not disable them globally to make a test pass.

## Protect the daemon boundary

Access to a rootful Docker daemon can allow host-level control. Mounting `/var/run/docker.sock` into a container is a major privilege grant, even if the application claims to be “just a dashboard”. A read-only bind of the socket does not turn the Docker API into a read-only API.

Avoid `--privileged`, broad host mounts and unauthenticated daemon TCP endpoints. Use reviewed, narrowly scoped automation and authenticated remote access. Restrict who can run code on self-hosted CI agents with daemon access.

## Scan and maintain dependencies

Scan both operating-system packages and application dependencies with an approved scanner. Consider severity, exploitability, reachability, available fixes and exceptions with owners/expiry. A scan is a snapshot against a changing advisory database, not proof of safety.

Keep runtime contents small enough to understand. Pin approved artifacts, rebuild for fixes, review base image provenance, and avoid downloading unverified installation scripts during builds. A minimal image can still contain a vulnerable application.

## SBOM, provenance and signing

| Evidence | Answers | Does not prove |
| --- | --- | --- |
| SBOM | Which components were recorded? | Absence of vulnerabilities |
| Provenance | What build process and inputs are asserted? | That the process was trustworthy |
| Signature | Was content signed by a trusted identity/key? | Correct behavior or harmless content |

BuildKit can emit SBOM and provenance attestations; registry/output support matters. Signature verification must constrain the expected signer identity and issuer or trusted key, and verify the intended digest. Merely finding some valid signature is insufficient. Consult current Cosign instructions for the chosen trust model rather than copying an unrestricted verification command.

## Checkpoint and answer

**Question:** The image is signed and has zero reported critical findings. Can it receive the host Docker socket safely?

**Answer:** Those facts do not justify that privilege. A trusted signature identifies a signer, and a scanner covers known detectable issues. Neither limits what code can do with the daemon. Assess the socket requirement separately and choose a narrower design when possible.

## Summary

Combine least privilege, protected credentials, dependency maintenance and explicit artifact trust. Test that hardening preserves the intended behavior and failure handling.

## Sources

- [Engine security](https://docs.docker.com/engine/security/)
- [Rootless mode](https://docs.docker.com/engine/security/rootless/)
- [Build secrets](https://docs.docker.com/build/building/secrets/)
- [Attestations](https://docs.docker.com/build/metadata/attestations/)
- [Cosign verification](https://docs.sigstore.dev/cosign/verifying/verify/)
