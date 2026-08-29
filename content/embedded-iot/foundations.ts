const markdown = String.raw`Embedded systems are computers built **inside a product** to perform a defined set of functions. They range from a tiny battery sensor with one microcontroller to a Linux-based industrial controller with several processors, radios and safety-critical peripherals.

This chapter establishes the architecture before discussing individual buses or IoT protocols.

## 1. Embedded system vs general-purpose computer

A laptop is designed to run many unrelated applications. An embedded system is usually designed around a product function and a known hardware platform.

Typical constraints include:

- limited RAM and non-volatile storage;
- limited CPU frequency and processing budget;
- strict power consumption;
- deterministic or bounded response time;
- direct interaction with sensors and actuators;
- long product lifetime;
- difficult physical access after deployment;
- safety, security or regulatory requirements.

Examples include a thermostat, smartwatch, motor controller, router, medical device, drone flight controller, automotive ECU and industrial PLC.

## 2. MCU, MPU and SoC

### Microcontroller (MCU)

An MCU normally combines a CPU core, RAM, flash and peripherals on one chip.

Typical on-chip peripherals:

- GPIO;
- timers/counters;
- PWM;
- ADC/DAC;
- UART;
- I²C;
- SPI;
- CAN;
- USB;
- watchdog;
- DMA;
- cryptographic accelerators.

MCUs are common where cost, power, startup time and deterministic peripheral control matter.

### Microprocessor (MPU)

An MPU usually relies more heavily on external RAM/storage and often runs a rich operating system such as Linux. It fits systems requiring larger memory, advanced networking, a graphical UI or complex application software.

### System on Chip (SoC)

SoC is a broad term for highly integrated chips that can contain CPU cores, memory controllers, accelerators, radios and many peripherals. Many modern MCUs and application processors are also SoCs.

The useful distinction is therefore not the marketing label but **what resources and execution environment the product actually has**.

## 3. CPU cores and instruction execution

The CPU fetches instructions, decodes them and executes operations on registers and memory.

Embedded developers frequently need to understand:

- registers;
- stack pointer;
- program counter;
- privilege levels;
- exceptions and interrupts;
- memory-mapped peripherals;
- atomic operations;
- endianness;
- alignment.

Most application code is written in C/C++, Rust or another high-level language, but hardware behavior eventually becomes machine instructions and memory accesses.

## 4. Memory map: flash, RAM and peripherals

An MCU normally exposes a memory map containing different address ranges.

### Flash / ROM-like non-volatile storage

Contains firmware and constants that must survive power loss.

### RAM

Contains runtime state such as:

- stack;
- heap;
- global/static variables;
- buffers;
- RTOS task state.

### Memory-mapped peripherals

Peripheral registers can appear at fixed addresses. Writing a bit in one register may enable a UART, toggle GPIO mode or start an ADC conversion.

A simplified view:

~~~text
0x0000....   firmware / flash
0x2000....   SRAM
0x4000....   peripheral registers
...          architecture/vendor-specific regions
~~~

Exact addresses depend on the chip.

## 5. Firmware, bootloader and application

**Firmware** is the software stored on and controlling the embedded device.

A product can have several software stages:

~~~text
power-on/reset
   ↓
ROM boot code
   ↓
bootloader
   ↓
application firmware
   ↓
optional RTOS tasks / services
~~~

The bootloader can verify images, choose a firmware slot, recover from failed updates and start the application.

Not every device has a separately updateable bootloader, but the boot chain is fundamental to understanding provisioning, secure boot and OTA updates.

## 6. Bare metal vs RTOS vs embedded Linux

### Bare metal

The firmware runs directly on the hardware without a general operating system.

A simple program can look conceptually like:

~~~c
initialize_hardware();

while (1) {
    read_inputs();
    update_state();
    control_outputs();
}
~~~

This is appropriate for small systems but becomes harder to manage as concurrency and timing complexity grow.

### RTOS

A real-time operating system provides scheduling and synchronization primitives while remaining much smaller than desktop/server operating systems.

Common concepts:

- task/thread;
- priority;
- scheduler;
- queue;
- semaphore;
- mutex;
- event flags;
- software timer.

FreeRTOS and Zephyr are common examples.

### Embedded Linux

Linux is common on more capable processors where memory management, networking, filesystems, drivers and rich application stacks are needed.

“Embedded” therefore does **not** automatically mean “no operating system.”

## 7. Interrupts

Polling asks hardware repeatedly whether something happened. An interrupt lets hardware notify the CPU.

Examples:

- a UART byte arrived;
- a timer expired;
- a GPIO edge occurred;
- an ADC conversion completed;
- a CAN frame was received.

The CPU temporarily transfers control to an interrupt service routine (ISR), then resumes normal execution.

Good ISR design is usually short and bounded. Expensive work is often deferred to the main loop or an RTOS task.

## 8. Timers, counters, PWM and watchdogs

### Timer/counter

Hardware timers provide accurate time bases independent of normal software execution.

They can generate periodic interrupts, measure pulse width, count external events or schedule outputs.

### PWM

Pulse-width modulation represents an average output by changing the duty cycle of a digital signal. Common uses include motor speed control, LED brightness and power conversion.

### Watchdog

A watchdog timer expects software to periodically prove that it is alive. If the software stops servicing it, the watchdog can reset the device.

A watchdog is not a substitute for fixing software faults; it is a recovery mechanism for failures that still occur in the field.

## 9. DMA

Direct Memory Access lets a peripheral transfer data to/from memory with less CPU involvement.

Typical use cases:

- receiving a stream of UART bytes;
- filling ADC sample buffers;
- transmitting SPI frames;
- audio/data acquisition.

DMA improves efficiency but introduces concurrency questions: when is a buffer owned by the CPU, when by DMA, and when is data complete?

## 10. Clock, reset and startup

Embedded hardware depends on clock sources and reset behavior.

Important concepts:

- internal/external oscillator;
- PLL and clock tree;
- peripheral clock enable;
- power-on reset;
- brown-out reset;
- software reset;
- watchdog reset;
- reset-cause register.

A device that “randomly rebooted” may have experienced software reset, watchdog reset, brown-out or external reset. Preserving reset-cause information is therefore valuable for diagnostics.

## 11. Real-time does not mean simply fast

A real-time requirement means a result must occur within a required time bound.

Examples:

- sample a sensor every 1 ms ± tolerance;
- stop a motor within 20 ms after a fault input;
- produce an audio buffer before playback underflows.

A system can be very fast on average and still fail real-time requirements because of rare latency spikes.

### Hard vs soft real-time

- **Hard real-time:** missing a deadline can be unacceptable or unsafe.
- **Soft real-time:** occasional misses degrade quality but are tolerated.

The exact classification depends on product consequences, not on the technology name.

## 12. Concurrency and shared state

Embedded systems often have several things happening at once:

- interrupt handlers;
- RTOS tasks;
- DMA;
- hardware peripherals;
- multiple CPU cores.

Shared data can therefore produce races.

Common coordination mechanisms include:

- critical sections;
- atomic operations;
- mutexes;
- semaphores;
- message queues;
- ownership rules.

A mutex solves a different problem from an interrupt disable or a queue. Choosing the primitive requires understanding who can access the resource and from what execution context.

## 13. State machines

State machines are one of the most useful patterns in embedded design.

Example device connection states:

~~~text
OFF
 ↓
STARTING
 ↓
CONNECTING → RETRY_WAIT
 ↓             ↑
ONLINE ────────┘
 ↓
SHUTTING_DOWN
~~~

Explicit states make timing, retry and fault behavior easier to reason about than scattered boolean flags.

## 14. Device architecture: edge to cloud

A connected product usually has several software/hardware boundaries:

~~~text
sensor / actuator
      ↓
MCU firmware
      ↓
local bus or radio
      ↓
gateway / phone / router (optional)
      ↓
Internet
      ↓
cloud service
      ↓
web/mobile application
~~~

Not every product uses every layer. A BLE sensor may communicate only with a phone. A Thread device may communicate over IPv6 through a border router. A cellular tracker can connect directly to cloud services.

This architecture is why an IoT issue cannot automatically be called a “firmware bug” or a “cloud bug.” First identify the failing boundary.

## 15. What belongs in this learning track

The rest of this Embedded & IoT track is organized by responsibility:

1. hardware interfaces and local peripheral buses;
2. CAN and industrial communication;
3. wireless and network connectivity;
4. IoT application protocols and cloud interaction;
5. firmware lifecycle, security and OTA;
6. sensors, timing and power;
7. debugging, simulation, HIL and testing.

General TCP/IP, DNS, TLS, HTTP versions and Internet networking fundamentals remain in the separate **Networking** track.

## 16. Practice

### Exercise 1 — classify a product

For a battery temperature sensor, identify likely MCU/MPU choice, non-volatile memory, RAM, sensor interface, communication interface and power constraints.

### Exercise 2 — reconstruct a boot chain

Explain what must happen between power-on and execution of the main application. Where could firmware signature verification happen?

### Exercise 3 — polling or interrupt

Compare reading a push button by polling every 10 ms with using a GPIO interrupt. What changes in power, latency and software complexity?

### Exercise 4 — real-time reasoning

A motor controller normally reacts in 2 ms but once every hour takes 80 ms. Is its average performance enough if the required bound is 20 ms? Explain.

### Exercise 5 — boundary diagnosis

A connected sensor is visible locally but data never reaches the dashboard. List the boundaries you would isolate before deciding which component is defective.

## Quick testing lens

This chapter is architectural, not QA-first. When testing these foundations, the highest-value questions are:

- Does startup work from every reset cause and power state?
- What happens when memory, queue or buffer capacity is exhausted?
- Are interrupt/task concurrency assumptions safe?
- Are timing deadlines measured under worst-case load rather than average load?
- Does the watchdog recover the system without creating reset loops or corrupting state?
- Can failures be diagnosed through reset reason, logs, counters or retained crash information?

## Sources

- [Arm Developer — Cortex-M processors](https://developer.arm.com/Processors/Cortex-M)
- [FreeRTOS documentation](https://www.freertos.org/Documentation/00-Overview)
- [Zephyr Project documentation](https://docs.zephyrproject.org/latest/)
- [MCUboot documentation](https://docs.mcuboot.com/)
- [Embedded Artistry — Embedded systems field atlas](https://embeddedartistry.com/fieldatlas/)
`;

const markdownUk = String.raw`Embedded system — це комп'ютер, **вбудований усередину продукту** для виконання визначених функцій. Це може бути маленький battery sensor з одним microcontroller або Linux-based industrial controller з кількома processors, radios та safety-critical peripherals.

Цей chapter спочатку будує architecture, а вже далі окремі buses та IoT protocols.

## 1. Embedded system vs general-purpose computer

Laptop створений для багатьох unrelated applications. Embedded system зазвичай проєктується під конкретну product function та відому hardware platform.

Типові constraints:

- обмежені RAM та non-volatile storage;
- обмежений CPU budget;
- жорсткі power constraints;
- deterministic або bounded response time;
- direct interaction із sensors/actuators;
- довгий product lifetime;
- складний physical access після deployment;
- safety/security/regulatory requirements.

Приклади: thermostat, smartwatch, motor controller, router, medical device, drone flight controller, automotive ECU, PLC.

## 2. MCU, MPU та SoC

### Microcontroller (MCU)

MCU зазвичай поєднує CPU core, RAM, flash та peripherals на одному chip.

Поширені on-chip peripherals:

- GPIO;
- timers/counters;
- PWM;
- ADC/DAC;
- UART;
- I²C;
- SPI;
- CAN;
- USB;
- watchdog;
- DMA;
- crypto accelerators.

MCU типовий там, де важливі cost, power, startup time та deterministic peripheral control.

### Microprocessor (MPU)

MPU частіше використовує external RAM/storage і може запускати Linux. Він підходить для систем з більшим memory footprint, advanced networking, UI або складним application software.

### System on Chip (SoC)

SoC — широкий термін для highly integrated chip із CPU cores, memory controllers, accelerators, radios та peripherals.

Тому корисніше дивитися не на marketing label, а на **реальні resources та execution environment**.

## 3. CPU cores та instruction execution

CPU fetch-ить, decode-ить та виконує instructions.

В embedded важливо розуміти:

- registers;
- stack pointer;
- program counter;
- privilege levels;
- exceptions та interrupts;
- memory-mapped peripherals;
- atomic operations;
- endianness;
- alignment.

Application code може бути на C/C++, Rust або іншій high-level language, але hardware behavior зрештою стає machine instructions та memory accesses.

## 4. Memory map: flash, RAM та peripherals

MCU зазвичай має memory map з різними address ranges.

### Flash / non-volatile storage

Містить firmware та constants, які мають переживати power loss.

### RAM

Містить runtime state:

- stack;
- heap;
- global/static variables;
- buffers;
- RTOS task state.

### Memory-mapped peripherals

Peripheral registers можуть мати fixed addresses. Write одного bit може enable UART, змінити GPIO mode або запустити ADC conversion.

~~~text
0x0000....   firmware / flash
0x2000....   SRAM
0x4000....   peripheral registers
...          architecture/vendor-specific regions
~~~

Exact addresses залежать від chip.

## 5. Firmware, bootloader та application

**Firmware** — software, що зберігається на device і керує ним.

Можливий boot chain:

~~~text
power-on/reset
   ↓
ROM boot code
   ↓
bootloader
   ↓
application firmware
   ↓
optional RTOS tasks / services
~~~

Bootloader може verify image, вибрати firmware slot, recover після failed update та стартувати application.

Цей boot chain потрібен для розуміння provisioning, secure boot та OTA.

## 6. Bare metal vs RTOS vs embedded Linux

### Bare metal

Firmware працює прямо на hardware без general operating system.

~~~c
initialize_hardware();

while (1) {
    read_inputs();
    update_state();
    control_outputs();
}
~~~

Для small systems це просто, але concurrency/timing complexity швидко росте.

### RTOS

Real-time operating system дає scheduler та synchronization primitives з набагато меншим footprint, ніж desktop OS.

Ключові concepts:

- task/thread;
- priority;
- scheduler;
- queue;
- semaphore;
- mutex;
- event flags;
- software timer.

FreeRTOS та Zephyr — поширені examples.

### Embedded Linux

Linux типовий для більш capable processors, де потрібні memory management, networking, filesystems, drivers та rich application stack.

Embedded **не означає** automatically “без OS”.

## 7. Interrupts

Polling постійно питає hardware, чи щось сталося. Interrupt дозволяє hardware повідомити CPU про event.

Приклади:

- UART byte arrived;
- timer expired;
- GPIO edge;
- ADC conversion complete;
- CAN frame received.

CPU переходить у interrupt service routine (ISR), після чого повертається до normal execution.

ISR зазвичай має бути short and bounded; важка робота переноситься у main loop або RTOS task.

## 8. Timers, counters, PWM та watchdogs

### Timer/counter

Hardware timers дають precise time base незалежно від normal software execution.

Вони можуть генерувати periodic interrupts, measure pulse width, count external events або schedule outputs.

### PWM

Pulse-width modulation змінює duty cycle digital signal. Use cases: motor speed, LED brightness, power conversion.

### Watchdog

Watchdog timer очікує, що software регулярно доведе, що працює. Якщо service watchdog припиняється — device може reset.

Watchdog не замінює fixing bugs; це recovery mechanism.

## 9. DMA

Direct Memory Access дозволяє peripheral transfer data до/з memory з меншим CPU involvement.

Use cases:

- UART receive stream;
- ADC sample buffers;
- SPI transmission;
- audio/data acquisition.

DMA додає ownership questions: коли buffer належить CPU, коли DMA і коли data complete?

## 10. Clock, reset та startup

Embedded hardware залежить від clock sources та reset behavior.

Ключові concepts:

- internal/external oscillator;
- PLL та clock tree;
- peripheral clock enable;
- power-on reset;
- brown-out reset;
- software reset;
- watchdog reset;
- reset-cause register.

“Random reboot” може бути software reset, watchdog, brown-out або external reset. Reset-cause information дуже важлива для diagnostics.

## 11. Real-time — це не просто fast

Real-time requirement означає, що result має з'явитися в required time bound.

Приклади:

- sensor sample кожну 1 ms ± tolerance;
- stop motor ≤20 ms після fault;
- audio buffer до playback underflow.

System може бути дуже fast average і все одно fail real-time requirement через rare latency spikes.

### Hard vs soft real-time

- **Hard real-time:** missed deadline неприйнятний/небезпечний.
- **Soft real-time:** occasional miss погіршує quality, але допускається.

Classification визначається product consequences, а не назвою technology.

## 12. Concurrency та shared state

Одночасно можуть працювати:

- interrupt handlers;
- RTOS tasks;
- DMA;
- hardware peripherals;
- multiple CPU cores.

Тому shared data може створювати races.

Coordination mechanisms:

- critical sections;
- atomic operations;
- mutexes;
- semaphores;
- message queues;
- ownership rules.

Mutex, interrupt disable та queue вирішують різні задачі.

## 13. State machines

State machine — один із найкорисніших embedded patterns.

~~~text
OFF
 ↓
STARTING
 ↓
CONNECTING → RETRY_WAIT
 ↓             ↑
ONLINE ────────┘
 ↓
SHUTTING_DOWN
~~~

Explicit states роблять timing, retry та fault behavior набагато зрозумілішими, ніж набір scattered booleans.

## 14. Device architecture: edge to cloud

Connected product має кілька boundaries:

~~~text
sensor / actuator
      ↓
MCU firmware
      ↓
local bus or radio
      ↓
gateway / phone / router (optional)
      ↓
Internet
      ↓
cloud service
      ↓
web/mobile application
~~~

Не кожен product має всі layers. BLE sensor може працювати лише з phone. Thread device — через border router. Cellular tracker може йти прямо в cloud.

Тому IoT issue не можна автоматично називати “firmware bug” або “cloud bug”. Спочатку знайди failing boundary.

## 15. Що входить у цей learning track

Далі Embedded & IoT організований за responsibilities:

1. hardware interfaces та local buses;
2. CAN та industrial communication;
3. wireless/network connectivity;
4. IoT application protocols та cloud interaction;
5. firmware lifecycle, security та OTA;
6. sensors, timing та power;
7. debugging, simulation, HIL та testing.

General TCP/IP, DNS, TLS, HTTP versions та Internet networking fundamentals залишаються у **Networking**.

## 16. Practice

### Exercise 1 — classify a product

Для battery temperature sensor визнач likely MCU/MPU, storage, RAM, sensor interface, communication interface та power constraints.

### Exercise 2 — boot chain

Поясни steps від power-on до main application. Де може відбуватися firmware signature verification?

### Exercise 3 — polling or interrupt

Порівняй polling button кожні 10 ms та GPIO interrupt за power, latency та complexity.

### Exercise 4 — real-time

Motor controller normally reacts in 2 ms, але раз на годину — 80 ms. Якщо deadline 20 ms, чи достатньо average performance?

### Exercise 5 — boundary diagnosis

Connected sensor visible locally, але data не доходить до dashboard. Переліч boundaries, які треба isolate.

## Quick testing lens

Chapter вище architectural, не QA-first. Для testing найцінніші questions:

- Startup після всіх reset causes та power states?
- Що відбувається при memory/queue/buffer exhaustion?
- Чи safe interrupt/task concurrency?
- Deadlines вимірюються під worst-case load?
- Watchdog recovery не створює reset loop або state corruption?
- Чи є reset reason, logs, counters або retained crash info?

## Sources

- [Arm Developer — Cortex-M processors](https://developer.arm.com/Processors/Cortex-M)
- [FreeRTOS documentation](https://www.freertos.org/Documentation/00-Overview)
- [Zephyr Project documentation](https://docs.zephyrproject.org/latest/)
- [MCUboot documentation](https://docs.mcuboot.com/)
- [Embedded Artistry — Embedded systems field atlas](https://embeddedartistry.com/fieldatlas/)
`;

export const embeddedFoundations = { markdown, markdownUk };
export default embeddedFoundations;
