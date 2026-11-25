# Практичні вправи архітектора

Використовуйте synthetic fixtures і scratch-copy. Реальні зовнішні записи не є частиною цієї лабораторії.

## Лабораторія 1: MCP-catalog

Запустіть examples/agentic-mcp-lab, перегляньте discover, tools/list і call-contract. Надішліть malformed params та переконайтеся, що наступний валідний запит обслуговується. Failure не повинен ставати empty success.

## Лабораторія 2: repository-guidance

Вивчіть реальні команди проєкту, опишіть мінімальне guidance без секретів і перевірте scope. У scratch-copy виправте boundary-умову після independently failing-test. Не змінюйте production-конфігурацію для навчання.

## Лабораторія 3: review у CI

На локальному diff сформуйте findings зі source/line/input/expected/actual. Звірте schema й семантику; попередні findings використайте для дедуплікації. Не публікуйте коментарі без окремої авторизації.

## Лабораторія 4: extraction

Використайте F1=hybrid,F2=Kyiv,F3=salary unknown. Відхиліть remote/5000, boolean salary та reversed bounds. Nullable поле дозволяє чесно передати відсутність факту.

## Лабораторія 5: research-handoff

Передайте worker явні source-facts, інжектуйте error, збережіть partial evidence. Scope усіх потрібних тем визначте до synthesis. Різні джерела не усереднюйте без пояснення конфлікту.

## Виконувана база

[Пакет](https://github.com/sergiiiavt/gimme-job/tree/main/examples/certification-practice): `python examples/certification-practice/practice.py architect`. Reference проходить, незавершений starter через --candidate падає. Реалізуйте extraction, gate, retries й trace states. Покажіть відмову для іншого tenant і numeric approved=1. Retain case-ID, expected/actual та exit-status; trusted approval-store й auth у production треба реалізувати окремо.
