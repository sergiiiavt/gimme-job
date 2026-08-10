# JobPilot — приватний cloud-агент пошуку роботи

JobPilot збирає вакансії в один feed, видаляє дублікати, аналізує вимоги й ринкові тенденції, адаптує резюме без вигаданих фактів та готує заявки. Cloud-версія зберігає дані у приватній D1 database, а надсилання завжди залишається під вашим контролем.

## Cloud-версія

- frontend і API розгортаються разом;
- D1 зберігає профіль, джерела, вакансії, аналіз, резюме й approval history;
- Git-based checkpoint deploy створює постійну HTTPS-адресу;
- сайт доступний лише власнику workspace;
- deterministic analysis працює без OpenAI API та без AI-витрат;
- Gmail OAuth підключається окремо після першого deploy, коли відома callback URL.

Локальний режим нижче залишається доступним для розробки.

## Запуск у VS Code

Потрібні Node.js 22.13+ і npm.

1. Відкрийте цю папку у VS Code.
2. Відкрийте Terminal → New Terminal.
3. Виконайте:

```bash
npm install
npm run local
```

4. Відкрийте [http://localhost:4173](http://localhost:4173).

Також можна запустити через Terminal → Run Task → **Run JobPilot**.

## Що вже працює

- єдиний feed вакансій із дедуплікацією;
- RSS (наприклад, DOU), Greenhouse, Lever, Ashby та ручний JSON import;
- LinkedIn, Djinni і Work.ua через Gmail job alerts;
- Gmail OAuth для читання alerts та надсилання схвалених email-заявок;
- аналіз відповідності, вимог, seniority, remote policy, зарплати й ринкових тенденцій;
- адаптоване Markdown-резюме лише з фактів у профілі;
- application draft, черга підтвердження та історія статусів;
- строгий workflow `PENDING_APPROVAL → APPROVED → SENT`;
- SQLite база, що зберігається тільки локально в `data/`;
- OpenAI Agents SDK, якщо є API key; детермінований локальний аналіз без ключа.

## Перше налаштування

### 1. Профіль кандидата

Відкрийте **Connections** у dashboard і заповніть ім’я, headline, summary, цільові ролі, локації та перевірені skills. Повну історію досвіду й фактичні досягнення можна редагувати у `config/profile.json` після першого запуску.

Не залишайте тестові значення на кшталт `Your Name` або `Replace with company` перед реальною заявкою.

### 2. Джерела вакансій

Відредагуйте source configuration у dashboard або `config/sources.json`:

- `rss` — RSS/Atom feeds;
- `greenhouse`, `lever`, `ashby` — публічні ATS boards;
- `manualFiles` — локальні JSON-файли;
- `gmail` — alerts із LinkedIn, Djinni, Work.ua та інших job-сервісів.

LinkedIn не скрапиться й не керується ботом: це знижує ризик блокування акаунта. Вакансії можна отримувати з офіційних email alerts, а submit через форму відкривається для ручної дії.

### 3. OpenAI — опціонально

Скопіюйте `.env.example` у `.env` і додайте ключ:

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6
```

Без ключа JobPilot працює у deterministic mode.

### 4. Gmail — опціонально

1. У Google Cloud створіть Desktop OAuth client для Gmail API.
2. Збережіть credentials як `data/google-credentials.json`.
3. Запустіть:

```bash
npm run gmail:connect
```

OAuth token буде збережено локально як `data/google-token.json`. JobPilot просить scopes `gmail.readonly` і `gmail.send`. Увімкніть `gmail.enabled` у source configuration, коли connection готовий.

## Безпечне надсилання

`Run agent`, `Scan`, `Analyze` та `Approve` ніколи не надсилають заявку. Надсилання можливе тільки коли:

1. draft уже має статус `APPROVED`;
2. є валідний email recipient;
3. Gmail OAuth підключений;
4. ви окремо натиснули **Send with Gmail** і підтвердили дію.

Для вакансій без recruiter email використовуйте **Original listing** і submit вручну.

## Корисні команди

```bash
npm run local          # dashboard + local API
npm run lint           # code quality check
npm run build          # production web build
npm run agent:sync     # collect jobs from the terminal
npm run agent:analyze  # analyze pending jobs
npm run agent:market   # market report
npm run agent:queue    # approval queue
npm run gmail:connect  # local Gmail OAuth
```

## Де зберігаються дані

- `data/job-agent.db` — jobs, analysis, drafts, approvals;
- `data/google-token.json` — Gmail OAuth token;
- `data/exports/` — exported reports and application packages;
- `config/profile.json` — candidate facts;
- `config/sources.json` — job sources.

Ці runtime-файли виключені з Git. Не комітьте `.env`, Google credentials або tokens.

## Архітектура

- `app/` — локальний React dashboard;
- `agent/server.ts` — HTTP API на `127.0.0.1:4317`;
- `agent/src/` — job collection, analysis, Gmail, SQLite, market reports;
- `config/` — candidate and source templates;
- `data/` — private local state.
