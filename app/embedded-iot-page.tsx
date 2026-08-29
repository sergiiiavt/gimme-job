"use client";

import embeddedIotCatalog from "@/content/embedded-iot/catalog";
import { waitingForReviewBannerStyle } from "./learning-review-status";
import TopicLearningPage from "./topic-learning-page";

type EmbeddedIotPageProps = Readonly<{ mode: "public" | "personal" }>;

const publishedTopicMeta = {
  foundations: {
    en: ["MCU · MPU · RTOS", "Memory · interrupts · DMA", "Real-time · watchdog · boot"],
    uk: ["MCU · MPU · RTOS", "Memory · interrupts · DMA", "Real-time · watchdog · boot"],
  },
  "hardware-interfaces": {
    en: ["GPIO · ADC · PWM", "UART · I²C · SPI", "USB · RS-485 · signal integrity"],
    uk: ["GPIO · ADC · PWM", "UART · I²C · SPI", "USB · RS-485 · signal integrity"],
  },
  "can-industrial": {
    en: ["CAN · CAN FD · LIN", "RS-485 · Modbus RTU/TCP", "Arbitration · errors · gateways"],
    uk: ["CAN · CAN FD · LIN", "RS-485 · Modbus RTU/TCP", "Arbitration · errors · gateways"],
  },
  "wireless-connectivity": {
    en: ["BLE · Wi-Fi · Zigbee", "Thread · Matter · Ethernet", "Cellular · LoRaWAN"],
    uk: ["BLE · Wi-Fi · Zigbee", "Thread · Matter · Ethernet", "Cellular · LoRaWAN"],
  },
  "iot-protocols-cloud": {
    en: ["MQTT · CoAP · LwM2M", "Telemetry · commands · state", "Identity · cloud · twins"],
    uk: ["MQTT · CoAP · LwM2M", "Telemetry · commands · state", "Identity · cloud · twins"],
  },
  "firmware-lifecycle-security": {
    en: ["Secure boot · signing", "OTA · A/B · rollback", "Provisioning · fleet rollout"],
    uk: ["Secure boot · signing", "OTA · A/B · rollback", "Provisioning · fleet rollout"],
  },
  "sensors-timing-power": {
    en: ["Sensors · calibration", "Timing · deadlines · clocks", "Battery · sleep · brown-out"],
    uk: ["Sensors · calibration", "Timing · deadlines · clocks", "Battery · sleep · brown-out"],
  },
  "debugging-hil-testing": {
    en: ["JTAG · SWD · instruments", "Simulation · SIL · HIL", "Fault injection · hardware CI"],
    uk: ["JTAG · SWD · instruments", "Simulation · SIL · HIL", "Fault injection · hardware CI"],
  },
} as const;

const defaultMeta = {
  en: ["Embedded & IoT", "Layered engineering path", "Source-backed material"],
  uk: ["Embedded та IoT", "Layered engineering path", "Source-backed матеріал"],
} as const;

export default function EmbeddedIotPage({ mode }: EmbeddedIotPageProps) {
  return (
    <>
      <style>{waitingForReviewBannerStyle}</style>
      <TopicLearningPage
        activeSection="embedded"
        catalog={embeddedIotCatalog}
        defaultMeta={defaultMeta}
        defaultTopicId="foundations"
        mode={mode}
        publishedTopicMeta={publishedTopicMeta}
        secondaryTitle="Embedded & IoT"
      />
    </>
  );
}
