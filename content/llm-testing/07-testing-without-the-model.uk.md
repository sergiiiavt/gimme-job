# Тестування коду LLM-застосунку без моделі

Більшість коду LLM-застосунку можна перевіряти без моделі: формування промптів, збирання контексту, скорочення історії, розбір відповідей, авторизацію, інструменти, повтори, потоки й облік витрат. Їхні звичайні дефекти важче діагностувати через повільну й випадкову генерацію реальної моделі.

Розділ пояснює тестові двійники, передавання залежностей ззовні, інваріанти контексту, знімки промптів, запис і відтворення HTTP та контрактні фікстури. Розділяйте швидкі тести без мережі, перевірки реального API й оцінювання якості.

**Передумови:** [Анатомія LLM-застосунку та API](/learn/llm?topic=llm-application-anatomy), [Структуровані відповіді та їх перевірка](/learn/llm?topic=structured-output-validation) та базовий pytest.

## Що тестувати без моделі

| Компонент | Поведінка, яку перевіряти | Потрібний test double |
|---|---|---|
| Рендеринг prompts | Кожен template рендериться з реалістичними і ворожими значеннями; структура цілісна | Немає |
| Збирання context | System prompt зберігається, budget дотримано, найновіші turns у правильному порядку, дані правильного користувача | Немає або fake tokenizer |
| Parsing і validation output | Кожна записана форма output правильно приймається чи відхиляється | Записані outputs |
| Обробка stop reasons | Кожен stop reason веде до специфікованої дії | Stub responses |
| Маршрутизація tools і authorization | Невідомі tools, невалідні arguments і дані інших користувачів відхиляються | Scripted tool calls |
| Retries і timeouts | Повторюються лише retryable помилки, у межах лімітів спроб і часу | Failing client, fake clock |
| Streaming | Перервані streams ніколи не показуються як повні | Записані streams |
| Підключення guardrails | Заблоковані inputs не доходять до моделі; заблоковані outputs — до користувача | Stub classifier |
| Logging і tracing | Кожен виклик записує модель, версію prompt, usage та ідентифікатори context | Spy |
| Fallbacks | Збій основної моделі перемикає на fallback шлях | Failing client |

Жоден із цих тестів не каже, чи хороші відповіді моделі. Це робота evaluation ([Методологія оцінювання та набори даних](/learn/llm?topic=evaluation-fundamentals)). Два види тестування доповнюють одне одного: offline тести роблять систему надійною, evaluations — корисною.

## Тестові двійники для клієнтів моделі

**Test double** замінює реальну залежність у тесті. Класичний словник розрізняє кілька видів, і кожен має чітке застосування для model clients:

| Double | Що робить | Типове застосування з model client |
|---|---|---|
| Dummy | Заповнює parameter, який тестований шлях не використовує | Client, переданий у code, що взагалі не має його викликати |
| Stub | Повертає заготовлені відповіді | Перевірка parsing і post-processing відомої відповіді |
| Spy | Записує, як його викликали, часто обгортаючи інший double | Перевірка того, що надіслано: messages, parameters, tools, версія prompt |
| Mock | Програмується очікуваннями й падає, якщо вони не виконані | Перевірка, що виклик стався рівно раз або ніколи |
| Fake | Робоча спрощена реалізація | Відповіді за правилами для багатьох inputs; in-memory база замовлень для tools |
| Fault injector | Кидає помилки чи повертає невалідні дані | Timeouts, rate limits, обрізані й невалідні відповіді |

Передумова — **seam**: тестований code має отримувати client, а не створювати його. Функція нижче приймає `client` як parameter, тож можна підставити будь-який double.

```python
from dataclasses import dataclass, field


@dataclass
class Reply:
    text: str
    stop_reason: str = "end"


class StubClient:
    """Stub: always returns the same canned reply."""
    def __init__(self, text: str):
        self.reply = Reply(text)

    def complete(self, messages: list[dict]) -> Reply:
        return self.reply


@dataclass
class SpyClient:
    """Spy: wraps another client and records every call it receives."""
    inner: object = None
    calls: list = field(default_factory=list)

    def complete(self, messages: list[dict]) -> Reply:
        self.calls.append(messages)
        return self.inner.complete(messages)


class FailingClient:
    """Fault injector: raises the given error on every call."""
    def __init__(self, error: Exception):
        self.error = error

    def complete(self, messages: list[dict]) -> Reply:
        raise self.error


class RuleBasedFake:
    """Fake: a working, simplified implementation with predictable behaviour."""
    def complete(self, messages: list[dict]) -> Reply:
        question = messages[-1]["content"].lower()
        if "return" in question:
            return Reply("Unworn shoes can be returned within 30 days of delivery.")
        return Reply("I cannot confirm that. Shall I connect you with a colleague?")


# The code under test receives its client: dependency injection is the testing seam.
def answer_question(question: str, client, policy: str) -> str:
    messages = [
        {"role": "system", "content": f"Answer only from this policy:\n{policy}"},
        {"role": "user", "content": question},
    ]
    try:
        reply = client.complete(messages)
    except TimeoutError:
        return "Sorry, the assistant is not available right now. Please try again."
    if reply.stop_reason != "end":
        return "Sorry, I could not finish the answer. Please try again."
    return reply.text.strip()


policy = "Unworn shoes: 30 days from delivery."

# 1. Stub: the parsing and post-processing path
assert answer_question("Can I return shoes?", StubClient("  Yes, within 30 days.  "), policy) == "Yes, within 30 days."

# 2. Spy: what exactly was sent to the model
spy = SpyClient(RuleBasedFake())
answer_question("Can I return shoes?", spy, policy)
sent = spy.calls[0]
assert sent[0]["role"] == "system" and policy in sent[0]["content"]
assert sent[-1] == {"role": "user", "content": "Can I return shoes?"}

# 3. Fault injection: the timeout path
assert "not available" in answer_question("Hi", FailingClient(TimeoutError()), policy)

# 4. Fake: behaviour across several inputs without a model
fake = RuleBasedFake()
assert "30 days" in answer_question("Can I return worn shoes?", fake, policy)
assert "colleague" in answer_question("Do you ship to Mars?", fake, policy)
print("stub, spy, fault injection and fake: all checks passed")
```

Результат:

```text
stub, spy, fault injection and fake: all checks passed
```

### Як створити seam

Якщо code створює client усередині, тести мусять його патчити. Краще перенести створення на межу application:

```python
# Hard to test: the client is created inside the function.
def answer_question(question: str) -> str:
    client = OpenAI()                       # every test needs patching and network
    ...

# Testable: the client is a parameter with a production default created at startup.
class SupportAssistant:
    def __init__(self, client: ModelClient, retriever: Retriever, clock: Clock):
        self.client, self.retriever, self.clock = client, retriever, clock
```

Коли змінити code поки неможливо, fixture `monkeypatch` у pytest може замінити атрибут модуля для одного тесту. Вважайте це тимчасовим заходом: тести, що патчать внутрішні деталі, ламаються при кожному рефакторингу.

```python
def test_answer_uses_the_fallback_message_on_timeout(monkeypatch):
    monkeypatch.setattr(support, "create_client", lambda: FailingClient(TimeoutError()))
    assert "not available" in support.answer_question("Hi")
```

### Mocks: для взаємодій, а не для відповідей

Mock, що перевіряє точний текст prompt, прив'язує тест до деталі реалізації; кожна нешкідлива правка prompt його ламає. Використовуйте mocks і spies для **важливих взаємодій**: модель не викликається, коли input guardrail блокує запит; tool викликається з ID автентифікованого користувача; fallback модель викликається після збою основної. Точний текст prompt перевіряйте snapshot tests, де зміни рецензуються свідомо (див. нижче).

## Перевірка збирання контексту

Збирання context вирішує, що бачить модель: system prompt, історію розмови, retrieved документи, профіль користувача, визначення tools — у межах token budget. Його дефекти тихі: відкинутий system prompt чи дані іншого користувача в context не кидають exception, вони змінюють поведінку.

Тестуйте його **інваріантами**, що мають виконуватися для будь-якої розмови, і перевіряйте їх на багатьох згенерованих розмовах:

```python
import random


def count_tokens(text: str) -> int:
    """Deterministic stand-in for the real tokenizer (about four characters per token)."""
    return max(1, len(text) // 4)


def build_messages(system: str, history: list[dict], question: str, budget: int) -> list[dict]:
    """Keep the system prompt and the new question; add history from newest to oldest while it fits."""
    fixed = [{"role": "system", "content": system}, {"role": "user", "content": question}]
    used = sum(count_tokens(m["content"]) for m in fixed)
    if used > budget:
        raise ValueError("system prompt and question alone exceed the budget")
    kept = []
    for message in reversed(history):
        cost = count_tokens(message["content"])
        if used + cost > budget:
            break
        kept.append(message)
        used += cost
    return [fixed[0], *reversed(kept), fixed[1]]


def check_invariants(messages: list[dict], system: str, history: list[dict], question: str, budget: int) -> None:
    assert messages[0] == {"role": "system", "content": system}, "system prompt must survive"
    assert messages[-1] == {"role": "user", "content": question}, "new question must be last"
    assert sum(count_tokens(m["content"]) for m in messages) <= budget, "budget must hold"
    middle = messages[1:-1]
    assert middle == history[len(history) - len(middle):], "only the newest turns, in original order"


# Example-based test
history = [{"role": "user", "content": "Hi " * 30}, {"role": "assistant", "content": "Hello! " * 30},
           {"role": "user", "content": "Order A-1042?"}, {"role": "assistant", "content": "It ships today."}]
messages = build_messages("Answer from the policy.", history, "And returns?", budget=40)
print([m["content"][:16] for m in messages])
check_invariants(messages, "Answer from the policy.", history, "And returns?", 40)

# Randomized test: many conversations, the same invariants
rng = random.Random(4)
for _ in range(500):
    turns = [{"role": rng.choice(["user", "assistant"]), "content": "w" * rng.randint(1, 400)}
             for _ in range(rng.randint(0, 30))]
    budget = rng.randint(20, 600)
    question = "q" * rng.randint(1, 60)
    try:
        check_invariants(build_messages("system rules", turns, question, budget), "system rules", turns, question, budget)
    except ValueError:
        assert count_tokens("system rules") + count_tokens(question) > budget
print("500 random conversations: invariants hold")
```

Результат:

```text
['Answer from the ', 'Order A-1042?', 'It ships today.', 'And returns?']
500 random conversations: invariants hold
```

Інші інваріанти, які варто перевіряти в реальних системах: retrieved документи належать tenant, що робить запит; персональні дані прибрано до того, як вони потраплять у context; визначення tools відповідають правам користувача; context ніколи не перевищує window моделі мінус зарезервований budget output. Для production code використовуйте в цих тестах справжній tokenizer provider; неправильна оцінка tokens — сама по собі поширений дефект.

## Тести зі знімками промптів

**Snapshot** (golden-file) тест рендерить prompt для фіксованих inputs і порівнює з закоміченим файлом. Будь-яка зміна відрендереного тексту валить тест, доки хтось не перегляне різницю й не оновить snapshot. Це ловить ненавмисні зміни: рефакторинг, що втратив правило, змінну template, що рендериться порожньою, випадково продубльований приклад.

```python
# pip install syrupy
def test_support_prompt_snapshot(snapshot):
    rendered = render_system(policy_chunks=["Returns: 30 days from delivery."], few_shot_examples=["Q: ... A: ..."])
    assert rendered == snapshot          # pytest --snapshot-update rewrites the file after review
```

Snapshots мають один відомий failure mode: люди оновлюють їх, не читаючи diff. Тримайте їх малими (один snapshot на template з короткими фіксованими inputs), рецензуйте diffs snapshots як prompt diffs ([Промпти як артефакти, які можна тестувати](/learn/llm?topic=prompts-as-artifacts)) і ніколи не використовуйте snapshots для output моделі, який варіюється за задумом.

## Запис і відтворення

Деякі тести потребують реального HTTP трафіку: інтеграції вашого client wrapper із SDK provider, headers запитів, тіл помилок, форматів streaming. **Record and replay** один раз записує реальні взаємодії й надалі їх відтворює. З vcrpy (або plugin pytest-recording на його основі) тест уперше працює з реальним API і зберігає обмін у файлі cassette; наступні запуски відтворюють cassette без мережі.

```python
# pip install vcrpy
import vcr

replay = vcr.VCR(
    cassette_library_dir="tests/cassettes",
    record_mode="none",                       # CI: never touch the network; fail if a cassette is missing
    filter_headers=["authorization", "x-api-key", "openai-organization"],
    match_on=["method", "scheme", "host", "path", "body"],
)


@replay.use_cassette("refund_question.yaml")
def test_client_wrapper_parses_a_real_response():
    response = assistant.client.complete([{"role": "user", "content": "Can I return worn shoes?"}])
    assert response.stop_reason == "end"
    assert response.input_tokens > 0
```

Правила, що роблять cassettes безпечними й корисними:

- **Фільтруйте секрети** (API keys, organization IDs, cookies) до першого запису і скануйте cassettes у CI на все, що схоже на key.
- **Записуйте свідомо.** Використовуйте режим, що записує лише на явний запит (`once` локально, `none` у CI), щоб тест ніколи мовчки не викликав платний API.
- **Звіряйте тіло запиту.** Інакше змінений prompt відтворить стару відповідь, і тест пройде з неправильної причини.
- **Перезаписуйте свідомо,** наприклад при оновленні SDK, і рецензуйте diff cassette.
- **Не перевіряйте згенерований текст** у відтворених тестах понад те, що обробляє parsing code. Відтворену відповідь модель створила один раз; це fixture, а не вимірювання якості.

## Контрактні фікстури відповідей постачальників

Записані cassettes показують поширені відповіді. Рідкісні форми — tool calls, refusals, truncation, content filters, кілька tool calls, порожній контент — можуть ніколи не з'явитися у ваших записах, але parsing code мусить їх обробляти. **Contract fixtures** — це тіла відповідей у формі, задокументованій provider, збережені як JSON файли й використані для тестування коду нормалізації. Коли змінюється версія SDK чи API, порівнюйте нові реальні відповіді з fixtures.

```python
import json

# Contract fixtures: response bodies in the shape the providers document, saved as JSON files.
# They let the parsing code be tested against every shape it must handle, including rare ones.
OPENAI_TOOL_CALL = """{
  "choices": [{"finish_reason": "tool_calls", "message": {"role": "assistant", "content": null,
    "tool_calls": [{"id": "call_1", "type": "function",
      "function": {"name": "get_order_status", "arguments": "{\\"order_id\\": \\"A-1042\\"}"}}]}}],
  "usage": {"prompt_tokens": 812, "completion_tokens": 19}
}"""
ANTHROPIC_TOOL_CALL = """{
  "stop_reason": "tool_use",
  "content": [{"type": "text", "text": "Let me check."},
              {"type": "tool_use", "id": "toolu_1", "name": "get_order_status", "input": {"order_id": "A-1042"}}],
  "usage": {"input_tokens": 790, "output_tokens": 24}
}"""
ANTHROPIC_REFUSAL = """{"stop_reason": "refusal", "content": [], "usage": {"input_tokens": 50, "output_tokens": 0}}"""


def normalize_openai(body: dict) -> dict:
    choice = body["choices"][0]
    calls = [{"name": c["function"]["name"], "arguments": json.loads(c["function"]["arguments"])}
             for c in choice["message"].get("tool_calls") or []]
    return {"text": choice["message"].get("content") or "", "stop": choice["finish_reason"],
            "tool_calls": calls, "tokens": (body["usage"]["prompt_tokens"], body["usage"]["completion_tokens"])}


def normalize_anthropic(body: dict) -> dict:
    text = "".join(block["text"] for block in body["content"] if block["type"] == "text")
    calls = [{"name": block["name"], "arguments": block["input"]}
             for block in body["content"] if block["type"] == "tool_use"]
    return {"text": text, "stop": body["stop_reason"], "tool_calls": calls,
            "tokens": (body["usage"]["input_tokens"], body["usage"]["output_tokens"])}


openai = normalize_openai(json.loads(OPENAI_TOOL_CALL))
anthropic = normalize_anthropic(json.loads(ANTHROPIC_TOOL_CALL))
refusal = normalize_anthropic(json.loads(ANTHROPIC_REFUSAL))

# The same logical event must look the same after normalization, whatever the provider.
assert openai["tool_calls"] == anthropic["tool_calls"] == [{"name": "get_order_status", "arguments": {"order_id": "A-1042"}}]
assert openai["text"] == "" and anthropic["text"] == "Let me check."      # OpenAI content is null here
assert refusal == {"text": "", "stop": "refusal", "tool_calls": [], "tokens": (50, 0)}
print("openai   :", openai)
print("anthropic:", anthropic)
```

Результат:

```text
openai   : {'text': '', 'stop': 'tool_calls', 'tool_calls': [{'name': 'get_order_status', 'arguments': {'order_id': 'A-1042'}}], 'tokens': (812, 19)}
anthropic: {'text': 'Let me check.', 'stop': 'tool_use', 'tool_calls': [{'name': 'get_order_status', 'arguments': {'order_id': 'A-1042'}}], 'tokens': (790, 24)}
```

У наведеному форматі OpenAI Chat Completions `content` може бути `null`, а аргументи інструмента надходять JSON-рядком, який потрібно розібрати й перевірити. Anthropic передає аргументи об’єктом і може поєднувати текст із викликами. Ці відмінності мають покривати контрактні фікстури.

## Маршрутизація інструментів та авторизація

Коли модель просить виклик tool, запит — це **untrusted input**: модель може вибрати неіснуючий tool, надіслати невалідні arguments або бути змушеною запитати дані іншого клієнта. Router, що виконує tool calls, — критичний для безпеки code, і він повністю тестується без моделі.

```python
ORDERS = {"A-1042": {"owner": "u-17", "status": "shipped"}, "A-2001": {"owner": "u-99", "status": "packed"}}


class ToolError(Exception):
    """Returned to the model as a tool result; never shown raw to the user."""


def get_order_status(order_id: str, *, user_id: str) -> dict:
    order = ORDERS.get(order_id)
    if order is None or order["owner"] != user_id:          # one answer for missing and foreign orders
        raise ToolError("order not found")
    return {"order_id": order_id, "status": order["status"]}


TOOLS = {"get_order_status": {"function": get_order_status, "required": {"order_id": str}}}


def run_tool_call(call: dict, user_id: str) -> dict:
    """Validate a tool call requested by the model and execute it for the CURRENT user only."""
    spec = TOOLS.get(call.get("name"))
    if spec is None:
        return {"error": f"unknown tool {call.get('name')!r}"}
    arguments = call.get("arguments")
    if not isinstance(arguments, dict) or set(arguments) != set(spec["required"]):
        return {"error": "invalid arguments"}
    if not all(isinstance(arguments[k], t) for k, t in spec["required"].items()):
        return {"error": "invalid argument types"}
    try:
        return {"result": spec["function"](**arguments, user_id=user_id)}
    except ToolError as error:
        return {"error": str(error)}


cases = [
    ("own order", {"name": "get_order_status", "arguments": {"order_id": "A-1042"}}),
    ("order of another customer", {"name": "get_order_status", "arguments": {"order_id": "A-2001"}}),
    ("model injects user_id", {"name": "get_order_status", "arguments": {"order_id": "A-2001", "user_id": "u-99"}}),
    ("unknown tool", {"name": "issue_refund", "arguments": {"order_id": "A-1042"}}),
    ("wrong argument type", {"name": "get_order_status", "arguments": {"order_id": 1042}}),
]
for name, call in cases:
    print(f"{name:<26} -> {run_tool_call(call, user_id='u-17')}")
```

Результат:

```text
own order                  -> {'result': {'order_id': 'A-1042', 'status': 'shipped'}}
order of another customer  -> {'error': 'order not found'}
model injects user_id      -> {'error': 'invalid arguments'}
unknown tool               -> {'error': "unknown tool 'issue_refund'"}
wrong argument type        -> {'error': 'invalid argument types'}
```

Рішення в дизайні, які захищають тести:

- **Ідентичність користувача береться з автентифікованої сесії, ніколи від моделі.** Третій case показує, як модель намагається сама передати `user_id`; router відхиляє будь-який неочікуваний argument.
- **«Не знайдено» і «не ваше» дають однакову відповідь,** тож tool не можна використати, щоб з'ясувати, які order IDs існують.
- **Помилки повертаються моделі як tool results,** щоб вона пояснила ситуацію користувачу, і логуються для monitoring.

## Час, випадковість і конкурентне виконання

Ще три джерела нестабільних тестів мають стандартні ліки:

- **Час.** Підставляйте clock. Логіка retries і timeouts, протестована з fake clock, виконується миттєво й детерміновано (повний приклад — в [Анатомія LLM-застосунку та API](/learn/llm?topic=llm-application-anatomy)). Поведінка, залежна від дати («ваше вікно повернення закінчується завтра»), потребує фіксованого «зараз».
- **Випадковість.** Фіксуйте seed кожного генератора випадковості в тестах, включно з sampling у fakes і генераторами даних, і друкуйте seed при збої.
- **Асинхронність.** Streaming і паралельні tool calls зазвичай асинхронні. Тестуйте їх async test runner (наприклад pytest-asyncio), рухайте streams записаними подіями й явно тестуйте скасування: скасований запит має припинити читати stream і не залишити напівзаписаного стану.

## Організація набору тестів

Розділяйте тести за тим, що їм потрібно і як часто вони запускаються:

| Рівень | Потребує | Швидкість | Коли запускається | Приклад |
|---|---|---|---|---|
| Unit (offline) | Нічого зовнішнього | Мілісекунди | Кожен commit | Parsing, маршрутизація, збирання context з doubles |
| Записана інтеграція | Cassettes і fixtures | Секунди | Кожен commit | SDK wrapper проти відтвореного трафіку |
| Live smoke | API key, мережа | Секунди, коштує грошей | Щоночі та перед релізом | Один реальний виклик на кожен шлях provider: stop reasons, usage, structured output |
| Evaluation | Datasets, модель, scorers | Від хвилин до годин | Pull requests, що змінюють поведінку, щоночі | Metrics якості з thresholds |

Markers роблять рівні явними, а запуск за замовчуванням лишається offline:

```toml
[tool.pytest.ini_options]
addopts = "-m 'not live and not eval'"
markers = [
  "live: calls a real model provider; needs API keys",
  "eval: runs an evaluation dataset against a model",
]
```

Запускайте `pytest -m live` чи `pytest -m eval` свідомо, на етапах pipeline, описаних у [Якість у промисловому середовищі](/learn/llm?topic=production-quality).

## Приклад проєкту

Метод цього chapter реалізований і покритий тестами в [examples/llm-testing/07-testing-without-the-model](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/07-testing-without-the-model): support assistant з підставленим model client, усі шість видів test doubles, інваріанти збирання context, перевірені Hypothesis, snapshot prompt, contract fixtures providers, router, що забезпечує authorization tools, і record-and-replay тест, що працює offline із закоміченої cassette. Усі тести працюють offline, без моделі та API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/07-testing-without-the-model
```

## Типові помилки

- **Тестувати детермінований code через реальну модель,** що робить тести повільними, дорогими й нестабільними та приховує причини збоїв.
- **Створювати client усередині бізнес-логіки,** через що тести можуть лише патчити внутрішні деталі.
- **Mock точного тексту prompt** у поведінкових тестах, через що кожна правка prompt ламає непов'язані тести.
- **Cassettes із секретами** або cassettes, що не звіряють тіло запиту.
- **Лише fixtures щасливого шляху:** немає форм tool call, refusal, truncation чи null content.
- **Довіра до arguments tools від моделі,** включно з полями ідентичності чи прав.
- **Один недиференційований test suite,** що змішує offline тести, платні live виклики й повільні evaluations.

## Підсумок

- Детерміновану частину застосунку перевіряйте без мережі за допомогою тестових двійників.
- Передавання залежностей ззовні створює точку підміни. Обирайте заготовлені відповіді, записувачі викликів, спрощені реалізації чи імітатори збоїв відповідно до мети тесту.
- Перевіряйте інваріанти контексту на багатьох згенерованих розмовах.
- Рецензуйте зміни знімків промптів, щоб не пропустити втрату правил.
- Відтворюйте трафік без секретів зі звірянням запиту; рідкісні форми покривайте контрактними фікстурами.
- Маршрутизатор інструментів має брати ідентичність із сесії, перевіряти аргументи й не розкривати чужі дані.
- Відокремлюйте модульні тести, записані інтеграції, реальні API й оцінювання. Типовий запуск має працювати без мережі.
