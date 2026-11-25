# Дизайн tools і MCP

Контракт інструмента має бути зрозумілим моделі й перевірним на межі виконання.

## Описи та вибір

Поясніть що повертає tool, його inputs і коли обрати його замість схожого. Якщо get_customer плутають із lookup_order, спочатку перевірте описи й routing-errors. Force одного tool може зламати задачі, де потрібен інший.

## Scope можливостей

Схожі інтерфейси й зайві права збільшують складність. Залиште worker потрібні capabilities та порівняйте результати до/після. Немає універсального правила «18 завжди гірше 5»; least privilege корисний незалежно від якості routing.

## Tool_choice

Auto дозволяє текст або tool; any вимагає якийсь tool; named tool запитує конкретний; none забороняє tools. Перевірте сумісність mode/model. Choice не гарантує schema-valid args, успішне виконання чи завершення бізнесової задачі.

## Корисні помилки

IsError/is_error, безпечна категорія, причина й replay/retry-policy відрізняють збій від порожнього успіху. Timeout не означає «замовлень немає». Не розкривайте credentials або приватні payload у тексті помилки.

## Конфігурація MCP

Project .mcp.json можна версіонувати без секретів; environment-reference відокремлює credentials. Resources надають контекст, tools — операції. Stdio для local-process резервує stdout протоколу; remote-transport має власні auth і network-controls.

## Вбудовані tools Claude Code

Grep шукає вміст, Glob — шляхи; Read дає фактичний текст перед edit. Edit потребує точного збігу, Write змінює файл і вимагає обережності щодо паралельних правок. Bash підлягає permissions і не ізолюється лише текстовою інструкцією.

## Приклад timeout

Order-service недоступний: поверніть явний transient-error. Retry дозволений лише за replay-safe контракту, залишку бюджету та deadline. Інакше збережіть evidence й поясніть unresolved-стан, не підмінюючи його порожнім списком.

## Перевірка error-contract

Після успішного failures-list інжектуйте history-timeout. Збережіть список як partial evidence; не читайте structuredContent з error і не оголошуйте done. Runnable stdio-lab перевіряє цю межу зі scripted-policy, без SDK/model-call; це навчальний runtime, не готова production-інтеграція.
