# Оцінювання агентів і викликів інструментів

**Агент** працює в циклі: читає завдання та попередні результати, пропонує дію, спостерігає наслідок і повторює. Інструменти дозволяють шукати замовлення, повертати кошти чи надсилати листи, а цикл поєднує ці кроки.

Те саме завдання можна виконати різними шляхами. Дії змінюють стан, ранні помилки накопичуються, а успіх між запусками різниться. Перевіряйте визначення й виклики інструментів, кінцевий стан, послідовність дій, відновлення після збоїв, надійність, безпеку та сервери MCP.

**Передумови:** [Анатомія LLM-застосунку та API](/learn/llm?topic=llm-application-anatomy), [Тестування коду LLM-застосунку без моделі](/learn/llm?topic=testing-without-the-model), [Статистика для оцінювання](/learn/llm?topic=eval-statistics).

## Як працюють виклики інструментів і агенти

```diagram
Application sends: task + conversation + tool definitions (name, description, JSON Schema of arguments)
        ↓
Model replies with a tool call: {"name": "lookup_order", "arguments": {"order_id": "A-1042"}}
        ↓
Application validates the call, checks permissions, executes the tool
        ↓
Application sends the tool result back to the model
        ↓
Model calls another tool, or writes the final answer          (repeat until done or out of budget)
```

Модель ніколи нічого не виконує сама. Вона пропонує виклики; application вирішує, чи їх виконувати. На цій межі живе більшість тестів: application валідує кожен виклик проти schema tool, застосовує права й бюджети, виконує tool і повертає результат, зокрема помилки, у формі, з якою модель може працювати.

**Model Context Protocol** (MCP) стандартизує бік tools у цьому циклі: server перелічує свої tools (`tools/list`, з JSON Schema для кожного) і виконує їх (`tools/call`), тож ті самі tools можуть використовувати різні клієнти й моделі.

## Типові збої

| Збій | Приклад | Як виявити |
|---|---|---|
| Не той tool | Шукає у FAQ замість пошуку замовлення | Очікуваний tool для кожного сценарію; перевірки траєкторії |
| Неправильні чи вигадані аргументи | `order_id: "1042"` або номер замовлення, якого користувач не давав | Validation schema; перевірки аргументів проти задачі |
| Проігнорована помилка tool | Заявляє про успіх після збою виклику refund | Fault injection; порівняння заяви з кінцевим станом |
| Вигаданий результат tool | Називає дату доставки, якої tool не повертав | Порівняння тверджень із записаними outputs tools |
| Цикли й марнування | Знову й знову викликає той самий пошук | Виявлення повторних викликів; бюджети кроків і вартості |
| Небезпечна дія | Робить refund, не перевіривши статус замовлення, або видаляє дані | Заборонені tools; обов'язкові передумови; approval gates |
| Здається або перепитує | Питає номер замовлення, який клієнт уже дав | Підрахунок уточнювальних питань; симульовані користувачі |
| Prompt injection через tools | Результат tool містить інструкції, яких agent слухається | Adversarial результати tools ([Безпека, імітація атак і захисні механізми](/learn/llm?topic=security-red-teaming)) |

## Перевірка визначень і викликів інструментів

Визначення tool — це контракт інтерфейсу для моделі. Його назва й опис вирішують, коли модель його використає, а schema — які виклики валідні. Валідуйте кожен виклик перед виконанням і формулюйте помилки validation так, щоб модель могла виправити виклик:

```python
import re

# Tool definitions as the model sees them: a name, a description and a JSON Schema for the arguments
TOOLS = {
    "lookup_order": {
        "description": "Look up an order by its number, for example A-1042.",
        "input_schema": {"type": "object", "required": ["order_id"], "additionalProperties": False,
                         "properties": {"order_id": {"type": "string", "pattern": r"^A-\d{4}$"}}},
    },
    "issue_refund": {
        "description": "Refund a delivered order to the original payment method.",
        "input_schema": {"type": "object", "required": ["order_id", "amount_eur", "reason"], "additionalProperties": False,
                         "properties": {"order_id": {"type": "string", "pattern": r"^A-\d{4}$"},
                                        "amount_eur": {"type": "number", "minimum": 0.01},
                                        "reason": {"type": "string", "enum": ["return", "damaged", "late"]}}},
    },
}
TYPES = {"string": str, "number": (int, float), "object": dict}


def validate_call(name: str, arguments: dict) -> list[str]:
    """Problems with a tool call, phrased so that the model can correct the call."""
    if name not in TOOLS:
        return [f"unknown tool {name!r}; available: {sorted(TOOLS)}"]
    schema = TOOLS[name]["input_schema"]
    problems = [f"missing argument {field!r}" for field in schema["required"] if field not in arguments]
    for field, value in arguments.items():
        spec = schema["properties"].get(field)
        if spec is None:
            problems.append(f"unexpected argument {field!r}")
        elif not isinstance(value, TYPES[spec["type"]]) or isinstance(value, bool):
            problems.append(f"{field} must be a {spec['type']}, got {type(value).__name__}")
        elif "enum" in spec and value not in spec["enum"]:
            problems.append(f"{field} must be one of {spec['enum']}, got {value!r}")
        elif "pattern" in spec and not re.fullmatch(spec["pattern"], value):
            problems.append(f"{field} {value!r} does not match the format {spec['pattern']}")
        elif "minimum" in spec and value < spec["minimum"]:
            problems.append(f"{field} must be at least {spec['minimum']}")
    return problems


calls = [
    ("lookup_order", {"order_id": "A-1042"}),
    ("lookup_order", {"order_id": "1042"}),
    ("issue_refund", {"order_id": "A-1042", "amount_eur": "89.90", "reason": "return"}),
    ("issue_refund", {"order_id": "A-1042", "amount_eur": 89.9, "reason": "changed my mind"}),
    ("issue_refund", {"order_id": "A-1042", "amount_eur": 89.9}),
    ("cancel_order", {"order_id": "A-1042"}),
]
for name, arguments in calls:
    problems = validate_call(name, arguments)
    print(f"{name}({arguments}) -> {'ok' if not problems else '; '.join(problems)}")
```

Результат:

```text
lookup_order({'order_id': 'A-1042'}) -> ok
lookup_order({'order_id': '1042'}) -> order_id '1042' does not match the format ^A-\d{4}$
issue_refund({'order_id': 'A-1042', 'amount_eur': '89.90', 'reason': 'return'}) -> amount_eur must be a number, got str
issue_refund({'order_id': 'A-1042', 'amount_eur': 89.9, 'reason': 'changed my mind'}) -> reason must be one of ['return', 'damaged', 'late'], got 'changed my mind'
issue_refund({'order_id': 'A-1042', 'amount_eur': 89.9}) -> missing argument 'reason'
cancel_order({'order_id': 'A-1042'}) -> unknown tool 'cancel_order'; available: ['issue_refund', 'lookup_order']
```

Що тестувати навколо tools:

- **Кожен executor tool відхиляє невалідні аргументи,** навіть коли provider обіцяє виклики, що відповідають schema: executor також викликають code, інші клієнти й тести.
- **Повідомлення про помилки дають змогу діяти.** «order_id '1042' does not match ^A-\d{4}$» дозволяє моделі повторити правильно; «invalid input» — ні. MCP робить те саме розрізнення: невідомий tool — помилка протоколу, а невалідний input і бізнес-помилки повертаються як результати tool з позначкою `isError`, щоб модель могла відновитися.
- **Вибір tool** тестують сценаріями: для кожного типу запиту — який tool має бути викликаний першим і який не має викликатися взагалі.
- **Описи — частина prompt.** Зміна опису tool змінює поведінку, тож визначення tools версіонують і оцінюють як prompts ([Промпти як артефакти, які можна тестувати](/learn/llm?topic=prompts-as-artifacts)).

## Оцінювання результату й траєкторії

Запуск agent можна оцінювати за тим, де він завершився, і за тим, як він туди дійшов:

| Підхід | Що перевіряють | Сильна сторона | Слабка сторона |
|---|---|---|---|
| Результат | Стан середовища після запуску: записи, refunds, надіслані повідомлення, фінальна відповідь | Приймає кожен валідний шлях | Пропускає ризиковані чи марнотратні шляхи, які випадково закінчилися добре |
| Траєкторія | Послідовність викликів tools і їхні аргументи | Ловить небезпечний порядок, цикли й марнування | Крихка, якщо вимагає одного точного шляху |

Використовуйте обидва і тримайте перевірки траєкторії на рівні **правил** (передумови, заборонені tools, бюджети, без повторів), а не одного еталонного шляху:

```python
import copy

# Task: "My boots from order A-1042 do not fit, I sent them back. Please refund me."
START = {
    "orders": {"A-1042": {"customer": "olena", "total": 89.9, "status": "returned"},
               "A-2210": {"customer": "taras", "total": 45.5, "status": "delivered"}},
    "refunds": [],
    "emails": [],
}
EXPECTED_REFUND = {"order_id": "A-1042", "amount_eur": 89.9}
FORBIDDEN_TOOLS = {"delete_order", "change_address"}
MAX_STEPS = 6


def run(trajectory):
    """Replay recorded tool calls against a copy of the environment and return the final state."""
    state = copy.deepcopy(START)
    for name, args in trajectory:
        if name == "issue_refund":
            state["refunds"].append({"order_id": args["order_id"], "amount_eur": args["amount_eur"]})
            state["orders"][args["order_id"]]["status"] = "refunded"
        elif name == "send_email":
            state["emails"].append(args["to"])
    return state


def outcome_problems(state):
    problems = []
    if state["refunds"] != [EXPECTED_REFUND]:
        problems.append(f"refunds should be exactly {[EXPECTED_REFUND]}, got {state['refunds']}")
    if state["emails"] != ["olena"]:
        problems.append(f"one confirmation to olena expected, got {state['emails']}")
    if state["orders"]["A-2210"] != START["orders"]["A-2210"]:
        problems.append("an unrelated order was changed")
    return problems


def trajectory_problems(trajectory):
    names = [name for name, _ in trajectory]
    problems = [f"forbidden tool {name}" for name in names if name in FORBIDDEN_TOOLS]
    if "issue_refund" in names and "lookup_order" not in names[:names.index("issue_refund")]:
        problems.append("refund issued before the order status was checked")
    repeated = {(name, str(args)) for i, (name, args) in enumerate(trajectory) if (name, args) in trajectory[:i]}
    problems += [f"repeated call {name}" for name, _ in sorted(repeated)]
    if len(trajectory) > MAX_STEPS:
        problems.append(f"{len(trajectory)} steps, budget {MAX_STEPS}")
    return problems


good = [("lookup_order", {"order_id": "A-1042"}),
        ("issue_refund", {"order_id": "A-1042", "amount_eur": 89.9}),
        ("send_email", {"to": "olena"})]
lucky = [("issue_refund", {"order_id": "A-1042", "amount_eur": 89.9}),
         ("lookup_order", {"order_id": "A-1042"}),
         ("lookup_order", {"order_id": "A-1042"}),
         ("send_email", {"to": "olena"})]
wrong = [("lookup_order", {"order_id": "A-1042"}),
         ("lookup_order", {"order_id": "A-2210"}),
         ("issue_refund", {"order_id": "A-2210", "amount_eur": 45.5}),
         ("send_email", {"to": "olena"})]

for label, trajectory in [("good", good), ("lucky", lucky), ("wrong", wrong)]:
    state = run(trajectory)
    print(f"{label}: outcome {outcome_problems(state) or 'ok'}")
    print(f"{' ' * len(label)}  trajectory {trajectory_problems(trajectory) or 'ok'}")
```

Результат:

```text
good: outcome ok
      trajectory ok
lucky: outcome ok
       trajectory ['refund issued before the order status was checked', 'repeated call lookup_order']
wrong: outcome ["refunds should be exactly [{'order_id': 'A-1042', 'amount_eur': 89.9}], got [{'order_id': 'A-2210', 'amount_eur': 45.5}]", 'an unrelated order was changed']
       trajectory ok
```

Щасливий запуск закінчується в правильному стані, але оформив refund, не перевіривши, що черевики повернулися; та сама звичка завтра поверне гроші за неповернені замовлення. Неправильний запуск дотримується кожного правила й повертає гроші не тому клієнту. Перевірки результату ловлять другий випадок, правила траєкторії — перший, і жодна з них окремо не достатня.

## Внесення збоїв і коректна відмова

Справжні tools перевищують таймаути, повертають помилки й несподівані дані. Agent має відновлюватися, де може, і визнавати збій, де не може. Tool, який у тестах завжди працює, ніколи не перевіряє цю поведінку, тож впроваджуйте збої навмисно:

```python
def refund_tool(failures: int):
    """A refund tool that fails with a timeout the first `failures` times it is called."""
    calls = {"count": 0, "refunds": []}

    def call(order_id: str, amount_eur: float) -> dict:
        calls["count"] += 1
        if calls["count"] <= failures:
            return {"isError": True, "text": "payment service timeout"}
        calls["refunds"].append((order_id, amount_eur))
        return {"isError": False, "text": f"refund {order_id} {amount_eur} EUR created"}

    return call, calls


def careful_agent(tool) -> str:
    """Retries a failed call twice, then hands over instead of claiming success."""
    for _ in range(3):
        if not tool("A-1042", 89.9)["isError"]:
            return "Your refund of 89.90 EUR is on its way."
    return "I could not issue the refund right now; a colleague will contact you today."


def careless_agent(tool) -> str:
    tool("A-1042", 89.9)  # the result is ignored
    return "Your refund of 89.90 EUR is on its way."


def claims_refund(message: str) -> bool:
    return "refund of" in message and "could not" not in message


for agent in [careful_agent, careless_agent]:
    for failures in [0, 1, 3]:
        tool, record = refund_tool(failures)
        message = agent(tool)
        refunded = len(record["refunds"]) == 1
        verdict = "consistent" if claims_refund(message) == refunded else "FALSE CLAIM"
        print(f"{agent.__name__:<15} failures={failures}  calls={record['count']}  refunded={refunded!s:<5}  {verdict}")
```

Результат:

```text
careful_agent   failures=0  calls=1  refunded=True   consistent
careful_agent   failures=1  calls=2  refunded=True   consistent
careful_agent   failures=3  calls=3  refunded=False  consistent
careless_agent  failures=0  calls=1  refunded=True   consistent
careless_agent  failures=1  calls=1  refunded=False  FALSE CLAIM
careless_agent  failures=3  calls=1  refunded=False  FALSE CLAIM
```

Без fault injection обидва agents проходять кожен тест. З ним необачний agent каже клієнту, що гроші вже в дорозі, хоча нічого не сталося. Збої, які варто впроваджувати: таймаути й rate limits, результати з помилкою, порожні й часткові результати, зіпсовані результати, повільні відповіді, що вичерпують бюджет кроків, і результати, що суперечать словам користувача (замовлення так і не доставили).

## Детерміноване тестове середовище

Agents діють на стан, тож тестам потрібне середовище, яке дешево скинути й безпечно змінювати:

- **Fake tools зі справжнім станом:** таблиця замовлень у пам'яті, журнал refunds і вихідна пошта замість production систем. Кожен тест починається з відомого знімка.
- **Записані чи заскриптовані рішення моделі** для тестів самого циклу ([Тестування коду LLM-застосунку без моделі](/learn/llm?topic=testing-without-the-model)), а справжня модель — лише в evaluation runs.
- **Бюджети, які застосовує цикл:** максимум кроків, tokens і вартості на задачу; перевищення завершує запуск із чітким статусом.
- **Повний trace кожного запуску:** inputs і outputs моделі, виклики tools, аргументи, результати й час, щоб кожен збій можна було відтворити.
- **Sandboxes для agents, що виконують code чи переглядають web:** контейнери без мережі або з allow-list і з обмеженням ресурсів ([Програмні оцінювачі та метрики](/learn/llm?topic=code-based-scorers) розглядає виконання згенерованого code).

## Симульовані користувачі й багатокрокові задачі

Багато задач agents — це розмови: клієнт дає інформацію частинами, змінює думку чи просить те, чого agent не може зробити. τ-bench зробив це вимірюваним: мовна модель грає користувача за письмовою персоною й метою, agent працює з tools над базою даних, а успіх визначають, порівнюючи кінцевий стан бази з очікуваним. Той самий підхід працює і для вашого продукту: напишіть сценарії користувачів із цілями та інформацією, яку знає кожен користувач, дайте симульованому користувачу вести розмову й перевірте кінцевий стан і правила розмови (без повторних питань, підтвердження перед незворотними діями).

Симульовані користувачі самі є моделями, тож перевіряйте вибірку симульованих розмов читанням і тримайте набір заскриптованих розмов для regression tests, які не мають варіювати.

## Надійність повторних запусків

Та сама задача може вдатися в одному запуску й провалитися в наступному. Для agents важливе число зазвичай **pass^k** — ймовірність, що всі k спроб задачі вдадуться, бо клієнт, який користується agent щодня, відчуває кожен запуск ([Статистика для оцінювання](/learn/llm?topic=eval-statistics)). Запускайте кожен сценарій кілька разів, показуйте pass^k поруч із середнім рівнем успіху і вважайте сценарії, що іноді провалюються, дефектами для розслідування, а не нестабільними тестами для повтору.

## Права та погодження дій

- **Мінімальні привілеї:** давайте agent лише ті tools, що потрібні задачі, і обмежуйте кожен tool поточним користувачем (tool refund може повертати гроші лише за замовлення автентифікованого клієнта).
- **Approval gates для незворотних чи дорогих дій:** refund понад ліміт, видалення, зовнішнє повідомлення. Перевірте, що gate не можна обійти аргументами, повторами чи іншими tools.
- **Вважайте результати tools недовіреним input.** Відгук про товар, лист чи web-сторінка, повернені tool, можуть містити інструкції; agent не повинен їх виконувати ([Безпека, імітація атак і захисні механізми](/learn/llm?topic=security-red-teaming)).
- **Логуйте кожну дію** з користувачем, аргументами й причиною, щоб інцидент можна було відтворити.

## Тестування MCP-серверів

MCP server — це API, клієнтом якого є модель, і його тестують як API і як tool водночас:

- **Контракт протоколу:** `initialize`, `tools/list` і `tools/call` поводяться так, як каже специфікація; невідомий tool повертає помилку JSON-RPC; невалідний input повертає результат з `isError: true` і повідомленням, що пояснює проблему.
- **Schemas:** кожен tool має точну schema input, а для структурованих результатів — і schema output; результати їм відповідають.
- **Поведінка:** кожен tool робить те, що каже його опис, включно з граничними випадками, і безпечно провалюється.
- **Безпека:** inputs валідуються, доступ перевіряється для кожного користувача, виклики обмежуються за частотою, а outputs, що потраплять до моделі, очищаються. Специфікація також просить клієнтів підтверджувати чутливі операції з користувачем.
- **Інтерактивні перевірки** в MCP Inspector і автоматизовані контрактні тести, що викликають server у пам'яті чи через його транспорт.

## Порівняльні тести

Публічні benchmarks agents показують, як evaluation agents будують на практиці і де моделі досі помиляються:

| Benchmark | Задачі | Чим вимірюють успіх |
|---|---|---|
| τ-bench | Розмови служби підтримки з tools і симульованим користувачем | Кінцевий стан бази даних, pass^k у повторних спробах |
| SWE-bench | Розв'язання реальних GitHub issues у Python репозиторіях | Тести репозиторію проходять після зміни |
| WebArena | Задачі на реалістичних self-hosted сайтах | Функціональні перевірки кінцевого стану |
| GAIA | Питання, що потребують web, tools і міркувань | Точні відповіді |
| AgentBench | Вісім середовищ, від операційних систем до ігор | Успіх за правилами кожного середовища |
| Berkeley Function Calling Leaderboard | Одиночні й множинні виклики функцій | Правильна функція й аргументи |

Benchmarks ранжують моделі; вони не тестують вашого agent. Використовуйте їх, щоб вивчити дизайн evaluation і вибрати моделі-кандидати, а потім оцінюйте на сценаріях із власного продукту.

## Приклад проєкту

Методи цього chapter реалізовані й покриті тестами в [examples/llm-testing/13-agent-testing](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/13-agent-testing): середовище support agent із замовленнями, refunds і вихідною поштою, визначення tools з validation аргументів, цикл agent з бюджетами кроків і approval gate, заскриптовані policies з помилками, які можна впровадити, перевірки результату й траєкторії, fault injection з виявленням хибних заяв, pass^k на seeded запусках і MCP-подібний server у пам'яті з контрактними тестами протоколу. Усі тести працюють offline, без моделі та API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/13-agent-testing
```

## Типові помилки

- **Виконувати виклики tools без validation,** бо provider застосовує schemas.
- **Повідомлення про помилки, з якими модель не може працювати,** або помилки, що обривають запуск замість того, щоб повідомити модель.
- **Лише перевірки результату,** що приймають ризиковані шляхи, які випадково закінчилися добре, або лише одна еталонна траєкторія, що відкидає валідні альтернативи.
- **Тести з tools, які ніколи не ламаються.**
- **Довіра фінальному повідомленню agent** замість стану середовища.
- **Один запуск на сценарій** для системи, якою користувачі користуються щодня.
- **Approval gates, які можна обійти іншими tools чи повторами,** і результати tools, які вважають довіреними інструкціями.
- **MCP servers, протестовані лише вручну в inspector.**

## Підсумок

- Модель пропонує дію, а застосунок перевіряє, авторизує й виконує її.
- Перевіряйте аргументи за схемою, вибір інструмента — сценаріями, а описи версіонуйте як промпти.
- Оцінюйте кінцевий стан і шлях: порядок, заборонені дії, повтори й бюджети.
- Вносьте збої та порівнюйте заявлений успіх зі справжнім станом.
- Використовуйте кероване середовище, імітації інструментів, бюджети й повні трасування.
- Вимірюйте pass^k, застосовуйте мінімальні привілеї й підтвердження важливих дій. Результати інструментів є недовіреними даними.
- Перевіряйте протокол MCP, схеми, поведінку й безпеку інструментів.
