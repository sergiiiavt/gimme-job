# Можливості GitHub Copilot

Поверхні продукту та дозволи відрізняються. Перевіряйте поточний контракт перед побудовою робочого процесу.

## Surfaces

Inline/next-edit suggestions, IDE-chat, agent/edit workflows, CLI, cloud-agent, review та інші підтримувані features мають різні capabilities. Cloud-agent може готувати draft-PR асинхронно; це не автоматична довіра до merge.

## Словник Chat

Slash-commands задають задачі, context references додають доступний матеріал. Workspace/codebase розширює retrieval; selection звужує. Підтримка назв і syntax залежить від client/version, а context-reference не гарантує включення всіх файлів.

## Agents, subagents і MCP

Agent може читати, редагувати, виконувати дозволені commands та ітерувати за результатом. Subagent може відокремити noisy-work; MCP інтегрує зовнішню можливість. Auth, approvals і sandbox не виникають від самого prompt.

## Файли налаштувань

Repo guidance: .github/copilot-instructions.md; path-specific: .github/instructions/*.instructions.md з applyTo; reusable prompts: .github/prompts/*.prompt.md у підтримуваних surfaces. Це версіоновані інструкції, не детерміновані checks.

## Плани та адміністрування

Business/Enterprise мають організаційні policy/seats можливості; конкретний набір features змінюється. REST керує seats за дозволів, audit фіксує зміни, metrics показує usage. Не підмінюйте один механізм іншим.

## Робочий приклад

Правило «Vitest, не Jest» задайте в потрібному scope, згенеруйте мінімальну зміну й перевірте реально виконані тести. Присутність instruction-file не доводить застосування або правильність тестового oracle.

## Перевірити вибраний surface

Chat пояснює discount, editing-workflow готує fix, незалежні 99/100 cases перевіряють результат. Перед MCP, prompt-file чи feature-policy звірте current-support. Backend та filesystem controls існують окремо від repo-guidance.
