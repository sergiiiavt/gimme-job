const markdown = String.raw`Once a device has connectivity, it still needs an **application communication model**: how telemetry is published, how commands arrive, how state is represented, how retries work and how identity is enforced.

This chapter covers MQTT, CoAP, HTTP, WebSocket, LwM2M and Matter at the application layer, plus the device-to-cloud architecture around them.

## 1. Separate connectivity from application protocol

Examples:

- Wi-Fi gives an IP-capable local network, but the device may use HTTP, MQTT or WebSocket over it.
- Cellular gives wide-area IP connectivity, but the application protocol can still be MQTT or HTTPS.
- Thread provides IPv6 mesh networking; Matter can provide the application data model above it.
- RS-485 provides electrical signaling; Modbus RTU supplies application messaging.

“Connected” therefore does not tell you how the application exchanges meaning.

## 2. Common IoT communication patterns

Connected devices commonly use:

### Telemetry

Device → backend measurements/events.

Examples: temperature, battery level, position, fault counters.

### Commands

Backend/controller → device requested action.

Examples: unlock, reboot, set target temperature, change sampling interval.

### Reported state

What the device says is currently true.

### Desired state

What a controller/cloud wants to become true.

### Events

Discrete facts that happened, often immutable once emitted.

The data model should not mix these concepts accidentally.

## 3. MQTT architecture

MQTT is a lightweight client/server publish-subscribe messaging protocol well suited to constrained and intermittently connected systems.

Basic model:

~~~text
publisher ──PUBLISH──> broker ──> subscribers
subscriber ─SUBSCRIBE─> broker
~~~

Clients do not normally send directly to each other. They publish to and subscribe from topic names through a broker.

## 4. MQTT topics and subscriptions

Example topics:

~~~text
devices/42/telemetry
devices/42/state/reported
devices/42/state/desired
devices/42/commands
~~~

Topic design affects permissions, observability and scaling.

Subscription filters can include wildcards:

- **+** matches one topic level;
- **#** matches multiple remaining levels.

A topic hierarchy is an application design convention, not a database schema automatically provided by MQTT.

## 5. MQTT QoS

MQTT defines delivery quality-of-service levels.

### QoS 0 — at most once

Message is sent without MQTT-level acknowledgement/retry guarantee.

Use when occasional loss is acceptable and freshness matters more than retransmission.

### QoS 1 — at least once

Sender retries until acknowledged. **Duplicates are possible.**

Application consumers must not assume exactly one business effect.

### QoS 2 — exactly once at MQTT protocol delivery level

Uses a larger handshake to avoid duplicate delivery at the MQTT protocol layer.

This does not automatically make the entire distributed business transaction exactly-once. Database writes, downstream retries and application crashes can still create their own duplicate effects.

## 6. MQTT retained messages

A retained message lets the broker keep the latest retained value for a topic and immediately deliver it to new matching subscribers.

Useful for current state, but dangerous if confused with an event stream.

Example:

- retained **online=true** can represent current availability;
- historical temperature measurements should usually not be modeled as “the one retained temperature event.”

## 7. MQTT sessions and subscriptions

Session behavior determines whether subscriptions and queued messages survive reconnects.

MQTT 5 uses session-expiry concepts rather than treating every reconnect as a completely new client.

Important design questions:

- Is client identity stable?
- Should pending QoS messages survive reconnect?
- How long should broker-side state live?
- What happens if two devices connect using the same client identifier?

## 8. MQTT keep alive and Last Will

### Keep Alive

The client and broker use periodic communication to detect broken connections.

### Last Will and Testament

A client can register a message that the broker publishes if the client disconnects unexpectedly.

This is useful for presence/availability, but it must be combined with retained-state and reconnect logic carefully.

## 9. MQTT 5 useful features

MQTT 5 adds richer metadata and flow/error capabilities such as:

- reason codes;
- user properties;
- message expiry;
- response topic/correlation data;
- topic aliases;
- receive maximum / flow-control-related limits;
- session expiry.

A product should use only features supported by its broker/device fleet compatibility requirements.

## 10. CoAP

CoAP (Constrained Application Protocol) is a web-style application protocol designed for constrained nodes and constrained networks.

It commonly uses UDP and provides a REST-like resource interaction model with methods analogous to GET, PUT, POST and DELETE.

Important concepts:

- URI/resource model;
- confirmable vs non-confirmable messages;
- message ID/token;
- retransmission for confirmable exchanges;
- response codes;
- Observe extension for resource updates;
- DTLS or OSCORE-based security options depending architecture.

CoAP is not “HTTP packets over UDP.” It is a separate protocol designed around constrained environments.

## 11. HTTP/HTTPS on devices

HTTP remains common for connected devices when bandwidth/power constraints are acceptable, direct web integration matters and request-response is natural.

Typical uses:

- provisioning;
- configuration;
- firmware download;
- telemetry batches;
- local web API;
- cloud REST API.

The separate Networking and HTTP API tracks cover HTTP semantics in depth.

## 12. WebSocket on devices

WebSocket fits long-lived bidirectional sessions where both device and backend need to push data independently.

It can be useful for gateways and capable devices, but a long-lived connection has power, reconnect and infrastructure consequences.

Do not choose WebSocket just because updates are “real-time.” MQTT, CoAP Observe or periodic HTTP may better fit device constraints.

## 13. LwM2M

OMA LightweightM2M (LwM2M) is a device-management and service-enablement protocol designed for IoT devices.

It defines standardized concepts for bootstrap, registration, object/resource models, telemetry/observation, configuration, firmware update and device management.

LwM2M is strongly associated with constrained-device transports such as CoAP and is particularly relevant to managed cellular/constrained fleets.

## 14. Matter application model

Matter defines an interoperable application layer for smart-home devices.

Important concepts include node, endpoint, device type, cluster, attribute, command, event, fabric and commissioning.

~~~text
Matter clusters / commands / attributes
              ↓
             IP
              ↓
      Thread / Wi-Fi / Ethernet
~~~

## 15. Device identity

A secure IoT system needs a stable answer to “which physical/logical device is this?”

Possible identity material:

- unique device certificate;
- hardware-backed key;
- per-device symmetric secret;
- manufacturing serial/ID plus separate credential;
- cellular SIM/eSIM identity for network access.

A serial number alone is usually an identifier, not strong authentication.

## 16. Authentication vs authorization

Authentication establishes identity. Authorization decides what that identity is allowed to do.

Example: a device certificate proves device 42, while a topic ACL allows device 42 to publish only under its own telemetry topic.

Transport encryption alone does not solve authorization.

## 17. Telemetry design

Telemetry payloads need explicit contracts for field names, types, units, timestamps, precision, optionality, schema version and missing/error values.

A payload containing only a field named **value = 17** is ambiguous when it is unclear whether 17 means °C, °F, percent or raw ADC counts.

## 18. Commands and idempotency

Commands should define what happens if they are duplicated or retried.

Examples:

- set target temperature to 21 is naturally idempotent;
- increment counter is not;
- dispense dose can be safety-critical if repeated.

Useful command fields can include command ID, issued timestamp, expiry/deadline, desired value, correlation ID and acknowledgement/result state.

## 19. Offline buffering and replay

Devices frequently lose connectivity.

You need a policy for what gets buffered, maximum storage, overwrite/drop strategy, message expiry, ordering, timestamp source, replay rate and duplicate handling.

A device that reconnects after a week can overload a backend if it immediately replays every measurement without rate control.

## 20. Time synchronization

Distributed IoT data often depends on accurate time.

Possible sources include RTC, NTP/SNTP, cellular network time, GNSS or gateway-provided time.

Distinguish event occurrence time, device transmission time and broker/backend receive time. Clock drift and reset can make these diverge.

## 21. Digital twins / device shadows

Cloud platforms often maintain a server-side representation of device state, sometimes called a digital twin or device shadow.

A common pattern distinguishes desired state, reported state and metadata/version.

This is a cloud/application pattern, not an MQTT protocol feature by itself.

## 22. Backend architecture

~~~text
device
  ↓ MQTT/HTTP/CoAP
broker / ingress
  ↓
stream/queue
  ↓
processing + rules
  ↓
storage / digital twin
  ↓
API
  ↓
web/mobile app
~~~

One user-visible defect can originate at any of these boundaries.

## 23. Choosing an application protocol

| Need | Often suitable |
|---|---|
| Lightweight brokered telemetry/commands | MQTT |
| Constrained REST-like resources over UDP | CoAP |
| Universal web request-response | HTTP/HTTPS |
| Long-lived bidirectional capable-device channel | WebSocket |
| Managed constrained-device lifecycle | LwM2M |
| Interoperable smart-home application model | Matter |

The same device can use several. Example: BLE for commissioning, MQTT for telemetry, HTTPS for firmware download.

## 24. Practice

### Exercise 1 — MQTT QoS

A QoS 1 command is delivered twice. Explain why this is valid and how the application should prevent duplicate business effects.

### Exercise 2 — retained state

Which is a better retained MQTT value: “current thermostat mode” or “door opened at 14:32”? Explain.

### Exercise 3 — offline replay

A sensor stores 100,000 events while offline. Design reconnect behavior that avoids losing data and avoids overloading the cloud.

### Exercise 4 — identity

Explain why TLS encryption with one shared fleet password is weaker than per-device credentials.

## Quick testing lens

High-value application-layer IoT tests include:

- QoS retries and duplicates;
- retained-message correctness;
- stale session/client-ID conflicts;
- command expiry/idempotency;
- unauthorized topic/resource access;
- malformed/older/newer schema versions;
- offline buffer overflow;
- reconnect replay rate;
- clock reset/drift;
- desired vs reported state conflicts;
- broker/backend restart while devices remain connected/reconnect.

## Sources

- [OASIS — MQTT Version 5.0](https://www.oasis-open.org/standard/mqtt-v5-0-os/)
- [RFC 7252 — Constrained Application Protocol (CoAP)](https://www.rfc-editor.org/rfc/rfc7252)
- [OMA — LightweightM2M](https://oma-knowledge-base.openmobilealliance.org/specifications/lwm2m/introduction/)
- [Connectivity Standards Alliance — Matter](https://csa-iot.org/all-solutions/matter/)
- [RFC 8613 — Object Security for Constrained RESTful Environments (OSCORE)](https://www.rfc-editor.org/rfc/rfc8613)
`;

const markdownUk = String.raw`Після появи connectivity device все ще потрібна **application communication model**: telemetry, commands, state, retries та identity.

Цей chapter покриває MQTT, CoAP, HTTP, WebSocket, LwM2M та Matter на application layer і device-to-cloud architecture.

## 1. Connectivity ≠ application protocol

Wi-Fi дає IP network, але application може використовувати HTTP/MQTT/WebSocket. Cellular дає wide-area IP, але protocol усе одно може бути MQTT/HTTPS. Thread дає IPv6 mesh, а Matter — application model поверх нього. RS-485 — electrical layer, Modbus RTU — application messaging.

## 2. Common IoT patterns

**Telemetry:** device → backend measurements/events.

**Commands:** backend/controller → device action.

**Reported state:** що device каже про current state.

**Desired state:** що controller хоче отримати.

**Events:** discrete facts that happened.

Не змішуй ці concepts без явної model.

## 3. MQTT architecture

MQTT — lightweight client/server publish-subscribe protocol.

~~~text
publisher ──PUBLISH──> broker ──> subscribers
subscriber ─SUBSCRIBE─> broker
~~~

Clients зазвичай communicate через broker/topics, а не direct peer-to-peer.

## 4. MQTT topics та subscriptions

~~~text
devices/42/telemetry
devices/42/state/reported
devices/42/state/desired
devices/42/commands
~~~

Wildcards: **+** = one level, **#** = remaining levels.

Topic hierarchy — application design, не automatic database schema.

## 5. MQTT QoS

### QoS 0 — at most once

No MQTT-level delivery acknowledgement guarantee.

### QoS 1 — at least once

Retries until acknowledged; **duplicates possible**.

### QoS 2 — exactly once на MQTT delivery level

Larger handshake. Це не automatic exactly-once для database/downstream business transaction.

## 6. Retained messages

Broker зберігає latest retained value і віддає новому subscriber.

Добре для current state, не для historical event stream.

## 7. Sessions

Session behavior визначає, чи subscriptions/queued messages survive reconnect. Важливі stable client ID, pending QoS, session lifetime та duplicate client IDs.

## 8. Keep Alive та Last Will

Keep Alive допомагає detect broken connection. Last Will — broker-published message після unexpected disconnect.

## 9. MQTT 5 features

Reason codes, user properties, message expiry, response topic/correlation data, topic aliases, receive limits, session expiry.

## 10. CoAP

CoAP — web-style application protocol для constrained nodes/networks, commonly over UDP.

Concepts: resources/URI, confirmable/non-confirmable, message ID/token, retransmission, response codes, Observe, DTLS/OSCORE.

CoAP ≠ HTTP packets over UDP.

## 11. HTTP/HTTPS on devices

Use cases: provisioning, configuration, firmware download, telemetry batches, local API, cloud REST API.

HTTP deep dive — у Networking/API tracks.

## 12. WebSocket on devices

Long-lived bidirectional channel для capable devices/gateways. Real-time requirement не означає automatically WebSocket.

## 13. LwM2M

OMA LightweightM2M — IoT device-management/service protocol з bootstrap, registration, object/resource model, observation, config, firmware update та device management.

## 14. Matter application model

Matter concepts: node, endpoint, device type, cluster, attribute, command, event, fabric, commissioning.

~~~text
Matter application
        ↓
IP
        ↓
Thread / Wi-Fi / Ethernet
~~~

## 15. Device identity

Possible credentials: device certificate, hardware-backed key, per-device secret, serial + separate credential, SIM/eSIM network identity.

Serial number — identifier, не strong authentication сам по собі.

## 16. Authentication vs authorization

Authentication = хто ти. Authorization = що тобі дозволено.

Example: certificate proves device 42; topic ACL дозволяє publish лише own telemetry.

## 17. Telemetry design

Contract має визначати field, type, unit, timestamp, precision, optionality, version, error/missing semantics.

Value 17 без unit/meaning — ambiguous.

## 18. Commands та idempotency

Duplicate/retry behavior має бути defined.

Set target = naturally idempotent; increment = not; dispense dose = dangerous duplicate.

Useful fields: command ID, issued time, expiry, correlation ID, acknowledgement/result.

## 19. Offline buffering/replay

Define max storage, drop policy, expiry, ordering, timestamp source, replay rate, duplicates.

100k buffered events після reconnect можуть overload backend.

## 20. Time synchronization

RTC, NTP/SNTP, cellular, GNSS, gateway.

Distinguish event time, transmission time, backend receive time.

## 21. Digital twins / shadows

Cloud pattern з desired/reported state та version metadata. Це application/cloud pattern, не MQTT feature automatically.

## 22. Backend architecture

~~~text
device
  ↓
broker / ingress
  ↓
queue/stream
  ↓
processing
  ↓
storage / twin
  ↓
API
  ↓
web/mobile
~~~

## 23. Choosing protocol

| Need | Often suitable |
|---|---|
| Brokered telemetry/commands | MQTT |
| Constrained REST over UDP | CoAP |
| Web request-response | HTTP |
| Bidirectional session | WebSocket |
| Managed device lifecycle | LwM2M |
| Smart-home interoperability | Matter |

Device може використовувати кілька: BLE commissioning + MQTT telemetry + HTTPS firmware.

## 24. Practice

### Exercise 1
QoS 1 command delivered twice. Why valid? How make business effect safe?

### Exercise 2
Retained: current thermostat mode vs door-open event?

### Exercise 3
100k offline events. Design replay.

### Exercise 4
Why per-device credentials better than shared fleet password?

## Quick testing lens

- QoS duplicates/retries;
- retained correctness;
- session/client-ID conflict;
- command expiry/idempotency;
- ACL/authorization;
- schema versions;
- buffer overflow;
- replay rate;
- clock drift/reset;
- desired/reported conflict;
- broker/backend restart.

## Sources

- [OASIS — MQTT 5.0](https://www.oasis-open.org/standard/mqtt-v5-0-os/)
- [RFC 7252 — CoAP](https://www.rfc-editor.org/rfc/rfc7252)
- [OMA — LightweightM2M](https://oma-knowledge-base.openmobilealliance.org/specifications/lwm2m/introduction/)
- [Connectivity Standards Alliance — Matter](https://csa-iot.org/all-solutions/matter/)
- [RFC 8613 — OSCORE](https://www.rfc-editor.org/rfc/rfc8613)
`;

export const iotProtocolsCloud = { markdown, markdownUk };
export default iotProtocolsCloud;
