# Налаштування Claude Code

Кожен механізм має область: пам’ять правил, окремий контекст, процедура, integration або hook-event.

## CLAUDE.md

Короткі актуальні команди та конвенції для потрібного scope. Shared-rules у Git, personal у home. Не зберігайте secrets, випадкові logs або неперевірені припущення; перевіряйте завантаження memory-files.

## Subagents

Спеціаліст працює з переданими inputs і дозволеними capabilities, повертає стислий результат із evidence. Не припускайте автоматичну shared-memory. Окремий контекст не sandbox для files чи external-effects.

## Skills

Повторні процедури з матеріалами й прикладами. Skill допомагає послідовності, але не створює credentials або guaranteed-format. Перевірте підтримуваний invocation й актуальність кроків.

## MCP

Client/server контракт для context/resources і tool-calls. Shared-config відокремлюйте від secrets, обмежуйте scope. Local stdio й remote HTTP мають різні transport/auth властивості.

## Hooks

PreToolUse може блокувати matched-tool до виконання; PostToolUse діє після й не скасовує операцію. Тестуйте event-shape, stdout/stderr та exit-status. Hook не захищає універсально всі канали запису.

## Що вибрати

Конвенція→memory; noisy-research→окремий контекст; повторна процедура→skill; зовнішній сервіс→MCP; deterministic event-check→hook. Backend-auth і filesystem-sandbox існують окремо від цих підказок.

## Перевірка реальної межі

Супровідний hook читає JSON stdin. Write/Edit до .env.training→stderr та exit2; answer.py→exit0; malformed event→exit2. Settings-example охоплює лише Write/Edit. Bash, symlinks і remote-writes потребують інших controls; секрети в config не додавайте.
