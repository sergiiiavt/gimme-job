# Цикл агента й tools

Tools є дозволеними можливостями застосунку, не прямими довільними діями моделі.

## Agent-loop

Надішліть context/tools, обробіть tool_use, перевірте args і authorization, виконайте операцію й поверніть matching result. End_turn завершує model-turn; task-done потребує окремого критерію. Додайте budgets та error/cancel paths.

## Визначення tool

Ім’я, чітке призначення й input_schema допомагають вибору. Strict-mode за підтримки перевіряє форму; choice лише визначає вибір. Backend володіє tenant, правами, business-rules та approval.

## Thinking

Додаткове reasoning може допомогти складним багатокроковим задачам, але витрачає час і токени. Оцінюйте користь на релевантних cases; не вимагайте прихований chain-of-thought як доказ правильності.

## Ручний loop і Tool Runner

SDK може автоматизувати цикл; custom-approval, logging і recovery потребують відповідних extension-points або власної orchestration. Перевіряйте актуальний SDK-contract, а не вважайте один спосіб універсально обов’язковим.

## Приклад

Order-timeout повинен мати явний is_error і причину, не порожній список. Обмежений replay-safe retry або handoff зберігає partial evidence; модельна фраза «готово» не означає успішну операцію.

## Перевірка result-contract

Кілька tool_use потребують усіх відповідних results з tool_use_id. Не припускайте, що перший block є текстом. Offline trace_outcome та check_extraction перевіряють policy-рішення, а stdio-lab показує scripted-loop без моделі; production SDK-flow перевіряється окремо.
