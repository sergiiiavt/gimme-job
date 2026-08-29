const markdown = String.raw`Embedded devices live in the physical world. Their software quality depends on how correctly they measure, filter, time and control real signals — and how they behave when power is limited or unstable.

## 1. Sensor measurement chain

A measurement may pass through several stages:

~~~text
physical quantity
   ↓
sensor element
   ↓
analog front end
   ↓
ADC / digital sensor interface
   ↓
raw sample
   ↓
calibration / filtering
   ↓
engineering unit
   ↓
application decision
~~~

A wrong displayed value can originate at any stage.

## 2. Accuracy, precision and resolution

These terms are different.

### Resolution

Smallest representable/measurable step of the conversion system.

### Accuracy

How close a measurement is to the true value.

### Precision / repeatability

How consistently repeated measurements agree with each other.

A 16-bit reading is not automatically accurate just because it has many digital codes.

## 3. Calibration

Calibration maps raw measurements to known references.

Possible calibration data:

- offset;
- scale/gain;
- multi-point curve;
- temperature compensation;
- sensor-specific coefficients.

Calibration can be:

- fixed at design time;
- measured per unit during manufacturing;
- updated during service;
- self-calibrated using known references.

Calibration data is product-critical persistent state and often should survive factory reset depending on design.

## 4. Sampling

Sampling rate determines how often the signal is measured.

Too slow a sample rate can miss important dynamics or create aliasing. Very fast sampling can waste power/CPU/storage without adding useful information.

The Nyquist concept says a band-limited signal must be sampled sufficiently above its highest relevant frequency to reconstruct it, but real systems also need anti-alias filtering and margin.

## 5. Filtering

Common digital filtering approaches include:

- moving average;
- exponential moving average;
- median filter;
- low-pass/high-pass filters;
- domain-specific filters such as complementary/Kalman approaches.

Filtering trades responsiveness for noise reduction.

A heavily smoothed temperature signal may look stable but react too slowly to a real dangerous change.

## 6. Sensor failure states

A sensor can fail as:

- open circuit;
- short circuit;
- stuck value;
- saturated min/max;
- noisy/intermittent;
- implausible jump;
- slow drift;
- communication timeout;
- internally reported diagnostic fault.

Robust systems distinguish “valid value = 0” from “no valid measurement.”

## 7. Plausibility checks

Software can detect impossible or suspicious data through:

- physical min/max range;
- rate-of-change limit;
- redundant sensor comparison;
- cross-signal consistency;
- timeout/freshness;
- CRC/status bits supplied by smart sensors.

Plausibility logic should itself be documented; silently clamping every bad value can hide real faults.

## 8. Actuators

Actuators convert commands into physical action.

Examples:

- motors;
- relays;
- valves;
- heaters;
- pumps;
- LEDs;
- speakers;
- servos.

An actuator path often has more states than ON/OFF: enable, target, ramp, feedback, current limit, fault and safe state.

## 9. Open-loop vs closed-loop control

### Open loop

Command output without measuring whether the physical result occurred.

### Closed loop

Measure feedback and adjust control to reach/maintain a target.

Example:

~~~text
speed target
   ↓
controller → motor
   ↑         ↓
   └── speed sensor
~~~

Closed-loop systems introduce stability, tuning and feedback-failure concerns.

## 10. Safe state and fail-safe behavior

A product should define what physical outputs do during faults.

Examples:

- motor disabled;
- heater off;
- valve closed/open depending hazard analysis;
- brake applied;
- alarm asserted.

“Turn everything off” is not universally safest. Safe state is domain-specific.

## 11. Time sources

Embedded software can use several notions of time:

- CPU cycle counter;
- hardware timer;
- monotonic uptime;
- real-time clock (RTC);
- wall-clock UTC time from network/GNSS;
- local timezone representation in UI.

Do not use wall clock for measuring short durations if it can jump due to synchronization or manual changes. A monotonic time base is usually more appropriate.

## 12. Clock drift

Oscillators are not perfectly accurate.

Drift depends on crystal/oscillator tolerance, temperature, aging and calibration.

A device without regular synchronization can accumulate seconds/minutes of error over long periods.

This affects timestamps, scheduled wakeups, certificate validity and data correlation.

## 13. Scheduling and deadlines

Timing requirements should be explicit:

- period;
- deadline;
- jitter tolerance;
- latency;
- execution-time budget.

Example:

~~~text
sample every 10 ms
process within 2 ms
update control output before 10 ms deadline
allowed jitter ±0.2 ms
~~~

Average loop time alone cannot prove this requirement.

## 14. Priority inversion

In an RTOS, a high-priority task can be indirectly blocked by a low-priority task holding a shared resource while a medium-priority task runs.

This is priority inversion.

RTOS mechanisms such as priority inheritance can mitigate it for mutex-protected resources.

The important lesson: scheduling problems can emerge from resource relationships, not just task priorities.

## 15. Power architecture

Battery devices must account for several modes:

- active processing;
- radio transmit;
- radio receive;
- idle;
- light sleep;
- deep sleep;
- shutdown/storage.

Average power depends on both current and how long each mode lasts.

~~~text
average current ≈ Σ(mode current × fraction of time in mode)
~~~

A 100 mA radio burst can be acceptable if it is extremely short and infrequent; a 2 mA “idle” leak can dominate battery life if continuous.

## 16. Duty cycling

Duty cycling keeps high-power components asleep most of the time.

Example sensor:

1. sleep 59 seconds;
2. wake;
3. power sensor;
4. measure;
5. transmit;
6. return to sleep.

Wake-up latency and reinitialization energy matter when choosing sleep depth.

## 17. Battery basics

Battery behavior depends on chemistry, temperature, load profile, age and cutoff voltage.

Important product concepts:

- nominal capacity;
- internal resistance;
- voltage sag under load;
- state of charge estimation;
- brown-out threshold;
- charging limits;
- low-temperature behavior.

A battery can have remaining energy but still reset a device if a radio current pulse causes voltage to sag below the brown-out threshold.

## 18. Brown-out and unstable power

Power faults can create the hardest embedded bugs.

Possible effects:

- repeated resets;
- partially written flash;
- peripheral undefined state;
- corrupted external memory;
- communication failures;
- boot loops.

Brown-out detection and power-fail-safe storage design are therefore important.

## 19. Persistent writes and flash endurance

Flash/EEPROM has finite erase/write endurance.

Writing the same configuration counter every second can wear storage prematurely.

Strategies include:

- write only on meaningful changes;
- batch writes;
- wear leveling;
- rotating records;
- journaling/checksums;
- RAM caching plus controlled flush.

Power loss during write must also be handled.

## 20. Environmental conditions

Real hardware behavior changes with:

- temperature;
- humidity;
- vibration;
- supply voltage;
- EMI/EMC environment;
- component tolerance;
- aging.

Software thresholds should not assume every sensor and oscillator is identical to the lab prototype.

## 21. Practice

### Exercise 1 — measurement chain

A temperature display is consistently +3 °C. List possible causes from physical sensor through application conversion.

### Exercise 2 — battery life

A device sleeps at 20 µA for 59 s and uses 80 mA for 1 s. Explain why averaging current is more useful than quoting only the 80 mA peak.

### Exercise 3 — time

Choose monotonic time or wall-clock time for: retry timeout, user-visible timestamp, motor deadline and TLS certificate validity.

### Exercise 4 — sensor fault

Design representation for “valid temperature is exactly 0 °C” vs “sensor unavailable.”

## Quick testing lens

High-value physical/timing/power tests include:

- sensor min/max and calibrated reference points;
- noisy/stuck/disconnected sensor;
- rapid physical transitions;
- actuator feedback mismatch;
- worst-case task/interrupt load;
- clock drift and time synchronization;
- sleep/wake cycles;
- low battery and voltage sag;
- brown-out during flash write;
- temperature/environment extremes where equipment permits;
- long-duration endurance and flash-write frequency.

## Sources

- [FreeRTOS documentation](https://www.freertos.org/Documentation/00-Overview)
- [Zephyr — Timing documentation](https://docs.zephyrproject.org/latest/kernel/services/timing/index.html)
- [Arm Cortex-M documentation](https://developer.arm.com/Processors/Cortex-M)
`;

const markdownUk = String.raw`Embedded devices працюють у physical world. Якість software залежить від того, наскільки правильно system measure, filter, time та control real signals і як поводиться при limited/unstable power.

## 1. Sensor measurement chain

~~~text
physical quantity
   ↓
sensor
   ↓
analog front end
   ↓
ADC / digital interface
   ↓
raw sample
   ↓
calibration / filtering
   ↓
engineering unit
   ↓
application decision
~~~

Wrong displayed value може з'явитися на будь-якому stage.

## 2. Accuracy, precision, resolution

**Resolution** — smallest representable step.

**Accuracy** — closeness to true value.

**Precision/repeatability** — consistency між repeated measurements.

16-bit reading не означає automatic high accuracy.

## 3. Calibration

Calibration maps raw → known reference.

Data: offset, gain, curve, temperature compensation, per-sensor coefficients.

Може бути design-time, per-unit factory, service або self-calibration.

Calibration data часто має переживати factory reset.

## 4. Sampling

Too slow → missed dynamics/aliasing. Too fast → wasted CPU/power/storage.

Nyquist concept важливий, але real systems також потребують anti-alias filtering та margin.

## 5. Filtering

Moving average, exponential average, median, low/high-pass, domain-specific filters.

Filtering = noise vs responsiveness trade-off.

## 6. Sensor failure states

Open, short, stuck, saturated, noisy, jump, drift, timeout, diagnostic fault.

“valid 0” ≠ “no measurement”.

## 7. Plausibility checks

Physical range, rate-of-change, redundancy, cross-signal consistency, freshness, CRC/status bits.

Silent clamping може приховати real fault.

## 8. Actuators

Motors, relays, valves, heaters, pumps, LEDs, speakers, servos.

Real actuator state includes enable, target, ramp, feedback, current limit, fault, safe state.

## 9. Open vs closed loop

Open loop — command without feedback.

Closed loop — measure result and adjust.

~~~text
speed target
   ↓
controller → motor
   ↑         ↓
   └── sensor
~~~

## 10. Safe state

Fault outputs must be defined. Motor off, heater off, valve state, brake, alarm — domain-specific.

“All off” is not universally safest.

## 11. Time sources

CPU cycles, hardware timer, monotonic uptime, RTC, UTC from network/GNSS, local UI timezone.

Duration measurement usually should use monotonic time, not wall clock that can jump.

## 12. Clock drift

Oscillator tolerance, temperature, aging → drift.

Affects timestamps, scheduled wakeups, certificates and correlation.

## 13. Scheduling/deadlines

Specify period, deadline, jitter, latency, execution budget.

~~~text
sample 10 ms
process ≤2 ms
output before 10 ms deadline
jitter ±0.2 ms
~~~

Average loop time is not proof.

## 14. Priority inversion

High-priority task can wait for low-priority task's mutex while medium task executes.

Priority inheritance can mitigate.

## 15. Power modes

Active, radio TX/RX, idle, light sleep, deep sleep, shutdown.

Average current depends on current × time fraction.

Short 100 mA burst may matter less than continuous 2 mA leak.

## 16. Duty cycling

Sleep → wake → sensor → measure → transmit → sleep.

Wake latency/energy matter.

## 17. Battery basics

Capacity, internal resistance, voltage sag, state of charge, brown-out, charging, temperature.

Radio pulse can reset device through voltage sag even with remaining battery energy.

## 18. Brown-out

Can cause resets, partial flash writes, peripheral state issues, memory corruption, boot loops.

## 19. Flash endurance

Finite writes/erase cycles.

Strategies: write on changes, batch, wear leveling, rotating records, journaling, RAM cache.

Also handle power loss mid-write.

## 20. Environment

Temperature, humidity, vibration, supply, EMI, tolerance, aging change behavior.

Lab prototype is not entire production population.

## 21. Practice

### Exercise 1
Temperature +3°C: enumerate chain causes.

### Exercise 2
20 µA sleep 59 s + 80 mA active 1 s: why average current matters?

### Exercise 3
Choose monotonic/wall clock for retry, UI timestamp, motor deadline, certificate validity.

### Exercise 4
Represent valid 0°C vs sensor unavailable.

## Quick testing lens

- calibration points;
- noisy/stuck/disconnected sensors;
- fast transitions;
- actuator feedback mismatch;
- worst-case task load;
- clock drift;
- sleep/wake;
- low battery/sag;
- brown-out during write;
- environment extremes;
- endurance/flash frequency.

## Sources

- [FreeRTOS documentation](https://www.freertos.org/Documentation/00-Overview)
- [Zephyr — Timing](https://docs.zephyrproject.org/latest/kernel/services/timing/index.html)
- [Arm Cortex-M](https://developer.arm.com/Processors/Cortex-M)
`;

export const sensorsTimingPower = { markdown, markdownUk };
export default sensorsTimingPower;
