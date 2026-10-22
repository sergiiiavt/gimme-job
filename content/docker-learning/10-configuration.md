# Configuration, secrets and development

## Outcomes

Separate build inputs, Compose interpolation and container runtime configuration. Choose a development loop without baking credentials into artifacts.

## Three different input stages

| Stage | Example | When changes take effect |
| --- | --- | --- |
| Build | Base image, dependency lock, non-secret ARG | Rebuild and replace |
| Compose resolution | `${DOCKER_COURSE_PORT:-18080}` | Resolve configuration and replace affected containers |
| Runtime | `DB_PATH=/data/counter.sqlite` | Create a container with the new environment |

A `.env` file supplies Compose interpolation inputs; its values are not all automatically injected into every container. `environment` and `env_file` configure container environment. Shell variables, explicit options, files and image defaults have precedence rules: inspect the resolved result and test the actual container.

## A safe local configuration change

From the capstone directory:

```sh
DOCKER_COURSE_PORT=18082 docker compose config --quiet
DOCKER_COURSE_PORT=18082 docker compose up -d --wait
curl --fail http://127.0.0.1:18082/health
```

These are POSIX shell commands. The internal checker URL remains `http://api:8000`. `docker compose restart` alone does not apply a changed port publication or environment configuration.

## Runtime secret injection

An illustrative file-based secret definition:

```yaml
services:
  app:
    image: your-approved-image
    secrets: [database_password]
secrets:
  database_password:
    file: ./secrets/database_password.txt
```

Replace the image and create the file outside Git before use. The application must actually read `/run/secrets/database_password`; a `_FILE` variable works only if that image supports the convention. The capstone deliberately needs no password, so this fragment is not part of its stack.

## Secret lifecycle

Compose file injection is not a complete encrypted secret-management service. Protect the source file, backups, permissions and host access; rotate credentials and recreate or reload consumers correctly. Build secrets are a separate mechanism used during build steps.

Do not print full environments, authorization headers or resolved configuration into public CI artifacts. A leaked credential requires revocation/rotation, not merely deleting the visible file or rewriting one Dockerfile layer.

## Development workflow choices

| Approach | Benefit | Tradeoff |
| --- | --- | --- |
| Rebuild and replace | Closest to packaged runtime | Slower edit loop |
| Bind-mounted source | Immediate local file visibility | Can hide image files and expose host paths |
| Compose Watch | Sync/rebuild rules tied to file changes | Requires supported Compose and correct rules |
| Dev container | Consistent editor tools and environment | Development image may contain tools unsuitable for production |

For Watch, use sync for source changes and rebuild for dependency changes. Check the current feature requirements. The capstone keeps its release-like root filesystem read-only; use a separate development override when source synchronization needs writes. Do not weaken the release configuration silently to enable hot reload.

## Checkpoint and answer

**Question:** You add `API_TOKEN` to `.env`, but the application sees no token. What does that tell you?

**Answer:** Nothing proves that the token was injected. `.env` primarily provides interpolation. Declare the intended runtime input explicitly or use a supported file-secret mechanism, then verify without printing the credential itself.

## Summary

Identify where every value is consumed and when it changes. Keep development conveniences, production settings and credential storage explicit.

## Sources

- [Environment variables](https://docs.docker.com/compose/how-tos/environment-variables/)
- [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
- [Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/)
- [Development Containers](https://containers.dev/)
