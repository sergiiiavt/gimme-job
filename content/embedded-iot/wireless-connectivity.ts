const markdown = String.raw`Wireless IoT is not one technology. Range, throughput, topology, power budget, infrastructure and application model determine the right choice.

This chapter compares the major connectivity families without pretending they sit at the same layer.

## 1. Start with requirements, not protocol names

Ask first:

- required range;
- data volume and frequency;
- battery life;
- mobility;
- latency;
- topology;
- infrastructure availability;
- indoor/outdoor use;
- regulatory region;
- device cost;
- security and provisioning model.

A coin-cell sensor and a video camera have completely different communication constraints.

## 2. Radio fundamentals

Wireless links are affected by:

- transmit power;
- receiver sensitivity;
- antenna design;
- frequency band;
- path loss;
- obstacles/materials;
- interference;
- channel utilization;
- multipath/fading;
- regulatory transmit limits.

RSSI is useful but is not a complete measure of connection quality.

## 3. Bluetooth Classic vs Bluetooth Low Energy

Bluetooth includes several technologies.

### Bluetooth Classic / BR-EDR

Historically common for continuous point-to-point use cases such as audio and peripherals.

### Bluetooth Low Energy (LE)

Bluetooth LE was designed for low-power communication and supports connection-oriented and broadcast-oriented models.

Important BLE concepts:

- advertising;
- scanning;
- connection;
- connection interval;
- PHY;
- channels;
- pairing/bonding;
- GATT;
- ATT;
- services and characteristics;
- notifications/indications.

BLE is not simply “serial over radio.” Applications usually expose structured GATT services and characteristics.

## 4. BLE advertising and connections

Before connection, a peripheral can advertise information.

A central device scans and may initiate a connection.

Once connected, behavior is influenced by:

- connection interval;
- peripheral latency;
- supervision timeout;
- MTU/data length;
- PHY choice;
- notification rate.

Lower latency can cost more power because radios wake more often.

## 5. GATT model

GATT organizes data as:

~~~text
service
  ├─ characteristic
  │    ├─ value
  │    └─ descriptors
  └─ characteristic
~~~

Characteristics can support operations such as read, write, notify or indicate.

Notifications do not require an application-level acknowledgement from the client; indications do.

A custom GATT protocol should define units, byte order, versioning and error behavior explicitly.

## 6. Wi-Fi

Wi-Fi provides high-throughput local IP connectivity and integrates naturally with existing LAN/Internet infrastructure.

Typical strengths:

- high throughput;
- native IP connectivity;
- common infrastructure;
- direct cloud/backend access.

Typical costs:

- higher power than ultra-low-power radios;
- association/authentication complexity;
- dependency on access-point configuration;
- RF congestion in common bands.

IoT Wi-Fi devices still need robust handling for wrong password, AP disappearance, DHCP failure, roaming/reconnect and captive/enterprise network assumptions.

## 7. Ethernet

Ethernet is wired rather than wireless, but belongs in connectivity decisions because many embedded gateways and industrial devices use it for stable IP connectivity.

Compared with radio links it can provide:

- predictable physical connection;
- high throughput;
- no RF interference;
- Power over Ethernet in supported designs.

The trade-off is cabling and reduced mobility.

## 8. IEEE 802.15.4 ecosystem

IEEE 802.15.4 defines low-rate wireless PHY/MAC technologies used by higher-layer systems including Zigbee and Thread.

It is important not to use 802.15.4, Zigbee, Thread and Matter as synonyms.

They represent different layers/ecosystems.

## 9. Zigbee

Zigbee is a low-power mesh networking/application ecosystem built on IEEE 802.15.4.

Typical concepts include:

- coordinator/router/end-device roles in common Zigbee networks;
- mesh routing;
- clusters/application profiles;
- sleepy end devices;
- joining and trust/security mechanisms.

Zigbee devices generally need a Zigbee-aware coordinator/gateway to integrate with IP/cloud systems.

## 10. Thread

Thread is a secure, low-power IPv6-based mesh networking protocol built on IEEE 802.15.4.

Important ideas:

- IPv6 is native;
- mesh topology;
- low-power end devices;
- router-capable nodes;
- Thread Border Router connects the Thread mesh to adjacent IP networks;
- Thread itself does not define the complete smart-home application data model.

This is one of the key differences from Zigbee's historically more vertically integrated application ecosystem.

## 11. Matter

Matter is an application-layer interoperability standard/ecosystem for smart-home devices.

Matter runs over IP networks such as:

- Thread;
- Wi-Fi;
- Ethernet.

BLE is used in important commissioning flows but is not the normal operational transport for a commissioned Matter-over-Thread device.

Therefore:

~~~text
Matter application model
        ↓
IPv6 / IP networking
        ↓
Thread OR Wi-Fi OR Ethernet
~~~

Matter and Thread are complementary, not competing synonyms.

## 12. Cellular IoT

Cellular connectivity is useful when devices need wide-area communication without local Wi-Fi infrastructure.

Possible technologies include LTE/4G/5G and IoT-focused options such as LTE-M and NB-IoT.

### LTE-M

Generally supports higher mobility/data rate and lower latency than NB-IoT, with power-saving mechanisms for IoT devices.

### NB-IoT

Targets low-power wide-area device connectivity with small/intermittent data and deep coverage use cases.

Actual operator support, roaming and feature availability vary by country/network.

Cellular IoT also introduces SIM/eSIM, APN, registration, coverage and operator dependencies.

## 13. LoRaWAN

LoRaWAN targets low-power wide-area networks with long range and small payloads.

Architecture commonly includes:

~~~text
end device
   ↓ LoRa radio
one or more gateways
   ↓ IP backhaul
network server
   ↓
application server
~~~

A gateway is largely a packet forwarder; network-level coordination lives in the LoRaWAN backend architecture.

LoRaWAN is not designed for high-throughput continuous streaming.

## 14. Topology comparison

| Technology | Typical topology | Native IP? | Relative power/use |
|---|---|---|---|
| BLE | Point-to-point + broadcast; mesh also exists | No, not ordinary GATT use | Very low-power short range |
| Wi-Fi | Station ↔ AP | Yes | Higher throughput/power |
| Zigbee | Mesh/star/tree depending stack | Not native general IP | Low-power mesh |
| Thread | IPv6 mesh | Yes | Low-power IP mesh |
| Cellular | Device ↔ operator network | Yes | Wide-area, operator dependent |
| LoRaWAN | Device ↔ gateways ↔ network server | Backend uses IP | Very low data, long range |

This table is a simplification; product details and radio modes matter.

## 15. Commissioning and provisioning

Connectivity is not complete until a new device can securely join its network.

Provisioning may include:

- Wi-Fi SSID/password;
- BLE pairing/bonding;
- Thread network credentials;
- Matter fabric commissioning;
- cellular SIM/eSIM profile;
- LoRaWAN device/network keys;
- cloud device identity.

Factory provisioning and user commissioning are different lifecycle stages.

## 16. Reconnect and offline behavior

Connected devices must define what happens when communication disappears.

Questions include:

- Does the device keep local control working?
- Does it queue telemetry?
- How much data can it buffer?
- Is retry exponential/backed off?
- What state wins after reconnect?
- Can commands be replayed?
- How is clock/time recovered?

The best radio does not fix an undefined offline state model.

## 17. Wireless security basics

Security exists at several layers:

- radio/link encryption/authentication;
- network credentials;
- device identity;
- TLS/application security;
- cloud authorization.

“BLE encrypted” or “Wi-Fi protected” does not automatically mean the cloud identity or application commands are authorized correctly.

## 18. Tools

Useful tools include:

- smartphone BLE scanners;
- BlueZ tools on Linux;
- dedicated BLE sniffers;
- Wireshark;
- Wi-Fi packet capture where hardware/permissions allow;
- Thread diagnostic tools/border-router logs;
- cellular modem AT command/logging tools;
- LoRaWAN network-server logs;
- RF spectrum analyzer for advanced interference investigation.

## 19. Practice

### Exercise 1 — choose connectivity

Choose a primary technology for: battery door sensor, smartwatch-phone link, industrial gateway, remote agriculture sensor and security camera. Explain trade-offs.

### Exercise 2 — Thread vs Matter

Explain why “the device uses Matter, therefore it uses Thread” is incorrect.

### Exercise 3 — BLE power

A BLE device needs lower latency. Which connection parameters may change, and what battery trade-off follows?

### Exercise 4 — offline model

Design behavior for a smart lock that loses cloud access but still has local BLE connectivity.

## Quick testing lens

Wireless/IoT tests should cover:

- minimum/maximum useful range;
- interference and congestion;
- weak-signal transitions;
- disconnect/reconnect loops;
- changing Wi-Fi networks or cellular cells;
- pairing/commissioning failures;
- credential rotation/removal;
- duplicate device identity;
- offline buffering limits;
- power impact of connection parameters;
- recovery after gateway/AP/border-router restart.

## Sources

- [Bluetooth SIG — Bluetooth LE Primer](https://www.bluetooth.com/bluetooth-le-primer/)
- [Thread Group — Thread overview](https://threadgroup.org/what-Is-thread/overview)
- [Thread Group — Resources](https://threadgroup.org/Resources)
- [Connectivity Standards Alliance — Matter](https://csa-iot.org/all-solutions/matter/)
- [Wi-Fi Alliance](https://www.wi-fi.org/)
- [GSMA — Mobile IoT resources](https://www.gsma.com/solutions-and-impact/technologies/internet-of-things/)
- [LoRa Alliance — What is LoRaWAN](https://lora-alliance.org/about-lorawan/)
`;

const markdownUk = String.raw`Wireless IoT — не одна technology. Range, throughput, topology, power, infrastructure та application model визначають choice.

Цей chapter порівнює major connectivity families, не роблячи вигляд, що вони на одному layer.

## 1. Починай з requirements

Спочатку визнач:

- range;
- data volume/frequency;
- battery life;
- mobility;
- latency;
- topology;
- infrastructure;
- indoor/outdoor;
- regulatory region;
- cost;
- security/provisioning.

Coin-cell sensor і video camera мають зовсім різні constraints.

## 2. Radio fundamentals

На wireless link впливають transmit power, receiver sensitivity, antenna, band, path loss, obstacles, interference, channel utilization, fading та regulatory limits.

RSSI корисний, але не є повною характеристикою link quality.

## 3. Bluetooth Classic vs Bluetooth Low Energy

### Bluetooth Classic / BR-EDR

Історично використовується для continuous point-to-point cases, наприклад audio/peripherals.

### Bluetooth LE

BLE створений для low-power communication і підтримує connections та broadcast-oriented modes.

Concepts:

- advertising;
- scanning;
- connection;
- connection interval;
- PHY;
- pairing/bonding;
- GATT/ATT;
- services/characteristics;
- notifications/indications.

BLE — не просто “serial over radio”.

## 4. BLE advertising та connections

Peripheral advertises; central scans і може connect.

Connection behavior залежить від interval, peripheral latency, supervision timeout, MTU/data length, PHY та notification rate.

Lower latency часто коштує більше battery.

## 5. GATT model

~~~text
service
  ├─ characteristic
  │    ├─ value
  │    └─ descriptors
  └─ characteristic
~~~

Characteristic може read/write/notify/indicate.

Notification не має application-level acknowledgement; indication має.

Custom GATT protocol має явно визначати units, byte order, versioning та errors.

## 6. Wi-Fi

Wi-Fi дає high-throughput local IP connectivity.

Strengths: throughput, native IP, common infrastructure, cloud access.

Costs: higher power, association/auth complexity, AP dependency, RF congestion.

IoT device має переживати wrong password, AP loss, DHCP failure та reconnect.

## 7. Ethernet

Wired connectivity теж важлива для embedded gateways/industrial devices.

Strengths: predictable physical link, throughput, no RF interference, possible PoE.

Trade-off: cable/mobility.

## 8. IEEE 802.15.4 ecosystem

802.15.4 — low-rate PHY/MAC basis для systems such as Zigbee та Thread.

802.15.4, Zigbee, Thread та Matter — не synonyms.

## 9. Zigbee

Low-power mesh ecosystem over 802.15.4.

Concepts: coordinator/router/end device, mesh routing, clusters/profiles, sleepy devices, joining/security.

Зазвичай потрібен Zigbee-aware coordinator/gateway для IP/cloud integration.

## 10. Thread

Thread — secure low-power IPv6 mesh over 802.15.4.

Concepts:

- native IPv6;
- mesh;
- sleepy end devices;
- router-capable nodes;
- Border Router;
- Thread не визначає complete smart-home application model.

## 11. Matter

Matter — application-layer interoperability standard для smart home.

Matter працює over IP networks: Thread, Wi-Fi, Ethernet.

BLE важливий для commissioning, але не є normal operational transport Matter-over-Thread device.

~~~text
Matter application
        ↓
IP
        ↓
Thread OR Wi-Fi OR Ethernet
~~~

Matter і Thread complementary.

## 12. Cellular IoT

Wide-area connectivity без local Wi-Fi.

LTE-M та NB-IoT — IoT-oriented cellular options.

LTE-M зазвичай підтримує greater mobility/data rate/lower latency; NB-IoT — low-power small/intermittent data і deep coverage.

Actual availability залежить від operator/region.

Додаються SIM/eSIM, APN, registration, coverage, roaming.

## 13. LoRaWAN

Low-power wide-area для long range/small payloads.

~~~text
end device
   ↓
gateways
   ↓
network server
   ↓
application server
~~~

Не для continuous high-throughput streaming.

## 14. Topology comparison

| Technology | Typical topology | Native IP? | Typical use |
|---|---|---|---|
| BLE | Point/broadcast | No | Low-power short range |
| Wi-Fi | Station ↔ AP | Yes | High throughput |
| Zigbee | Mesh/star/tree | No general native IP | Low-power mesh |
| Thread | IPv6 mesh | Yes | Low-power IP mesh |
| Cellular | Operator network | Yes | Wide-area |
| LoRaWAN | Device→gateways | Backend IP | Small long-range data |

## 15. Commissioning та provisioning

Може включати Wi-Fi credentials, BLE pairing, Thread credentials, Matter fabric, SIM/eSIM, LoRaWAN keys, cloud identity.

Factory provisioning і user commissioning — different lifecycle stages.

## 16. Reconnect та offline behavior

Потрібно визначити:

- local control offline;
- telemetry queue;
- buffer limit;
- retry/backoff;
- state reconciliation;
- command replay;
- clock recovery.

Undefined offline model не виправить жодна radio technology.

## 17. Wireless security basics

Security layers:

- radio/link;
- network credentials;
- device identity;
- TLS/application security;
- cloud authorization.

Link encryption ≠ correct application authorization.

## 18. Tools

BLE scanners, BlueZ, BLE sniffers, Wireshark, Wi-Fi capture, Thread tools/logs, cellular AT/logging, LoRaWAN server logs, RF spectrum analyzer.

## 19. Practice

### Exercise 1

Choose technology for door sensor, smartwatch, industrial gateway, agriculture sensor, security camera.

### Exercise 2

Why “Matter means Thread” is wrong?

### Exercise 3

BLE lower latency: which parameters and battery trade-off?

### Exercise 4

Smart lock loses cloud but has BLE. Define offline behavior.

## Quick testing lens

- range;
- interference;
- weak-signal transitions;
- disconnect/reconnect;
- Wi-Fi/cellular changes;
- commissioning failures;
- credential rotation;
- duplicate identity;
- offline buffer limit;
- power vs connection settings;
- AP/gateway/border-router restart.

## Sources

- [Bluetooth SIG — Bluetooth LE Primer](https://www.bluetooth.com/bluetooth-le-primer/)
- [Thread Group — Overview](https://threadgroup.org/what-Is-thread/overview)
- [Thread Group — Resources](https://threadgroup.org/Resources)
- [Connectivity Standards Alliance — Matter](https://csa-iot.org/all-solutions/matter/)
- [Wi-Fi Alliance](https://www.wi-fi.org/)
- [GSMA — Mobile IoT](https://www.gsma.com/solutions-and-impact/technologies/internet-of-things/)
- [LoRa Alliance](https://lora-alliance.org/about-lorawan/)
`;

export const wirelessConnectivity = { markdown, markdownUk };
export default wirelessConnectivity;
