const markdown = String.raw`## WebSocket: complete QA guide

WebSocket is a persistent, full-duplex protocol for cases where both client and server need to send data at any time over one long-lived connection. Typical uses include chats, live notifications, collaborative editing, multiplayer games, dashboards, market feeds, device telemetry, presence indicators, and other interactive real-time features.

### WebSocket vs HTTP polling vs SSE

| Mechanism | Direction | Connection model | Good fit |
|---|---|---|---|
| HTTP request/response | Client → server, then response | Separate requests | CRUD and ordinary APIs |
| Polling | Client repeatedly asks | Repeated HTTP requests | Simple, infrequent updates |
| Server-Sent Events (SSE) | Server → browser | Long-lived HTTP stream | One-way server push |
| WebSocket | Both directions | Long-lived duplex connection | Interactive low-latency messaging |

Do not choose WebSocket merely because a feature is called real time. If only the server pushes events, SSE can be simpler. If updates are infrequent, normal HTTP or polling can be easier to operate.

### URLs: ws:// and wss://

- **ws://** — WebSocket without TLS.
- **wss://** — WebSocket over TLS; prefer it in production and for sensitive traffic.
- A connection has an opening handshake, a long-lived message phase, and a closing handshake.

### Opening handshake

Classic WebSocket starts with an HTTP/1.1 Upgrade handshake:

~~~http
GET /chat HTTP/1.1
Host: api.example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Origin: https://app.example.com
~~~

Successful response:

~~~http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
~~~

**101 Switching Protocols is only the connection upgrade.** After that, application data travels as WebSocket frames rather than ordinary HTTP request/response pairs. RFC 8441 also defines bootstrapping WebSocket over HTTP/2, so do not assume every deployment internally uses the HTTP/1.1 Upgrade path.

### Messages and frames

WebSocket supports:

- **text messages** — UTF-8, commonly JSON;
- **binary messages** — application-defined binary data;
- **continuation/fragmented frames** — one logical message may span multiple frames;
- **Ping/Pong** control frames — protocol-level liveness;
- **Close** control frames — graceful closing handshake.

Tests should validate logical application messages rather than depend on one message equaling one network frame.

### Connection lifecycle

Browser WebSocket states:

1. **CONNECTING** — handshake in progress.
2. **OPEN** — messages can be sent and received.
3. **CLOSING** — closing handshake in progress.
4. **CLOSED** — connection closed or failed.

Applications usually add authentication, subscriptions or rooms, message schemas, acknowledgements, sequencing, retries, heartbeat policy, and reconnect behavior. WebSocket itself does not automatically provide those application semantics.

### Browser client example

~~~javascript
const socket = new WebSocket("wss://api.example.com/ws", ["chat.v1"]);

socket.addEventListener("open", () => {
  console.log("connected", socket.protocol);
  socket.send(JSON.stringify({
    type: "subscribe",
    roomId: "qa-team"
  }));
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  console.log("received", message);
});

socket.addEventListener("error", () => {
  console.error("WebSocket error");
});

socket.addEventListener("close", (event) => {
  console.log({ code: event.code, reason: event.reason, clean: event.wasClean });
});
~~~

The browser constructor takes a URL and optional subprotocol list. Browser JavaScript does not offer a general API for arbitrary custom handshake headers, so authentication design must account for browser constraints.

### Minimal Node.js server example

Using the popular ws package:

~~~javascript
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (socket, request) => {
  console.log("client connected", request.headers.origin);
  socket.send(JSON.stringify({ type: "welcome" }));

  socket.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      socket.close(1003, "Invalid JSON");
      return;
    }

    if (message.type === "ping") {
      socket.send(JSON.stringify({ type: "pong", id: message.id }));
      return;
    }

    socket.send(JSON.stringify({ type: "echo", payload: message }));
  });
});
~~~

~~~bash
npm install ws
node server.mjs
~~~

Production code must validate input, authenticate the connection, authorize each action, enforce message-size and rate limits, handle malformed data, manage slow consumers and backpressure, and clean up disconnected clients.

### Python client example

~~~python
import asyncio
import json
import websockets

async def main():
    async with websockets.connect("ws://localhost:8080") as ws:
        await ws.send(json.dumps({"type": "ping", "id": 42}))
        response = json.loads(await ws.recv())
        assert response == {"type": "pong", "id": 42}

asyncio.run(main())
~~~

### pytest WebSocket example

~~~python
import json
import pytest
import websockets

@pytest.mark.asyncio
async def test_ping_pong():
    async with websockets.connect("ws://localhost:8080") as ws:
        await ws.send(json.dumps({"type": "ping", "id": "req-1"}))
        message = json.loads(await ws.recv())

        assert message["type"] == "pong"
        assert message["id"] == "req-1"
~~~

Do not stop at message received. Assert schema, values, correlation IDs, ordering requirements, permissions, and side effects.

### Manual testing

Useful tools:

- Browser DevTools → Network → WS → inspect handshake and Frames/Messages.
- **wscat** or websocat.
- API clients with WebSocket support.
- Service logs and traces correlated by connection ID or message ID.

~~~bash
npx wscat -c ws://localhost:8080
> {"type":"ping","id":1}
~~~

### What exactly to test

#### 1. Handshake and connection

- valid ws:// and wss:// endpoint;
- expected 101 response for HTTP/1.1 Upgrade;
- Upgrade, Connection, and Sec-WebSocket headers;
- supported and unsupported subprotocol negotiation;
- valid and invalid Origin;
- TLS certificate, hostname, and expiry for wss://;
- proxy and load-balancer behavior;
- connection timeout and refused connection.

#### 2. Message contract

For every message type verify required fields and types, missing and unknown fields, malformed JSON, empty payloads, Unicode, boundary values, oversized messages, text versus binary behavior, schema/version compatibility, acknowledgements, and correct recipient, room, tenant, or subscription.

Example application envelope:

~~~json
{
  "type": "chat.message",
  "id": "msg-123",
  "correlationId": "req-77",
  "timestamp": "2026-08-28T12:00:00Z",
  "payload": {
    "roomId": "qa-team",
    "text": "Hello"
  }
}
~~~

Stable message IDs and correlation IDs make duplicates, retries, and tracing testable.

#### 3. Ordering, duplicates, and concurrency

WebSocket preserves transport ordering on one connection, but distributed applications can still create business-level ordering issues across producers, brokers, retries, rooms, or reconnects. Test rapid sequential messages, multiple concurrent clients, duplicate client messages, reconnect while messages are in flight, fan-out to 10/100/1000 subscribers, and races between acknowledgements and server events.

#### 4. Disconnect and reconnect

Simulate Wi-Fi off/on, mobile-network switching, sleep/wake, server restart or deploy, proxy idle timeout, abrupt TCP loss, and graceful close.

Verify that the client reconnects when intended, uses bounded backoff and jitter rather than a reconnect storm, re-authenticates when required, restores subscriptions, avoids duplicate active sockets and UI events, and has defined behavior for missed and in-flight messages.

~~~javascript
let retry = 0;

function connect() {
  const ws = new WebSocket("wss://api.example.com/ws");

  ws.addEventListener("open", () => {
    retry = 0;
  });

  ws.addEventListener("close", () => {
    const delay = Math.min(30000, 1000 * 2 ** retry);
    retry += 1;
    setTimeout(connect, delay + Math.random() * 500);
  });
}

connect();
~~~

The exact retry policy is application-specific. The important points are bounded exponential backoff, jitter, cancellation when no longer needed, and no duplicate active connections.

#### 5. Heartbeats and idle connections

Ping/Pong control frames can detect dead peers; some applications also use JSON-level heartbeats. Test the expected heartbeat interval, missing Pong response, reverse-proxy or load-balancer idle timeout, false disconnects on slow networks, cleanup of dead connections, and heartbeat overhead at scale.

#### 6. Close codes

| Code | Meaning |
|---|---|
| 1000 | Normal closure |
| 1001 | Going away |
| 1002 | Protocol error |
| 1003 | Unsupported data |
| 1008 | Policy violation |
| 1009 | Message too big |
| 1011 | Unexpected server condition |

1005 and 1006 are reserved status values describing absence or abnormal closure and are not normal Close-frame codes sent by an endpoint.

#### 7. Authentication and authorization

A successful handshake does not mean the socket is authorized forever. Test connection-level and message-level permissions. Possible designs include authenticated cookies, credentials during connection setup where supported, a short-lived URL token with leakage risks, a subprotocol-based scheme, or an authentication message immediately after connection.

Test missing, expired, and revoked credentials; user A subscribing to user B private room; token expiry while the socket is open; role changes during an active connection; reconnect with a stale token; server-side revocation; and tenant isolation.

#### 8. Origin and WebSocket security

**CORS is not the WebSocket authorization model.** Browser WebSocket handshakes include an Origin header. Validate allowed origins when browser-origin security matters, especially with cookie-authenticated sockets, but never treat Origin validation as a replacement for authentication and authorization.

Also test wss:// for sensitive traffic, cross-site WebSocket hijacking, message-level authorization, injection through text payloads, size/rate limits, connection quotas, sensitive data in URLs or logs, and malformed protocol frames with lower-level tooling when relevant.

#### 9. Performance and scale

WebSocket performance differs from ordinary REST load testing because connections stay open. Model concurrent open connections, connections per second, messages per second in both directions, message-size distribution, fan-out, connection lifetime, reconnect storms, **slow consumers/backpressure**, memory per connection, CPU, file descriptors, network throughput, event-loop lag, and proxy/load-balancer limits.

A server that handles 10,000 idle sockets may still fail when 10,000 clients each receive 50 messages per second. Test the complete workload, not only the connection count.

### Backpressure

The classic browser WebSocket API does not provide built-in **backpressure**. If messages arrive faster than the application consumes them, buffers and memory can grow. Explicitly test slow-consumer behavior for high-rate streams. MDN also documents WebSocketStream, a Streams-based alternative with backpressure, although support differs from the broadly supported classic WebSocket interface.

### WebSocket debugging checklist

1. Did the handshake succeed, and what status and headers were returned?
2. Is the URL ws:// or wss://, and is TLS valid?
3. Which Origin and subprotocol were negotiated?
4. Was authentication accepted, and is authorization enforced per action?
5. Which exact message type and schema were sent?
6. Did the server send an acknowledgement or event?
7. Are connection and message correlation IDs present in logs or traces?
8. Did ordering, duplication, or reconnect affect the result?
9. What close code and reason were observed?
10. Is a proxy or load balancer terminating idle sockets?
11. Is the client consuming messages slower than they arrive?
12. Can the scenario be reproduced with a minimal CLI or script client?

### Interview-ready summary

A strong answer should mention that WebSocket provides **persistent bidirectional communication**, begins with a **handshake** (classically HTTP Upgrade → **101**), then exchanges text, binary, and control frames over a long-lived connection. Testing must cover **handshake, authentication and authorization, Origin, message schema, ordering, duplicates, heartbeat, close codes, reconnect, missed messages, concurrency, slow consumers, and scale**.

### Sources

- [RFC 6455 — The WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455.html)
- [RFC 8441 — Bootstrapping WebSockets with HTTP/2](https://www.rfc-editor.org/rfc/rfc8441.html)
- [MDN — WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [MDN — Writing WebSocket client applications](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications)
- [AsyncAPI Specification](https://www.asyncapi.com/docs/reference/specification/v3.0.0)
`;

const markdownUk = String.raw`## WebSocket: повний QA guide

WebSocket — persistent full-duplex protocol для ситуацій, коли і client, і server мають надсилати дані в будь-який момент через одне long-lived connection. Типові use cases: chats, live notifications, collaborative editing, multiplayer games, dashboards, market feeds, device telemetry, presence indicators та інші interactive real-time features.

### WebSocket vs HTTP polling vs SSE

| Механізм | Напрямок | Connection model | Коли підходить |
|---|---|---|---|
| HTTP request/response | Client → server, потім response | Окремі requests | CRUD і звичайні APIs |
| Polling | Client постійно перепитує | Повторні HTTP requests | Прості рідкі updates |
| Server-Sent Events (SSE) | Server → browser | Long-lived HTTP stream | Односторонні server events |
| WebSocket | Обидва напрямки | Long-lived duplex connection | Interactive low-latency messaging |

Не треба вибирати WebSocket лише тому, що feature називають real time. Якщо server тільки push-ить events, SSE може бути простішим. Для рідких updates звичайний HTTP або polling часто легше підтримувати.

### ws:// та wss://

- **ws://** — WebSocket без TLS.
- **wss://** — WebSocket через TLS; для production і sensitive traffic використовуйте його.
- Connection має opening handshake, довгу message phase та closing handshake.

### Opening handshake

Класичний WebSocket починається з HTTP/1.1 Upgrade:

~~~http
GET /chat HTTP/1.1
Host: api.example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Origin: https://app.example.com
~~~

Успішна відповідь:

~~~http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
~~~

**101 Switching Protocols — це тільки upgrade connection.** Після handshake application data іде як WebSocket frames, а не як звичайні HTTP request/response. RFC 8441 також описує bootstrapping WebSocket через HTTP/2.

### Messages, frames та lifecycle

WebSocket підтримує text messages, binary messages, fragmented or continuation frames, **Ping/Pong** control frames для liveness та Close frame для graceful closing handshake. Browser states: CONNECTING, OPEN, CLOSING, CLOSED.

Поверх protocol application зазвичай додає authentication, subscriptions або rooms, schemas, acknowledgements, sequencing, retries, heartbeat policy та reconnect logic.

### Browser client example

~~~javascript
const socket = new WebSocket("wss://api.example.com/ws", ["chat.v1"]);

socket.addEventListener("open", () => {
  socket.send(JSON.stringify({ type: "subscribe", roomId: "qa-team" }));
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  console.log("received", message);
});

socket.addEventListener("close", (event) => {
  console.log({ code: event.code, reason: event.reason, clean: event.wasClean });
});
~~~

Browser JavaScript не має загального API для довільних custom handshake headers, тому authentication design повинен враховувати browser constraints.

### Minimal Node.js server

~~~javascript
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (socket, request) => {
  console.log("client connected", request.headers.origin);
  socket.send(JSON.stringify({ type: "welcome" }));

  socket.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      socket.close(1003, "Invalid JSON");
      return;
    }

    if (message.type === "ping") {
      socket.send(JSON.stringify({ type: "pong", id: message.id }));
    }
  });
});
~~~

~~~bash
npm install ws
node server.mjs
~~~

Production implementation також повинна робити input validation, authentication, authorization кожної action, size/rate limits, malformed-data handling, slow-consumer/backpressure management та cleanup disconnected clients.

### Python client та pytest

~~~python
import asyncio
import json
import websockets

async def main():
    async with websockets.connect("ws://localhost:8080") as ws:
        await ws.send(json.dumps({"type": "ping", "id": 42}))
        response = json.loads(await ws.recv())
        assert response == {"type": "pong", "id": 42}

asyncio.run(main())
~~~

~~~python
import json
import pytest
import websockets

@pytest.mark.asyncio
async def test_ping_pong():
    async with websockets.connect("ws://localhost:8080") as ws:
        await ws.send(json.dumps({"type": "ping", "id": "req-1"}))
        message = json.loads(await ws.recv())
        assert message["type"] == "pong"
        assert message["id"] == "req-1"
~~~

Перевіряйте schema, values, correlation IDs, ordering contract, permissions та side effects, а не лише факт отримання message.

### Manual testing

- Browser DevTools → Network → WS → handshake + Frames/Messages.
- **wscat** або websocat.
- API clients із WebSocket support.
- logs/traces із connection ID або message ID.

~~~bash
npx wscat -c ws://localhost:8080
> {"type":"ping","id":1}
~~~

### Що тестувати

#### Handshake та connection

Перевіряйте valid ws:// і wss:// endpoint, 101 для HTTP/1.1 Upgrade, Upgrade/Connection/Sec-WebSocket headers, subprotocol negotiation, valid/invalid Origin, TLS certificate/hostname/expiry, proxy/load balancer, timeout і refused connection.

#### Message contract

Для кожного message type перевіряйте required fields/types, missing/unknown fields, malformed JSON, empty payload, Unicode, boundaries, oversized messages, text vs binary, schema/version compatibility, acknowledgements та правильний recipient/room/tenant/subscription.

#### Ordering, duplicates та concurrency

WebSocket зберігає transport ordering на одному connection, але distributed application може мати business-level ordering issues через producers, brokers, retries, rooms або reconnects. Тестуйте rapid sequential messages, **concurrent** clients, duplicates, reconnect із in-flight messages, fan-out та races.

#### Disconnect та reconnect

Симулюйте Wi-Fi off/on, mobile-network switch, sleep/wake, server restart/deploy, proxy idle timeout, abrupt TCP loss та graceful close. Перевіряйте reconnect, bounded backoff + jitter, re-authentication, restore subscriptions, відсутність duplicate active sockets і визначену поведінку missed/in-flight messages.

~~~javascript
let retry = 0;

function connect() {
  const ws = new WebSocket("wss://api.example.com/ws");
  ws.addEventListener("open", () => { retry = 0; });
  ws.addEventListener("close", () => {
    const delay = Math.min(30000, 1000 * 2 ** retry);
    retry += 1;
    setTimeout(connect, delay + Math.random() * 500);
  });
}

connect();
~~~

#### Heartbeat та close codes

Ping/Pong або application heartbeat допомагають визначати dead peers. Тестуйте interval, missing response, proxy/LB idle timeout, cleanup dead sockets та heartbeat overhead.

| Code | Значення |
|---|---|
| 1000 | Normal closure |
| 1001 | Going away |
| 1002 | Protocol error |
| 1003 | Unsupported data |
| 1008 | Policy violation |
| 1009 | Message too big |
| 1011 | Unexpected server condition |

1005 та 1006 — reserved status values і не є звичайними Close-frame codes, що відправляються endpoint.

#### Authentication, Origin та security

Handshake success не означає authorization на всі actions. Тестуйте missing/expired/revoked credentials, private-room і tenant boundaries, token expiry під час active socket, role changes, reconnect зі stale token та server-side revocation.

**CORS не є WebSocket authorization model.** Browser handshake передає Origin; перевіряйте allowed origins, особливо при cookie authentication, але Origin validation не замінює authentication та authorization. Також тестуйте wss://, cross-site WebSocket hijacking, message-level authorization, injection, size/rate limits і connection quotas.

#### Performance та scale

Моделюйте concurrent open connections, connections/second, messages/second, message sizes, fan-out, connection lifetime, reconnect storms, **slow consumers/backpressure**, memory per connection, CPU, file descriptors, network throughput, event-loop lag та proxy/load-balancer limits.

10,000 idle sockets і 10,000 clients із 50 messages/sec — різні workloads. Тестуйте реальний workload, а не лише connection count.

### Backpressure

Класичний browser WebSocket API не має built-in **backpressure**. Якщо messages приходять швидше, ніж application їх обробляє, buffers і memory можуть рости. Для high-rate streams slow-consumer behavior треба тестувати окремо. MDN також описує WebSocketStream як Streams-based alternative з backpressure.

### Debugging checklist

1. Чи пройшов handshake і які status/headers?
2. ws:// чи wss://, чи валідний TLS?
3. Який Origin/subprotocol?
4. Authentication + authorization?
5. Який exact message type/schema?
6. Чи був ack/event?
7. Чи є correlation IDs у logs/traces?
8. Чи вплинули ordering/duplicates/reconnect?
9. Який close code/reason?
10. Чи не закриває idle socket proxy/LB?
11. Чи client не відстає від incoming rate?
12. Чи відтворюється проблема мінімальним CLI/script client?

### Коротка відповідь для співбесіди

WebSocket дає **persistent bidirectional communication**, починається з **handshake** (класично HTTP Upgrade → **101**), після чого працює через text, binary і control frames. Тестувати треба **handshake, authentication/authorization, Origin, schemas, ordering, duplicates, heartbeat, close codes, reconnect, missed messages, concurrency, slow consumers та scale**.

### Sources

- [RFC 6455 — The WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455.html)
- [RFC 8441 — Bootstrapping WebSockets with HTTP/2](https://www.rfc-editor.org/rfc/rfc8441.html)
- [MDN — WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [MDN — Writing WebSocket client applications](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications)
- [AsyncAPI Specification](https://www.asyncapi.com/docs/reference/specification/v3.0.0)
`;

const websocketGuide = { markdown, markdownUk };

export default websocketGuide;
