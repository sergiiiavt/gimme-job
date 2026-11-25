# Platform 101: підсумок

Готовність інтеграції визначають перевірні контракти й failure-cases, а не один успішний request.

## Ключові відмінності

System/messages; typed-block/text; end_turn/task-done; tool_choice/strict; schema/semantics/grounding; resource/tool; usage/bill; compaction/persistence. Доведіть кожну відмінність прикладом.

## Типові distractors

Проза DONE як control-loop; empty-success за timeout; найбільша модель для кожного; required salary без nullable; model-approved як реальний дозвіл. Назвіть правильну межу й незалежний check.

## Перед quiz

Пройдіть fixed-traces, schema-validator та exact-approval cases; поясніть error на останньому budget-step. Original quiz — діагностика, не офіційне course-assessment.

## Після курсу

За потреби переходьте до API, MCP та agent-runtime матеріалів глибше. Додавайте complexity за вимогою задачі й перевіряйте current SDK/platform docs. Зберігайте versioned evaluation-set.

## Evidence інтеграції

Request/response contract, error/deadline policy, tool allowlist, synthetic extraction та failed-tool trace мають відтворюватися. Named choice не означає strict args; strict shape не означає truth. Local-green не тестує live-account permissions або remote-features.
