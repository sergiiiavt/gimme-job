const markdown = String.raw`Embedded products often communicate over buses designed for noisy electrical environments, distributed control and long-lived equipment. This chapter separates **physical/electrical layers** from the application protocols carried over them.

## 1. Why industrial and automotive buses differ from board-level buses

UART, I²C and SPI are usually short-range local interfaces. Automotive and industrial networks must often handle:

- meters to hundreds of meters of wiring;
- electrical noise;
- multiple distributed nodes;
- deterministic or bounded latency needs;
- fault detection;
- field serviceability;
- long product lifetimes.

That changes topology, signaling, termination and error handling.

## 2. CAN fundamentals

CAN (Controller Area Network) is a multi-node broadcast bus widely used in automotive, industrial and embedded systems.

Key properties:

- message-oriented communication;
- identifiers describe message priority/meaning rather than destination address;
- non-destructive arbitration;
- strong error detection;
- differential physical signaling on common CAN transceivers;
- multiple nodes can observe the same frame.

The controller and transceiver are separate concepts: an MCU may contain a CAN controller but still require an external physical-layer transceiver.

## 3. CAN arbitration

CAN arbitration occurs while nodes transmit the frame identifier.

A dominant bit wins over a recessive bit. A node that transmits recessive but observes dominant stops transmitting and retries later.

This means the numerically lower identifier normally has higher bus priority.

Arbitration is non-destructive: the winning frame continues without being corrupted by the losing transmitters.

## 4. CAN frame concepts

Important concepts include:

- identifier;
- standard vs extended identifier formats;
- data length;
- payload;
- CRC;
- ACK field;
- error frame;
- remote frame in Classical CAN contexts;
- bit stuffing.

An identifier is not automatically a device address. Application protocols decide what the identifier and payload mean.

## 5. CAN error handling

CAN controllers maintain error state and can move through states such as error-active, error-passive and bus-off.

Typical error sources:

- bit error;
- stuff error;
- CRC error;
- form error;
- ACK error.

A node that repeatedly disrupts the bus can eventually isolate itself through bus-off behavior.

Recovery policy is partly controller/application dependent and must be designed intentionally.

## 6. CAN FD

CAN FD extends Classical CAN with larger payloads and an optional faster data phase.

The main distinction:

- arbitration remains compatible with CAN-style bus access;
- payload can be larger than Classical CAN's 8-byte maximum;
- data phase can use a higher bit rate when bit-rate switching is enabled.

CAN FD is not simply “CAN but faster.” Controller capability, transceivers, bit timing and network design must all support the intended mode.

## 7. Termination and topology

A typical high-speed CAN bus uses a linear trunk with termination at both physical ends.

Long stubs, missing termination or incorrect impedance can create reflections and communication errors.

Electrical symptoms can therefore appear as protocol errors.

A useful diagnostic split:

~~~text
application signal wrong?
        ↓
CAN frame wrong?
        ↓
controller configuration wrong?
        ↓
transceiver / wiring / termination wrong?
~~~

## 8. Bit timing

CAN bit timing depends on clock, nominal bit rate and sample-point configuration.

Nodes must be configured compatibly enough to sample the same bus correctly.

Common symptoms of timing problems include intermittent errors, failure only at higher bit rates or failure on longer networks.

## 9. LIN

LIN (Local Interconnect Network) is commonly used as a lower-cost automotive subnetwork for less demanding nodes such as switches, simple actuators and body electronics.

A LIN cluster uses a schedule controlled by one commander/master role with responding nodes.

Useful concepts:

- header and response;
- protected identifier;
- schedule table;
- checksum;
- break/sync fields;
- sleep/wake behavior.

LIN and CAN solve different cost/complexity/latency problems and often coexist in the same vehicle architecture.

## 10. RS-485 revisited

RS-485 defines differential electrical signaling; it does not define an application command set.

It is frequently used for industrial serial networks because it supports robust signaling and multi-drop buses.

On top of RS-485 you can carry protocols such as Modbus RTU or proprietary framing.

Therefore:

- UART = serial framing peripheral/concept;
- RS-485 = electrical layer;
- Modbus RTU = application protocol/framing convention.

## 11. Modbus architecture

Modbus is an application-layer protocol used to exchange process/control data.

Core concepts include:

- client/server request-response model in modern terminology;
- unit/server address in serial contexts;
- function code;
- coils;
- discrete inputs;
- input registers;
- holding registers;
- exception responses.

Common function examples include reading coils/registers and writing coils/registers.

The register meaning itself is product-specific and must be documented by the device vendor.

## 12. Modbus RTU

Modbus RTU is commonly carried over serial links such as RS-485.

Important concepts:

- compact binary framing;
- address;
- function code;
- data;
- CRC;
- frame separation based on silent intervals/timing.

Timing therefore forms part of correct framing.

## 13. Modbus TCP

Modbus TCP carries Modbus application semantics over TCP/IP/Ethernet networks.

It is not “raw RS-485 packets sent through Ethernet.” It uses an MBAP header and TCP transport.

The same application data model can therefore exist over different lower layers.

This is a useful example of protocol layering.

## 14. Ethernet in embedded/industrial systems

Ethernet is a link-layer family, not an application protocol.

Embedded products may use Ethernet to carry:

- IP;
- TCP/UDP;
- HTTP;
- Modbus TCP;
- vendor-specific real-time/industrial Ethernet protocols.

The ordinary Networking track covers Ethernet/IP/TCP fundamentals. Here the important embedded point is that an industrial device may bridge between local field buses and Ethernet/IP systems.

## 15. Gateways and protocol conversion

A gateway can connect different communication domains:

~~~text
sensor nodes --CAN--> gateway --Ethernet/IP--> backend
PLC --Modbus RTU/RS-485--> gateway --Modbus TCP--> SCADA
LIN nodes --LIN--> ECU --CAN--> vehicle network
~~~

The gateway may need to translate addressing, timing, retries, units and state models — not just copy bytes.

## 16. Failure modes

High-value failure categories include:

- bus disconnected/shorted;
- incorrect termination;
- one node using wrong bit rate;
- duplicate IDs/addresses where application layer requires uniqueness;
- bus saturation;
- priority starvation;
- malformed frame;
- CRC/checksum error;
- node reset during communication;
- bus-off and recovery;
- delayed/duplicate gateway translation;
- stale process data.

## 17. Tools

Useful tools include:

- CAN interface adapters;
- SocketCAN on Linux;
- candump / cansend;
- CANoe/CANalyzer in automotive environments;
- logic analyzer for lower-speed serial buses;
- oscilloscope for physical waveform/termination analysis;
- Modbus client/server diagnostic tools;
- Wireshark for CAN captures where supported and for Modbus TCP.

Software capture and electrical measurement answer different questions.

## 18. Practice

### Exercise 1 — classify the layers

A Modbus RTU device uses RS-485 and a UART-capable MCU. Explain the responsibility of each layer.

### Exercise 2 — CAN priority

Two nodes begin transmitting simultaneously with identifiers 0x100 and 0x300. Which normally wins arbitration and why?

### Exercise 3 — physical vs logical fault

CAN frames become corrupted only when cable length is increased. Which hypotheses would you investigate before changing application code?

### Exercise 4 — gateway behavior

A gateway converts Modbus RTU register data to Modbus TCP. What state/timing/error information could be lost or changed during translation?

## Quick testing lens

For CAN/industrial communication, test beyond “message received”:

- min/max bus load;
- arbitration under contention;
- communication during node reboot;
- electrical disconnect/reconnect;
- CRC/error injection where tooling permits;
- bus-off and recovery;
- stale data timeout;
- duplicate/out-of-order gateway updates;
- Modbus exception responses;
- register boundaries and illegal function/address handling.

## Sources

- [Bosch — CAN FD Specification](https://www.bosch-semiconductors.com/media/ip_modules/pdf_2/can_fd_spec.pdf)
- [Linux kernel — SocketCAN documentation](https://docs.kernel.org/networking/can.html)
- [Modbus Organization — Specifications](https://www.modbus.org/modbus-specifications)
- [Modbus Organization — Introduction to Modbus](https://www.modbus.org/introduction-to-modbus)
`;

const markdownUk = String.raw`Embedded products часто використовують buses, створені для noisy electrical environments, distributed control та long-lived equipment. Тут важливо розділяти **physical/electrical layers** і application protocols поверх них.

## 1. Чому industrial/automotive buses відрізняються від board-level buses

UART, I²C та SPI зазвичай short-range. Automotive/industrial networks мають працювати з:

- meters/hundreds of meters wiring;
- electrical noise;
- multiple distributed nodes;
- bounded latency;
- fault detection;
- field serviceability;
- long lifecycle.

Це змінює topology, signaling, termination та error handling.

## 2. CAN fundamentals

CAN = Controller Area Network, multi-node broadcast bus для automotive/industrial/embedded systems.

Properties:

- message-oriented communication;
- identifier задає priority/meaning, а не просто destination;
- non-destructive arbitration;
- strong error detection;
- differential signaling через CAN transceiver;
- кілька nodes бачать той самий frame.

CAN controller в MCU і physical transceiver — різні components.

## 3. CAN arbitration

Arbitration відбувається під час identifier transmission.

Dominant bit перемагає recessive. Node, що передав recessive, але побачив dominant, stops transmission і retry later.

Тому lower numeric identifier зазвичай має higher priority.

Winning frame не corrupt-иться losers — arbitration non-destructive.

## 4. CAN frame concepts

- identifier;
- standard/extended format;
- data length;
- payload;
- CRC;
- ACK;
- error frame;
- remote frame в Classical CAN;
- bit stuffing.

Identifier не є automatically device address. Meaning визначає application protocol.

## 5. CAN error handling

CAN controllers мають error states: error-active, error-passive, bus-off.

Error types:

- bit;
- stuff;
- CRC;
- form;
- ACK.

Node, що систематично порушує bus, може перейти bus-off.

Recovery policy треба проектувати явно.

## 6. CAN FD

CAN FD розширює Classical CAN:

- larger payload;
- optional faster data phase;
- arbitration зберігає CAN-style behavior.

Це не просто “CAN faster”: controllers, transceivers, bit timing та network design мають підтримувати mode.

## 7. Termination та topology

Typical high-speed CAN — linear trunk з termination на обох physical ends.

Long stubs, missing termination, wrong impedance → reflections/error frames.

~~~text
application signal wrong?
        ↓
CAN frame wrong?
        ↓
controller config wrong?
        ↓
transceiver / wiring / termination wrong?
~~~

## 8. Bit timing

CAN bit timing залежить від clock, nominal bit rate та sample point.

Wrong timing може проявлятися intermittent errors, problems at high bitrate або long network.

## 9. LIN

LIN — lower-cost automotive subnetwork для switches, simple actuators та body electronics.

Concepts:

- commander/master-controlled schedule;
- header/response;
- protected identifier;
- schedule table;
- checksum;
- break/sync;
- sleep/wake.

LIN і CAN часто coexist.

## 10. RS-485 revisited

RS-485 задає differential electrical signaling, але не application commands.

Поверх нього часто працює Modbus RTU.

Отже:

- UART = serial framing interface;
- RS-485 = electrical layer;
- Modbus RTU = application protocol/framing.

## 11. Modbus architecture

Modbus — application-layer protocol для process/control data.

Concepts:

- client/server request-response;
- unit/server address;
- function code;
- coils;
- discrete inputs;
- input registers;
- holding registers;
- exception responses.

Meaning конкретних registers product-specific.

## 12. Modbus RTU

Modbus RTU часто працює over RS-485.

Frame містить address, function, data, CRC; separation frames залежить від silent intervals/timing.

Timing — частина framing.

## 13. Modbus TCP

Modbus TCP переносить Modbus semantics через TCP/IP/Ethernet.

Це не raw RS-485 packet over Ethernet: є MBAP header та TCP transport.

Same application model може мати different lower layers.

## 14. Ethernet в embedded/industrial

Ethernet — link-layer family, не application protocol.

Поверх нього можуть бути IP, TCP/UDP, HTTP, Modbus TCP та industrial Ethernet protocols.

General Ethernet/IP/TCP fundamentals — у Networking. Тут важливий bridge field bus ↔ Ethernet/IP.

## 15. Gateways та protocol conversion

~~~text
sensor --CAN--> gateway --Ethernet/IP--> backend
PLC --Modbus RTU--> gateway --Modbus TCP--> SCADA
LIN nodes --LIN--> ECU --CAN--> vehicle network
~~~

Gateway може translate addressing, timing, retries, units та state — не лише bytes.

## 16. Failure modes

- disconnect/short;
- wrong termination;
- wrong bit rate;
- duplicate IDs/addresses;
- bus saturation;
- priority starvation;
- malformed frame;
- CRC/checksum error;
- node reset;
- bus-off/recovery;
- gateway delay/duplicate;
- stale data.

## 17. Tools

- CAN adapters;
- SocketCAN;
- candump/cansend;
- CANoe/CANalyzer;
- logic analyzer;
- oscilloscope;
- Modbus diagnostics;
- Wireshark.

Software capture та electrical measurement відповідають на різні questions.

## 18. Practice

### Exercise 1

Modbus RTU device uses RS-485 + UART MCU. Explain each layer.

### Exercise 2

IDs 0x100 і 0x300 start together. Хто wins arbitration?

### Exercise 3

Errors only with longer CAN cable. Які physical hypotheses перевірити?

### Exercise 4

Gateway Modbus RTU → Modbus TCP. Яка timing/state/error semantics може змінитися?

## Quick testing lens

- min/max bus load;
- contention/arbitration;
- node reboot;
- disconnect/reconnect;
- error injection;
- bus-off/recovery;
- stale timeout;
- duplicate gateway updates;
- Modbus exceptions;
- invalid register/function boundaries.

## Sources

- [Bosch — CAN FD Specification](https://www.bosch-semiconductors.com/media/ip_modules/pdf_2/can_fd_spec.pdf)
- [Linux kernel — SocketCAN](https://docs.kernel.org/networking/can.html)
- [Modbus Organization — Specifications](https://www.modbus.org/modbus-specifications)
- [Modbus Organization — Introduction](https://www.modbus.org/introduction-to-modbus)
`;

export const canIndustrial = { markdown, markdownUk };
export default canIndustrial;
