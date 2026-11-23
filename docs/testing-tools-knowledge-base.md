# Testing Tools knowledge base

## Scope

`/learn/testing-tools` is a set of **hands-on guides to specific tools** that QA engineers use every day. Each chapter teaches one tool (or a closely related pair) with exact menu paths, shortcuts and commands, official screenshots, a cheat sheet and a hands-on lab. The chapters are in English and Ukrainian.

The public curriculum contains **9 tool guides and 58 required concepts**.

## Curriculum

1. Chrome DevTools — Elements, Console, Network (filters, throttling, Request conditions, Copy as cURL, HAR), Application storage, Device Mode, Local overrides
2. Postman — requests, collections and environments, authorization, scripts and tests, Collection Runner, Postman CLI / Newman, WebSocket, gRPC, GraphQL and MQTT requests
3. curl & jq — verbose debugging, data and uploads, auth and cookie jars, `-w` timing, `--resolve`, jq assertions, CI scripts
4. Charles Proxy & Fiddler Everywhere — SSL proxying, phone and simulator setup, Breakpoints, Map Local / Map Remote, Rewrite, throttling, Fiddler Rules, mapping to Proxyman and mitmproxy
5. Wireshark, tcpdump & tshark — capture vs display filters, Follow Stream, TLS decryption with `SSLKEYLOGFILE`, Expert Information, statistics, server-side capture
6. MQTT tools — MQTT essentials for testers, MQTT Explorer, MQTTX, `mosquitto_pub` / `mosquitto_sub`, test scenarios, wire-level debugging
7. Browser extensions for QA — safe installation, Requestly / ModHeader, axe DevTools, WAVE, Bug Magnet, GoFullPage, Jam, Cookie-Editor
8. DBeaver — connections, Production connection type and read-only safety, SQL and data editors, execution plans, exports
9. Mobile: adb, Logcat & Xcode Simulator — device setup, daily adb commands, Logcat queries, Simulator, `simctl`, iOS logs

## Content files

- `content/testing-tools/taxonomy.json` — the 9 guides, their order, bilingual labels and source IDs.
- `content/testing-tools/chapter-NN.en.json` / `.uk.json` — one Markdown document per guide and language. Each `##` section is a retrieval unit for the Learning Path Advisor.
- `content/testing-tools/practical-examples.en.json` / `.uk.json` — one hands-on lab per guide, inserted before the Summary as a collapsible `:::details` block.
- `content/testing-tools/required-concepts.json` — one concept per tool section, in section order.
- `content/testing-tools/sources.json` — official documentation, store listings and standards with a review date and the role each source plays.

## Screenshot policy

Screenshots are hotlinked from the tools' **official documentation or official project pages** (Chrome for Developers, Postman Learning Center, Telerik, Wireshark User's Guide, MQTTX, MQTT Explorer, Requestly, Deque, WebAIM, DBeaver, Android Developers). Every screenshot needs a caption that names its source, and the English and Ukrainian chapters must use the same screenshots in the same order. Charles Proxy's documentation has no screenshots, so that chapter uses Fiddler Everywhere's official screenshots for the shared proxy concepts.

## Source policy

Menu paths, defaults and command options are checked against current official documentation. Claims that depend on a version or a vendor decision (for example Postman's recommendation of the Postman CLI over Newman, or DBeaver's default connection-type settings) are tied to the source that states them.

## Safety policy

The guides distinguish observation from mutation. Proxy root certificates, TLS key log files, exported cookies, HAR files with sensitive data, SQL writes, Requestly rules and public MQTT brokers are explicitly treated as risky. Examples:

- use public practice services (`postman-echo.com`, `jsonplaceholder.typicode.com`, public MQTT test brokers with a unique topic prefix) or disposable local environments;
- prefer read-only investigation and say when a command changes state;
- never treat production as a practice environment;
- tell the learner to clean up (remove certificates, proxies, rules and key logs) at the end of each lab.

## Boundaries

Performance, security, accessibility strategy, automation-framework design and deep API/integration strategy have their own learning paths. These guides teach the tools well enough to collect evidence and reproduce bugs, without duplicating those courses.

## Validation

`scripts/validate-testing-tools-content.mjs` enforces:

- exactly the 9 tool guides in order and 58 registered concepts;
- bilingual parity of chapters, H2 section counts and screenshots;
- numbered step-by-step instructions, at least one reference table, a Cheat sheet / Шпаргалка section and a captioned screenshot in every guide;
- a hands-on lab with numbered steps for every guide in both languages;
- source registry integrity and complete source use;
- a diagram, Summary and Sources section per chapter, and explicit concept coverage markers.
