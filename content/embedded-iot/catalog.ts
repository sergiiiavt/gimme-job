import embeddedFoundations from "./foundations";
import hardwareInterfaces from "./hardware-interfaces";
import canIndustrial from "./can-industrial";
import wirelessConnectivity from "./wireless-connectivity";
import iotProtocolsCloud from "./iot-protocols-cloud";
import firmwareLifecycleSecurity from "./firmware-lifecycle-security";
import sensorsTimingPower from "./sensors-timing-power";
import debuggingHilTesting from "./debugging-hil-testing";

export type EmbeddedIotTopicStatus = "under-construction" | "published";

export interface EmbeddedIotTopic {
  id: string;
  label: string;
  labelUk: string;
  description: string;
  descriptionUk: string;
  status: EmbeddedIotTopicStatus;
  markdown: string;
  markdownUk: string;
}

export const embeddedIotCatalog = {
  title: "Embedded & IoT",
  titleUk: "Embedded та IoT",
  description: "A layered learning path from microcontrollers and electrical interfaces to wireless networks, device-cloud protocols, secure OTA, physical systems and HIL.",
  descriptionUk: "Layered learning path від microcontrollers та electrical interfaces до wireless networks, device-cloud protocols, secure OTA, physical systems та HIL.",
  topics: [
    {
      id: "foundations",
      label: "Foundations & architecture",
      labelUk: "Foundations та architecture",
      description: "MCU vs MPU, memory, firmware, bootloaders, bare metal, RTOS, interrupts, timers, DMA, watchdogs, real-time behavior and edge-to-cloud architecture.",
      descriptionUk: "MCU vs MPU, memory, firmware, bootloaders, bare metal, RTOS, interrupts, timers, DMA, watchdogs, real-time behavior та edge-to-cloud architecture.",
      status: "published" as const,
      markdown: embeddedFoundations.markdown,
      markdownUk: embeddedFoundations.markdownUk,
    },
    {
      id: "hardware-interfaces",
      label: "Hardware interfaces & local buses",
      labelUk: "Hardware interfaces та local buses",
      description: "GPIO, ADC/DAC, PWM, UART, RS-232/RS-485, I²C, SPI, USB, logic levels, signal integrity and lab instruments.",
      descriptionUk: "GPIO, ADC/DAC, PWM, UART, RS-232/RS-485, I²C, SPI, USB, logic levels, signal integrity та lab instruments.",
      status: "published" as const,
      markdown: hardwareInterfaces.markdown,
      markdownUk: hardwareInterfaces.markdownUk,
    },
    {
      id: "can-industrial",
      label: "CAN & industrial communication",
      labelUk: "CAN та industrial communication",
      description: "CAN/CAN FD, arbitration, error states, LIN, RS-485 layering, Modbus RTU/TCP, gateways and physical-vs-protocol failure analysis.",
      descriptionUk: "CAN/CAN FD, arbitration, error states, LIN, RS-485 layering, Modbus RTU/TCP, gateways та physical-vs-protocol failure analysis.",
      status: "published" as const,
      markdown: canIndustrial.markdown,
      markdownUk: canIndustrial.markdownUk,
    },
    {
      id: "wireless-connectivity",
      label: "Wireless & network connectivity",
      labelUk: "Wireless та network connectivity",
      description: "Bluetooth LE/GATT, Wi-Fi, Ethernet, Zigbee, Thread, Matter layering, cellular IoT, LoRaWAN, commissioning and offline behavior.",
      descriptionUk: "Bluetooth LE/GATT, Wi-Fi, Ethernet, Zigbee, Thread, Matter layering, cellular IoT, LoRaWAN, commissioning та offline behavior.",
      status: "published" as const,
      markdown: wirelessConnectivity.markdown,
      markdownUk: wirelessConnectivity.markdownUk,
    },
    {
      id: "iot-protocols-cloud",
      label: "IoT protocols & device cloud",
      labelUk: "IoT protocols та device cloud",
      description: "MQTT QoS/sessions/retained state, CoAP, HTTP, WebSocket, LwM2M, Matter application model, device identity, telemetry, commands and digital twins.",
      descriptionUk: "MQTT QoS/sessions/retained state, CoAP, HTTP, WebSocket, LwM2M, Matter application model, device identity, telemetry, commands та digital twins.",
      status: "published" as const,
      markdown: iotProtocolsCloud.markdown,
      markdownUk: iotProtocolsCloud.markdownUk,
    },
    {
      id: "firmware-lifecycle-security",
      label: "Firmware lifecycle, security & OTA",
      labelUk: "Firmware lifecycle, security та OTA",
      description: "Secure boot, signing, bootloaders, OTA/A-B updates, rollback, provisioning, per-device credentials, debug security, factory reset and fleet rollout.",
      descriptionUk: "Secure boot, signing, bootloaders, OTA/A-B updates, rollback, provisioning, per-device credentials, debug security, factory reset та fleet rollout.",
      status: "published" as const,
      markdown: firmwareLifecycleSecurity.markdown,
      markdownUk: firmwareLifecycleSecurity.markdownUk,
    },
    {
      id: "sensors-timing-power",
      label: "Sensors, timing & power",
      labelUk: "Sensors, timing та power",
      description: "Measurement chains, calibration, sampling, filtering, actuators, control feedback, real-time deadlines, clocks, batteries, sleep modes and brown-outs.",
      descriptionUk: "Measurement chains, calibration, sampling, filtering, actuators, control feedback, real-time deadlines, clocks, batteries, sleep modes та brown-outs.",
      status: "published" as const,
      markdown: sensorsTimingPower.markdown,
      markdownUk: sensorsTimingPower.markdownUk,
    },
    {
      id: "debugging-hil-testing",
      label: "Debugging, simulation & HIL",
      labelUk: "Debugging, simulation та HIL",
      description: "JTAG/SWD, logs, logic analyzers, oscilloscopes, protocol tooling, unit/SIL/HIL layers, fault injection, flashing automation and hardware CI.",
      descriptionUk: "JTAG/SWD, logs, logic analyzers, oscilloscopes, protocol tooling, unit/SIL/HIL layers, fault injection, flashing automation та hardware CI.",
      status: "published" as const,
      markdown: debuggingHilTesting.markdown,
      markdownUk: debuggingHilTesting.markdownUk,
    },
  ],
};

export default embeddedIotCatalog;
