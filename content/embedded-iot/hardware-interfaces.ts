const markdown = String.raw`Embedded software becomes meaningful when it interacts with electrical signals. This chapter covers the local interfaces between a processor and nearby sensors, memory, displays, converters and other components.

The key idea is to separate **electrical signaling**, **bus mechanics** and **application data**.

## 1. GPIO: the simplest digital interface

GPIO means General-Purpose Input/Output.

A pin can often be configured as:

- digital input;
- digital output;
- alternate peripheral function;
- analog input on capable pins.

Important concepts:

- logic HIGH / LOW;
- input threshold;
- output drive strength;
- pull-up / pull-down resistor;
- push-pull output;
- open-drain/open-collector output;
- edge interrupt;
- debounce.

A software value of 1 does not automatically mean a particular voltage. Logic levels depend on the electrical standard and supply domain.

## 2. Pull-ups, pull-downs and floating inputs

An un-driven digital input can float and randomly read HIGH or LOW.

A pull-up weakly biases it toward HIGH. A pull-down biases it toward LOW.

Open-drain buses such as I²C depend on pull-up resistors because devices actively pull the line LOW but release it for HIGH.

Choosing pull resistance affects rise time, current and noise sensitivity.

## 3. ADC and DAC

### ADC

An Analog-to-Digital Converter samples an analog voltage and converts it into a digital number.

Important terms:

- resolution, e.g. 10-bit / 12-bit / 16-bit;
- reference voltage;
- sampling rate;
- input range;
- quantization;
- noise;
- offset and gain error.

For an ideal N-bit ADC, the digital range has 2^N codes.

### DAC

A Digital-to-Analog Converter generates an analog voltage/current representation from a digital value.

Not every MCU has a true DAC; PWM plus filtering is sometimes used instead.

## 4. PWM

PWM is a digital waveform whose duty cycle is controlled.

~~~text
25% duty:  __|‾|___|‾|___
50% duty:  __|‾‾|__|‾‾|__
75% duty:  __|‾‾‾|_|‾‾‾|_
~~~

Frequency and duty cycle are separate parameters.

Typical uses:

- motor control;
- LED brightness;
- servo pulses;
- switch-mode power control;
- simple waveform generation.

## 5. UART

UART is an asynchronous serial interface. It normally needs at least TX, RX and a shared reference/ground.

Common parameters:

- baud rate;
- data bits;
- parity;
- stop bits;
- flow control.

A familiar configuration is 115200, 8 data bits, no parity, 1 stop bit: **115200 8N1**.

UART itself does not define message meaning. The application may send text, binary packets, AT commands, a proprietary frame or another protocol.

### UART vs RS-232 / RS-485

UART describes serial framing at the digital interface. RS-232 and RS-485 define electrical signaling characteristics.

A microcontroller UART pin is therefore **not automatically RS-232 compatible**. A transceiver may be required.

## 6. RS-232 and RS-485

### RS-232

RS-232 is traditionally point-to-point and uses voltage levels different from normal MCU GPIO/UART levels.

### RS-485

RS-485 uses differential signaling and supports longer/noisier links and multi-drop topologies.

Important RS-485 concepts:

- A/B differential pair;
- bus termination;
- biasing/failsafe state;
- half-duplex vs full-duplex implementation;
- driver-enable timing.

Protocols such as Modbus RTU are commonly carried over RS-485, but RS-485 itself does not define Modbus messages.

## 7. I²C

I²C is a synchronous multi-device bus commonly used for sensors, EEPROMs, RTCs and configuration devices.

Typical signals:

- SDA — data;
- SCL — clock.

Both lines are normally open-drain/open-collector with pull-ups.

Important concepts:

- controller/target roles;
- 7-bit and 10-bit addressing;
- START / STOP conditions;
- ACK / NACK;
- repeated START;
- clock stretching;
- arbitration in multi-controller systems.

A transaction conceptually looks like:

~~~text
START → address + R/W → ACK → data → ACK/NACK → STOP
~~~

The device register map is an application/device contract layered on top of I²C transfers.

## 8. SPI

SPI is a synchronous serial interface commonly used for displays, flash memory, ADCs, sensors and high-rate peripherals.

Typical signals:

- SCLK — clock;
- MOSI / controller-out-target-in;
- MISO / controller-in-target-out;
- CS/SS — chip select.

SPI is usually full duplex and has no universal addressing layer; the controller selects a target using chip-select lines or external logic.

Important concepts:

- clock frequency;
- CPOL and CPHA;
- SPI mode 0–3;
- bit order;
- chip-select timing;
- transaction framing defined by the peripheral.

Incorrect CPOL/CPHA can produce data that looks shifted or completely invalid.

## 9. I²C vs SPI vs UART

| Property | UART | I²C | SPI |
|---|---|---|---|
| Clock line | No | Yes | Yes |
| Typical wires | TX/RX | SDA/SCL | SCLK + data + CS |
| Addressing in interface | No | Yes | Usually via CS |
| Duplex | Full duplex possible | Half-duplex-style shared data | Usually full duplex |
| Typical use | Console/module/link | Many low/medium-rate peripherals | Faster local peripherals |
| Pull-ups required | Not inherently | Yes | Not inherently |

There is no universally “best” bus. Board topology, bandwidth, device count, pin budget, distance and power matter.

## 10. USB

USB is much more than “a pair of wires.” It combines electrical signaling, enumeration, descriptors, transfer types, device classes and host/device roles.

Useful concepts:

- host and device roles;
- enumeration;
- endpoint;
- descriptor;
- control transfer;
- bulk transfer;
- interrupt transfer;
- isochronous transfer;
- device classes such as HID, CDC and mass storage.

USB Type-C describes connector/cable and role/power capabilities; it is not identical to a particular USB data generation.

USB Power Delivery is another protocol family layered on Type-C signaling for power negotiation.

## 11. Logic levels and level shifting

Two digital devices can both “speak SPI” and still be electrically incompatible.

Examples:

- 1.8 V device connected to 3.3 V-only-tolerant logic;
- 5 V output driving a non-5-V-tolerant MCU;
- missing common ground;
- open-drain bus without pull-ups.

Level shifters/transceivers are used when voltage domains or electrical standards differ.

## 12. Signal integrity and distance

A digital waveform is an analog electrical signal underneath.

At higher speeds or longer traces/cables, behavior depends on:

- capacitance;
- inductance;
- impedance;
- edge rate;
- termination;
- reflections;
- EMI;
- ground quality;
- connector/cable characteristics.

A protocol analyzer may report corrupt frames, but the root cause can be electrical.

## 13. Reading a datasheet interface section

For any peripheral, extract:

1. voltage and absolute maximum ratings;
2. pin functions;
3. required pull resistors;
4. supported bus modes/speeds;
5. timing parameters;
6. initialization sequence;
7. register map or command framing;
8. reset/default state;
9. error/status flags.

Do not write software from a one-line product description. The electrical and timing tables are part of the interface contract.

## 14. Useful tools

### Multimeter

Measures voltage, resistance, continuity and current (with correct setup).

### Oscilloscope

Shows analog waveform vs time. Useful for rise time, glitches, ringing, PWM, clock quality and timing.

### Logic analyzer

Captures digital lines and can decode UART, I²C, SPI and other protocols.

### USB protocol analyzer

Provides deeper visibility into USB transactions than an ordinary serial terminal.

A logic analyzer tells you what bits were observed; an oscilloscope helps explain **why those bits became wrong electrically**.

## 15. Practice

### Exercise 1

A 3.3 V MCU must communicate with a 5 V UART module. Explain what you must verify before connecting them.

### Exercise 2

An I²C sensor never ACKs. Build an investigation starting from power, pull-ups and address before blaming the driver.

### Exercise 3

An SPI flash returns shifted data. Which clock-mode and timing parameters would you compare with the datasheet?

### Exercise 4

Explain why Modbus RTU, RS-485 and UART should not be used as synonyms.

## Quick testing lens

For local interfaces, high-value failure cases include:

- wrong voltage/pull-up configuration;
- min/max supported clock or baud rates;
- boundary register values and reserved bits;
- missing ACK/NACK or timeout;
- device reset during transaction;
- partial/corrupted frame;
- bus contention or multiple devices;
- cable/trace/load variations;
- recovery after peripheral lock-up.

## Sources

- [NXP — UM10204 I²C-bus specification and user manual](https://www.nxp.com/docs/en/user-guide/UM10204.pdf)
- [USB-IF Document Library](https://www.usb.org/documents)
- [USB 2.0 Specification](https://www.usb.org/document-library/usb-20-specification)
- [Arm Developer — CMSIS and Cortex-M resources](https://developer.arm.com/Tools%20and%20Software/CMSIS)
`;

const markdownUk = String.raw`Embedded software має сенс тоді, коли воно взаємодіє з electrical signals. Цей chapter покриває local interfaces між processor та sensors, memory, displays, converters та іншими components.

Головна ідея — відрізняти **electrical signaling**, **bus mechanics** та **application data**.

## 1. GPIO: найпростіший digital interface

GPIO = General-Purpose Input/Output.

Pin часто можна налаштувати як:

- digital input;
- digital output;
- alternate peripheral function;
- analog input.

Важливі concepts:

- logic HIGH / LOW;
- input threshold;
- output drive strength;
- pull-up / pull-down;
- push-pull;
- open-drain/open-collector;
- edge interrupt;
- debounce.

Software value 1 не означає universal voltage. Logic levels залежать від electrical standard та supply domain.

## 2. Pull-ups, pull-downs та floating inputs

Un-driven digital input може float і випадково читатися HIGH/LOW.

Pull-up weakly biases HIGH, pull-down — LOW.

Open-drain buses на кшталт I²C залежать від pull-up resistors: devices тягнуть line LOW і release її для HIGH.

Resistance впливає на rise time, current та noise sensitivity.

## 3. ADC та DAC

### ADC

Analog-to-Digital Converter sample-ить analog voltage і перетворює його у digital number.

Concepts:

- resolution;
- reference voltage;
- sampling rate;
- input range;
- quantization;
- noise;
- offset/gain error.

Ideal N-bit ADC має 2^N digital codes.

### DAC

Digital-to-Analog Converter генерує analog representation з digital value.

Не кожен MCU має true DAC; інколи використовують PWM + filter.

## 4. PWM

PWM — digital waveform зі змінним duty cycle.

~~~text
25% duty:  __|‾|___|‾|___
50% duty:  __|‾‾|__|‾‾|__
75% duty:  __|‾‾‾|_|‾‾‾|_
~~~

Frequency та duty cycle — різні parameters.

Use cases: motors, LED brightness, servo pulses, power control.

## 5. UART

UART — asynchronous serial interface. Зазвичай потрібні TX, RX та common reference/ground.

Parameters:

- baud rate;
- data bits;
- parity;
- stop bits;
- flow control.

Typical: **115200 8N1**.

UART не визначає message meaning. Поверх нього можуть бути text, binary frames, AT commands або proprietary protocol.

### UART vs RS-232 / RS-485

UART описує serial framing на digital side. RS-232/RS-485 описують electrical signaling.

MCU UART pin **не є автоматично RS-232 compatible** — потрібен transceiver.

## 6. RS-232 та RS-485

### RS-232

Зазвичай point-to-point і має voltage levels, відмінні від MCU GPIO/UART.

### RS-485

Differential signaling для longer/noisier links і multi-drop topology.

Concepts:

- A/B differential pair;
- termination;
- biasing/failsafe;
- half/full duplex;
- driver-enable timing.

Modbus RTU часто працює поверх RS-485, але RS-485 не визначає Modbus messages.

## 7. I²C

I²C — synchronous multi-device bus для sensors, EEPROM, RTC та configuration devices.

Signals:

- SDA;
- SCL.

Лінії зазвичай open-drain з pull-ups.

Concepts:

- controller/target;
- 7/10-bit addressing;
- START / STOP;
- ACK / NACK;
- repeated START;
- clock stretching;
- arbitration.

~~~text
START → address + R/W → ACK → data → ACK/NACK → STOP
~~~

Device register map — contract поверх I²C transfer mechanics.

## 8. SPI

SPI — synchronous serial interface для displays, flash, ADC, sensors та faster local peripherals.

Signals:

- SCLK;
- MOSI;
- MISO;
- CS/SS.

Concepts:

- clock frequency;
- CPOL/CPHA;
- SPI modes 0–3;
- bit order;
- chip-select timing;
- peripheral-defined framing.

Wrong CPOL/CPHA може давати shifted або invalid data.

## 9. I²C vs SPI vs UART

| Property | UART | I²C | SPI |
|---|---|---|---|
| Clock | Ні | Так | Так |
| Typical wires | TX/RX | SDA/SCL | SCLK + data + CS |
| Addressing | Ні | Так | Usually CS |
| Duplex | Full possible | Shared data | Usually full |
| Typical use | Console/module | Many peripherals | Faster peripherals |
| Pull-ups | Not inherent | Required | Not inherent |

“Best bus” не існує: важливі topology, bandwidth, pins, distance та power.

## 10. USB

USB включає electrical signaling, enumeration, descriptors, transfer types та host/device roles.

Concepts:

- host/device;
- enumeration;
- endpoint;
- descriptor;
- control/bulk/interrupt/isochronous transfer;
- HID, CDC, mass storage classes.

USB Type-C — connector/cable/role/power system, а не конкретна USB data generation.

USB Power Delivery — окремий protocol family для power negotiation через Type-C.

## 11. Logic levels та level shifting

Два devices можуть “говорити SPI” і бути electrically incompatible.

Examples:

- 1.8 V vs 3.3 V;
- 5 V output у non-5-V-tolerant MCU;
- no common ground;
- open-drain bus без pull-ups.

Level shifters/transceivers потрібні для різних voltage/electrical domains.

## 12. Signal integrity та distance

Digital waveform фізично залишається analog electrical signal.

На high speed/long distance впливають capacitance, inductance, impedance, edge rate, termination, reflections, EMI, ground та cable.

Protocol decoder може показати corrupt frames, хоча root cause electrical.

## 13. Як читати datasheet interface section

Випиши:

1. voltage/absolute maximum;
2. pin functions;
3. pull resistors;
4. bus modes/speeds;
5. timing;
6. initialization;
7. register map/commands;
8. reset defaults;
9. error/status flags.

Electrical/timing tables — частина interface contract.

## 14. Useful tools

### Multimeter

Voltage, resistance, continuity, current.

### Oscilloscope

Analog waveform vs time: rise time, glitches, ringing, PWM, clock quality.

### Logic analyzer

Digital capture та decode UART/I²C/SPI.

### USB protocol analyzer

Deep USB transaction visibility.

Logic analyzer показує, які bits були captured; oscilloscope допомагає зрозуміти, **чому вони стали неправильними electrically**.

## 15. Practice

### Exercise 1

3.3 V MCU має працювати з 5 V UART module. Що перевірити перед connection?

### Exercise 2

I²C sensor не ACK. Побудуй investigation від power/pull-ups/address до driver.

### Exercise 3

SPI flash повертає shifted data. Які clock/timing parameters перевірити?

### Exercise 4

Поясни, чому Modbus RTU, RS-485 та UART — не synonyms.

## Quick testing lens

High-value failures:

- wrong voltage/pull-ups;
- min/max clock/baud;
- register boundaries/reserved bits;
- ACK/NACK/timeout;
- reset mid-transaction;
- partial/corrupt frame;
- contention/multiple devices;
- cable/load variations;
- recovery after peripheral lock-up.

## Sources

- [NXP — UM10204 I²C-bus specification and user manual](https://www.nxp.com/docs/en/user-guide/UM10204.pdf)
- [USB-IF Document Library](https://www.usb.org/documents)
- [USB 2.0 Specification](https://www.usb.org/document-library/usb-20-specification)
- [Arm Developer — CMSIS](https://developer.arm.com/Tools%20and%20Software/CMSIS)
`;

export const hardwareInterfaces = { markdown, markdownUk };
export default hardwareInterfaces;
