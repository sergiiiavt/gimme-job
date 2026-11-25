# Практичні вправи розробника

Спочатку перевірні offline-рішення. Live-SDK та зовнішні side effects потребують окремо дозволеної конфігурації.

## Лабораторія 1: streaming-summary

Опишіть request/response, stop-reasons та incomplete-stream. На synthetic-response відокремте transport-timeout від max_tokens. За optional live-call не логуйтесь secrets; фіксуйте model/version і sanitized evidence.

## Лабораторія 2: bulk-classifier

Визначте quality-bar й labeled-slices, оберіть допустиме processing-window та custom_id. Зіставте результати незалежно від порядку, повторіть лише потрібні failures. Не припускайте, що нічний deadline завжди дорівнює 24 годинам.

## Лабораторія 3: agent/evaluation

Використайте F1–F3, nullable salary, exact trusted approval й error traces. Додайте cross-tenant denial, unsafe-timeout replay та schema-valid unsupported claim. Зберігайте expected/actual і незавершені питання.

## Виконувана база

[Пакет](https://github.com/sergiiiavt/gimme-job/tree/main/examples/certification-practice): `python examples/certification-practice/practice.py developer`. Reference проходить; starter через --candidate падає до реалізації. Реалізуйте retry_allowed, extraction, gate та trace_outcome. Покажіть rejection хибного рішення; для HTTP окремо потрібні backoff/jitter, retry-after, deadline та operation-reconciliation. Це policy-fixtures, не live-інтеграція.
