# Агентна архітектура й orchestration

Надійність залежить від runtime, перевірних контрактів і меж дій. Саме покращення формулювання не гарантує потрібний ефект.

## Цикл агента

Надішліть messages і tools, обробіть tool_use, перевірте args/права, виконайте tool та поверніть result із matching tool_use_id. End_turn завершує model-turn; бізнесове завершення перевірте окремо. Додайте deadline, step-budget і явні error/cancel стани.

## Координатор і workers

Координатор визначає scope й передає потрібний контекст, workers повертають findings із джерелами, synthesis зберігає provenance. Успадкування history залежить від runtime. Незалежні задачі можна паралелити; залежні записи чи approvals потребують порядку та ізоляції.

## Hooks та обов’язкові правила

PreToolUse може блокувати охоплені виклики до дії; PostToolUse обробляє результат після неї. Ліміти, identity й tenant перевіряйте на backend незалежно від prompt. Hook не sandbox для Bash, filesystem чи сторонніх інтеграцій.

## Escalation і handoff

Явні критерії: прохання людини, вихід за policy, відсутність прогресу. Передайте проблему, sourced facts, кроки, partial evidence й невирішені питання. Sentiment та self-confidence не є надійними універсальними triggers.

## Сесії

Resume продовжує state, fork створює гілку розмови. Fork не ізолює файли, credentials або зовнішні побічні ефекти; для ризикового експерименту потрібне окреме середовище й відповідні дозволи.

## Приклад refund-cap

Prompt задає 500, але модель просить 900. Кодова перевірка відхиляє перевищення й передає кейс людині з контекстом. Більша модель чи capital letters можуть змінити ймовірність, не створити гарантію policy.

## Gate та handoff на прикладі

Send_application для training/job-7/candidate-2 потребує trusted-store approval саме цих args і належної авторизації. Зміна tenant скасовує відповідність; model-approved=true не є дозволом. В offline-симуляції нічого не надсилається. History-error після read-job дає error із частковими доказами, а не done.
