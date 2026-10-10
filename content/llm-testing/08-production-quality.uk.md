Evals на ноутбуці ловлять проблеми один раз. Якість у production потребує evals, що запускаються автоматично: **gates перед merge** і **monitors після deploy**. Цей chapter з'єднує LLM evaluation з CI/CD, observability, performance і cost.

## 1. Два цикли

```text
offline loop (до релізу)                      online loop (після релізу)
  dataset -> run app -> score -> gate           traffic -> trace -> sample -> score -> alert
       ^                                                                     |
       +----------- нові failure cases з production -------------------------+
```

Offline loop запобігає відомим regressions. Online loop знаходить невідомі проблеми й повертає їх в offline dataset. Зріла команда запускає обидва.

## 2. Evals у CI/CD

Проєктуй pipeline з огляду на cost і швидкість:

| Етап | Trigger | Обсяг | Типовий gate |
|---|---|---|---|
| Unit tests (fake model) | Кожен push | Увесь deterministic code | 100% pass |
| Smoke evals | Кожен pull request, що чіпає prompts, моделі чи LLM code | 20–50 критичних cases, deterministic checks плюс кілька judges | Жоден критичний case не падає; ключові rates у межах tolerance |
| Full evals | Щоночі та перед релізом | Повний golden dataset з повторними runs | Thresholds для кожної metric і сегмента порівняно з baseline |
| Red-team suite | Щотижня та перед релізом | Security dataset і автоматизовані scanners | Немає нових high-severity findings |

Практичні правила:

- **Порівнюй з baseline**, а не лише з фіксованим абсолютним числом. Зберігай результати baseline як artifact.
- **Використовуй tolerances.** Scores шумні, тож fail-и на падіння, більші за виміряну варіацію між runs.
- **Кешуй** відповіді моделі за input, версією prompt і версією моделі, щоб повторні runs були дешевими.
- **Публікуй scorecard** у pull request з посиланнями на flipped cases.
- **Ніколи не дозволяй CI викликати production tools** з реальними side effects.

Загальний дизайн deployment gates — у [Cloud & DevOps — deployment gates](/learn/cloud-devops?topic=deployment-gates).

## 3. Tracing і observability

**Trace** записує один запит як дерево **spans**: model call, retrieval, кожен tool call і post-processing. Для кожного LLM span записуй:

- назву та версію моделі, parameters і версію prompt;
- input і output (з PII redaction, де потрібно);
- кількість tokens, latency, time to first token і cost;
- IDs і scores retrieved documents;
- назви tools, arguments і результати;
- помилки та retries.

**OpenTelemetry** визначає semantic conventions для generative AI spans, тож traces переносяться між vendors. Tools на кшталт **Langfuse**, **LangSmith** і **Arize Phoenix** зберігають traces і прикріплюють до них scores.

## 4. Online evaluation

Production traffic показує inputs, яких твій dataset не уявляв. Online evaluation:

1. **семплює** traces (наприклад 5% traffic плюс 100% traces з помилками чи негативним feedback);
2. асинхронно запускає **deterministic checks** і валідовані **judges** — ніколи не на шляху запиту користувача;
3. **агрегує** scores за часом, feature, сегментом, моделлю і версією prompt;
4. **алертить**, коли rate дрейфує за threshold;
5. надсилає провальні traces у **review queue** для людей.

Поважай privacy: отримуй згоду, де потрібно, видаляй персональні дані перед збереженням traces чи передачею third-party judge, став ліміти retention.

## 5. Feedback користувачів

- **Explicit:** thumbs up/down, оцінки, «повідомити про проблему».
- **Implicit:** кліки regenerate, копіювання, покидання, escalation до людини, уточнення, що повторюють початкове питання.

Feedback упереджений: незадоволені користувачі клікають частіше, а багато хто не клікає взагалі. Використовуй його, щоб знаходити cases для огляду, а не як самостійну metric якості.

**Найважливіша звичка:** кожен підтверджений production failure стає новим case у golden dataset з тегом на incident.

## 6. Performance testing

Latency LLM має власні metrics:

| Metric | Значення |
|---|---|
| TTFT (time to first token) | Скільки часу до початку streaming output; визначає відчуття швидкості |
| Tokens per second | Швидкість генерації output |
| End-to-end latency | З retrieval, tools і post-processing |
| p50 / p95 / p99 | Перцентилі; tail latency важливіша за середнє |
| Error і throttle rate | 429, timeouts, provider 5xx під навантаженням |

Нотатки для load testing:

- використовуй реалістичні довжини input і output — latency масштабується з tokens;
- поважай rate limits і budgets provider; тестуй зі staging key з відомими квотами;
- тестуй streaming clients, ліміти з'єднань і timeouts;
- вимірюй поведінку під throttling: queueing, backoff і коректні помилки.

**k6** і **Locust** працюють для LLM endpoints. Основи load testing — у [Performance & reliability](/learn/performance).

## 7. Cost testing

Cost — атрибут якості. Відстежуй:

- input і output tokens на запит для кожної feature;
- cache hit rate для prompt caching і response caching;
- cost на успішну задачу, а не лише на запит;
- cost regressions: зміна prompt, що додає 500 tokens до кожного виклику, — реальна regression.

Додай cost assertions в eval runs: «медіана tokens на запит не зростає більш ніж на 15% порівняно з baseline».

## 8. Тестування міграції моделі

Зміна моделі (нова версія, дешевша модель чи інший provider) — високоризикова зміна:

1. прожени повний offline suite на кандидаті з повторними runs;
2. порівняй по сегментах і прочитай flipped cases;
3. перевалідуй judges, якщо змінюється judge model;
4. перевір відповідність формату, поведінку refusals, latency, cost і якість мов;
5. розкатуй поступово (shadow traffic, потім canary на відсоток) з увімкненою online evaluation;
6. тримай швидкий rollback path.

Фіксуй версії моделей у production. Рухомий alias може змінити поведінку без жодної зміни в твоєму code.

## 9. A/B testing і експерименти

Для змін prompt чи моделі, які offline evals не можуть вирішити, запускай online експеримент:

- визнач primary metric (task success, розв'язання без escalation) і **guardrail metrics** (safety violations, latency, cost) до старту;
- рандомізуй за користувачем, а не за запитом, щоб уникнути неконсистентного досвіду;
- запускай достатньо довго для запланованого sample size;
- зупиняй достроково лише через порушення guardrail.

## 10. Case study: Learning Path Advisor GimmeJob у production

Advisor у цьому repository демонструє кілька з цих практик:

- Langfuse callbacks фіксують виконання LangGraph і моделі; root trace записує стратегію retrieval, embedding model, retrieved IDs і scores;
- deterministic runtime quality scores (`retrieval_top_score`, `grounded_node_ratio`, `source_validity`, `map_connected`) прикріплюються до кожного trace, тож їх можна моніторити в часі без judge model;
- token usage з інтеграції моделі дозволяє Langfuse рахувати cost кожної generation і загальний;
- endpoint `/health` показує готовність моделі, retrieval і tracing без розкриття секретів;
- production deploy автоматично оновлює RAG index після deploy Worker, тож новий learning content потрапляє в retrieval без ручного кроку.

## 11. QA quick reference

- Smoke evals на кожен релевантний pull request, full evals щоночі.
- Gate на зміну порівняно з baseline з tolerances на основі виміряного шуму.
- Trace кожен span моделі, retrieval і tool з версіями, tokens і cost.
- Асинхронно оцінюй семпли production traffic; алерти на drift.
- Перетворюй кожен production failure на case у dataset.
- Вимірюй TTFT, p95 latency, throttling і cost на успішну задачу.
- Стався до змін моделі як до міграцій: повний suite, canary, rollback.

## 12. Practice

1. Додай GitHub Actions job, що запускає smoke eval suite на pull requests і падає на regression порівняно зі збереженим baseline.
2. Інструментуй bot tracing-ом (Langfuse або Phoenix) з tokens, cost і retrieved IDs.
3. Додай один online judge на 10% вибірки і dashboard його pass rate у часі.
4. Зроби load test bot через k6 або Locust на трьох рівнях concurrency; покажи TTFT і p95.
5. Мігруй bot на іншу модель за процесом з розділу 8 і напиши одну сторінку migration report.

**Exit check:** погана зміна prompt блокується до merge, а падіння якості в production запускає alert з посиланнями на traces.

## Sources

- [OpenTelemetry — semantic conventions for generative AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Langfuse documentation](https://langfuse.com/docs)
- [Arize Phoenix](https://phoenix.arize.com/)
- [promptfoo — CI/CD integration](https://www.promptfoo.dev/docs/integrations/ci-cd/)
- [Grafana k6 documentation](https://grafana.com/docs/k6/latest/)
- [Locust](https://locust.io/)
