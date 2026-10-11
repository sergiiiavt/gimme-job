Agent виконує цикл рішень моделі та tool calls, доки не вирішить, що задачу завершено. Він може робити багато кроків, відновлюватися після помилок і змінювати речі в реальному світі. Тестувати agent означає перевіряти, **де він опинився**, **як туди дійшов** і **наскільки надійно** це робить.

Концепції дизайну agents (tools, state, approvals та MCP) — у розділі [AI agents & MCP](/learn/agentic).

## 1. Чому agents складніше тестувати

- **Довгі trajectories.** Дрібна помилка на кроці 2 накопичується через кроки 3–15.
- **Багато валідних шляхів.** Дві різні послідовності tools можуть обидві бути правильними.
- **Side effects.** Tools надсилають emails, пишуть файли, переказують гроші, змінюють записи.
- **Стан environment.** Результат залежить від стану баз даних, файлів і зовнішніх APIs.
- **Cost і latency.** Кожен run може містити десятки model calls.
- **Низька надійність накопичується.** Agent, що успішний у 80% задач, може підводити більшість користувачів, які працюють з ним щодня.

## 2. Outcome vs trajectory evaluation

| Підхід | Що перевіряєш | Сильна сторона | Слабка сторона |
|---|---|---|---|
| Outcome (final state) | Environment після run: рядки БД, файли, надіслані повідомлення, фінальна відповідь | Стійкий до багатьох валідних шляхів | Пропускає небезпечні чи марнотратні шляхи, що випадково закінчилися добре |
| Trajectory | Послідовність tool calls і arguments | Ловить небезпечні дії, цикли і марнотратство | Крихкий, якщо вимагати один точний шлях |

Використовуй обидва. Перевіряй **outcome** на коректність, а **trajectory** — на обмеження:

- заборонені tools ніколи не викликались;
- обов'язкові перевірки відбулися перед дією (наприклад перевірка особи перед refund);
- жоден крок не повторювався більше N разів;
- загальна кількість кроків, tokens і cost у межах budget.

## 3. Коректність tool calls

Для кожного tool call оцінюй:

- **selection:** правильний tool або коректна відсутність tool;
- **argument validity:** arguments відповідають schema;
- **argument correctness:** значення правильні (правильний order ID, дата і timezone);
- **necessity:** немає зайвих викликів;
- **error handling:** після помилки tool agent розумно повторює, пробує альтернативу або чесно повідомляє про збій;
- **faithful use of results:** agent не вигадує результати tools і не ігнорує незручні.

Single-step тести на вибір tool дешеві й оцінюються детерміновано. Збери їх багато, перш ніж запускати дорогі end-to-end сценарії.

## 4. Sandboxed, deterministic environments

Agent evals потребують environment, який ти контролюєш:

- **fake tools** на seeded in-memory даних;
- **reset** усього стану між runs;
- **записані відповіді** зовнішніх APIs;
- **годинник під контролем** для задач, залежних від дати;
- **жодних реальних side effects:** fake email outbox, тестова БД, жодних production credentials.

```python
def test_refund_requires_identity_check(agent, env):
    env.seed(orders=[{"id": "A-1042", "owner": "u1", "total": 49.0}])
    result = agent.run("Refund my order A-1042", user_id="u1")

    calls = [step.tool for step in result.trajectory]
    assert "verify_identity" in calls
    assert calls.index("verify_identity") < calls.index("issue_refund")
    assert env.refunds == [{"order_id": "A-1042", "amount": 49.0}]
    assert len(result.trajectory) <= 8
```

## 5. Multi-turn і simulated users

Реальні розмови мають багато turns. Щоб тестувати їх масштабно, використовуй **user simulator** — другу модель, що грає користувача з persona і метою.

```text
Persona: impatient customer, writes short messages, sometimes gives the wrong order ID first.
Goal: get a refund for order A-1042.
Stop when: the refund is confirmed, or after 10 turns.
```

Потім оцінюй усю розмову: чи досягнута мета, чи дотримані policies, чи доречний tone? Валідуй сам simulator: він має триматися ролі й не розв'язувати задачу замість agent.

## 6. Надійність: pass^k

Якість agent — це надійність, а не найкращий випадок. Запускай кожен сценарій k разів:

- **pass@k:** щонайменше один успіх. Корисно для дослідження, оманливо для користувачів.
- **pass^k:** усі k runs успішні. Показує, наскільки стабільно поводиться agent.

Стаття τ-bench показала, що сильні agents з хорошим single-run success rate мали значно нижчий pass^k на задачах customer service. Показуй обидва і ставь release thresholds на pass^k для критичних задач.

## 7. Failure modes agents

| Failure | Як виявити |
|---|---|
| Нескінченний цикл або повторні tool calls | Step limit, детектор повторних викликів у trajectory checks |
| Здається рано або хибно заявляє успіх | Порівняння заявленого результату з реальним станом environment |
| Вигадані результати tools | Порівняння тверджень agent з залогованими outputs tools |
| Неправильні значення arguments | Assertions на рівні arguments у записаних викликах |
| Ігнорує помилки tools | Inject tool failures і перевірка відповіді |
| Вибух cost | Budgets tokens і кроків на сценарій |
| Небезпечна або несхвалена дія | Assertions на заборонені tools; тести approval gates |
| Зайві уточнення | Кількість уточнювальних питань, коли інформація вже була |

## 8. Fault injection

Навмисно ламай tools:

- timeouts і 500 errors;
- порожні результати;
- malformed responses;
- частковий успіх (оновлено 2 з 3 елементів);
- повільні відповіді, що впираються в ліміти часу;
- **output tool з інструкціями** (indirect prompt injection, див. [Prompt injection і jailbreaks](/learn/llm?topic=prompt-injection)).

Agent має повторювати з лімітами, чесно повідомляти про збій і ніколи не заявляти успіх.

## 9. Тестування MCP servers

Коли agent використовує MCP servers, тестуй кожен server як API contract:

- назви tools, описи та input schemas точні й стабільні;
- невалідні inputs повертають зрозумілі помилки, а не crashes;
- authorization забезпечує server, а не довіра до моделі;
- деструктивні tools явно позначені й вимагають підтвердження в client;
- описи tools не містять інструкцій, що можуть перехопити модель.

## 10. Benchmarks, варті вивчення

- **τ-bench:** взаємодія tool-agent-user у доменах customer service з надійністю pass^k.
- **SWE-bench:** розв'язання реальних GitHub issues у Python repositories з перевіркою тестами.
- **GAIA:** задачі загального асистента, що потребують tools і багатокрокових міркувань.

Сам ти їх запускатимеш рідко. Вивчай їхній дизайн: як будують environments, визначають успіх і оцінюють надійність.

## 11. QA quick reference

- Перевіряй final state на коректність, а trajectory — на обмеження.
- Збери багато дешевих single-step тестів вибору tool перед end-to-end сценаріями.
- Seed і reset sandboxed environment; ніколи не чіпай production side effects.
- Використовуй simulated users для multi-turn coverage; валідуй simulator.
- Показуй pass^k, кроки, tokens і cost для кожного сценарію.
- Inject tool failures і перевіряй чесність звітування.

## 12. Practice

1. Додай до support bot два tools: `verify_identity` і `issue_refund` на seeded fake environment.
2. Напиши 30 single-step тестів вибору tool і оцінюй їх детерміновано.
3. Напиши 20 multi-turn сценаріїв з user simulator і personas.
4. Запусти кожен сценарій 5 разів і покажи success rate, pass^5, медіану кроків і cost.
5. Inject три типи tool failure і покажи поведінку agent у кожному.

**Exit check:** ти показуєш надійність agent за повторних runs, і кожен критичний сценарій перевіряє і final state, і safety-обмеження trajectory.

## Sources

- [Yao et al. — τ-bench: A Benchmark for Tool-Agent-User Interaction](https://arxiv.org/abs/2406.12045)
- [τ-bench on GitHub](https://github.com/sierra-research/tau-bench)
- [SWE-bench](https://www.swebench.com/)
- [Mialon et al. — GAIA: a benchmark for General AI Assistants](https://arxiv.org/abs/2311.12983)
- [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Model Context Protocol](https://modelcontextprotocol.io/)
