# Claude Code 101: підсумок

Перевірте розуміння меж конфігурації та доказів завершеності.

## Ключові відмінності

Memory-guidance/permissions; subagent/skill; MCP/resource/tool; PreToolUse/PostToolUse; compact/clear; context-fork/filesystem-isolation. До кожного механізму наведіть задачу та те, що він не перевіряє.

## Типові distractors

Вища модель замість джерела; home-rule як shared-config; exit1 як універсальний block; post-hook як скасування дії; green generated-tests як доказ correct-oracle. Пояснюйте failure-path.

## Перед quiz

Відтворіть boundary-bug, виконайте мінімальний fix, перевірте hook streams/exit-codes та actual diff. Original quiz допомагає діагностиці, але не є course-assessment чи certification-paper.

## Після курсу

Розширюйте процес лише за реальною потребою: reusable procedures, scoped-context та CI. Для API-інтеграції є Platform101; не додавайте складний harness до задачі, яку вирішує проста перевірка.

## Перевірка reviewer

Дайте свіжому reviewer точну вимогу, diff і cases. Відхиліть заяву про успішні tests без результату запуску. Збережіть regression-evidence й unverified-limits; fixtures не покривають кожне середовище й усі paths.
