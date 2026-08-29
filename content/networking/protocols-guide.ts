const markdown = String.raw`This chapter is a **general networking and communication-protocol learning path**. It explains how systems communicate, how the major protocol families relate to one another, and how to choose and diagnose them.

It is intentionally not an HTTP API chapter. For HTTP methods, CRUD vs REST, headers, status codes, authentication, file upload, caching and CORS, use **HTTP API semantics**.

It is also intentionally not an Embedded & IoT chapter. MQTT, CoAP, Bluetooth/BLE, Zigbee, Thread, Matter, LoRaWAN, CAN, LIN, Modbus, UART, I²C, SPI, USB and similar device-oriented technologies belong in a separate **Embedded & IoT communications** learning path where they can be explained together and at the correct layers.

## 1. Protocols are a stack, not a flat list

A protocol is a set of rules that lets peers communicate. Real communication usually uses several protocols at once.

A practical Internet-oriented stack looks like this:

| Responsibility | Common technologies | Main question |
|---|---|---|
| Application communication | HTTP, WebSocket, gRPC, AMQP, SMTP, IMAP, SSH | What are the messages and application semantics? |
| Security | TLS | How is traffic encrypted and how is the peer authenticated? |
| Transport | TCP, UDP, QUIC | How does data move between processes? |
| Network | IP | How are packets addressed and routed between hosts? |
| Link / network access | Ethernet, Wi-Fi | How does a device reach the local network? |
| Naming | DNS | How does a human-readable name map to a service address? |

One HTTPS request may therefore involve:

~~~text
DNS
  -> IP routing
  -> TCP or QUIC
  -> TLS
  -> HTTP
  -> JSON / HTML / another representation
~~~

These categories are easy to mix up:

- **JSON, XML, Protocol Buffers and MessagePack are data formats**, not network protocols.
- **REST is an architectural style**, not a protocol.
- **GraphQL is a query language and execution model**, not a transport protocol.
- **gRPC is an RPC framework** that commonly uses HTTP/2.
- **SSE is an HTTP streaming mechanism**, not a replacement transport layer.

### OSI vs TCP/IP

The seven-layer OSI model is useful vocabulary, while the Internet protocol suite is usually the more practical model for real systems.

| OSI idea | Rough Internet-stack equivalent |
|---|---|
| Application / presentation / session | Application protocols + formats + TLS/session mechanisms |
| Transport | TCP, UDP, QUIC |
| Network | IP, ICMP |
| Data link / physical | Ethernet, Wi-Fi and physical media |

Do not force every modern technology into exactly one OSI box. Layering is a model for reasoning, not a law of nature.

## 2. IP, addresses, ports and sockets

### IP

Internet Protocol provides addressing and packet delivery across interconnected networks. IPv4 and IPv6 are the two major versions in use.

IP itself does not promise that packets arrive, arrive once, or arrive in order. Higher layers provide the communication behavior an application needs.

### Addresses

An IP address identifies a network interface/addressable endpoint in the IP layer. A hostname such as \`api.example.com\` is not an IP address; DNS may resolve it to one or more IPv4 or IPv6 addresses.

### Ports

TCP and UDP use port numbers to identify services/process endpoints on a host.

A default port is a convention, not proof of which application protocol is actually running.

| Common default | Typical use |
|---:|---|
| 22 | SSH / SFTP |
| 25 | SMTP relay |
| 53 | DNS |
| 80 | HTTP / ws |
| 110 / 995 | POP3 / POP3 over TLS |
| 143 / 993 | IMAP / IMAP over TLS |
| 443 | HTTPS / wss / many TLS-protected services |
| 465 / 587 | Mail submission variants |
| 5672 / 5671 | AMQP / AMQP over TLS |

### Socket

A socket is an operating-system/application abstraction for network communication. A TCP connection is commonly identified by source IP, source port, destination IP and destination port.

This explains how one server can serve many simultaneous connections on the same listening port: every connection has a different endpoint tuple.

## 3. TCP and UDP

### TCP

TCP provides an ordered, reliable byte stream between two endpoints.

Important properties:

- connection-oriented;
- retransmits lost data;
- preserves byte order;
- includes flow control and congestion control;
- exposes a byte stream, **not application message boundaries**.

Because TCP is a byte stream, an application protocol must define its own framing. One application message can be split across several TCP segments, and several small messages can appear in one read operation.

Common TCP-based protocols include HTTP/1.1, HTTP/2, TLS, SSH, SMTP and IMAP.

### UDP

UDP provides independent datagrams. It does not add TCP-style connection establishment, delivery guarantees, ordering or retransmission.

That does not mean every UDP-based application is unreliable. A protocol built on UDP can implement its own reliability, ordering, congestion control and connection behavior. QUIC is the most important modern example.

### TCP vs UDP

| Property | TCP | UDP |
|---|---|---|
| Connection model | Connection-oriented | Datagram-oriented |
| Reliable delivery | Yes, while connection remains viable | Not provided by UDP itself |
| Ordering | Preserved | Not guaranteed |
| Message boundaries | No | Yes, datagrams |
| Retransmission | Built in | Not built in |
| Typical strength | Reliable streams | Minimal transport semantics and flexibility |

The choice is not simply “TCP is safe, UDP is fast.” The application protocol and workload determine which trade-offs matter.

## 4. QUIC: modern transport over UDP

QUIC is a secure, connection-oriented, multiplexed transport built on UDP.

It exists partly to move transport evolution out of operating-system TCP stacks and to improve connection establishment and multiplexing behavior.

Important concepts:

- QUIC integrates TLS 1.3 security into its handshake;
- one connection can contain multiple independent streams;
- loss affecting one stream does not impose TCP-style head-of-line blocking on unrelated streams;
- connection identifiers can help connections survive network-path changes, such as moving from Wi-Fi to mobile data;
- QUIC traffic is carried in UDP datagrams.

HTTP/3 uses QUIC as its transport.

**QUIC is not HTTP/3.** QUIC is the transport; HTTP/3 is an application protocol carried over it.

## 5. TLS: security for protocols

TLS protects data in transit between peers.

It provides three central properties:

1. **Confidentiality** — protected traffic should not be readable by passive observers.
2. **Integrity** — modification in transit should be detectable.
3. **Authentication** — normally the client authenticates the server certificate; mutual TLS can authenticate both peers.

A simplified HTTPS flow is:

~~~text
DNS -> transport connection -> TLS handshake -> HTTP messages
~~~

Important TLS concepts:

- certificate;
- certificate authority and trust chain;
- hostname validation;
- certificate validity period;
- TLS version and cipher negotiation;
- SNI for selecting the intended virtual host;
- ALPN for negotiating an application protocol such as HTTP/2;
- session resumption;
- mutual TLS (mTLS).

**HTTPS does not mean the application user is authenticated.** TLS protects and authenticates the connection. Application authentication and authorization are separate concerns.

TLS is not specific to HTTP. It can protect SMTP, IMAP, AMQP and many other application protocols.

## 6. DNS: names before connections

DNS maps names to information needed to locate services.

High-value record types:

| Record | Purpose |
|---|---|
| A | Name -> IPv4 address |
| AAAA | Name -> IPv6 address |
| CNAME | Alias to another name |
| MX | Mail exchanger |
| TXT | Text metadata, often used for verification/security policies |
| NS | Authoritative name server |
| SRV | Service location including host and port metadata |

### Recursive and authoritative resolution

A client usually asks a recursive resolver. The resolver may answer from cache or query the DNS hierarchy until it reaches authoritative data.

### TTL and caching

DNS records have a TTL that influences how long answers may be cached. After a DNS change, different resolvers can temporarily return different results.

### DNS is more than “hostname to IP”

DNS also participates in:

- mail routing through MX records;
- service discovery through SRV records;
- ownership/security configuration through TXT records;
- load distribution and failover patterns through multiple records and DNS providers.

DNS can use both UDP and TCP. Modern encrypted DNS variants also exist, including DNS over HTTPS and DNS over TLS.

## 7. HTTP/1.1, HTTP/2 and HTTP/3

All modern HTTP versions preserve the core HTTP semantics: methods, resource targets, fields/headers and status codes. The major differences are in framing and transport behavior.

### HTTP/1.1

HTTP/1.1 uses textual message syntax and normally runs over TCP. Persistent connections let several requests reuse one connection, but it does not provide HTTP-level multiplexing of many concurrent streams in the way HTTP/2 and HTTP/3 do.

### HTTP/2

HTTP/2 keeps HTTP semantics but adds:

- binary framing;
- multiplexed streams;
- header compression;
- stream prioritization mechanisms.

It normally runs over a single TCP connection on the public web. HTTP-level streams are independent, but packet loss in the shared TCP connection can still delay delivery for all streams.

### HTTP/3

HTTP/3 maps HTTP semantics onto QUIC instead of TCP.

| Version | Typical transport | Framing | Multiplexing |
|---|---|---|---|
| HTTP/1.1 | TCP, optionally TLS | Textual syntax | No HTTP-level multiplexing |
| HTTP/2 | TCP + usually TLS | Binary frames | Yes |
| HTTP/3 | QUIC over UDP | HTTP/3 frames | Yes, over QUIC streams |

The separate **HTTP API semantics** chapter covers methods, REST, headers, status codes, authentication, files, caching and CORS.

## 8. WebSocket, SSE and polling

These technologies solve related real-time/update problems but use different communication models.

### WebSocket

WebSocket provides a long-lived, bidirectional message channel between peers. In its classic web form, the connection starts with an HTTP Upgrade handshake and then switches to WebSocket framing.

Strong fits include:

- chat;
- collaborative editing;
- multiplayer/game state;
- trading/live dashboards;
- interactive control channels.

The dedicated **WebSocket: build, test & debug** chapter covers the protocol in depth.

### Server-Sent Events (SSE)

SSE is an HTTP-based server-to-client event stream. A browser keeps an HTTP response open and receives text events over time.

It is a good fit when the server needs to push updates but the client can continue sending commands using ordinary HTTP requests.

### Polling and long polling

Polling is an application pattern over HTTP. The client repeatedly asks whether anything changed.

Long polling keeps one request pending until an update or timeout occurs, then the client creates another request.

| Mechanism | Direction | Connection behavior | Typical fit |
|---|---|---|---|
| Polling | Client -> server requests | Repeated requests | Simple or infrequent updates |
| Long polling | Server delays response | Repeated long requests | Compatibility-oriented server push |
| SSE | Primarily server -> client | Long-lived HTTP response | Feeds, notifications, progress |
| WebSocket | Bidirectional | Long-lived WebSocket connection | Interactive real-time traffic |

## 9. gRPC and RPC communication

Remote Procedure Call (RPC) systems make remote operations look more like method/function calls than resource-oriented HTTP interactions.

gRPC is a modern RPC framework. Services are defined by a contract, commonly with Protocol Buffers, and gRPC usually runs over HTTP/2.

Four gRPC interaction shapes are important:

1. Unary — one request, one response.
2. Server streaming — one request, many responses.
3. Client streaming — many requests, one response.
4. Bidirectional streaming — both sides stream messages.

Important concepts include:

- service and method definitions;
- message schemas;
- metadata;
- deadlines;
- cancellation;
- gRPC status codes;
- streaming;
- Protocol Buffer compatibility.

Do not describe gRPC as “JSON over HTTP/2.” Its contract, framing and common serialization model are different from a typical JSON/REST-style API.

## 10. Messaging and AMQP

Request/response is only one communication pattern. Messaging systems decouple producers and consumers in time and topology.

Common messaging concepts include:

- producer and consumer;
- broker;
- queue or address;
- publish/subscribe;
- acknowledgement / settlement;
- redelivery;
- retry;
- dead-letter handling;
- message TTL;
- ordering guarantees;
- backpressure;
- eventual consistency.

### AMQP

AMQP is a binary application-layer messaging protocol family/standard used for interoperable messaging systems.

Be careful not to equate a broker product with a single protocol. A broker may support several protocols, and product-level concepts such as exchanges, queues and routing rules can extend beyond what a protocol specification itself defines.

### Why MQTT is not covered here in depth

MQTT is a valid application-layer publish/subscribe protocol and can be used outside embedded systems. However, its most important learning context is IoT/device communication: constrained devices, brokers, intermittent connectivity, retained state, sessions and QoS. Covering MQTT deeply here while omitting BLE, CoAP, Thread, LoRaWAN and device buses creates an arbitrary curriculum boundary.

For that reason, MQTT is moved to the separate **Embedded & IoT communications** track. This chapter focuses on broadly applicable Internet/backend networking concepts.

## 11. Email protocols: SMTP, IMAP and POP3

Email uses different protocols for transport and mailbox access.

### SMTP

SMTP is used to submit and transfer email.

A simplified path is:

~~~text
mail client --SMTP--> sending server --SMTP--> receiving server
~~~

### IMAP

IMAP is designed for mailbox access and synchronization while messages remain managed on the server. It supports mailboxes/folders, message flags and multi-client synchronization.

### POP3

POP3 is a simpler retrieval protocol historically oriented around downloading messages from a mailbox.

### MIME

MIME is not a transport protocol. It defines how email can represent structured bodies, content types, attachments and encodings.

A complete mail flow therefore combines several standards rather than “using one email protocol.”

## 12. FTP, FTPS, SSH and SFTP

These names are commonly confused.

### FTP

FTP is a file-transfer protocol with separate control/data connection behavior. Classic FTP does not provide modern encrypted transport by itself.

### FTPS

FTPS is FTP protected with TLS.

### SSH

SSH provides a secure channel for remote login, command execution and related capabilities.

### SFTP

SFTP means **SSH File Transfer Protocol**. It runs through SSH and is not “FTP plus SSH.” It is a different protocol and connection model.

| Technology | What it is | Security relationship |
|---|---|---|
| FTP | File Transfer Protocol | Plain unless separately protected |
| FTPS | FTP protected by TLS | TLS + FTP |
| SSH | Secure Shell protocol | Secure remote channel |
| SFTP | SSH File Transfer Protocol | Runs through SSH |

## 13. Choosing a communication mechanism

Protocol choice should begin with the interaction model and constraints, not popularity.

| Need | Common choice | Why |
|---|---|---|
| Browser/web request-response | HTTP | Broad compatibility, intermediaries, caching and tooling |
| Typed service-to-service RPC | gRPC | Strong contracts, streaming, efficient framing |
| Bidirectional real-time session | WebSocket | Both peers can push messages |
| Server push to browser | SSE | Simple HTTP streaming model |
| Asynchronous brokered messaging | AMQP or broker-specific protocol | Decoupled producers/consumers and delivery semantics |
| Email transfer | SMTP | Standard mail submission/relay |
| Mailbox synchronization | IMAP | Server-managed mailbox state |
| Secure remote administration | SSH | Secure command/session channel |
| Secure remote file transfer | SFTP | File operations through SSH |

Real systems frequently combine several mechanisms. A product may use HTTPS for its public API, gRPC internally, WebSocket for live updates, AMQP for asynchronous workflows and SMTP for notifications.

## 14. Diagnose communication layer by layer

When a system cannot communicate, isolate the failing layer.

1. **Name resolution** — does the name resolve to the expected destination?
2. **Network reachability** — is there a route to the destination?
3. **Port/service reachability** — is the expected TCP/UDP service accessible?
4. **Transport** — can the TCP/QUIC/etc. connection be established and maintained?
5. **TLS** — does certificate validation and protocol negotiation succeed?
6. **Application protocol** — are both peers speaking compatible protocol versions?
7. **Authentication/authorization** — does the application accept the identity and permissions?
8. **Payload/contract** — is the application message valid?
9. **State and timing** — are retries, timeouts, ordering, caching or asynchronous state involved?

Useful tools:

| Tool | Typical use |
|---|---|
| \`ping\` | Basic ICMP reachability signal; not proof that an application service works |
| \`traceroute\` / \`tracert\` | Inspect network path hops |
| \`nslookup\` / \`dig\` | DNS resolution and records |
| \`curl\` | HTTP/HTTPS requests, headers and protocol negotiation |
| \`openssl s_client\` | TLS handshake, certificates and ALPN |
| \`nc\` / netcat | Basic TCP/UDP connectivity and manual text-protocol experiments |
| \`grpcurl\` | Explore compatible gRPC services |
| \`wscat\` / \`websocat\` | Interactive WebSocket communication |
| Wireshark | Packet/protocol capture and low-level analysis |

A packet capture is powerful, but it is not the first tool for every problem. Start with the highest layer that can quickly confirm or reject the current hypothesis.

## 15. Practice

### Exercise 1 — classify the stack

For an HTTPS request returning JSON, identify the role of DNS, IP, TCP or QUIC, TLS, HTTP and JSON. Explain why JSON is not “the protocol used by the API.”

### Exercise 2 — TCP vs UDP

Explain why DNS often uses UDP while HTTP/1.1 normally uses TCP, then explain why HTTP/3 can still be reliable even though QUIC runs over UDP.

### Exercise 3 — HTTP versions

Compare HTTP/1.1, HTTP/2 and HTTP/3 without discussing methods or status codes. Focus only on transport, framing and multiplexing.

### Exercise 4 — real-time design

Choose between polling, SSE and WebSocket for:

- a build-progress screen;
- a chat application;
- a dashboard refreshed every five minutes.

Defend each choice.

### Exercise 5 — diagnose a failure

A browser reports that \`https://api.example.com\` is unavailable. Build an investigation sequence from DNS to TLS to HTTP rather than immediately assuming an application bug.

## 16. QA quick reference

The learning path above is intentionally general. For testing work, use this compact lens rather than treating every section as QA-specific content.

| Area | High-value test questions |
|---|---|
| DNS | Correct records? TTL/cache behavior? IPv4/IPv6 differences? |
| TCP/UDP/QUIC | Connection loss? timeout? retransmission/loss behavior? network change? |
| TLS | Expired/wrong-host/untrusted certificate? protocol negotiation? mTLS? |
| HTTP versions | Proxy/firewall compatibility? fallback? multiplexing/performance behavior? |
| WebSocket/SSE | Reconnect? duplicate/missed events? idle timeout? backpressure? |
| gRPC | Contract compatibility? deadlines/cancellation? stream termination? status mapping? |
| Messaging | Duplicate/redelivery handling? ordering? retries? dead-letter flow? |
| Email/file transfer | Authentication? encoding? large payloads? interruption/resume? permissions? |

The most useful principle is **test the failure model of the protocol you actually use** rather than applying one generic network checklist to every technology.

## Embedded & IoT scope boundary

Embedded and IoT communication deserves its own layered curriculum rather than being mixed into this Internet/backend protocol survey.

That separate track should distinguish:

| Layer / family | Technologies to cover |
|---|---|
| Local peripheral buses | UART, I²C, SPI |
| Wired embedded/industrial networks | CAN / CAN FD, LIN, RS-232, RS-485, Modbus |
| Short-range wireless | Bluetooth Classic, Bluetooth LE, Zigbee, Thread |
| IP/local connectivity | Wi-Fi, Ethernet, IPv6/6LoWPAN |
| Long-range / wide-area | LTE/4G/5G, NB-IoT/LTE-M where relevant, LoRaWAN |
| IoT application protocols | MQTT, CoAP |
| Smart-home application layer | Matter |
| Host/device connectivity | USB |

These are not all peers at one protocol layer. For example, Thread is an IPv6-based low-power mesh network, Matter is an application-layer ecosystem over IP networks such as Thread/Wi-Fi/Ethernet, and MQTT/CoAP sit at the application layer. Bluetooth LE is a complete wireless stack with its own radio/link and higher-layer concepts. Treating all of them as one flat “protocol list” would repeat the same structural mistake this Networking chapter is designed to avoid.

## Sources

- [RFC 8200 — Internet Protocol, Version 6](https://www.rfc-editor.org/rfc/rfc8200)
- [RFC 9293 — Transmission Control Protocol (TCP)](https://www.rfc-editor.org/rfc/rfc9293)
- [RFC 768 — User Datagram Protocol](https://www.rfc-editor.org/rfc/rfc768)
- [RFC 9000 — QUIC: A UDP-Based Multiplexed and Secure Transport](https://www.rfc-editor.org/rfc/rfc9000)
- [RFC 8446 — TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446)
- [RFC 1034 — Domain Names: Concepts and Facilities](https://www.rfc-editor.org/rfc/rfc1034)
- [RFC 9112 — HTTP/1.1](https://www.rfc-editor.org/rfc/rfc9112)
- [RFC 9113 — HTTP/2](https://www.rfc-editor.org/rfc/rfc9113)
- [RFC 9114 — HTTP/3](https://www.rfc-editor.org/rfc/rfc9114)
- [RFC 6455 — The WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455)
- [gRPC Core Concepts](https://grpc.io/docs/what-is-grpc/core-concepts/)
- [OASIS AMQP 1.0](https://docs.oasis-open.org/amqp/core/v1.0/os/amqp-core-overview-v1.0-os.html)
- [RFC 5321 — SMTP](https://www.rfc-editor.org/rfc/rfc5321)
- [RFC 9051 — IMAP4rev2](https://www.rfc-editor.org/rfc/rfc9051)
- [RFC 1939 — POP3](https://www.rfc-editor.org/rfc/rfc1939)
- [RFC 959 — FTP](https://www.rfc-editor.org/rfc/rfc959)
- [RFC 4251 — SSH Protocol Architecture](https://www.rfc-editor.org/rfc/rfc4251)
- [Bluetooth SIG — Bluetooth technology overview](https://www.bluetooth.com/learn-about-bluetooth/tech-overview/)
- [Thread Group — What is Thread?](https://threadgroup.org/)
- [RFC 7252 — Constrained Application Protocol (CoAP)](https://www.rfc-editor.org/rfc/rfc7252)
`;

const markdownUk = String.raw`Цей розділ — **загальний learning path з networking та communication protocols**. Він пояснює, як системи спілкуються, як основні protocol families пов'язані між собою, як їх обирати та як діагностувати проблеми.

Це навмисно не HTTP API chapter. Для HTTP methods, CRUD vs REST, headers, status codes, authentication, file upload, caching та CORS використовуй **HTTP API semantics**.

Також це навмисно не Embedded & IoT chapter. MQTT, CoAP, Bluetooth/BLE, Zigbee, Thread, Matter, LoRaWAN, CAN, LIN, Modbus, UART, I²C, SPI, USB та подібні device-oriented technologies мають бути в окремому **Embedded & IoT communications** learning path, де їх можна пояснювати разом і на правильних layers.

## 1. Protocols — це stack, а не плоский список

Protocol — це набір правил, за якими peers можуть обмінюватися даними. Реальна комунікація зазвичай використовує кілька protocols одночасно.

Практичний Internet-oriented stack:

| Відповідальність | Поширені technologies | Головне питання |
|---|---|---|
| Application communication | HTTP, WebSocket, gRPC, AMQP, SMTP, IMAP, SSH | Які messages та application semantics? |
| Security | TLS | Як traffic шифрується та як автентифікується peer? |
| Transport | TCP, UDP, QUIC | Як data рухається між processes? |
| Network | IP | Як packets адресуються та маршрутизуються між hosts? |
| Link / network access | Ethernet, Wi-Fi | Як device потрапляє у local network? |
| Naming | DNS | Як human-readable name перетворюється на service address? |

Один HTTPS request може включати:

~~~text
DNS
  -> IP routing
  -> TCP або QUIC
  -> TLS
  -> HTTP
  -> JSON / HTML / інше представлення
~~~

Категорії легко переплутати:

- **JSON, XML, Protocol Buffers та MessagePack — data formats**, а не network protocols.
- **REST — architectural style**, а не protocol.
- **GraphQL — query language та execution model**, а не transport protocol.
- **gRPC — RPC framework**, який зазвичай використовує HTTP/2.
- **SSE — HTTP streaming mechanism**, а не окремий transport layer.

### OSI vs TCP/IP

Семирівнева OSI model корисна як vocabulary, а Internet protocol suite зазвичай практичніша для реальних systems.

| OSI idea | Приблизний Internet-stack equivalent |
|---|---|
| Application / presentation / session | Application protocols + formats + TLS/session mechanisms |
| Transport | TCP, UDP, QUIC |
| Network | IP, ICMP |
| Data link / physical | Ethernet, Wi-Fi та physical media |

Не треба насильно вкладати кожну modern technology рівно в один OSI box. Layering — модель для reasoning, а не закон природи.

## 2. IP, addresses, ports та sockets

### IP

Internet Protocol дає addressing та packet delivery між interconnected networks. Основні версії — IPv4 та IPv6.

IP сам по собі не гарантує, що packet буде доставлений, прийде один раз або збереже order. Поведінку, потрібну application, додають вищі layers.

### Addresses

IP address ідентифікує addressable endpoint/interface на IP layer. Hostname на кшталт \`api.example.com\` — не IP address; DNS може resolve його в одну або кілька IPv4/IPv6 addresses.

### Ports

TCP та UDP використовують port numbers, щоб ідентифікувати service/process endpoint на host.

Default port — convention, а не доказ того, який application protocol реально працює.

| Common default | Typical use |
|---:|---|
| 22 | SSH / SFTP |
| 25 | SMTP relay |
| 53 | DNS |
| 80 | HTTP / ws |
| 110 / 995 | POP3 / POP3 over TLS |
| 143 / 993 | IMAP / IMAP over TLS |
| 443 | HTTPS / wss / багато TLS-protected services |
| 465 / 587 | Mail submission variants |
| 5672 / 5671 | AMQP / AMQP over TLS |

### Socket

Socket — це OS/application abstraction для network communication. TCP connection зазвичай ідентифікується source IP, source port, destination IP та destination port.

Тому один server може мати багато одночасних connections на одному listening port: у кожного connection свій endpoint tuple.

## 3. TCP та UDP

### TCP

TCP надає ordered, reliable byte stream між двома endpoints.

Ключові властивості:

- connection-oriented;
- retransmission втрачених data;
- зберігає byte order;
- має flow control та congestion control;
- дає byte stream, але **не application message boundaries**.

Тому application protocol має сам визначити framing. Один message може бути розбитий на кілька TCP segments, а кілька маленьких messages можуть потрапити в один read.

Поширені TCP-based protocols: HTTP/1.1, HTTP/2, TLS, SSH, SMTP та IMAP.

### UDP

UDP дає independent datagrams. Він не додає TCP-style connection establishment, delivery guarantees, ordering або retransmission.

Це не означає, що кожна UDP-based application ненадійна. Protocol над UDP може реалізувати власні reliability, ordering, congestion control та connection behavior. Найважливіший modern example — QUIC.

### TCP vs UDP

| Property | TCP | UDP |
|---|---|---|
| Connection model | Connection-oriented | Datagram-oriented |
| Reliable delivery | Так, поки connection viable | UDP сам не гарантує |
| Ordering | Зберігається | Не гарантується |
| Message boundaries | Ні | Так, datagrams |
| Retransmission | Built in | Не built in |
| Typical strength | Reliable streams | Мінімальні transport semantics та flexibility |

Вибір — не просто «TCP safe, UDP fast». Вирішальними є application protocol та workload.

## 4. QUIC: modern transport over UDP

QUIC — secure, connection-oriented, multiplexed transport, побудований поверх UDP.

Важливі concepts:

- QUIC інтегрує TLS 1.3 security у handshake;
- один connection може мати багато independent streams;
- loss в одному stream не створює TCP-style head-of-line blocking для unrelated streams;
- connection identifiers допомагають connection пережити network-path change, наприклад Wi-Fi -> mobile data;
- QUIC traffic передається UDP datagrams.

HTTP/3 використовує QUIC як transport.

**QUIC — не HTTP/3.** QUIC — transport; HTTP/3 — application protocol поверх нього.

## 5. TLS: security для protocols

TLS захищає data in transit між peers.

Основні властивості:

1. **Confidentiality** — protected traffic не повинен бути readable passive observer.
2. **Integrity** — modification in transit має виявлятися.
3. **Authentication** — client зазвичай перевіряє server certificate; mutual TLS може authenticate обидві сторони.

Спрощений HTTPS flow:

~~~text
DNS -> transport connection -> TLS handshake -> HTTP messages
~~~

Важливі TLS concepts:

- certificate;
- certificate authority та trust chain;
- hostname validation;
- certificate validity period;
- TLS version та cipher negotiation;
- SNI;
- ALPN;
- session resumption;
- mutual TLS (mTLS).

**HTTPS не означає, що application user authenticated.** TLS захищає та authenticates connection. Application authentication/authorization — окрема задача.

TLS не прив'язаний лише до HTTP. Він може захищати SMTP, IMAP, AMQP та інші protocols.

## 6. DNS: names before connections

DNS мапить names на інформацію, потрібну для пошуку services.

Основні record types:

| Record | Purpose |
|---|---|
| A | Name -> IPv4 address |
| AAAA | Name -> IPv6 address |
| CNAME | Alias на інше name |
| MX | Mail exchanger |
| TXT | Text metadata, часто verification/security policies |
| NS | Authoritative name server |
| SRV | Service location із host/port metadata |

### Recursive та authoritative resolution

Client зазвичай звертається до recursive resolver. Resolver може відповісти з cache або пройти DNS hierarchy до authoritative data.

### TTL та caching

DNS records мають TTL, який впливає на час caching. Після DNS change різні resolvers тимчасово можуть бачити різні answers.

### DNS — це більше ніж «hostname -> IP»

DNS також використовується для mail routing, service discovery, ownership/security metadata та деяких load-distribution/failover patterns.

DNS може працювати через UDP і TCP. Існують encrypted variants, зокрема DNS over HTTPS та DNS over TLS.

## 7. HTTP/1.1, HTTP/2 та HTTP/3

Усі modern HTTP versions зберігають core semantics: methods, resource targets, fields/headers та status codes. Основні відмінності — framing та transport behavior.

### HTTP/1.1

HTTP/1.1 використовує textual message syntax і зазвичай працює поверх TCP. Persistent connections дозволяють reuse connection, але немає HTTP-level multiplexing багатьох concurrent streams як у HTTP/2 та HTTP/3.

### HTTP/2

HTTP/2 зберігає HTTP semantics, але додає binary framing, multiplexed streams та header compression.

На public web він зазвичай працює через один TCP connection. HTTP streams independent на application framing level, але packet loss у shared TCP connection може затримати delivery для всіх streams.

### HTTP/3

HTTP/3 переносить HTTP semantics на QUIC замість TCP.

| Version | Typical transport | Framing | Multiplexing |
|---|---|---|---|
| HTTP/1.1 | TCP, optionally TLS | Textual syntax | Немає HTTP-level multiplexing |
| HTTP/2 | TCP + usually TLS | Binary frames | Так |
| HTTP/3 | QUIC over UDP | HTTP/3 frames | Так, через QUIC streams |

Окремий **HTTP API semantics** chapter покриває methods, REST, headers, status codes, authentication, files, caching та CORS.

## 8. WebSocket, SSE та polling

Ці technologies вирішують схожі real-time/update problems, але мають різні communication models.

### WebSocket

WebSocket дає long-lived bidirectional message channel. У classic web form connection починається HTTP Upgrade handshake, а потім переходить на WebSocket framing.

Типові use cases: chat, collaborative editing, multiplayer/game state, trading/live dashboards, interactive control channels.

Окремий **WebSocket: build, test & debug** chapter розбирає protocol детально.

### Server-Sent Events (SSE)

SSE — HTTP-based server-to-client event stream. Browser тримає HTTP response open і отримує text events з часом.

Підходить, коли server має push updates, а client commands можна надсилати звичайними HTTP requests.

### Polling та long polling

Polling — application pattern поверх HTTP. Client періодично запитує updates.

Long polling тримає request pending до update або timeout, після чого client створює наступний request.

| Mechanism | Direction | Connection behavior | Typical fit |
|---|---|---|---|
| Polling | Client -> server | Repeated requests | Simple / infrequent updates |
| Long polling | Server delays response | Repeated long requests | Compatibility-oriented push |
| SSE | Primarily server -> client | Long-lived HTTP response | Feeds, notifications, progress |
| WebSocket | Bidirectional | Long-lived WebSocket | Interactive real-time traffic |

## 9. gRPC та RPC communication

Remote Procedure Call systems роблять remote operations схожими на method/function calls, а не на resource-oriented HTTP interactions.

gRPC — modern RPC framework. Services задаються contract, зазвичай через Protocol Buffers, а transport найчастіше використовує HTTP/2.

Чотири interaction shapes:

1. Unary — one request, one response.
2. Server streaming — one request, many responses.
3. Client streaming — many requests, one response.
4. Bidirectional streaming — обидві сторони stream messages.

Ключові concepts: service/method definitions, message schemas, metadata, deadlines, cancellation, gRPC status codes, streaming та Protocol Buffer compatibility.

Не варто описувати gRPC як «JSON over HTTP/2». Його contract, framing та serialization model відрізняються від типового JSON/REST-style API.

## 10. Messaging та AMQP

Request/response — не єдина communication pattern. Messaging systems decouple producers та consumers у часі й topology.

Common concepts:

- producer / consumer;
- broker;
- queue / address;
- publish/subscribe;
- acknowledgement / settlement;
- redelivery;
- retry;
- dead-letter handling;
- message TTL;
- ordering guarantees;
- backpressure;
- eventual consistency.

### AMQP

AMQP — binary application-layer messaging protocol family/standard для interoperable messaging systems.

Не треба ототожнювати broker product з одним protocol. Broker може підтримувати кілька protocols, а product-level concepts можуть виходити за межі specification конкретного protocol.

### Чому MQTT тут більше не розбирається детально

MQTT — повноцінний application-layer publish/subscribe protocol і може використовуватися не лише в embedded. Але його найкорисніший learning context — IoT/device communication: constrained devices, brokers, intermittent connectivity, retained state, sessions та QoS.

Глибоко розбирати MQTT тут, але не BLE, CoAP, Thread, LoRaWAN та device buses — штучна межа curriculum. Тому MQTT переноситься до окремого **Embedded & IoT communications** track, а цей chapter залишається про broadly applicable Internet/backend networking.

## 11. Email protocols: SMTP, IMAP та POP3

Email використовує різні protocols для transport та mailbox access.

### SMTP

SMTP використовується для submit та transfer email.

~~~text
mail client --SMTP--> sending server --SMTP--> receiving server
~~~

### IMAP

IMAP призначений для mailbox access/synchronization, коли messages залишаються managed on server. Він підтримує mailboxes/folders, flags та multi-client synchronization.

### POP3

POP3 — простіший retrieval protocol, історично орієнтований на downloading messages from mailbox.

### MIME

MIME — не transport protocol. Він визначає structured bodies, content types, attachments та encodings.

Тобто complete mail flow комбінує кілька standards.

## 12. FTP, FTPS, SSH та SFTP

Ці назви часто плутають.

### FTP

FTP — file-transfer protocol із separate control/data connection behavior. Classic FTP сам по собі не дає modern encrypted transport.

### FTPS

FTPS — FTP, protected by TLS.

### SSH

SSH дає secure channel для remote login, command execution та related capabilities.

### SFTP

SFTP — **SSH File Transfer Protocol**. Він працює через SSH і не є «FTP + SSH».

| Technology | What it is | Security relationship |
|---|---|---|
| FTP | File Transfer Protocol | Plain unless separately protected |
| FTPS | FTP protected by TLS | TLS + FTP |
| SSH | Secure Shell protocol | Secure remote channel |
| SFTP | SSH File Transfer Protocol | Runs through SSH |

## 13. Як обирати communication mechanism

Починай з interaction model та constraints, а не з popularity.

| Need | Common choice | Why |
|---|---|---|
| Browser/web request-response | HTTP | Compatibility, intermediaries, caching, tooling |
| Typed service-to-service RPC | gRPC | Strong contracts, streaming, efficient framing |
| Bidirectional real-time | WebSocket | Both peers can push messages |
| Server push to browser | SSE | Simple HTTP streaming |
| Async brokered messaging | AMQP / broker-specific protocol | Decoupled producers/consumers |
| Email transfer | SMTP | Standard mail submission/relay |
| Mailbox sync | IMAP | Server-managed mailbox state |
| Secure remote administration | SSH | Secure command/session channel |
| Secure remote file transfer | SFTP | File operations through SSH |

Реальна система часто використовує кілька mechanisms одночасно.

## 14. Діагностуй communication layer by layer

Коли система не може communicate, ізолюй layer:

1. **Name resolution** — чи name resolves правильно?
2. **Network reachability** — чи є route до destination?
3. **Port/service reachability** — чи expected TCP/UDP service accessible?
4. **Transport** — чи встановлюється і тримається connection?
5. **TLS** — чи проходять certificate validation та negotiation?
6. **Application protocol** — чи peers говорять compatible versions?
7. **Authentication/authorization** — чи application приймає identity/permissions?
8. **Payload/contract** — чи message valid?
9. **State/timing** — retries, timeouts, ordering, caching, async state?

Корисні tools:

| Tool | Typical use |
|---|---|
| \`ping\` | Basic ICMP reachability signal; не proof, що service працює |
| \`traceroute\` / \`tracert\` | Network path hops |
| \`nslookup\` / \`dig\` | DNS resolution/records |
| \`curl\` | HTTP/HTTPS, headers, protocol negotiation |
| \`openssl s_client\` | TLS handshake, certificates, ALPN |
| \`nc\` / netcat | Basic TCP/UDP connectivity |
| \`grpcurl\` | gRPC exploration |
| \`wscat\` / \`websocat\` | Interactive WebSocket |
| Wireshark | Packet/protocol capture |

Packet capture дуже потужний, але не має бути first tool для кожної проблеми. Починай з найвищого layer, який швидко підтвердить або спростує hypothesis.

## 15. Practice

### Exercise 1 — classify the stack

Для HTTPS request, який повертає JSON, визнач role DNS, IP, TCP/QUIC, TLS, HTTP та JSON. Поясни, чому JSON не є «protocol used by API».

### Exercise 2 — TCP vs UDP

Поясни, чому DNS часто використовує UDP, HTTP/1.1 — TCP, але HTTP/3 усе одно може бути reliable, хоча QUIC працює over UDP.

### Exercise 3 — HTTP versions

Порівняй HTTP/1.1, HTTP/2 та HTTP/3 без methods/status codes. Тільки transport, framing та multiplexing.

### Exercise 4 — real-time design

Обери polling, SSE або WebSocket для build-progress screen, chat application та dashboard із refresh раз на п'ять хвилин. Обґрунтуй.

### Exercise 5 — diagnose failure

Browser каже, що \`https://api.example.com\` unavailable. Побудуй investigation sequence від DNS до TLS та HTTP замість припущення «це bug в application».

## 16. QA quick reference

Learning path вище навмисно general-purpose. Для testing використовуй компактний lens, а не будуй кожен розділ навколо QA.

| Area | High-value test questions |
|---|---|
| DNS | Correct records? TTL/cache? IPv4/IPv6 differences? |
| TCP/UDP/QUIC | Connection loss? timeout? loss behavior? network change? |
| TLS | Expired/wrong-host/untrusted certificate? negotiation? mTLS? |
| HTTP versions | Proxy/firewall compatibility? fallback? multiplexing/performance? |
| WebSocket/SSE | Reconnect? duplicate/missed events? idle timeout? backpressure? |
| gRPC | Contract compatibility? deadlines/cancellation? stream termination? |
| Messaging | Duplicates/redelivery? ordering? retries? dead-letter flow? |
| Email/file transfer | Authentication? encoding? large payloads? interruption? permissions? |

Головний принцип: **тестуй failure model саме того protocol, який реально використовує system**, а не застосовуй один generic network checklist до всього.

## Embedded & IoT scope boundary

Embedded та IoT communication має окремий layered curriculum і не повинно бути змішане з цим Internet/backend protocol survey.

Окремий track варто структурувати так:

| Layer / family | Technologies |
|---|---|
| Local peripheral buses | UART, I²C, SPI |
| Wired embedded/industrial | CAN / CAN FD, LIN, RS-232, RS-485, Modbus |
| Short-range wireless | Bluetooth Classic, Bluetooth LE, Zigbee, Thread |
| IP/local connectivity | Wi-Fi, Ethernet, IPv6/6LoWPAN |
| Long-range / wide-area | LTE/4G/5G, NB-IoT/LTE-M where relevant, LoRaWAN |
| IoT application protocols | MQTT, CoAP |
| Smart-home application layer | Matter |
| Host/device connectivity | USB |

Це не peers одного protocol layer. Наприклад, Thread — IPv6-based low-power mesh network, Matter — application-layer ecosystem over IP networks such as Thread/Wi-Fi/Ethernet, MQTT/CoAP — application-layer protocols, а Bluetooth LE — повний wireless stack з radio/link та higher-layer concepts.

Плоский список з усіх цих назв повторив би ту саму structural mistake, якої цей Networking chapter намагається уникнути.

## Sources

- [RFC 8200 — Internet Protocol, Version 6](https://www.rfc-editor.org/rfc/rfc8200)
- [RFC 9293 — Transmission Control Protocol (TCP)](https://www.rfc-editor.org/rfc/rfc9293)
- [RFC 768 — User Datagram Protocol](https://www.rfc-editor.org/rfc/rfc768)
- [RFC 9000 — QUIC](https://www.rfc-editor.org/rfc/rfc9000)
- [RFC 8446 — TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446)
- [RFC 1034 — DNS concepts](https://www.rfc-editor.org/rfc/rfc1034)
- [RFC 9112 — HTTP/1.1](https://www.rfc-editor.org/rfc/rfc9112)
- [RFC 9113 — HTTP/2](https://www.rfc-editor.org/rfc/rfc9113)
- [RFC 9114 — HTTP/3](https://www.rfc-editor.org/rfc/rfc9114)
- [RFC 6455 — WebSocket](https://www.rfc-editor.org/rfc/rfc6455)
- [gRPC Core Concepts](https://grpc.io/docs/what-is-grpc/core-concepts/)
- [OASIS AMQP 1.0](https://docs.oasis-open.org/amqp/core/v1.0/os/amqp-core-overview-v1.0-os.html)
- [RFC 5321 — SMTP](https://www.rfc-editor.org/rfc/rfc5321)
- [RFC 9051 — IMAP4rev2](https://www.rfc-editor.org/rfc/rfc9051)
- [RFC 1939 — POP3](https://www.rfc-editor.org/rfc/rfc1939)
- [RFC 959 — FTP](https://www.rfc-editor.org/rfc/rfc959)
- [RFC 4251 — SSH Protocol Architecture](https://www.rfc-editor.org/rfc/rfc4251)
- [Bluetooth SIG — Bluetooth technology overview](https://www.bluetooth.com/learn-about-bluetooth/tech-overview/)
- [Thread Group — What is Thread?](https://threadgroup.org/)
- [RFC 7252 — CoAP](https://www.rfc-editor.org/rfc/rfc7252)
`;

export const protocolsGuide = { markdown, markdownUk };
export default protocolsGuide;
