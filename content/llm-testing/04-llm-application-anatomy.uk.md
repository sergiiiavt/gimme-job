# Анатомія LLM-застосунку та API

Функція на основі LLM — переважно звичайне програмне забезпечення навколо віддалених викликів моделі. Їхня затримка, вартість, квоти й імовірнісність створюють ризики, окремі від якості моделі. На прикладі асистента Stride розглянемо компоненти, запити й відповіді, завершення генерації, потоки, помилки, повтори, витрати та записи для діагностики.

**Передумови:** [Як LLM генерують текст](/learn/llm?topic=llm-foundations); HTTP і JSON ([API та інтеграції](/learn/api)).

## Архітектура LLM-застосунку

Асистент Stride відповідає про правила магазину й замовлення. Шлях запиту:

```diagram
 browser chat widget
        │  HTTPS, user session
        ▼
 API gateway ─────────── authentication, rate limiting, request size limits
        │
        ▼
 conversation orchestrator ── loads conversation state, enforces turn and cost budgets
        │
        ├─► input guardrails ─────── blocks abusive or out-of-scope input, redacts PII
        │
        ├─► context assembly ─────── system prompt template (versioned), history window,
        │                            retrieved policy chunks, user profile, tool definitions
        │
        ├─► model client ─────────── provider SDK, timeouts, retries, fallback model
        │        │
        │        └─► tool loop ────── get_order_status(order_id) with authorization check
        │
        ├─► output parsing ───────── structured output validation, citation check
        │
        ├─► output guardrails ────── policy and safety filters
        │
        └─► response + trace ─────── answer, citations, trace ID, usage and latency metrics
```

Імовірнісна частина зосереджена у викликах моделі. Навколишній код перевіряйте модульними й інтеграційними тестами, підміняючи модель за потреби ([Тестування коду LLM-застосунку без моделі](/learn/llm?topic=testing-without-the-model)).

| Компонент | Детермінований? | Типові дефекти | Основна техніка тестування |
|---|---|---|---|
| Шлюз API | Так | Відсутні автентифікація, ліміти розміру й частоти | Перевірки API та безпеки |
| Оркестратор | Так | Втрачений стан, нескінченні цикли, немає бюджетів | Модульні й інтеграційні тести |
| Захист вхідних даних | Залежить від використання моделей | Надмірне блокування або витік персональних даних | Метрики класифікації |
| Збирання контексту | Так | Втрачені інструкції, чужі дані, неправильний шаблон | Модульні тести й знімки промптів |
| Клієнт моделі | Обгортка — так, модель — ні | Неправильне завершення, лавина повторів, немає таймаутів | Імітація клієнта й внесення збоїв |
| Цикл інструментів | Керувальний код — так | Немає авторизації, неперевірені аргументи | Модульні тести й оцінювання агента |
| Розбір відповіді | Так | Некоректний JSON або посилання | Записані некоректні відповіді |
| Захист відповідей | Залежить від реалізації | Надмірне чи недостатнє блокування | Метрики класифікації |
| Якість відповіді моделі | Ні | Хибний, непідтверджений чи небезпечний зміст | Оцінювання на наборах даних |

**Значну частину LLM-застосунку перевіряють звичайними техніками.** Оцінювання моделі їх доповнює.

## Виклик моделі: запит і відповідь

API чату приймає повідомлення з ролями й параметри. Відповідь містить згенерований вміст, причину завершення та дані використання ресурсів.

```json
{
  "model": "<pinned model id>",
  "messages": [
    {"role": "system", "content": "You are Stride's support assistant. Answer only from the POLICY section..."},
    {"role": "user", "content": "Can I return shoes I wore once?"}
  ],
  "temperature": 0,
  "max_tokens": 500,
  "tools": [{"name": "get_order_status", "description": "...", "parameters": {"type": "object"}}]
}
```

| Роль | Призначення | Нотатка для тестування |
|---|---|---|
| system (або developer) | Інструкції застосунку: роль, правила, формат | Зберігайте під час скорочення історії; не додавайте секретів |
| user | Повідомлення користувача | Недовірені дані |
| assistant | Попередні відповіді чи заданий початок | Історія теж є входом; дані з клієнта можна підробити |
| tool | Результат інструмента | Недовірені зовнішні дані |

Приклади трьох SDK для запуску локально: задайте ключ API й точний ID моделі у змінних середовища.

```python
# OpenAI Chat Completions API
import os
from openai import OpenAI

client = OpenAI()
response = client.chat.completions.create(
    model=os.environ["LLM_MODEL"],
    messages=[
        {"role": "system", "content": "You are Stride's support assistant."},
        {"role": "user", "content": "Can I return shoes I wore once?"},
    ],
    temperature=0,
    max_completion_tokens=500,
)
choice = response.choices[0]
print(choice.message.content)
print(choice.finish_reason, response.usage.prompt_tokens, response.usage.completion_tokens)
```

```python
# OpenAI Responses API
import os
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model=os.environ["LLM_MODEL"],
    instructions="You are Stride's support assistant.",
    input="Can I return shoes I wore once?",
    max_output_tokens=500,
)
print(response.output_text)
print(response.status, response.usage.input_tokens, response.usage.output_tokens)
```

```python
# Anthropic Messages API: the system prompt is a top-level parameter and max_tokens is required
import os
import anthropic

client = anthropic.Anthropic()
message = client.messages.create(
    model=os.environ["LLM_MODEL"],
    system="You are Stride's support assistant.",
    messages=[{"role": "user", "content": "Can I return shoes I wore once?"}],
    temperature=0,
    max_tokens=500,
)
print(message.content[0].text)
print(message.stop_reason, message.usage.input_tokens, message.usage.output_tokens)
```

Відмінності API важливі для тестів: місце системного промпту, обов’язковість `max_tokens`, рядок чи блоки вмісту, назви полів завершення й обліку токенів. Адаптер або шлюз на кшталт LiteLLM може нормалізувати ці форми для решти застосунку.

## Причини завершення виклику

Кожна причина завершення потребує визначеної обробки й тесту.

| Причина | OpenAI Chat `finish_reason` | Anthropic `stop_reason` | Дія застосунку |
|---|---|---|---|
| Звичайне завершення | `stop` | `end_turn`, `stop_sequence` | Перевірити й повернути результат |
| Досягнуто ліміту | `length` | `max_tokens`, `model_context_window_exceeded` | Не видавати за повну відповідь; змінити бюджет чи пояснити проблему |
| Виклик інструмента | `tool_calls` | `tool_use` | Перевірити права, виконати й продовжити |
| Блокування чи відмова | `content_filter` | `refusal` | Безпечне повідомлення й запис події |
| Продовження | Не застосовується | `pause_turn` | Надіслати розмову для продовження |

Поширена помилка — **прийняти обірвану відповідь за повну**. Обробник нормалізує причини й вибирає дію. Невідоме значення майбутнього API не можна мовчки приймати за успіх.

```python
from dataclasses import dataclass, field

# One vocabulary for the whole application, whatever the provider calls it.
OPENAI_FINISH = {"stop": "end", "length": "max_tokens", "tool_calls": "tool_use",
                 "content_filter": "blocked"}
ANTHROPIC_STOP = {"end_turn": "end", "max_tokens": "max_tokens", "stop_sequence": "end",
                  "tool_use": "tool_use", "refusal": "blocked", "pause_turn": "continue",
                  "model_context_window_exceeded": "max_tokens"}


@dataclass
class ModelResponse:
    text: str
    stop_reason: str                      # normalized value
    output_tokens: int
    tool_calls: list = field(default_factory=list)


def handle(response: ModelResponse, max_tokens: int) -> str:
    """Decide what the application does next. Every branch needs its own test."""
    if response.stop_reason == "end":
        return "deliver answer"
    if response.stop_reason == "tool_use":
        return f"run {len(response.tool_calls)} tool call(s) and call the model again"
    if response.stop_reason == "max_tokens":
        if max_tokens < 4000:
            return "retry once with a larger max_tokens"
        return "show a shortened-answer notice and log a truncation"
    if response.stop_reason == "blocked":
        return "show the refusal template and log for review"
    if response.stop_reason == "continue":
        return "send the conversation back so the model can continue"
    return "fail closed: unknown stop reason"


cases = [
    ("normal answer", ModelResponse("You can return...", OPENAI_FINISH["stop"], 42), 1000),
    ("tool request", ModelResponse("", ANTHROPIC_STOP["tool_use"], 18, [{"name": "get_order"}]), 1000),
    ("truncated, small budget", ModelResponse('{"answer": "You can re', OPENAI_FINISH["length"], 1000), 1000),
    ("truncated, large budget", ModelResponse("...", ANTHROPIC_STOP["max_tokens"], 8000), 8000),
    ("provider refusal", ModelResponse("", ANTHROPIC_STOP["refusal"], 0), 1000),
    ("new provider value", ModelResponse("", "something_new", 0), 1000),
]
for name, response, budget in cases:
    print(f"{name:<24} -> {handle(response, budget)}")
```

Результат:

```text
normal answer            -> deliver answer
tool request             -> run 1 tool call(s) and call the model again
truncated, small budget  -> retry once with a larger max_tokens
truncated, large budget  -> show a shortened-answer notice and log a truncation
provider refusal         -> show the refusal template and log for review
new provider value       -> fail closed: unknown stop reason
```

## Потокове передавання

За потокового передавання відповідь надходить HTTP-подіями: початок, фрагменти тексту чи інструментів, завершення й облік ресурсів. Користувач бачить текст до кінця генерації.

Окремі ризики потокової обробки:

- **Обрив:** часткова відповідь не є повною без належного завершення.
- **Частковий JSON:** повна перевірка можлива після збирання; інкрементальний розбір потребує спеціального засобу.
- **Пізній облік токенів:** після обриву дані можуть бути відсутні.
- **Від’єднання користувача:** скасовуйте непотрібну генерацію, якщо API це підтримує. Саме припинення читання не гарантує припинення обчислень чи оплати.
- **Затримка:** вимірюйте час до першого токена (TTFT) і загальну тривалість.

Збирач нижче відтворює події, вимірює TTFT і виявляє незавершений потік.

```python
# A recorded stream: (seconds since the request was sent, event type, payload)
complete_stream = [
    (0.000, "start", None),
    (0.640, "delta", "You can return "),
    (0.700, "delta", "unworn shoes within "),
    (0.770, "delta", "30 days of delivery."),
    (0.790, "stop", {"stop_reason": "end", "output_tokens": 12}),
]
broken_stream = complete_stream[:3]          # connection dropped before the stop event


def assemble(events: list) -> dict:
    text, first_token_at, finished, usage = [], None, False, None
    for at, kind, payload in events:
        if kind == "delta":
            if first_token_at is None:
                first_token_at = at
            text.append(payload)
        elif kind == "stop":
            finished, usage = True, payload
    return {
        "text": "".join(text),
        "complete": finished,
        "time_to_first_token_s": first_token_at,
        "total_s": events[-1][0],
        "usage": usage,
    }


for name, events in [("complete", complete_stream), ("broken", broken_stream)]:
    result = assemble(events)
    print(name, result)
    if not result["complete"]:
        print("  -> must not be shown as a full answer: retry or show an error")
```

Результат:

```text
complete {'text': 'You can return unworn shoes within 30 days of delivery.', 'complete': True, 'time_to_first_token_s': 0.64, 'total_s': 0.79, 'usage': {'stop_reason': 'end', 'output_tokens': 12}}
broken {'text': 'You can return unworn shoes within ', 'complete': False, 'time_to_first_token_s': 0.64, 'total_s': 0.7, 'usage': None}
  -> must not be shown as a full answer: retry or show an error
```

Запис і відтворення реальних подій дозволяють перевіряти потокову обробку без мережі.

### Тестові випадки потокової обробки

| Випадок | Очікувана поведінка |
|---|---|
| Звичайний потік | Відповідь повна, час записаний |
| З'єднання обірвалося до фінальної події | Не показується і не зберігається як повна відповідь; користувач може повторити |
| Причина `max_tokens` | Обробка досягнення ліміту |
| Фрагменти виклику інструмента | Повністю зібрати аргументи перед виконанням |
| Закритий чат | Припинити непотрібну обробку й за можливості скасувати генерацію |
| Немає даних використання | Явно позначити відсутній облік |
| Помилка посеред потоку | Обробити як помилку API |
| Перевищено таймаут читання | Коректно припинити очікування |

## Помилки, повторні спроби й граничний час очікування

Обробка помилок є частиною основної функціональності. Коди потребують різних рішень:

| Код | Значення | Повторення |
|---|---|---|
| 400 | Некоректний запит | Спочатку виправити запит |
| 401, 403 | Автентифікація чи доступ | Перевірити конфігурацію й права |
| 404 | Невідомий ресурс чи модель | Перевірити маршрут і доступність |
| 413 | Запит завеликий | Ні |
| 408, таймаут | Перевищено час | Можна в межах загального строку |
| 429 | Частота чи квота | Дотриматися `Retry-After`; вичерпаний бюджет очікування не відновить |
| 500, 502, 503, 504 | Сервер чи шлюз | Зазвичай можна з обмеженнями |
| 529 | Перевантаження Anthropic | Можна із затримкою |

Політика повторних спроб має п’ять складників:

- **Повторюйте тимчасові помилки**, а не незмінений некоректний запит.
- **Експоненційна затримка з випадковим розкидом:** приблизно `base · 2^attempt` з верхньою межею та випадковістю, щоб клієнти не повторювали синхронно.
- **Дотримуйтеся `Retry-After`.**
- **Обмежуйте спроби й загальний час** відповідно до потреб інтерфейсу.
- **Захищайте побічні дії:** повтор не повинен вдруге повернути кошти. Потрібні ідемпотентність і перевірка стану.

Тестовий годинник перевіряє затримки без очікування, а імітація клієнта задає послідовність збоїв і успіхів.

```python
import random

RETRYABLE = {408, 429, 500, 502, 503, 504, 529}


class ApiError(Exception):
    def __init__(self, status: int, retry_after: float | None = None, code: str = ""):
        super().__init__(f"HTTP {status} {code}".strip())
        self.status = status
        self.retry_after = retry_after
        self.code = code


class FakeClock:
    """Lets tests 'sleep' instantly while recording how long the code would have waited."""
    def __init__(self):
        self.now = 0.0

    def sleep(self, seconds: float) -> None:
        self.now += seconds


def call_with_retries(call, clock, max_attempts=5, base=0.5, cap=8.0, deadline=20.0, seed=0):
    rng = random.Random(seed)
    start = clock.now
    for attempt in range(1, max_attempts + 1):
        try:
            return call()
        except ApiError as error:
            quota_exhausted = error.code == "insufficient_quota"   # a 429 that waiting will not fix
            if error.status not in RETRYABLE or quota_exhausted or attempt == max_attempts:
                raise
            if error.retry_after is not None:
                delay = error.retry_after                                 # the server told us how long
            else:
                delay = rng.uniform(0, min(cap, base * 2 ** attempt))     # exponential backoff, full jitter
            if clock.now - start + delay > deadline:
                raise
            clock.sleep(delay)


class ScriptedClient:
    """Fake model client: returns or raises the scripted outcomes in order."""
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0

    def __call__(self):
        self.calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def run(name, outcomes, **kwargs):
    client, clock = ScriptedClient(outcomes), FakeClock()
    try:
        result = call_with_retries(client, clock, **kwargs)
    except ApiError as error:
        result = f"raised {error}"
    print(f"{name:<34} calls={client.calls}  waited={clock.now:5.2f}s  result={result}")
    return client.calls


assert run("429 with Retry-After, 503, success",
           [ApiError(429, retry_after=2.0), ApiError(503), "ok"]) == 3
assert run("400 bad request is not retried", [ApiError(400), "ok"]) == 1
assert run("quota exhausted is not retried", [ApiError(429, code="insufficient_quota"), "ok"]) == 1
assert run("503 forever gives up after 5 tries", [ApiError(503)] * 10) == 5
assert run("Retry-After beyond the deadline", [ApiError(429, retry_after=60.0), "ok"]) == 1
print("all retry policy checks passed")
```

Результат:

```text
429 with Retry-After, 503, success calls=3  waited= 3.69s  result=ok
400 bad request is not retried     calls=1  waited= 0.00s  result=raised HTTP 400
quota exhausted is not retried     calls=1  waited= 0.00s  result=raised HTTP 429 insufficient_quota
503 forever gives up after 5 tries calls=5  waited= 6.11s  result=raised HTTP 503
Retry-After beyond the deadline    calls=1  waited= 0.00s  result=raised HTTP 429
all retry policy checks passed
```

Повтори SDK і зовнішньої обгортки можуть множитися. Три внутрішні спроби — перша й дві повторні — для кожної з п’яти зовнішніх дають до 15 викликів. Перевіряйте сумарну політику.

Ще два механізми надійності потребують тестів:

- **Таймаути:** з’єднання, читання між подіями та загальна обробка запиту.
- **Резервні моделі:** вони потребують того самого оцінювання якості, інакше запасний шлях неперевірений.

## Токени, використання ресурсів і вартість

API може окремо тарифікувати вхідні, вихідні, кешовані токени й міркування. Правила залежать від постачальника. Кешування повторно використовує однаковий префікс промпту.

```text
cost per request = (uncached input tokens × input price
                    + cached input tokens × cached input price
                    + output tokens (including reasoning) × output price) / 1,000,000
```

Вимірюйте вартість на запит, розмову й **успішно розв’язане завдання**. Приклад використовує умовні ціни й бюджет із трасувань.

```python
# Example prices in USD per million tokens. Real prices change; read them from the provider's pricing page.
PRICES = {
    "large-model": {"input": 3.00, "cached_input": 0.30, "output": 15.00},
    "small-model": {"input": 0.25, "cached_input": 0.025, "output": 2.00},
}


def request_cost(model: str, input_tokens: int, output_tokens: int, cached_tokens: int = 0) -> float:
    price = PRICES[model]
    uncached = input_tokens - cached_tokens
    return (uncached * price["input"] + cached_tokens * price["cached_input"]
            + output_tokens * price["output"]) / 1_000_000


# Token budget of one assistant turn, measured from real traces
system_prompt, tool_definitions, history, retrieved, question = 1200, 400, 600, 2400, 50
input_tokens = system_prompt + tool_definitions + history + retrieved + question
output_tokens = 220

for model in PRICES:
    plain = request_cost(model, input_tokens, output_tokens)
    cached = request_cost(model, input_tokens, output_tokens, cached_tokens=system_prompt + tool_definitions)
    print(f"{model}: {input_tokens} in / {output_tokens} out -> ${plain:.5f} per request, "
          f"${cached:.5f} with prompt caching")

# What the business cares about: cost per resolved conversation, not per request
requests_per_conversation = 2.4
resolution_rate = 0.80
conversations_per_month = 50_000
per_request = request_cost("large-model", input_tokens, output_tokens)
per_resolved = per_request * requests_per_conversation / resolution_rate
monthly = per_request * requests_per_conversation * conversations_per_month
print(f"large-model: ${per_resolved:.4f} per resolved conversation, ${monthly:,.0f} per month")

# A prompt change that adds 1,500 tokens of instructions to every request
grown = request_cost("large-model", input_tokens + 1500, output_tokens)
print(f"prompt growth of 1,500 tokens: {grown / per_request - 1:+.0%} cost per request")
```

Результат:

```text
large-model: 4650 in / 220 out -> $0.01725 per request, $0.01293 with prompt caching
small-model: 4650 in / 220 out -> $0.00160 per request, $0.00124 with prompt caching
large-model: $0.0517 per resolved conversation, $2,070 per month
prompt growth of 1,500 tokens: +26% cost per request
```

Кількість і довжина знайдених фрагментів впливають на витрати. Навіть невелика правка промпту може помітно змінити бюджет, тому додавайте вартість до регресійного звіту ([Якість у промисловому середовищі](/learn/llm?topic=production-quality)).

## Запис викликів моделі для тестування

Для діагностики потрібні записи викликів із належно прибраними персональними даними:

```json
{
  "trace_id": "3f9c1e7a",
  "span": "answer_generation",
  "timestamp": "2026-10-11T09:14:03Z",
  "provider": "example-provider",
  "model": "<pinned model id>",
  "parameters": {"temperature": 0, "max_tokens": 500},
  "prompt_template": {"id": "support-answer", "version": "v14"},
  "messages_hash": "sha256:9b1d…",
  "retrieved_chunk_ids": ["returns-policy#2", "returns-policy#5"],
  "tools_offered": ["get_order_status"],
  "tool_calls": [],
  "stop_reason": "end",
  "usage": {"input_tokens": 4650, "output_tokens": 220, "cached_input_tokens": 1600},
  "latency_ms": {"time_to_first_token": 640, "total": 2310},
  "retries": 0,
  "output_text": "You can return unworn shoes within 30 days…",
  "outcome": {"delivered": true, "user_feedback": null}
}
```

Запис пояснює модель і промпт, вхідний контекст, причину завершення, витрати й наслідки. Це основа регресійних випадків ([Методологія оцінювання та набори даних](/learn/llm?topic=evaluation-fundamentals)), відтворення ([Тестування коду LLM-застосунку без моделі](/learn/llm?topic=testing-without-the-model)) і моніторингу ([Якість у промисловому середовищі](/learn/llm?topic=production-quality)).

### Приклад: застарілі правила у відповіді

Як з’ясувати причину посилання на замінені правила повернення:

- `retrieved_chunk_ids` визначає фрагменти, які бачила модель; старий ID може вказувати на застарілий індекс.
- `timestamp` зіставляє виклик з оновленням і переіндексацією.
- `prompt_template.version` і `model` показують версії, які потрібно порівняти.
- `output_text` підтверджує, що саме процитовано.
- Перевірте історію й інші джерела контексту. Сам `messages_hash` не відновлює повідомлень: потрібен дозволений запис або відтворення відповідної версії. Не робіть висновку про навчальні дані лише з відсутності фрагмента в пошуку.

## Рішення, що змінюють тестування

- **Фіксуйте версії:** за можливості використовуйте точний ID й оцінюйте перехід.
- **Відстежуйте припинення підтримки**, включно з оцінювачами й резервними моделями.
- **Локальні API**, наприклад Ollama, корисні для практики. Сумісність формату не доводить однакової поведінки з робочим постачальником.
- **Шлюзи й адаптери** можуть централізувати нормалізацію, повтори, бюджети й журналювання. Їхню логіку теж потрібно перевіряти.

## Приклад проєкту

Метод реалізований і покритий тестами в [examples/llm-testing/04-model-client](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/04-model-client): завершення, повтори, тестовий годинник, відтворення потоків і витрати. Перевірки реального API необов’язкові; основні тести працюють без мережі, моделі та ключів API:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/04-model-client
```

## Типові помилки

- **Видавати обірвану відповідь за повну.**
- **Повторювати постійні помилки чи не обмежувати очікування.**
- **Множити повтори на рівнях SDK, обгортки й черги.**
- **Використовувати неперевірену резервну модель.**
- **Рахувати лише вартість запиту**, пропускаючи кінцеве завдання.
- **Записувати замало версій або забагато персональних даних.**

## Підсумок

- Звичайний код навколо моделі потребує звичайних програмних тестів.
- Нормалізуйте відмінності API на межі системи.
- Перевіряйте причини завершення й обриви.
- Покривайте часткові потоки, облік ресурсів і затримки.
- Обмежуйте повтори й захищайте побічні дії; тестуйте час без реального очікування.
- Вимірюйте витрати на запит, розмову та успішне завдання.
- Записуйте версії, параметри, контекст, завершення, ресурси й час.
