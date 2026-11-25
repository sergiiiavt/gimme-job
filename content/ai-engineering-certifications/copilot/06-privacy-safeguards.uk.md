# Приватність і safeguards Copilot

Перевіряйте план, client/version, feature та policy. Тестуйте controls на синтетичних даних, не на справжніх секретах.

## Content exclusion

Організаційні правила Business/Enterprise обмежують відповідний контекст підтримуваних surfaces. Перевірте matching-path і scope. Це не шифрування файлу й не універсальна заборона доступу всім AI-tools.

## Agentic-surfaces змінюються

Поточна support-matrix важливіша за узагальнення «agents ніколи/завжди поважають exclusion». CLI, app, IDE-agent, third-party extensions і MCP можуть мати різні межі. Непрямий semantic-context також потребує уваги.

## Збіги public-code

Policy для suggestions matching public code може block/allow відповідні matches. Code referencing допомагає перевірити джерело й ліцензію. Фільтр не є повною юридичною гарантією для будь-якого generated-code.

## Налаштування редактора

Організаційні та особисті settings мають різні scopes. Перевірте effective policy й client-refresh, а не лише файл на диску. Не покладайтеся на вигаданий універсальний ignore-файл.

## Troubleshooting

Звірте pattern, repo/org scope, підтримуваний client/feature, version та propagation/refresh. Відтворіть на synthetic-path і запишіть expected/observed. Якщо причина не встановлена, позначте невизначеність замість заяви про гарантований захист.

## Робочий приклад

Secrets/** усе ще впливає на suggestion. Спершу перевірте збіг і surface, потім refresh і indirect-context. Не перейменовуйте справжні секрети для експерименту; окремі файлові й backend-controls залишаються потрібними.

## Матриця перевірки

Для кожного client/feature запишіть plan/version, configured path, direct/indirect test й observed behavior. Перевірте повторно після policy/client change. Third-party/MCP/filesystem доступи мають власні controls; exclusion не є vault чи загальним sandbox.
