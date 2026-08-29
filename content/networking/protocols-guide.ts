const markdown = String.raw`This chapter answers a different question from the HTTP API chapter: **how do systems actually communicate, and why would one protocol be chosen instead of another?**

Use it as a map of the network/application protocol landscape. For HTTP methods, CRUD vs REST, headers, status codes, authentication, files, caching and CORS, continue with **HTTP API semantics** after this chapter.

## 1. Start with the stack, not a protocol list

A useful QA mental model is to follow data from the application down to the network and back:

| Layer / responsibility | Examples | What QA usually observes |
|---|---|---|
| Application communication | HTTP, WebSocket, gRPC, MQTT, AMQP, SMTP, IMAP | Requests, messages, commands, events, response/error semantics |
| Security/session | TLS | Certificates, encryption, protocol negotiation, trust failures |
| Transport | TCP, UDP, QUIC | Connections, streams, packets/datagrams, loss, retransmission, latency |
| Internet/network | IP | Addressing and routing between hosts |
| Name resolution | DNS | Mapping names such as api.example.com to addresses |

This is deliberately practical rather than a full OSI-model memorization exercise. A production request often crosses several protocols in sequence. For example:

~~~text
Browser
  -> DNS resolves api.example.com
  -> TCP connection or QUIC transport
  -> TLS protects the connection
  -> HTTP carries request/response semantics
  -> the application returns JSON
~~~

**A data format is not a transport protocol.** JSON, XML, Protocol Buffers and MessagePack describe data representation. They may be carried by different protocols.

**REST is not a network protocol.** REST is an architectural style commonly implemented with HTTP.

**GraphQL is not a transport protocol.** It is a query language and execution model, commonly carried over HTTP; subscriptions may use WebSocket or other transports.

## 2. TCP, UDP, ports and connections

### TCP

TCP provides an ordered, reliable byte stream between endpoints. It handles sequencing, retransmission and flow control. Applications such as HTTP/1.1, HTTP/2, SSH, SMTP and many database protocols commonly run over TCP.

From a QA perspective, TCP matters because:

- a connection must normally be established before application data is exchanged;
- lost data is retransmitted rather than silently skipped;
- bytes are ordered, but **message boundaries are not preserved** — the application protocol defines framing;
- one slow/lost segment can delay later bytes on the same TCP connection;
- connection resets, idle timeouts and half-open connections create application-visible failures.

### UDP

UDP sends independent datagrams without TCP-style delivery, ordering or retransmission guarantees. It has lower protocol overhead and lets an application implement the reliability model it actually needs.

Typical uses include DNS queries, media, telemetry and transports such as QUIC.

### TCP vs UDP

| Property | TCP | UDP |
|---|---|---|
| Connection-oriented | Yes | No TCP-style connection |
| Reliable delivery | Yes, or reports connection failure | Not guaranteed by UDP itself |
| Ordering | Yes | Not guaranteed |
| Message boundaries | No, byte stream | Yes, datagrams |
| Built-in retransmission | Yes | No |
| Typical QA concern | resets, timeouts, stream stalls | loss, duplicates, reordering, MTU/size |

### Ports

A port helps identify a service endpoint on a host. Default ports are conventions, not proof of which protocol is actually running.

| Common default | Protocol/use |
|---:|---|
| 22 | SSH, usually SFTP over SSH |
| 25 / 587 | SMTP relay / message submission |
| 53 | DNS |
| 80 | HTTP, ws |
| 110 / 995 | POP3 / POP3 over TLS |
| 143 / 993 | IMAP / IMAP over TLS |
| 443 | HTTPS, wss, often gRPC over TLS |
| 1883 / 8883 | MQTT / MQTT over TLS |
| 5672 / 5671 | AMQP / AMQP over TLS |

Services can be configured on other ports, and several protocols can share port 443 through TLS/application negotiation and routing.

## 3. TLS: security under application protocols

TLS protects communication in transit. Modern HTTPS is HTTP over a TLS-protected transport. TLS can also protect MQTT, SMTP, IMAP, AMQP and other protocols.

TLS provides three core properties:

1. **Confidentiality** — observers should not be able to read protected application data.
2. **Integrity** — modification in transit should be detected.
3. **Peer authentication** — normally the client validates the server certificate; with mTLS, both sides authenticate using certificates.

A simplified HTTPS setup is:

~~~text
DNS -> transport connection -> TLS handshake -> HTTP messages
~~~

Important QA failures include:

- expired or not-yet-valid certificate;
- hostname does not match certificate identity;
- untrusted issuer / incomplete certificate chain;
- unsupported TLS version or cipher configuration;
- client certificate missing/invalid in mTLS;
- SNI or ALPN negotiation selects the wrong virtual host/protocol;
- certificate renewal works on one node but not another.

**HTTPS does not mean the user is authenticated to the API.** TLS protects/authenticates the connection; application authentication and authorization remain separate.

## 4. DNS: the protocol before the connection

DNS translates names into records used to find services. A failed API call can therefore be a DNS problem before HTTP is ever attempted.

High-value record types:

| Record | Purpose |
|---|---|
| A | Hostname -> IPv4 address |
| AAAA | Hostname -> IPv6 address |
| CNAME | Alias to another canonical name |
| MX | Mail exchanger for a domain |
| TXT | Arbitrary text; often verification/security metadata |
| NS | Authoritative name servers |
| SRV | Service discovery with host/port metadata |

QA should understand **TTL and caching**. After a DNS change, different clients/resolvers may temporarily see different answers until cached records expire.

Useful questions when a service is unreachable:

- Does the hostname resolve at all?
- Does it resolve to the expected IPv4/IPv6 address?
- Is only one resolver/network affected?
- Has a recent DNS change not propagated through caches yet?
- Does the TLS certificate match the hostname that DNS ultimately leads to?

## 5. HTTP family: HTTP/1.1, HTTP/2 and HTTP/3

All modern HTTP versions share the same core semantics: methods, resource targets, status codes and fields/headers. What changes substantially is **how messages are transported and framed**.

### HTTP/1.1

HTTP/1.1 uses a human-readable textual message syntax and normally runs over TCP. Persistent connections allow multiple requests over the same connection, but concurrent work is limited compared with later versions.

### HTTP/2

HTTP/2 keeps HTTP semantics but introduces binary framing, multiplexed streams and header compression over a single connection, normally TLS over TCP on the public web.

The practical benefit is that several HTTP requests/responses can progress concurrently without requiring one TCP connection per request. However, packet loss in the underlying TCP connection can still delay all streams at the transport layer.

### HTTP/3 and QUIC

HTTP/3 carries HTTP semantics over QUIC. QUIC is a secure multiplexed transport built over UDP. Independent streams reduce the cross-stream transport blocking associated with a single TCP byte stream, and connection establishment can require fewer round trips in common cases.

| Version | Typical transport | Message representation | Multiplexing |
|---|---|---|---|
| HTTP/1.1 | TCP, often TLS | Textual HTTP/1.1 syntax | No HTTP-level multiplexing |
| HTTP/2 | TCP + usually TLS | Binary frames | Yes |
| HTTP/3 | QUIC over UDP | HTTP/3 frames | Yes, independent QUIC streams |

For API functional testing, method/status/header semantics usually remain the same. For performance, proxy, firewall, packet-loss and compatibility testing, the version can matter substantially.

The dedicated **HTTP API semantics** chapter covers methods, REST, headers, statuses, authentication, files, caching and CORS in detail.

## 6. Real-time delivery: WebSocket, SSE and polling

These mechanisms are often compared because all can deliver updates, but their communication models differ.

### WebSocket

WebSocket begins with an HTTP/1.1 upgrade handshake in the classic form and then switches to the WebSocket protocol. It provides a long-lived, bidirectional message channel.

Use it when both client and server need to send messages independently with low overhead, for example collaborative applications, games, trading dashboards or interactive device control.

The separate **WebSocket: build, test & debug** chapter covers handshake, frames, ping/pong, reconnects, backpressure, authentication and automation.

### Server-Sent Events (SSE)

SSE keeps an HTTP response open and delivers a text event stream from server to browser. It is primarily **server -> client**. Browser EventSource support includes reconnection behavior.

Use it when the server needs to push updates but the client can send its commands through ordinary HTTP requests.

### Polling / long polling

Polling is an application pattern over HTTP, not a separate protocol. The client repeatedly asks for updates. Long polling keeps a request open until data is available or a timeout occurs, then reconnects.

| Mechanism | Direction | Connection model | Strong fit |
|---|---|---|---|
| Normal polling | Client requests repeatedly | Repeated HTTP requests | Simple/low-frequency updates |
| Long polling | Server delays HTTP response | Repeated long HTTP requests | Compatibility without WebSocket |
| SSE | Server -> client | Long-lived HTTP stream | Notifications, feeds, progress |
| WebSocket | Both directions | Long-lived WebSocket connection | Interactive real-time traffic |

## 7. gRPC: remote procedure calls over HTTP/2

gRPC is an RPC framework rather than a replacement for TCP/IP. A service defines callable methods and strongly typed request/response messages, normally using Protocol Buffers as the interface definition and serialization format. gRPC commonly uses HTTP/2 as its transport.

Four interaction shapes matter:

1. **Unary** — one request, one response.
2. **Server streaming** — one request, stream of responses.
3. **Client streaming** — stream of requests, one response.
4. **Bidirectional streaming** — both sides stream messages.

QA focus:

- schema/contract compatibility;
- exact field types and optional/default behavior;
- gRPC status codes and error details, not only HTTP status;
- deadlines/timeouts and cancellation;
- metadata/authentication;
- stream ordering, cancellation and partial completion;
- backwards/forwards compatibility of Protocol Buffer changes;
- load behavior of long-lived streams.

Do not describe gRPC as “just JSON over HTTP/2.” Its service contract, framing and common serialization model are different from a typical REST-style JSON API.

## 8. Messaging protocols: MQTT and AMQP

Request/response is not the only integration model. Messaging systems decouple producers from consumers and introduce concepts such as brokers, queues/topics, acknowledgements, redelivery and eventual consistency.

### MQTT

MQTT is a lightweight publish/subscribe messaging protocol widely used for IoT and constrained environments. Clients connect to a broker, publish messages to topics and subscribe to topic filters.

Key MQTT concepts:

- broker;
- topic/topic filter;
- retained message;
- persistent/session state;
- keep alive;
- Last Will and Testament;
- QoS 0 — at most once delivery;
- QoS 1 — at least once delivery, therefore duplicates are possible;
- QoS 2 — exactly once delivery at the MQTT protocol level through a larger handshake.

A QA test must not assume QoS 1 means “one message only.” Consumers should be designed/tested for duplicates when at-least-once delivery is used.

### AMQP 1.0

AMQP 1.0 is a binary messaging protocol designed for interoperable messaging between systems. Products may expose broker abstractions such as queues/topics/exchanges, but application-visible concepts depend on the broker and API in use.

QA focus for brokered messaging:

- delivery guarantee and acknowledgement behavior;
- redelivery after consumer failure;
- duplicate handling/idempotent consumers;
- ordering guarantees and partitioning/concurrency;
- dead-letter/error handling;
- retry delay/backoff;
- message expiry/TTL;
- reconnect and session recovery;
- authorization per topic/queue/address;
- backpressure and broker limits.

## 9. Email protocols: SMTP, IMAP and POP3

Email uses different protocols for sending and retrieving messages.

### SMTP

SMTP transfers/submits email. A mail client commonly submits outgoing mail to a server, and mail servers use SMTP to relay mail onward.

### IMAP

IMAP is designed for mailbox access while messages remain managed on the server. It supports folders/mailboxes, flags and synchronization across clients.

### POP3

POP3 is a simpler retrieval model traditionally oriented around downloading messages from a mailbox.

A useful mental model:

~~~text
Sender/client --SMTP--> sending mail server --SMTP--> receiving mail server
                                                   |
                                      IMAP or POP3 |
                                                   v
                                            recipient/client
~~~

QA scenarios include TLS requirements, authentication, attachments/MIME, Unicode headers/body, large messages, duplicates, delayed delivery, spam/rejection responses, mailbox state synchronization and connection interruption.

## 10. File transfer and remote administration: FTP, SFTP and SSH

These names are often mixed up.

### FTP

FTP is a file transfer protocol with separate control/data connection behavior. Classic FTP does not provide SSH-style security by itself. FTPS means FTP protected with TLS.

### SSH

SSH provides secure remote login and other secure channel capabilities over an untrusted network.

### SFTP

SFTP is the **SSH File Transfer Protocol**. It runs over SSH and is not “FTP with SSH added.” Its protocol and connection model are different from FTP/FTPS.

| Term | What it is | Security relationship |
|---|---|---|
| FTP | File Transfer Protocol | Plain unless separately protected |
| FTPS | FTP over TLS | TLS protects FTP |
| SSH | Secure Shell protocol | Secure remote channel/login |
| SFTP | SSH File Transfer Protocol | Runs as an SSH subsystem/channel |

QA should test authentication method, permissions/chroot boundaries, path handling, overwrite rules, partial/interrupted transfer, resume behavior if supported, file integrity/hash, large files, concurrent transfers and audit logging.

## 11. Choosing a communication mechanism

Do not choose by popularity alone. Start from the interaction model and failure requirements.

| Need | Often appropriate | Why |
|---|---|---|
| Browser/API request-response | HTTP | Universal semantics/tooling/caching/proxies |
| Typed internal RPC | gRPC | Strong contracts, streaming, efficient binary framing |
| Bidirectional real-time session | WebSocket | Both peers can push messages |
| Server push to browser only | SSE | Simpler HTTP streaming model |
| IoT publish/subscribe | MQTT | Lightweight brokered pub/sub and QoS options |
| Enterprise brokered messaging | AMQP / broker protocol | Async delivery, settlement/routing patterns |
| Email transfer | SMTP | Standard mail transfer/submission |
| Mailbox synchronization | IMAP | Server-managed mailbox model |
| Secure remote file transfer | SFTP | Secure transfer over SSH |

The same product can legitimately use several at once: HTTPS for its public API, WebSocket for live updates, gRPC between services, MQTT for devices and SMTP for notifications.

## 12. Protocol testing: a repeatable QA workflow

When integration fails, isolate the layer instead of immediately blaming “the API.”

1. **Name resolution** — does DNS return the expected address/service?
2. **Reachability** — can the client reach the host/port through routing/firewall/proxy rules?
3. **Transport** — does TCP connect, or is UDP/QUIC traffic permitted?
4. **TLS** — does certificate validation and protocol negotiation succeed?
5. **Application protocol** — is the peer speaking the protocol/version you expect?
6. **Authentication/authorization** — are credentials accepted and permissions correct?
7. **Payload/contract** — are framing, schema, encoding and semantic rules correct?
8. **State/reliability** — retries, duplicate delivery, reconnects, ordering and timeouts.

Useful tools by layer:

| Tool | Typical use |
|---|---|
| Browser DevTools Network | HTTP versions, requests, responses, CORS, timing, WebSocket frames |
| curl | HTTP/HTTPS behavior and protocol/version experiments |
| nslookup / dig | DNS records and resolver behavior |
| openssl s_client | TLS handshake, certificate chain and negotiated protocol inspection |
| nc / netcat | Basic TCP/UDP reachability and manual text-protocol experiments |
| grpcurl | Explore/test gRPC services when reflection/descriptors are available |
| wscat / websocat | Interactive WebSocket client |
| mosquitto_pub / mosquitto_sub | MQTT publish/subscribe testing |
| Wireshark | Packet/protocol capture when lower-layer visibility is necessary |

Do not use packet capture as the first tool for every defect. Start at the highest layer that can disprove a hypothesis, then move downward.

## 13. Practical QA exercises

### Exercise 1 — classify the layers

For an HTTPS API call, identify which part is DNS, transport, TLS, HTTP and JSON. Then explain which layer owns a certificate error, a 404, malformed JSON and a DNS NXDOMAIN result.

### Exercise 2 — compare HTTP versions

Use a client that can report the negotiated HTTP version. Call the same HTTPS endpoint and inspect whether HTTP/1.1, HTTP/2 or HTTP/3 is used. Confirm that application semantics stay consistent even when transport/framing differs.

### Exercise 3 — reproduce a DNS failure

Query a real hostname and a deliberately invalid hostname. Distinguish DNS resolution failure from connection refusal and from an HTTP 404 response.

### Exercise 4 — TLS diagnosis

Inspect a public TLS endpoint. Identify certificate subject/alternative names, issuer, validity dates and negotiated protocol. Explain why a valid certificate for another hostname still fails verification.

### Exercise 5 — WebSocket vs SSE

Design a live build-progress screen twice: once with SSE and once with WebSocket. State which direction each side must send data and justify which mechanism is simpler.

### Exercise 6 — MQTT duplicate handling

Design a test where a QoS 1 message is redelivered. Verify that the consumer handles duplicate delivery without producing duplicate business effects.

### Exercise 7 — integration incident triage

Given “the API is down,” write evidence checks in this order: DNS -> reachability -> TLS -> HTTP -> authentication -> application dependency. The exercise is complete only when each failure can be distinguished from the next one.

## Sources

- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)
- [RFC 9112 — HTTP/1.1](https://www.rfc-editor.org/rfc/rfc9112)
- [RFC 9113 — HTTP/2](https://www.rfc-editor.org/rfc/rfc9113)
- [RFC 9114 — HTTP/3](https://www.rfc-editor.org/rfc/rfc9114)
- [RFC 9000 — QUIC](https://www.rfc-editor.org/rfc/rfc9000)
- [RFC 9293 — Transmission Control Protocol (TCP)](https://www.rfc-editor.org/rfc/rfc9293)
- [RFC 768 — User Datagram Protocol](https://www.rfc-editor.org/rfc/rfc768)
- [RFC 8446 — TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446)
- [RFC 1034 / RFC 1035 — Domain Names / DNS](https://www.rfc-editor.org/rfc/rfc1034)
- [RFC 6455 — WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455)
- [MDN — Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [gRPC — Core concepts, architecture and lifecycle](https://grpc.io/docs/what-is-grpc/core-concepts/)
- [OASIS — MQTT Version 5.0](https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html)
- [OASIS — AMQP Version 1.0](https://docs.oasis-open.org/amqp/core/v1.0/amqp-core-overview-v1.0.html)
- [RFC 5321 — SMTP](https://www.rfc-editor.org/rfc/rfc5321)
- [RFC 9051 — IMAP4rev2](https://www.rfc-editor.org/rfc/rfc9051)
- [RFC 1939 — POP3](https://www.rfc-editor.org/rfc/rfc1939)
- [RFC 959 — FTP](https://www.rfc-editor.org/rfc/rfc959)
- [RFC 4251 — SSH Protocol Architecture](https://www.rfc-editor.org/rfc/rfc4251)
`;

const markdownUk = String.raw`Цей розділ відповідає на інше питання, ніж HTTP API chapter: **як системи фактично спілкуються і чому обирають один protocol замість іншого?**

Використовуй його як карту network/application protocols. Для HTTP methods, CRUD vs REST, headers, status codes, authentication, files, caching та CORS переходь далі до окремого розділу **HTTP API semantics**.

## 1. Починай зі stack, а не зі списку protocol names

Практична QA mental model — простежити дані від application до network і назад:

| Layer / responsibility | Examples | Що зазвичай бачить QA |
|---|---|---|
| Application communication | HTTP, WebSocket, gRPC, MQTT, AMQP, SMTP, IMAP | Requests, messages, commands, events, response/error semantics |
| Security/session | TLS | Certificates, encryption, protocol negotiation, trust failures |
| Transport | TCP, UDP, QUIC | Connections, streams, packets/datagrams, loss, retransmission, latency |
| Internet/network | IP | Addressing і routing між hosts |
| Name resolution | DNS | Перетворення api.example.com на addresses |

Це навмисно практична модель, а не вправа на запам'ятовування повного OSI model. Один production request часто використовує кілька protocols послідовно:

~~~text
Browser
  -> DNS resolves api.example.com
  -> TCP connection або QUIC transport
  -> TLS protects the connection
  -> HTTP carries request/response semantics
  -> application returns JSON
~~~

**Data format — не transport protocol.** JSON, XML, Protocol Buffers та MessagePack описують representation даних і можуть передаватися різними protocols.

**REST — не network protocol.** Це architectural style, який дуже часто реалізується через HTTP.

**GraphQL — не transport protocol.** Це query language та execution model, який зазвичай працює поверх HTTP; subscriptions можуть використовувати WebSocket або інші transports.

## 2. TCP, UDP, ports та connections

### TCP

TCP надає ordered reliable byte stream між endpoints. Він відповідає за sequencing, retransmission та flow control. HTTP/1.1, HTTP/2, SSH, SMTP і багато database protocols зазвичай працюють поверх TCP.

Для QA важливо:

- connection зазвичай треба встановити до обміну application data;
- втрачені дані retransmit-яться, а не просто пропускаються;
- bytes ordered, але **message boundaries не зберігаються** — framing визначає application protocol;
- втрата segment може затримати наступні bytes у тому ж TCP connection;
- resets, idle timeouts та half-open connections стають application-visible failures.

### UDP

UDP передає незалежні datagrams без TCP-style гарантій delivery, ordering та retransmission. Це менший protocol overhead і більше контролю для application.

Типові use cases: DNS queries, media, telemetry та transports на кшталт QUIC.

### TCP vs UDP

| Property | TCP | UDP |
|---|---|---|
| Connection-oriented | Так | Немає TCP-style connection |
| Reliable delivery | Так або connection failure | UDP сам по собі не гарантує |
| Ordering | Так | Не гарантується |
| Message boundaries | Ні, byte stream | Так, datagrams |
| Built-in retransmission | Так | Ні |
| Typical QA concern | resets, timeouts, stream stalls | loss, duplicates, reordering, MTU/size |

### Ports

Port допомагає визначити service endpoint на host. Default ports — convention, а не доказ того, який protocol реально працює.

| Common default | Protocol/use |
|---:|---|
| 22 | SSH, зазвичай SFTP over SSH |
| 25 / 587 | SMTP relay / message submission |
| 53 | DNS |
| 80 | HTTP, ws |
| 110 / 995 | POP3 / POP3 over TLS |
| 143 / 993 | IMAP / IMAP over TLS |
| 443 | HTTPS, wss, часто gRPC over TLS |
| 1883 / 8883 | MQTT / MQTT over TLS |
| 5672 / 5671 | AMQP / AMQP over TLS |

Services можуть працювати на інших ports, а кілька protocols можуть використовувати 443 завдяки TLS/application negotiation та routing.

## 3. TLS: security під application protocols

TLS захищає communication in transit. HTTPS — це HTTP поверх TLS-protected transport. TLS також може захищати MQTT, SMTP, IMAP, AMQP та інші protocols.

Три core properties:

1. **Confidentiality** — сторонній observer не повинен читати protected application data.
2. **Integrity** — modification in transit має виявлятися.
3. **Peer authentication** — зазвичай client перевіряє server certificate; у mTLS certificates мають обидві сторони.

Спрощений HTTPS setup:

~~~text
DNS -> transport connection -> TLS handshake -> HTTP messages
~~~

Важливі QA failures:

- certificate expired або not-yet-valid;
- hostname не відповідає certificate identity;
- untrusted issuer / incomplete certificate chain;
- unsupported TLS version або cipher configuration;
- client certificate missing/invalid у mTLS;
- SNI або ALPN обирають не той virtual host/protocol;
- certificate renewal працює на одному node, але не на іншому.

**HTTPS не означає, що user authenticated в API.** TLS захищає/authenticates connection; application authentication та authorization окремі.

## 4. DNS: protocol до connection

DNS перетворює names на records, за якими знаходять services. Тому API call може впасти через DNS ще до будь-якого HTTP request.

High-value record types:

| Record | Purpose |
|---|---|
| A | Hostname -> IPv4 address |
| AAAA | Hostname -> IPv6 address |
| CNAME | Alias на canonical name |
| MX | Mail exchanger domain |
| TXT | Text metadata, часто verification/security |
| NS | Authoritative name servers |
| SRV | Service discovery з host/port metadata |

QA має розуміти **TTL та caching**. Після DNS change різні clients/resolvers можуть тимчасово бачити різні answers, доки cache не expire.

Перевіряй:

- hostname взагалі resolve-иться?
- повертається правильний IPv4/IPv6?
- проблема лише в одному resolver/network?
- recent DNS change ще знаходиться в cache?
- TLS certificate відповідає hostname, за яким фактично йде connection?

## 5. HTTP family: HTTP/1.1, HTTP/2 та HTTP/3

Усі modern HTTP versions мають однакові core semantics: methods, resource targets, status codes та fields/headers. Суттєво змінюється **transport і framing messages**.

### HTTP/1.1

HTTP/1.1 використовує human-readable text message syntax і зазвичай TCP. Persistent connections дозволяють повторно використовувати connection, але concurrency обмеженіша, ніж у новіших versions.

### HTTP/2

HTTP/2 зберігає HTTP semantics, але додає binary framing, multiplexed streams та header compression поверх одного connection, зазвичай TLS over TCP у public web.

Кілька HTTP requests/responses можуть прогресувати одночасно без окремого TCP connection на кожен request. Але packet loss у underlying TCP може все одно затримати всі streams transport layer.

### HTTP/3 та QUIC

HTTP/3 передає HTTP semantics через QUIC. QUIC — secure multiplexed transport поверх UDP. Independent streams зменшують cross-stream transport blocking одного TCP byte stream і можуть скоротити connection-establishment round trips.

| Version | Typical transport | Message representation | Multiplexing |
|---|---|---|---|
| HTTP/1.1 | TCP, often TLS | Textual HTTP/1.1 syntax | Немає HTTP-level multiplexing |
| HTTP/2 | TCP + usually TLS | Binary frames | Так |
| HTTP/3 | QUIC over UDP | HTTP/3 frames | Так, independent QUIC streams |

Для functional API testing methods/status/header semantics зазвичай ті самі. Для performance, proxy, firewall, packet-loss та compatibility testing HTTP version може бути суттєвим.

Окремий розділ **HTTP API semantics** детально покриває methods, REST, headers, statuses, authentication, files, caching та CORS.

## 6. Real-time delivery: WebSocket, SSE та polling

Їх часто порівнюють, бо всі можуть доставляти updates, але communication models різні.

### WebSocket

У класичному варіанті WebSocket починається з HTTP/1.1 upgrade handshake, після чого connection переходить на WebSocket protocol. Це long-lived bidirectional message channel.

Підходить, коли і client, і server мають незалежно push-ити messages: collaborative apps, games, trading dashboards, device control.

Окремий розділ **WebSocket: build, test & debug** покриває handshake, frames, ping/pong, reconnects, backpressure, authentication та automation.

### Server-Sent Events (SSE)

SSE тримає HTTP response відкритим і передає text event stream від server до browser. Напрям переважно **server -> client**. Browser EventSource має reconnect behavior.

Добре підходить, коли server push-ить updates, а client commands може надсилати звичайними HTTP requests.

### Polling / long polling

Polling — application pattern поверх HTTP, а не окремий protocol. Client регулярно питає про updates. Long polling тримає request відкритим до появи data або timeout, після чого reconnect.

| Mechanism | Direction | Connection model | Strong fit |
|---|---|---|---|
| Normal polling | Client requests repeatedly | Repeated HTTP requests | Simple/low-frequency updates |
| Long polling | Server delays HTTP response | Repeated long HTTP requests | Compatibility without WebSocket |
| SSE | Server -> client | Long-lived HTTP stream | Notifications, feeds, progress |
| WebSocket | Both directions | Long-lived WebSocket connection | Interactive real-time traffic |

## 7. gRPC: remote procedure calls over HTTP/2

gRPC — RPC framework, а не replacement для TCP/IP. Service визначає callable methods і strongly typed request/response messages, зазвичай через Protocol Buffers як interface definition та serialization format. gRPC переважно використовує HTTP/2 як transport.

Чотири interaction shapes:

1. **Unary** — один request, один response.
2. **Server streaming** — один request, stream responses.
3. **Client streaming** — stream requests, один response.
4. **Bidirectional streaming** — обидві сторони stream-ять messages.

QA focus:

- schema/contract compatibility;
- exact field types та optional/default behavior;
- gRPC status codes та error details, не тільки HTTP status;
- deadlines/timeouts і cancellation;
- metadata/authentication;
- stream ordering, cancellation та partial completion;
- backwards/forwards compatibility Protocol Buffer changes;
- load behavior long-lived streams.

Не називай gRPC “просто JSON over HTTP/2”. Service contract, framing та typical serialization model інші.

## 8. Messaging protocols: MQTT та AMQP

Request/response — не єдина integration model. Messaging systems decouple producers від consumers і додають brokers, queues/topics, acknowledgements, redelivery та eventual consistency.

### MQTT

MQTT — lightweight publish/subscribe protocol, популярний у IoT та constrained environments. Clients connect до broker, publish messages у topics і subscribe на topic filters.

Key concepts:

- broker;
- topic/topic filter;
- retained message;
- persistent/session state;
- keep alive;
- Last Will and Testament;
- QoS 0 — at most once delivery;
- QoS 1 — at least once, тому duplicates можливі;
- QoS 2 — exactly once delivery на MQTT protocol level через більший handshake.

QA test не повинен припускати, що QoS 1 означає “рівно одне повідомлення”. Consumer треба тестувати на duplicates.

### AMQP 1.0

AMQP 1.0 — binary messaging protocol для interoperable messaging між systems. Products можуть давати abstractions на кшталт queues/topics/exchanges, але application-visible concepts залежать від конкретного broker/API.

QA focus для messaging:

- delivery guarantee та acknowledgement behavior;
- redelivery після consumer failure;
- duplicate handling/idempotent consumers;
- ordering guarantees та partitioning/concurrency;
- dead-letter/error handling;
- retry delay/backoff;
- message expiry/TTL;
- reconnect і session recovery;
- authorization per topic/queue/address;
- backpressure та broker limits.

## 9. Email protocols: SMTP, IMAP та POP3

Email використовує різні protocols для sending та retrieving messages.

### SMTP

SMTP передає/submits email. Mail client зазвичай submit-ить outgoing mail на server, а mail servers relay-ять messages через SMTP далі.

### IMAP

IMAP призначений для mailbox access, коли messages залишаються managed на server. Підтримує folders/mailboxes, flags та synchronization між clients.

### POP3

POP3 — простіша retrieval model, історично орієнтована на downloading messages з mailbox.

~~~text
Sender/client --SMTP--> sending mail server --SMTP--> receiving mail server
                                                   |
                                      IMAP or POP3 |
                                                   v
                                            recipient/client
~~~

QA scenarios: TLS requirements, authentication, attachments/MIME, Unicode headers/body, large messages, duplicates, delayed delivery, spam/rejection responses, mailbox synchronization та interrupted connections.

## 10. File transfer та remote administration: FTP, SFTP та SSH

Ці names часто плутають.

### FTP

FTP — file transfer protocol із окремою control/data connection поведінкою. Classic FTP сам по собі не дає SSH-style security. FTPS — FTP protected by TLS.

### SSH

SSH дає secure remote login та інші secure channel capabilities через untrusted network.

### SFTP

SFTP — **SSH File Transfer Protocol**. Він працює поверх SSH і не є “FTP + SSH”. Protocol та connection model інші.

| Term | Що це | Security relationship |
|---|---|---|
| FTP | File Transfer Protocol | Plain, якщо окремо не protected |
| FTPS | FTP over TLS | TLS захищає FTP |
| SSH | Secure Shell protocol | Secure remote channel/login |
| SFTP | SSH File Transfer Protocol | SSH subsystem/channel |

QA: authentication method, permissions/chroot boundaries, path handling, overwrite rules, partial/interrupted transfer, resume if supported, file integrity/hash, large files, concurrent transfers та audit logging.

## 11. Як обирати communication mechanism

Не обирай protocol лише за popularity. Почни з interaction model та failure requirements.

| Need | Often appropriate | Why |
|---|---|---|
| Browser/API request-response | HTTP | Universal semantics/tooling/caching/proxies |
| Typed internal RPC | gRPC | Strong contracts, streaming, efficient binary framing |
| Bidirectional real-time session | WebSocket | Both peers can push messages |
| Server push to browser only | SSE | Simpler HTTP streaming model |
| IoT publish/subscribe | MQTT | Lightweight brokered pub/sub та QoS |
| Enterprise brokered messaging | AMQP / broker protocol | Async delivery, settlement/routing patterns |
| Email transfer | SMTP | Standard mail transfer/submission |
| Mailbox synchronization | IMAP | Server-managed mailbox model |
| Secure remote file transfer | SFTP | Secure transfer over SSH |

Один product може одночасно використовувати HTTPS для public API, WebSocket для live updates, gRPC між services, MQTT для devices і SMTP для notifications.

## 12. Protocol testing: repeatable QA workflow

Коли integration падає, ізолюй layer, а не одразу кажи “API broken”.

1. **Name resolution** — DNS повертає expected address/service?
2. **Reachability** — host/port доступний через routing/firewall/proxy?
3. **Transport** — TCP connect працює або UDP/QUIC traffic дозволений?
4. **TLS** — certificate validation та protocol negotiation успішні?
5. **Application protocol** — peer говорить очікуваним protocol/version?
6. **Authentication/authorization** — credentials і permissions правильні?
7. **Payload/contract** — framing, schema, encoding та semantic rules правильні?
8. **State/reliability** — retries, duplicates, reconnects, ordering, timeouts.

Tools:

| Tool | Typical use |
|---|---|
| Browser DevTools Network | HTTP versions, requests, responses, CORS, timing, WebSocket frames |
| curl | HTTP/HTTPS behavior та protocol/version experiments |
| nslookup / dig | DNS records та resolver behavior |
| openssl s_client | TLS handshake, certificate chain, negotiated protocol |
| nc / netcat | Basic TCP/UDP reachability, manual text-protocol experiments |
| grpcurl | gRPC service testing при доступних reflection/descriptors |
| wscat / websocat | Interactive WebSocket client |
| mosquitto_pub / mosquitto_sub | MQTT publish/subscribe |
| Wireshark | Packet/protocol capture для lower-layer analysis |

Packet capture не має бути першим інструментом для кожного bug. Починай з найвищого layer, де можна швидко спростувати hypothesis, і рухайся вниз лише за потреби.

## 13. Практичні QA вправи

### Exercise 1 — classify layers

Для HTTPS API call визнач DNS, transport, TLS, HTTP та JSON. Потім скажи, який layer відповідає за certificate error, 404, malformed JSON та DNS NXDOMAIN.

### Exercise 2 — compare HTTP versions

Використай client, що показує negotiated HTTP version. Виконай той самий HTTPS call через HTTP/1.1, HTTP/2 або HTTP/3 де підтримується. Перевір, що application semantics лишаються consistent.

### Exercise 3 — reproduce DNS failure

Query real hostname та deliberately invalid hostname. Відрізни DNS resolution failure від connection refused та HTTP 404.

### Exercise 4 — TLS diagnosis

Inspect public TLS endpoint: certificate identities, issuer, validity dates та negotiated protocol. Поясни, чому valid certificate для іншого hostname все одно fail-ить verification.

### Exercise 5 — WebSocket vs SSE

Спроєктуй live build-progress screen через SSE і через WebSocket. Визнач direction traffic та поясни, який mechanism простіший.

### Exercise 6 — MQTT duplicate handling

Спроєктуй test, де QoS 1 message redelivered. Перевір, що consumer не створює duplicate business effect.

### Exercise 7 — integration incident triage

Для повідомлення “API is down” побудуй checks: DNS -> reachability -> TLS -> HTTP -> authentication -> application dependency. Для кожного failure має бути окремий observable evidence.

## Sources

- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)
- [RFC 9112 — HTTP/1.1](https://www.rfc-editor.org/rfc/rfc9112)
- [RFC 9113 — HTTP/2](https://www.rfc-editor.org/rfc/rfc9113)
- [RFC 9114 — HTTP/3](https://www.rfc-editor.org/rfc/rfc9114)
- [RFC 9000 — QUIC](https://www.rfc-editor.org/rfc/rfc9000)
- [RFC 9293 — TCP](https://www.rfc-editor.org/rfc/rfc9293)
- [RFC 768 — UDP](https://www.rfc-editor.org/rfc/rfc768)
- [RFC 8446 — TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446)
- [RFC 1034 / RFC 1035 — DNS](https://www.rfc-editor.org/rfc/rfc1034)
- [RFC 6455 — WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455)
- [MDN — Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [gRPC — Core concepts, architecture and lifecycle](https://grpc.io/docs/what-is-grpc/core-concepts/)
- [OASIS — MQTT Version 5.0](https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html)
- [OASIS — AMQP Version 1.0](https://docs.oasis-open.org/amqp/core/v1.0/amqp-core-overview-v1.0.html)
- [RFC 5321 — SMTP](https://www.rfc-editor.org/rfc/rfc5321)
- [RFC 9051 — IMAP4rev2](https://www.rfc-editor.org/rfc/rfc9051)
- [RFC 1939 — POP3](https://www.rfc-editor.org/rfc/rfc1939)
- [RFC 959 — FTP](https://www.rfc-editor.org/rfc/rfc959)
- [RFC 4251 — SSH Protocol Architecture](https://www.rfc-editor.org/rfc/rfc4251)
`;

const protocolsGuide = { markdown, markdownUk };

export default protocolsGuide;
