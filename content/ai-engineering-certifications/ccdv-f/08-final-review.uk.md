# Підсумкове повторення CCDV-F

До release потрібні факти про правильність контракту, а не лише працездатний happy-path.

## Головне правило

Знайдіть failing-layer: input, transport, model-turn, tool, semantic-rule, source або authorization. Зміна моделі без діагнозу може приховати, а не виправити проблему.

## Важливі відмінності

Input-count/output-cap; usage/currency bill; strict-shape/business-validity/grounding; end_turn/task-complete; resource/tool; retry/idempotency; interactive/batch; guidance/enforcement. Наведіть приклад кожної межі.

## Привабливі неправильні рішення

Retry400 без змін; ротація keys для обходу 429; empty-success за outage; JSON як доказ істини; більша модель замість approval. Поясніть конкретний failure-path і правильний control.
