# Container networking

## Outcomes

Trace a request across host and container boundaries. Choose the correct DNS name and port, keep private services private, and diagnose connectivity layer by layer.

## Addressing model

| Caller | Destination in the capstone |
| --- | --- |
| Browser or curl on host | `http://127.0.0.1:18080` |
| Compose checker container | `http://api:8000` |
| API checking itself | `http://127.0.0.1:8000/health` |

Inside a normal isolated container, localhost refers to that container's network namespace. It is not the laptop and not a neighboring database. User-defined bridge networks provide name resolution; Compose creates such an application network and service DNS names by default.

## Publication and exposure

`-p 127.0.0.1:18080:8000` maps host loopback port 18080 to container port 8000. Omitting the host address commonly binds on all host interfaces. `EXPOSE` and Compose `expose` do not create host port publications and are not access-control policies.

Services on the same Docker network can communicate on listening container ports without publishing them. Do not publish a database merely to let the API reach it. Use separate networks and application authentication for intentional boundaries.

## Working example

Start the capstone from its directory, then inspect from both sides:

```sh
docker compose up --build -d --wait
curl --fail http://127.0.0.1:18080/health
docker compose exec api python -c "import socket; print(socket.gethostbyname('api'))"
docker compose --profile checks run --rm --no-deps checks
```

The checker reaches `api:8000` over the application network. Changing only the published host port does not require changing that internal URL. Avoid hard-coding container IPs: replacement can change them while the service name remains the intended address.

## Host access and platform differences

Docker Desktop provides `host.docker.internal` for reaching host services. Native Linux configurations can add a host-gateway mapping when supported; do not assume Desktop names work everywhere. The host service must listen on an interface reachable from the container and allow the connection.

Host networking removes ordinary network isolation and has platform/version constraints. It is not a generic repair for DNS problems. Overlay networking is for multi-host scenarios; macvlan/ipvlan address specialized network integration needs.

## Proxies, DNS and TLS

Separate image-pull traffic, build-step traffic and application runtime traffic: proxy configuration for one does not necessarily configure the others. Corporate CAs may need trusted installation at multiple boundaries. A TLS validation failure is different from DNS failure or TCP refusal.

A reverse proxy accepts public traffic and forwards it to the application. TLS termination, authentication, forwarded headers and timeouts still need deliberate configuration. An `internal` network limits external connectivity; it is not an application authorization system.

## Checkpoint and answer

**Question:** The API is published as `18080:8000`. A neighboring container calls `localhost:18080` and fails. What should it call?

**Answer:** If both services share the Compose network, call `api:8000`. The published port is for host-side access. The neighbor's localhost points to itself. Verify DNS, listening address and shared network before changing firewall rules.

## Summary

Identify caller, namespace, DNS name, listening port and published port separately. Debug DNS, TCP, TLS and HTTP in that order when the evidence supports it.

## Sources

- [Networking overview](https://docs.docker.com/engine/network/)
- [Port publishing](https://docs.docker.com/engine/network/port-publishing/)
- [Desktop networking](https://docs.docker.com/desktop/features/networking/)
