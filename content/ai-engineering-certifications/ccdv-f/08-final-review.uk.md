# Підсумкове повторення CCDV-F

До release потрібні факти про правильність контракту, а не лише працездатний happy-path.

## Головне правило

Знайдіть failing-layer: input, transport, model-turn, tool, semantic-rule, source або authorization. Зміна моделі без діагнозу може приховати, а не виправити проблему.

## Важливі відмінності

Input-count/output-cap; usage/currency bill; strict-shape/business-validity/grounding; end_turn/task-complete; resource/tool; retry/idempotency; interactive/batch; guidance/enforcement. Наведіть приклад кожної межі.

## Привабливі неправильні рішення

Retry400 без змін; ротація keys для обходу 429; empty-success за outage; JSON як доказ істини; більша модель замість approval. Поясніть конкретний failure-path і правильний control.

## Готовність

Звірте effective-date guide, виконайте labs та нові контрприклади для помилок mock. Перевірте critical-slices до model/prompt/schema/platform update. Навчальна оцінка не прогнозує official scaled-score.

## Пояснити збій перед settings-change

Truncation діагностують за stop_reason, timeout — за transport/stream. Usage потребує тарифів для bill. Валідний source-ID не доводить support. Для кожної помилки збережіть незалежне очікування, case і результат повторної перевірки.
