const markdown = String.raw`Embedded systems need several kinds of evidence because no single test environment reproduces CPU behavior, electronics, radio conditions, physical sensors, cloud services and long-term timing at once.

This chapter explains the engineering toolchain from source-level debugging to hardware-in-the-loop (HIL) and automated device labs.

## 1. Debugging vs testing

**Debugging** asks why a known failure happens.

**Testing** asks whether expected behavior holds across planned conditions and whether unknown failures can be exposed.

They use many of the same tools, but the purpose is different.

## 2. Build an evidence ladder

A practical embedded verification ladder is:

~~~text
host/unit tests
      ↓
software simulation / fake peripherals
      ↓
target firmware on MCU with controlled dependencies
      ↓
SIL / emulation where useful
      ↓
HIL with real controller + simulated/controlled plant
      ↓
real sensors/actuators/radios
      ↓
full end-to-end product environment
~~~

Higher realism usually means slower execution, higher cost and harder diagnosis.

The goal is not to move everything to HIL. Put each behavior at the lowest layer that can prove it correctly.

## 3. Host-based unit tests

Logic that does not require actual hardware should often be testable on a development machine.

Examples:

- packet/parser functions;
- state machines;
- unit conversions;
- filtering;
- retry policy;
- command validation;
- configuration migration;
- CRC/checksum logic.

Advantages:

- milliseconds instead of seconds/minutes;
- easy CI execution;
- sanitizers/fuzzers available;
- simple fault injection;
- deterministic reproduction.

Do not hide pure logic behind hardware access unnecessarily.

## 4. Hardware abstraction and dependency boundaries

Testable firmware often separates hardware access from domain logic.

Conceptual structure:

~~~text
application/state machine
        ↓
service/domain interfaces
        ↓
hardware abstraction / drivers
        ↓
MCU registers/peripherals
~~~

A fake sensor implementation can drive the same application logic used with the real driver.

This is not only a testing trick; it clarifies architecture.

## 5. Simulation and emulation

Terms vary by tool, but useful categories are:

### Functional simulation

Models behavior without reproducing the target CPU/electronics exactly.

### CPU/platform emulation

Runs target binaries/instructions against an emulated machine/peripheral model, e.g. QEMU-supported platforms.

### Native RTOS simulation

Some environments let application/RTOS code execute as a host process with simulated drivers.

Simulation is excellent for repeatability but only proves what the model includes.

## 6. SIL

Software-in-the-loop (SIL) puts production/control software against a software model of its surrounding system.

Example:

~~~text
motor-control algorithm
        ↕
software motor model
~~~

SIL is useful before real power electronics or mechanical hardware is available.

It does not reveal real ADC noise, wiring faults or transceiver behavior unless explicitly modeled.

## 7. HIL

Hardware-in-the-loop connects real target hardware to controlled equipment that stimulates inputs and observes outputs.

Example:

~~~text
HIL controller / DAQ
   ├─ generates sensor voltage
   ├─ toggles digital fault input
   ├─ simulates CAN messages
   └─ measures PWM/output
              ↕
        real ECU / MCU board
~~~

The device firmware runs on the actual processor/peripherals while the surrounding plant is simulated or controlled.

## 8. What HIL can simulate

Depending on equipment, HIL can provide:

- analog voltages/currents;
- digital inputs;
- PWM/frequency signals;
- resistive sensor equivalents;
- CAN/LIN traffic;
- serial buses through dedicated interfaces;
- loads or electronic load models;
- power supply variation;
- fault insertion;
- timing measurement.

Some physical systems cannot be safely or economically reproduced and remain real-device/system tests.

## 9. DAQ

DAQ = Data Acquisition.

A DAQ device converts between software-controlled test equipment and electrical signals.

It can expose analog inputs/outputs, digital I/O, counters and timing functions.

DAQ is not automatically a full HIL system. HIL adds the real-time plant model, switching/fault hardware, bus simulation and automation architecture needed for the product.

## 10. JTAG and SWD

JTAG and SWD are common hardware debug/programming interfaces.

Capabilities can include:

- flash programming;
- breakpoints;
- register/memory inspection;
- stepping;
- watchpoints;
- reset control;
- trace depending on target/probe.

Common probes include vendor/debugger tools such as J-Link, ST-LINK and CMSIS-DAP devices.

Debugging can change timing, especially when execution is halted, so a bug that disappears under a breakpoint may be timing-sensitive.

## 11. Serial console and logs

UART/USB CDC logs are simple and valuable.

Useful logs include:

- boot version/build ID;
- reset cause;
- state transitions;
- connection changes;
- update status;
- fault counters;
- timestamps/uptime.

Logging must be bounded so it does not block real-time work, overflow buffers or leak secrets.

## 12. Logic analyzer

A logic analyzer captures digital signals and can decode protocols such as UART, I²C and SPI.

Use it to answer:

- Did the MCU actually drive chip select?
- Was the I²C address correct?
- Did the sensor NACK?
- Is the UART baud/framing correct?
- Is transaction timing consistent with the datasheet?

## 13. Oscilloscope

An oscilloscope shows the analog electrical waveform.

Use it for:

- voltage levels;
- rise/fall time;
- ringing/reflection;
- clock quality;
- PWM timing;
- reset pulses;
- power rail droop;
- current measurement with suitable probes/shunts.

If a logic analyzer says a bit is wrong, the oscilloscope can reveal that the edge never reached a valid voltage in time.

## 14. Protocol-specific tools

Useful examples:

### CAN

- SocketCAN;
- candump/cansend;
- CANoe/CANalyzer;
- CAN adapters/analyzers.

### BLE

- phone BLE scanner apps;
- BlueZ tools;
- nRF Connect-class tools;
- BLE packet sniffers.

### MQTT

- mosquitto_pub / mosquitto_sub;
- broker logs;
- MQTT explorer clients.

### IP traffic

- Wireshark;
- tcpdump;
- curl;
- OpenSSL tools.

Choose the tool closest to the failing layer.

## 15. Flashing and provisioning automation

A repeatable hardware lab needs deterministic setup.

Automation can include:

1. identify connected board/serial number;
2. erase/flash known firmware;
3. set configuration;
4. provision test credentials;
5. power-cycle/reset;
6. verify boot/version;
7. run scenario;
8. collect logs/artifacts;
9. restore/clean state.

A test that depends on whatever firmware happened to be on the board is not reproducible.

## 16. Power control

Remote-controlled power is extremely useful.

Options include programmable power supplies, USB power switches, relays or lab controllers.

It enables:

- cold boot;
- brown-out scenarios;
- reboot-loop recovery;
- OTA interruption;
- current/power measurements;
- overnight unattended tests.

Reset-pin toggling is not always equivalent to removing power.

## 17. Fault injection

Embedded systems should be exercised with controlled failures.

Examples:

- disconnect sensor;
- return invalid sensor values;
- corrupt bus frame;
- delay response;
- drop MQTT connection;
- remove Wi-Fi;
- exhaust buffer;
- power off during flash update;
- force CAN bus-off condition with proper equipment;
- simulate stuck actuator feedback.

Fault injection should be safe for people and equipment.

## 18. Test doubles vs real hardware

Use a fake when the behavior under test is not the electrical behavior itself.

Use real hardware when the evidence depends on:

- timing/peripheral implementation;
- electrical levels;
- radio behavior;
- memory layout;
- bootloader/flash;
- real sensor physics;
- hardware revision interactions.

A good suite intentionally combines both.

## 19. Test pyramid for embedded systems

A useful shape:

~~~text
             few full-system/device tests
          HIL + real-hardware integration
       target/peripheral integration tests
    many host unit/property/fuzz tests
~~~

This is a cost/feedback model, not a required percentage formula.

If all tests require one physical board, feedback becomes slow and the lab becomes a bottleneck.

## 20. Determinism and flakiness

Hardware tests become flaky when they depend on uncontrolled timing/state.

Improve determinism by:

- wait for observable state, not arbitrary sleep;
- explicit timeouts;
- stable power/reset procedure;
- unique device identity;
- isolated broker/cloud namespace;
- known RF/environment assumptions;
- clean persistent state;
- timestamped logs;
- retry only when retry itself is product behavior, not to hide failures.

## 21. Measuring timing

For microsecond/millisecond timing, host wall-clock timestamps may be insufficient.

Use appropriate instruments or target counters:

- oscilloscope;
- logic analyzer;
- MCU cycle counter;
- hardware timer capture;
- DAQ timestamping.

Measure at the boundary the requirement actually specifies.

## 22. CI with hardware

Hardware CI commonly uses self-hosted runners connected to a device lab.

Typical pipeline:

~~~text
build firmware
  ↓
host/unit tests
  ↓
flash reserved device
  ↓
run target smoke/integration
  ↓
optional HIL suite
  ↓
collect logs + traces + firmware metadata
~~~

Lab orchestration needs device reservation/locking so two jobs do not control the same board simultaneously.

## 23. Artifact capture

When a hardware test fails, retain enough evidence to reproduce it:

- firmware hash/version;
- hardware revision/serial;
- test configuration;
- reset cause;
- serial logs;
- bus captures;
- power/timing traces when relevant;
- backend/broker correlation IDs;
- exact test command and seed.

A red CI result without device evidence wastes expensive lab time.

## 24. Coverage across hardware revisions

Hardware revisions can change sensors, flash chips, radios, pull-ups, oscillator, PCB routing or power circuits while firmware remains mostly shared.

Track which tests ran on which revision.

Risk-based matrix example:

| Test family | Rev A | Rev B | Rev C |
|---|---:|---:|---:|
| Host unit | same build logic | same | same |
| Basic boot | ✓ | ✓ | ✓ |
| Changed sensor | — | ✓ | ✓ |
| RF regression | sampled | ✓ | ✓ |
| Full HIL | release | release | release |

## 25. End-to-end connected-device test

A complete scenario can cross:

~~~text
physical stimulus
  ↓
sensor
  ↓
firmware
  ↓
BLE/MQTT/etc.
  ↓
gateway/cloud
  ↓
API
  ↓
UI
~~~

End-to-end tests are valuable but poor at isolating root cause unless intermediate evidence is captured.

## 26. Practical example: automated sensor test

Conceptual Python-style flow:

~~~python
power.set_voltage(3.3)
board.flash("candidate.hex")
sensor_sim.set_temperature(25.0)

assert board.wait_until_booted()
assert board.read_reported_temperature() == 25.0

sensor_sim.set_temperature(80.0)
assert board.wait_for_alarm(timeout=0.5)
~~~

The exact libraries depend on lab hardware. The important structure is controlled setup → stimulus → observable result → cleanup.

## 27. Practical example: communication fault

~~~python
mqtt.connect()
device.wait_online()

network.block_device()
assert device.queues_telemetry()

network.restore_device()
assert backend.eventually_receives_buffered_data()
assert backend.has_no_duplicate_business_effects()
~~~

Again, this is architecture rather than a specific framework requirement.

## 28. QA quick reference

This is the intentionally testing-focused chapter of the track.

For an embedded/IoT feature, ask which evidence layers are required:

- pure logic → host/unit test;
- protocol framing/state → simulator/integration;
- MCU peripheral behavior → real target;
- electrical/timing → instruments/HIL;
- physical sensor/actuator → real hardware or calibrated simulator;
- radio range/interference → RF/real environment;
- device-cloud behavior → controlled backend/broker;
- recovery/lifecycle → power control + persistent state + OTA tooling.

The central rule is **do not use expensive hardware to prove what a deterministic host test can prove, and do not use a mock to claim evidence about physics it does not model**.

## 29. Practice

### Exercise 1

Place each test at the lowest useful layer: CRC parser, I²C timing, BLE range, OTA rollback, temperature alarm state machine, motor stop deadline.

### Exercise 2

Design a HIL rig for a controller with two analog sensors, one PWM output and CAN communication. Identify stimulus, measurement and switching hardware.

### Exercise 3

A test passes with a debugger attached but fails at full speed. List timing-related reasons the debugger could mask the defect.

### Exercise 4

Design the artifacts you need to diagnose an overnight hardware-CI failure without physically watching the board.

## Sources

- [Zephyr — Testing documentation](https://docs.zephyrproject.org/latest/develop/test/index.html)
- [QEMU documentation](https://www.qemu.org/docs/master/)
- [Linux kernel — SocketCAN](https://docs.kernel.org/networking/can.html)
- [SEGGER J-Link documentation](https://www.segger.com/products/debug-probes/j-link/)
- [OpenOCD](https://openocd.org/)
- [Wireshark](https://www.wireshark.org/docs/)
- [Eclipse Mosquitto](https://mosquitto.org/documentation/)
`;

const markdownUk = String.raw`Embedded system потребує кількох типів evidence, бо жодне environment не відтворює одночасно CPU, electronics, radio, physical sensors, cloud та long-term timing.

Цей chapter — від source debugging до HIL та automated device lab.

## 1. Debugging vs testing

**Debugging** — чому known failure відбувся.

**Testing** — чи expected behavior працює в planned conditions і чи знайдемо unknown failures.

## 2. Evidence ladder

~~~text
host/unit tests
      ↓
simulation/fakes
      ↓
real target MCU
      ↓
SIL/emulation
      ↓
HIL
      ↓
real sensors/actuators/radios
      ↓
full end-to-end
~~~

Higher realism = usually slower/costlier/harder diagnosis.

Не треба все переносити в HIL. Test behavior на lowest layer, який реально його доводить.

## 3. Host unit tests

Добре для parser, state machine, conversions, filters, retries, validation, migration, CRC.

Advantages: fast CI, deterministic, sanitizers/fuzzers, easy fault injection.

## 4. Hardware abstraction

~~~text
application/state machine
        ↓
domain interfaces
        ↓
hardware abstraction/drivers
        ↓
MCU peripherals
~~~

Fake sensor може drive same application logic.

## 5. Simulation/emulation

Functional simulation, CPU/platform emulation, native RTOS simulation.

Model proves only what it models.

## 6. SIL

Production/control software ↔ software plant model.

Useful before real hardware; does not automatically reproduce electrical noise/wiring faults.

## 7. HIL

Real target hardware + controlled simulated plant.

~~~text
HIL / DAQ
 ├ sensor voltage
 ├ digital faults
 ├ CAN traffic
 └ output measurement
        ↕
      real ECU
~~~

## 8. HIL capabilities

Analog/digital I/O, PWM, sensor equivalents, CAN/LIN, serial, loads, power variation, fault insertion, timing.

## 9. DAQ

DAQ = Data Acquisition: software-controlled analog/digital/counter interface.

DAQ alone ≠ complete HIL. HIL adds plant model, switching, buses, automation.

## 10. JTAG/SWD

Flash, breakpoint, memory/registers, stepping, watchpoints, reset, trace where available.

Debugger can change timing and mask races.

## 11. Serial logs

Useful: build ID, reset cause, state transition, connection, update state, fault counter, timestamps.

Logs must not block real-time work or leak secrets.

## 12. Logic analyzer

Decode UART/I²C/SPI and prove actual line-level transactions.

## 13. Oscilloscope

Voltage, rise/fall, ringing, clock, PWM, reset, power droop/current.

Logic analyzer = observed bits; scope = electrical reason.

## 14. Protocol tools

CAN: SocketCAN, candump/cansend, CANoe/CANalyzer.

BLE: scanners, BlueZ, nRF Connect-class tools, sniffers.

MQTT: mosquitto_pub/sub, broker logs.

IP: Wireshark, tcpdump, curl, OpenSSL.

## 15. Flashing/provisioning automation

Identify board → flash known image → config/provision → power cycle → verify version → test → collect artifacts → cleanup.

Unknown board state = non-reproducible test.

## 16. Power control

Programmable PSU/USB switch/relay enables cold boot, brown-out, OTA interruption, power measurement, unattended runs.

Reset pin ≠ always real power cycle.

## 17. Fault injection

Disconnect sensor, corrupt frame, delay response, drop MQTT/Wi-Fi, buffer exhaustion, power-off during update, CAN fault, stuck feedback.

Must be safe for people/equipment.

## 18. Fakes vs real hardware

Fake for logic not dependent on electrical behavior.

Real target for timing, levels, radio, memory layout, boot/flash, real physics, hardware revisions.

## 19. Embedded test pyramid

~~~text
few full-system
HIL/real integration
target integration
many host unit/property/fuzz
~~~

Cost/feedback model, not fixed percentage.

## 20. Determinism/flakiness

Observable-state waits, explicit timeouts, stable reset, unique identity, isolated namespace, known RF assumptions, clean persistent state, logs.

Retry should test product retry behavior, not hide flaky test.

## 21. Timing measurement

For µs/ms use scope, logic analyzer, cycle counter, timer capture, DAQ — measure at actual requirement boundary.

## 22. CI with hardware

~~~text
build
 ↓
host tests
 ↓
flash reserved device
 ↓
target integration
 ↓
HIL
 ↓
artifacts
~~~

Need device locking/reservation.

## 23. Artifacts

Firmware hash, hardware revision/serial, config, reset cause, serial logs, bus capture, power/timing trace, backend IDs, exact command/seed.

## 24. Hardware revisions

Track execution by revision. Changes can be sensor, flash, radio, pull-up, oscillator, PCB, power circuit.

Use risk-based matrix, not assumption “same firmware = same hardware behavior”.

## 25. End-to-end

~~~text
physical stimulus
 ↓
sensor
 ↓
firmware
 ↓
radio/protocol
 ↓
cloud
 ↓
API/UI
~~~

E2E valuable but poor for root cause without intermediate evidence.

## 26. Practical sensor flow

~~~python
power.set_voltage(3.3)
board.flash("candidate.hex")
sensor_sim.set_temperature(25.0)
assert board.wait_until_booted()
assert board.read_reported_temperature() == 25.0
~~~

Structure: controlled setup → stimulus → observation → cleanup.

## 27. Communication fault example

~~~python
mqtt.connect()
device.wait_online()
network.block_device()
assert device.queues_telemetry()
network.restore_device()
assert backend.eventually_receives_buffered_data()
~~~

## 28. QA quick reference

Choose evidence by layer:

- logic → host unit;
- framing/state → simulation/integration;
- MCU peripheral → target;
- electrical/timing → instruments/HIL;
- physics → real/calibrated simulator;
- RF → radio environment;
- cloud → controlled backend;
- lifecycle → power/persistence/OTA tooling.

Rule: **не використовуй expensive hardware для того, що deterministic host test доводить краще; не використовуй mock як evidence про physics, яку він не models**.

## 29. Practice

### Exercise 1
Choose layer for CRC, I²C timing, BLE range, OTA rollback, alarm state machine, motor deadline.

### Exercise 2
Design HIL for 2 analog sensors + PWM + CAN.

### Exercise 3
Why debugger can make failing real-time test pass?

### Exercise 4
What artifacts needed for overnight hardware-CI failure?

## Sources

- [Zephyr — Testing](https://docs.zephyrproject.org/latest/develop/test/index.html)
- [QEMU](https://www.qemu.org/docs/master/)
- [SocketCAN](https://docs.kernel.org/networking/can.html)
- [SEGGER J-Link](https://www.segger.com/products/debug-probes/j-link/)
- [OpenOCD](https://openocd.org/)
- [Wireshark](https://www.wireshark.org/docs/)
- [Eclipse Mosquitto](https://mosquitto.org/documentation/)
`;

export const debuggingHilTesting = { markdown, markdownUk };
export default debuggingHilTesting;
