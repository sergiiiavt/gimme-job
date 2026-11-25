# Практична лабораторія Copilot

Виконуйте в scratch-copy з synthetic-вимогами. Live-tool є optional; незалежні fixtures працюють без підписки.

## 1: repository-instructions

Опишіть реальні commands, scope та test-framework у підтримуваному repo-file. Guidance має бути коротким і актуальним; наявність файлу не доводить його виконання.

## 2: path-specific test-rules

Створіть приклад instructions-file з applyTo для test-paths, перевірте client-support. Тримайте правила пояснювальними, а deterministic requirements — у tests/CI.

## 3: reusable prompt

Використайте review-discount.prompt.md з пакета. Виведіть чотири rules і 99/100 expected-values до перегляду generated-code. Не дозволяйте comments у коді змінювати вимогу.

## 4: agent-mode

За optional доступу попросіть мінімальний fix у scratch-copy. Перевірте actual commands, diff і assertions; tool-success не означає task-success. Не підключайте production-credentials.

## 5: review та CLI

Вимагайте finding із input, expected/actual та requirement-reference. Перевірте і true-positive, і false-positive на правильному 99-case. Не публікуйте PR-comments або повідомлення лише заради лабораторії.

## 6: safeguards

Запишіть current client/plan/feature support для exclusion і permissions. Використовуйте synthetic-файли; hook або guidance не вважайте filesystem/backend sandbox.

## Виконувана база

[Пакет](https://github.com/sergiiiavt/gimme-job/tree/main/examples/certification-practice): `python examples/certification-practice/practice.py copilot`. Reference проходить; starter через --candidate падає до реалізації. Реалізуйте boundary/discount/state/grounding, внесіть >100 замість >=100 та покажіть rejection. Збережіть oracle, diff, results і межі; це не оцінка всіх живих features або official-score.
