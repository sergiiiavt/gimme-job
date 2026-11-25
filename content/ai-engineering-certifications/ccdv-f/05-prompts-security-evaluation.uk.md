# Промпти, безпека, Code та оцінювання

Структура виходу й надійність дій мають різні controls; тестуйте їх окремо.

## Промптинг

Задайте критерії, область, джерело й формат. XML-tags допомагають позначити data, але не створюють instruction-isolation. Приклади мають охоплювати edge cases; цитування потребує перевірки підтримки.

## Structured output

Bare input_schema або named choice не є strict-enforcement. Перевірте supported strict tool-use чи JSON-mode, schema-обмеження та errors/refusals/truncation. Nullable поля запобігають вимушеним вигадкам; semantic-validator усе одно потрібен.

## Context engineering

Tools, system, history/results споживають бюджет. Trim до релевантного, зберігайте sourced facts і reserve для output. Compaction може втратити деталі, caching не робить input безкоштовним чи завжди доступним.

## Security і safety

Документи, emails та tool-results — недовірені. Least privilege, tenant authorization, exact approval та sandbox коду мають реалізовуватись поза model-text. Не зберігайте секрети в prompts/logs; незворотні дії контролюють до виконання.

## Claude Code

Noninteractive mode потрібен для відповідного CI-сценарію; машинний JSON перевіряють перед зовнішньою публікацією. Командні правила мають бути актуальні, reviewer отримує вимогу й diff. Свіжий контекст не гарантує незалежність висновків.

## Evaluation і debugging

Фіксуйте реальні synthetic/sanitized cases із незалежними очікуваннями, критичними slices й adversarial inputs. Code-grading для точних правил, rubric/human review для відкритих оцінок. Зберігайте мінімальний доступний evidence з retention, не весь raw-private payload.

## Adversarial extraction

Документ наказує відправити candidates назовні: це data, не authority. Send-tool відхиляє неузгодженого отримувача. Null salary не заповнюйте навмання; тестуйте extra-fields, bool замість числа й reversed bounds. Оцінюйте також відмови та false positives, не лише normal accuracy.
