# Промптинг і продуктивність

Корисний prompt прив’язує дію до джерела й очікувань; користь вимірюється повним результатом задачі.

## Структура prompt

Конкретний намір, потрібний контекст, вхід/вихід, обмеження й приклад. Для неоднозначності попросіть назвати unknowns, а не вигадувати. Загальне «напиши якісний код» не задає перевірного критерію.

## Zero-shot і few-shot

Нуль демонстрацій —zero-shot, одна —one-shot, кілька —few-shot. Приклади показують pattern, але не доводять правильність unseen-cases. Не визначайте few-shot просто як короткий prompt.

## Історія й prompt-files

Використовуйте релевантну history та версіоновані reusable-prompts у підтримуваному client. Застарілі результати скорочуйте, exact-facts зберігайте з джерелами. Prompt-file не є guaranteed execution-policy.

## Продуктивні застосування

Пояснення, чернетки, refactoring, tests і review можуть допомагати за правильного scope. Врахуйте setup, очікування, review й correction, не лише швидкість набору тексту або acceptance-rate.

## Тестування з Copilot

Спочатку умови й oracle зі spec, потім generated-tests. Перевірте edge cases та meaningful assertions, запустіть їх проти багу й правильного fix. Високий coverage із неправильним expected-value мало корисний.

## Робочий приклад

Для date-parser задайте formats, invalid-input і expected-error до генерації. Перевірте current library-API; модель може повторити поточну багову поведінку або невірний приклад.

## Повний час задачі

Prompt містить R1, чотири discount-rules та 99/100 обох ролей. Попросіть мінімальний fix і пояснення. Порівняйте setup+generation+review+correction з нормальним процесом. Економія keystrokes не доводить total-time gain або quality-gain.
