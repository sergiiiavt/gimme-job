const markdown = String.raw`A connected device is not finished when firmware first boots. It must be manufactured, provisioned, updated, recovered, supported and eventually retired.

This chapter treats firmware lifecycle and security as one system because update, identity, boot and key-management decisions are tightly connected.

## 1. Firmware lifecycle

A practical lifecycle can include:

~~~text
development
  ↓
manufacturing
  ↓
factory provisioning
  ↓
commissioning / installation
  ↓
normal operation
  ↓
firmware updates + credential rotation
  ↓
service / repair / reset
  ↓
decommissioning
~~~

Security requirements exist at every stage, not only during network communication.

## 2. Boot chain and root of trust

A secure boot chain starts from something the attacker cannot simply replace with modified software.

Possible roots include immutable ROM code, one-time-programmed configuration, hardware-backed keys or secure elements.

A conceptual chain:

~~~text
ROM / root of trust
     verifies
bootloader
     verifies
application firmware
     loads
configuration / application data
~~~

Each stage should verify the next stage before transferring control when the threat model requires it.

## 3. Secure boot

Secure boot validates that firmware is authorized, usually through digital signatures or another cryptographic trust mechanism.

It protects against running unauthorized firmware; it does **not** by itself encrypt firmware or prevent all runtime exploitation.

Key concepts:

- firmware hash;
- digital signature;
- public verification key;
- key revocation/rotation strategy;
- rollback protection;
- measured/verified boot concepts.

## 4. Firmware signing vs encryption

These solve different problems.

### Signing

Answers: “Was this firmware produced/authorized by a trusted signer and left unmodified?”

### Encryption

Answers: “Can an observer read the firmware contents?”

A product can require signing without encryption, or both, depending on intellectual-property and threat requirements.

## 5. Bootloader responsibilities

A bootloader may handle:

- image verification;
- firmware slot selection;
- recovery mode;
- rollback;
- factory image;
- update installation;
- communication with external updater tools;
- boot-attempt counters.

The simpler and more stable the bootloader, the lower the risk of losing recovery capability during future application updates.

## 6. OTA update architecture

OTA = Over-The-Air firmware update.

A complete OTA system needs more than a download URL.

Typical stages:

1. discover update;
2. authorize update policy;
3. download image/manifest;
4. verify integrity/authenticity;
5. ensure storage/power prerequisites;
6. install or mark image pending;
7. reboot;
8. boot new firmware;
9. confirm health;
10. commit or roll back.

## 7. A/B slots

A robust design can use two firmware slots:

~~~text
slot A: currently running
slot B: downloaded candidate
~~~

After reboot, slot B is tried. If the new image fails health confirmation, the bootloader can return to slot A.

A/B consumes flash but provides strong recovery behavior.

Other designs use swap/scratch regions or external flash; the exact mechanism depends on memory constraints.

## 8. Update atomicity and power loss

A device can lose power during:

- download;
- flash erase;
- flash programming;
- metadata update;
- first boot;
- migration of persistent settings.

The update design must define which operations are atomic and how interrupted state is recognized.

A device should not become unrecoverable because power failed at one unlucky instruction.

## 9. Rollback and anti-rollback

Two different ideas can conflict:

### Functional rollback

Return to the previously working image when a new update fails.

### Security anti-rollback

Prevent returning to a known-vulnerable old firmware version.

A robust design needs a policy that supports safe recovery without permanently reopening fixed vulnerabilities.

## 10. Firmware compatibility and migrations

Firmware may change persistent data formats.

Examples:

- configuration schema;
- calibration data;
- local database;
- credentials;
- boot metadata.

Migration should consider:

- forward conversion;
- rollback compatibility;
- interrupted migration;
- default values for new fields;
- old firmware reading newer state.

A successful image flash does not guarantee a successful product upgrade.

## 11. Provisioning

Provisioning installs product-specific identity/configuration.

Factory provisioning may include:

- serial number;
- device certificate/key;
- manufacturing data;
- calibration;
- hardware revision;
- region configuration;
- boot/security fuses.

User commissioning later may add Wi-Fi credentials, account ownership, Matter fabric membership or another operational identity.

Do not treat factory provisioning and user onboarding as the same operation.

## 12. Per-device credentials

One shared fleet credential creates a large blast radius: compromise of one device may compromise all devices.

Prefer per-device identity when feasible.

Possible storage approaches:

- protected MCU key storage;
- secure element;
- TPM-like component;
- encrypted/isolated flash region;
- hardware-backed key derivation.

The exact security level depends on physical-access threat assumptions.

## 13. Debug interfaces

JTAG/SWD/UART boot modes are invaluable during development but can become attack surfaces in production.

Production strategy may include:

- disabling unrestricted debug;
- authenticated debug unlock;
- lifecycle states;
- readout protection;
- controlled service procedure.

Permanently disabling debug can improve security but can also make field repair/forensics harder. This is a product risk decision.

## 14. Secrets and logs

Do not place long-lived credentials in ordinary source code or readable logs.

Logs should avoid exposing:

- private keys;
- bearer tokens;
- Wi-Fi passwords;
- full personal data;
- unredacted provisioning secrets.

Diagnostic usefulness and confidentiality must be designed together.

## 15. Device security boundaries

Common attack surfaces include:

- local physical ports;
- bootloader/update path;
- BLE/Wi-Fi/cellular interfaces;
- cloud APIs;
- broker topics;
- mobile companion app;
- gateway;
- local storage;
- supply-chain/manufacturing systems.

Securing only the MCU application leaves the product ecosystem exposed.

## 16. Memory-safety and fault defenses

Embedded firmware can fail through buffer overflows, use-after-free, stack corruption, invalid pointers and integer bugs.

Mitigations can include:

- memory-safe languages/components where practical;
- compiler hardening;
- MPU/MMU isolation;
- stack guards;
- input validation;
- bounded parsers;
- privilege separation;
- watchdog/recovery;
- fuzz testing of parsers/protocols.

## 17. Secure communication

Device communication can need:

- peer authentication;
- encryption;
- integrity;
- replay protection;
- authorization;
- key rotation.

TLS may cover Internet connections, but local protocols and constrained networks can use other security mechanisms.

Always reason about which layer is protected and which is not.

## 18. Factory reset

“Factory reset” must have an explicit contract.

Questions:

- Remove Wi-Fi/network credentials?
- Remove account ownership?
- Remove device certificate?
- Preserve manufacturing/calibration data?
- Preserve anti-rollback counters?
- Preserve crash logs?
- Return to factory firmware or current firmware with default settings?

Deleting the wrong data can brick or de-secure the product.

## 19. Decommissioning

End-of-life includes removing a device from accounts, networks and backends.

Possible actions:

- revoke cloud credentials;
- remove broker authorization;
- erase personal/user data;
- invalidate ownership tokens;
- remove from Matter fabric or other network;
- record device retirement.

A device that is physically discarded but still has active cloud credentials is not truly decommissioned.

## 20. Update observability

Fleet update systems need measurable state:

- eligible;
- offered;
- downloading;
- downloaded;
- verifying;
- installing;
- rebooting;
- confirmed;
- rolled back;
- failed with reason.

A single “update failed” status is insufficient for fleet operations.

## 21. Rollout strategy

Large fleets should rarely update every device simultaneously.

Common approach:

- internal devices;
- small canary cohort;
- percentage rollout;
- pause on error-rate threshold;
- progressive expansion;
- emergency stop/rollback policy.

This reduces blast radius from a bad release.

## 22. Practice

### Exercise 1 — power loss

List every point in an OTA update where power loss can occur and define a recoverable outcome.

### Exercise 2 — signing

Explain why a TLS-protected firmware download does not replace firmware signature verification.

### Exercise 3 — factory reset

Design reset behavior for Wi-Fi credentials, cloud ownership, calibration values, secure-boot keys and crash logs.

### Exercise 4 — rollout

A firmware update causes 2% of one hardware revision to reboot-loop. Design the fleet response.

## Quick testing lens

High-value lifecycle/security tests include:

- invalid/expired/wrong-signer image;
- corrupted download;
- insufficient flash space;
- power loss at every install phase;
- new firmware never confirms healthy boot;
- rollback and anti-rollback boundaries;
- persistent-data migration with downgrade;
- duplicate/failed provisioning;
- factory reset semantics;
- credential revocation;
- debug interface state in production builds;
- staged rollout metrics and stop conditions.

## Sources

- [MCUboot documentation](https://docs.mcuboot.com/)
- [Trusted Firmware-M documentation](https://tf-m-user-guide.trustedfirmware.org/)
- [NISTIR 8259A — IoT Device Cybersecurity Capability Core Baseline](https://csrc.nist.gov/pubs/ir/8259/a/final)
- [OWASP Internet of Things](https://owasp.org/www-project-internet-of-things/)
- [The Update Framework](https://theupdateframework.io/)
`;

const markdownUk = String.raw`Connected device не закінчується після першого successful boot. Його треба manufacture, provision, update, recover, service та decommission.

Firmware lifecycle і security тут розглядаються разом, бо update, identity, boot та key-management тісно пов'язані.

## 1. Firmware lifecycle

~~~text
development
  ↓
manufacturing
  ↓
factory provisioning
  ↓
commissioning
  ↓
operation
  ↓
updates + credential rotation
  ↓
service / reset
  ↓
decommissioning
~~~

Security потрібна на кожному stage.

## 2. Boot chain та root of trust

Secure boot chain починається з root, який attacker не може просто replace software update.

~~~text
ROM / root of trust
     verifies
bootloader
     verifies
application firmware
~~~

Root може бути ROM code, OTP configuration, hardware-backed key або secure element.

## 3. Secure boot

Secure boot перевіряє, що firmware authorized, зазвичай digital signature.

Це не automatic firmware encryption і не захист від усіх runtime exploits.

Concepts: hash, signature, public verification key, key rotation/revocation, rollback protection.

## 4. Signing vs encryption

**Signing:** firmware authorized і не modified?

**Encryption:** чи може observer прочитати firmware?

Можна вимагати signing без encryption або обидва.

## 5. Bootloader responsibilities

Image verification, slot selection, recovery, rollback, factory image, install, updater communication, boot attempts.

Stable/small bootloader зберігає recovery capability.

## 6. OTA architecture

Stages:

1. discover;
2. policy;
3. download;
4. verify;
5. storage/power prerequisites;
6. install/pending;
7. reboot;
8. boot new;
9. health confirm;
10. commit/rollback.

## 7. A/B slots

~~~text
slot A: running
slot B: candidate
~~~

If B fails health confirmation → bootloader can return A.

Consumes flash, but gives strong recovery.

## 8. Power loss / atomicity

Power can fail during download, erase, programming, metadata, first boot, persistent migration.

Design must know atomic operations і detect interrupted state.

## 9. Rollback vs anti-rollback

Functional rollback = return previous working image.

Security anti-rollback = don't allow known-vulnerable old version.

Need policy supporting both recovery and security.

## 10. Compatibility/migrations

Persistent config/calibration/database/credentials/boot metadata can change.

Consider forward migration, rollback compatibility, interruption, defaults, old firmware reading newer state.

Flash success ≠ product upgrade success.

## 11. Provisioning

Factory provisioning may include serial, certificate/key, manufacturing data, calibration, hardware revision, region, security fuses.

User commissioning later may add Wi-Fi/account/Matter fabric.

Factory provisioning ≠ user onboarding.

## 12. Per-device credentials

Shared fleet secret creates huge blast radius.

Prefer per-device identity.

Storage: protected MCU, secure element, TPM-like component, isolated flash, hardware-backed derivation.

## 13. Debug interfaces

JTAG/SWD/UART boot modes useful in dev but can be production attack surfaces.

Options: disable, authenticated unlock, lifecycle states, readout protection, service procedure.

Security vs field forensics is product risk decision.

## 14. Secrets/logs

Do not log private keys, bearer tokens, Wi-Fi passwords, provisioning secrets or unnecessary personal data.

## 15. Security boundaries

Physical ports, boot/update, radios, cloud API, MQTT broker, companion app, gateway, local storage, manufacturing.

MCU-only security недостатньо для product ecosystem.

## 16. Memory safety

Failures: buffer overflow, UAF, stack corruption, invalid pointer, integer bugs.

Mitigations: safer languages/components, compiler hardening, MPU/MMU, stack guards, validation, bounded parsers, privilege separation, watchdog, fuzzing.

## 17. Secure communication

Needs can include authentication, encryption, integrity, replay protection, authorization, key rotation.

Always ask which layer is protected.

## 18. Factory reset

Define explicitly:

- Wi-Fi credentials?
- account ownership?
- device certificate?
- calibration?
- anti-rollback counter?
- crash logs?
- factory firmware or current firmware defaults?

## 19. Decommissioning

Revoke cloud credentials, broker access, user data, ownership tokens, network/fabric membership.

Physically discarded device with live credentials is not decommissioned.

## 20. Update observability

Statuses should distinguish eligible/offered/downloading/downloaded/verifying/installing/rebooting/confirmed/rollback/failed reason.

## 21. Rollout strategy

Internal → canary → percentage → pause threshold → expand.

Avoid all-fleet blast radius.

## 22. Practice

### Exercise 1
Map power-loss points in OTA and recoverable state.

### Exercise 2
Why TLS firmware download does not replace image signing?

### Exercise 3
Define factory reset for credentials/calibration/keys/logs.

### Exercise 4
2% one hardware revision reboot-loop after update. Design response.

## Quick testing lens

- wrong signer/corrupt image;
- no flash space;
- power loss each phase;
- health confirm missing;
- rollback/anti-rollback;
- migration+downgrade;
- provisioning failures;
- reset semantics;
- credential revoke;
- production debug state;
- staged rollout stop conditions.

## Sources

- [MCUboot documentation](https://docs.mcuboot.com/)
- [Trusted Firmware-M](https://tf-m-user-guide.trustedfirmware.org/)
- [NISTIR 8259A](https://csrc.nist.gov/pubs/ir/8259/a/final)
- [OWASP Internet of Things](https://owasp.org/www-project-internet-of-things/)
- [The Update Framework](https://theupdateframework.io/)
`;

export const firmwareLifecycleSecurity = { markdown, markdownUk };
export default firmwareLifecycleSecurity;
