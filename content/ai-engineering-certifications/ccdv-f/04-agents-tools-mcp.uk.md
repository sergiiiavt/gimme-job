# Агенти, workflows, tools і MCP

Вибирайте найпростішу структуру, що відповідає задачі та контрольованим ризикам.

## Workflow чи agent

Фіксовані відомі кроки зручні для workflow; динамічний наступний крок може потребувати agent-loop. Routing, chaining, orchestrator-workers та evaluator-loop мають різні умови застосування, а не універсальну шкалу зрілості.

## Цикл через API

Передавайте потрібний контекст і tools, обробляйте structured-blocks, перевіряйте args/права й повертайте matching results. End_turn не замінює task-validation. Обмежте кроки, deadline й retries; failure має явний стан.

## Tools

Описи розрізняють призначення; schema описує args; strict-mode за підтримки підсилює форму; backend перевіряє право та бізнес-правила. Не давайте billing-write дослідницькому worker без потреби.

## MCP

Розділяйте client/server, resources/tools та local stdio/remote HTTP. Дотримуйтеся вибраної revision; не змішуйте handshake й request-contract різних версій. Secrets не зберігають у спільній конфігурації.

## Harness

Runtime володіє state, execution, approvals, retries, budgets, cancellation і recovery. Managed-hosting може взяти частину роботи, але не визначає вашу business-policy та evaluation замість вас.

## Робочий приклад

Billing маршрутизується до потрібних tools, tech-support — до іншого path. Навіть правильний routing не дозволяє cross-tenant запис; auth і approval перевіряються на межі сервісу.

## Одна траєкторія, чотири outcomes

Read→history-error: error з обома IDs. Лише read без finish: incomplete. Наступна подія понад max_steps: budget зі збереженим evidence. Validated-finish:done. Trace_outcome fixtures відрізняють ці стани без моделі; вони не є готовим SDK/runtime.
