# Вибір моделі та оптимізація

Спочатку перевірте quality-bar, потім оптимізуйте повну вартість і затримку в межах цього бар’єра.

## Модельні tiers

Opus/Sonnet/Haiku — корисні сімейства для орієнтації, не вічний вичерпний рейтинг. Порівнюйте репрезентативні cases, критичні slices, latency й cost. Pin/revalidate version; дешева модель непридатна, якщо не проходить потрібну якість.

## Prompt caching

Cache відповідає exact-prefix tools/system/messages у підтримуваній конфігурації. Стабільне ставте до breakpoint, змінне після. Перевірте model-specific minimum, TTL, scope та usage-категорії. Змінний prefix є однією з причин misses, не єдиною.

## Message Batches

Batches має окреме processing-window та pricing; custom_id потрібен для reconciliation. Не припускайте порядок output і не повторюйте вже успішні записи. Deadline має дозволяти batch-обробку; для блокувального interactive-check це поганий вибір.

## Токени й latency

Token-counting оцінює input; резервуйте output й окремо застосовуйте rates. Streaming показує текст раніше, але не гарантує швидший full-answer. Вартість залежить від фактичних tokens, моделі, cache/batch та кількості retries.

## Вибір важеля

Стабільний дорогий prefix→оцінити caching; допустимий offline-bulk→Batches; повільне відображення→streaming; слабкі hard-cases→перевірена escalation; переповнення→count/trim/chunk. Для кожної зміни повторіть quality-check.

## Приклад виміряного рішення

Моделі A й B проходять однаковий extraction-bar; A коштує 2 умовні одиниці/100 записів, B6. Bulk можна доручити A з оціненою escalation, але за провалу critical-slice економія не виправдовує реліз. Cache перевіряють за фактичними read/write usage, а batch-results — за IDs і statuses.
