# Застосунки й інтеграція

Будуйте контракт запиту, завершення, помилки та повтору до підключення реальних побічних ефектів.

## Форма запиту

POST/v1/messages: model,max_tokens,messages, headers auth/version; system є top-level полем. Content містить різні block-types; stop_reason пояснює зупинку, usage — токени. Валютну ціну рахуйте окремо за моделлю та cache/batch-категоріями.

## Streaming

Message_start, content-block start/delta/stop, message_delta та message_stop утворюють послідовність; SDK може збирати фінальний message. Частковий stream після error не є завершеною відповіддю. Видимий прогрес не гарантує коротшого повного обчислення.

## Stop reasons

End_turn завершує хід, tool_use потребує result, max_tokens означає truncation, stop_sequence — налаштовану зупинку, pause_turn — продовження підтримуваного server-flow, refusal — явний безпечний fallback. Завершення задачі перевіряйте окремо від ходу.

## Errors і retries

400 виправляйте;401/403 потребують auth/rights. Для визначених 429/5xx/529 можливий replay-safe bounded retry із backoff/jitter, retry-after та deadline. Узгодьте SDK й application-retries, щоб вони не множилися. Невідомий результат платежу потребує reconciliation до replay.

## Платформи

Claude API, Bedrock і Vertex мають різні auth, model-IDs та availability features. Перевіряйте конкретну платформу, а не припускайте parity через спільну модельну родину.

## Integration patterns

Synchronous для очікуваної негайної відповіді, streaming для прогресу, Batches для допустимого offline-вікна. Business-operation ID, idempotency й timeouts потрібні окремо. Не ототожнюйте retry model-call з безпечним повтором запису.

## Приклад довгої відповіді

Для обірваного summary перевірте max_tokens і stop_reason; для timeout — transport/proxy та stream. Це дві можливі причини, не автоматично доведений діагноз будь-якого збою.

## Failure-matrix

400→repair input;401/403→repair auth;429→wait within budget;503/529→retry if safe; unknown-payment-timeout→reconcile ID. За stream-error збережіть sanitized partial-state й позначте incomplete. Не логуйтесь повним приватним request/response у довготривале сховище.
