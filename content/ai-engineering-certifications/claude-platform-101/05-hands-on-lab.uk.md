# Практична лабораторія Platform

Baseline — локальні policy-fixtures. Live-model та зовнішні дії є окремими необов’язковими розширеннями.

## 1: call і model-choice

Розберіть request-shape та sanitized-response. Для optional SDK задайте підтримуваний model і ключ через environment, обмежте output/usage. Порівняйте quality-bar до вартості, не вибирайте tier лише за репутацією.

## 2: ручний loop

На fixed events обробіть tool-use/result та done/error/incomplete/budget. Інжектуйте failure на останньому кроці: результат має бути error, не budget чи success. Збережіть evidence попереднього read.

## 3: runner

Порівняйте обов’язки власного loop з поточним SDK Tool Runner. Визначте, де входять approval, timeout, cancellation і safe-retry. Не стверджуйте, що автоматичний runner перевірив ваш бізнесовий результат.

## 4: extension

Додайте лише synthetic tool із чіткою схемою та scoped-можливістю. Перевірте unknown fields, nullable salary, reversed bounds та cross-tenant approval. Нічого реально не надсилайте.

## 5: managed-runtime

За optional доступу порівняйте service-contract sessions/state/sandbox із власними вимогами. За відсутності live-доступу зафіксуйте це як unverified, не симулюйте нібито production-test.

## Виконувана база

[Пакет](https://github.com/sergiiiavt/gimme-job/tree/main/examples/certification-practice): `python examples/certification-practice/practice.py platform`. Reference проходить; starter через --candidate падає до реалізації. Implement extraction/gate/retry/trace, навмисно зламайте один outcome та покажіть відмову oracle. У production окремо потрібні auth, persisted-approvals, idempotency та HTTP-recovery.
