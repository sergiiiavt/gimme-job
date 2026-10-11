# Анатомія LLM application і APIs

Production LLM feature — це переважно звичайне software навколо кількох викликів model API. Ці виклики віддалені, повільні, тарифіковані, обмежені rate limits і ймовірнісні, і кожна з цих властивостей створює дефекти, що не мають жодного стосунку до якості моделі. Цей chapter розбирає наскрізний приклад — support assistant магазину Stride: його компоненти, request і response виклику моделі, способи, якими виклик завершується, streaming, помилки та retries, cost і те, що треба записувати, щоб будь-яку поведінку можна було відтворити й протестувати.

**Після цього chapter ви вмієте:**

- намалювати архітектуру LLM application і позначити детерміновані частини;
- читати й писати chat API requests і responses для основних providers;
- правильно обробляти кожен stop reason, streamed responses, помилки, retries і timeouts та тестувати кожен шлях;
- обчислювати використання tokens і cost на запит, на розмову і на розв'язану задачу;
- визначити запис, який треба логувати для кожного виклику моделі, щоб тестування й debugging були можливі.

**Prerequisites:** [Як LLM генерують текст](/learn/llm?topic=llm-foundations); основи HTTP і JSON ([API & Integration](/learn/api)).

## Архітектура LLM application

Асистент Stride відповідає на питання про policies і замовлення. Шлях запиту виглядає так:

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

Імовірнісні лише виклики моделі всередині model client. Усе інше — детермінований code, і його треба тестувати звичайними unit та integration tests, використовуючи fake model там, де є виклик моделі ([Тестування LLM code без моделі](/learn/llm?topic=testing-without-the-model)).

| Компонент | Детермінований? | Типові дефекти | Основна техніка тестування |
|---|---|---|---|
| API gateway | Так | Немає auth, лімітів розміру чи rate limits | API та security tests |
| Orchestrator | Так | Втрачений чи переплутаний стан розмови, нескінченні цикли, немає budgets | Unit та integration tests |
| Input guardrails | Здебільшого (може викликати classifier model) | Over-blocking, under-blocking, PII потрапляє в prompts | Classification metrics на позначених inputs |
| Context assembly | Так | Неправильна версія template, вікно історії відкидає system prompt, дані не того користувача | Unit tests і snapshot tests відрендерених prompts |
| Model client | Wrapper так, модель ні | Неправильна обробка stop reasons, retry storms, немає timeouts | Тести з fake client, fault injection |
| Tool loop | Wrapper так | Немає authorization, неперевірені arguments, нескінченні цикли | Unit tests, agent evaluation |
| Output parsing | Так | Падає на невалідному JSON, приймає невалідні citations | Unit tests на записаних поганих outputs |
| Output guardrails | Здебільшого | Те саме, що input guardrails | Classification metrics |
| Якість output моделі | Ні | Неправильні, unfaithful, нерелевантні чи небезпечні відповіді | Evaluation з datasets і scorers |

Таблиця показує повторюваний момент: **більшість LLM application тестується звичайними техніками.** Evaluation моделі потрібна, але вона не замінює цих тестів.

## Виклик моделі: request і response

Усі основні chat APIs мають однакову концептуальну форму: список **messages** з ролями плюс **parameters**, надісланий **моделі**; response містить згенерований контент, **stop reason** і лічильники **usage**.

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
| system (або developer) | Інструкції від application: persona, правила, формат | Має пережити обрізання історії; вважайте публічною, ніколи не кладіть туди секрети |
| user | Повідомлення кінцевого користувача | Untrusted input |
| assistant | Попередні відповіді моделі або prefilled початок відповіді | Історія, яку ви надсилаєте назад, — теж input; її можна підробити, якщо вона зберігається на клієнті |
| tool | Результат виклику tool | Untrusted дані із зовнішньої системи |

Той самий виклик у трьох поширених SDKs (запускайте на своїй машині; задайте API key і зафіксований model ID у змінних середовища):

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

Відмінності між providers невеликі, але для тестів важливі: де розташований system prompt, чи обов'язковий `max_tokens`, як структурований контент (рядок чи список content blocks) і як називаються stop reasons та поля usage. Багато команд обгортають providers одним внутрішнім інтерфейсом або використовують gateway library на кшталт LiteLLM, щоб решта application і її тести мали справу з однією нормалізованою формою.

## Stop reasons: як завершується виклик

Кожен response каже, чому генерація зупинилася. Кожна причина вимагає окремої обробки, і кожен шлях обробки потребує тесту.

| Нормалізоване значення | OpenAI Chat `finish_reason` | Anthropic `stop_reason` | Правильна поведінка application |
|---|---|---|---|
| Завершено нормально | `stop` | `end_turn`, `stop_sequence` | Валідувати й віддати |
| Досягнуто ліміту output | `length` | `max_tokens`, `model_context_window_exceeded` | Ніколи не віддавати як повну: retry з більшим лімітом, скоротити запит або показати повідомлення |
| Хоче викликати tool | `tool_calls` | `tool_use` | Виконати tool (з authorization) і викликати модель знову |
| Заблоковано чи відмовлено | `content_filter` | `refusal` | Показати безпечний template і залогувати для перегляду |
| Треба продовжити | не застосовується | `pause_turn` (server-side tool loops) | Надіслати розмову назад для продовження |

Найпоширеніший production bug тут — **вважати обрізаний response повним**. Він проявляється обірваними реченнями в UI або помилками парсингу JSON, у яких звинувачують модель. Handler нижче зіставляє значення providers з одним словником і вирішує наступну дію; test cases покривають кожну гілку, включно з невідомим значенням з майбутньої версії API, яке має fail closed.

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

Output:

```text
normal answer            -> deliver answer
tool request             -> run 1 tool call(s) and call the model again
truncated, small budget  -> retry once with a larger max_tokens
truncated, large budget  -> show a shortened-answer notice and log a truncation
provider refusal         -> show the refusal template and log for review
new provider value       -> fail closed: unknown stop reason
```

## Streaming

При streaming API надсилає response як послідовність подій через одне HTTP з'єднання (server-sent events): подія старту, багато дрібних текстових deltas, можливо deltas викликів tools і фінальна подія зі stop reason та usage. Користувачі бачать текст одразу, тому chat інтерфейси використовують streaming.

Streaming має власні failure modes:

- **Перервані streams.** З'єднання може обірватися після частини deltas. Без фінальної події у вас часткова відповідь, яку не можна показувати чи зберігати як повну.
- **Частковий structured output.** JSON приходить фрагментами; парсити коректно можна лише в кінці, якщо не використовувати спеціальний інкрементальний parser.
- **Usage лише в кінці.** Лічильники tokens приходять у фінальній події (деякі APIs вимагають опцію, щоб їх включити). Якщо stream обірвався, usage невідомий.
- **Відключення клієнта.** Якщо користувач закрив вкладку, server має припинити читати stream, щоб не платити за непотрібні tokens.
- **Latency metrics.** Time to first token (TTFT) і загальний час вимірюються за подіями stream.

Assembler нижче обробляє записаний stream, вимірює TTFT і виявляє перерваний stream.

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

Output:

```text
complete {'text': 'You can return unworn shoes within 30 days of delivery.', 'complete': True, 'time_to_first_token_s': 0.64, 'total_s': 0.79, 'usage': {'stop_reason': 'end', 'output_tokens': 12}}
broken {'text': 'You can return unworn shoes within ', 'complete': False, 'time_to_first_token_s': 0.64, 'total_s': 0.7, 'usage': None}
  -> must not be shown as a full answer: retry or show an error
```

Записати реальні streams один раз і відтворювати їх у тестах, як у цьому прикладі, — стандартний спосіб тестувати streaming code без мережі.

## Помилки, retries і timeouts

Model APIs падають достатньо часто, щоб обробка помилок була частиною основної функціональності. Status codes діляться на дві групи:

| Status | Значення | Retry? |
|---|---|---|
| 400 | Невалідний запит, наприклад input перевищує context window | Ні: той самий запит упаде знову; виправте чи скоротіть його |
| 401, 403 | Проблема автентифікації чи прав | Ні: алерт, це дефект конфігурації |
| 404 | Невідома модель чи endpoint, наприклад виведений з експлуатації model ID | Ні: алерт |
| 413 | Запит завеликий | Ні |
| 408, timeouts | Запит чи з'єднання перевищили час | Так, у межах загального deadline |
| 429 | Перевищено rate limit | Так, після затримки з header `Retry-After`, якщо він є. Виняток: 429 про вичерпану квоту чи проблеми з оплатою очікуванням не виправиться |
| 500, 502, 503, 504 | Помилка server чи gateway | Так |
| 529 | Overloaded (Anthropic) | Так |

Коректна retry policy має п'ять частин:

- **Повторюйте лише retryable помилки.** Retry на 400 марнує час і гроші та приховує дефект.
- **Exponential backoff з jitter.** Чекайте приблизно `base · 2^attempt` секунд з верхньою межею і рандомізуйте очікування («full jitter»: випадкове значення від 0 до цієї межі), щоб багато клієнтів не повторювали синхронно.
- **Поважайте `Retry-After`**, коли server його надає.
- **Обмежуйте все.** Максимальну кількість спроб і загальний deadline, що відповідає UX. Без них інцидент у provider перетворюється на запити, що висять хвилинами.
- **Ніколи не повторюйте side effects наосліп.** Якщо tool call уже зробив refund, retry всього turn не має робити його вдруге. Використовуйте idempotency keys для tools із side effects.

Реалізація нижче дотримується цих правил. Замість реального очікування вона використовує fake clock, що дозволяє тестам миттєво перевірити поведінку очікування; scripted fake client відтворює послідовність збоїв і успіхів.

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

Output:

```text
429 with Retry-After, 503, success calls=3  waited= 3.69s  result=ok
400 bad request is not retried     calls=1  waited= 0.00s  result=raised HTTP 400
quota exhausted is not retried     calls=1  waited= 0.00s  result=raised HTTP 429 insufficient_quota
503 forever gives up after 5 tries calls=5  waited= 6.11s  result=raised HTTP 503
Retry-After beyond the deadline    calls=1  waited= 0.00s  result=raised HTTP 429
all retry policy checks passed
```

Офіційні SDKs мають власну retry logic з налаштовуваними лімітами. Знайте їхні defaults і стежте, щоб ваш wrapper їх не множив: SDK, що повторює двічі всередині wrapper, що повторює п'ять разів, робить до 15 спроб на один запит користувача, і короткий збій provider перетворюється на перевантаження, яке ви спричинили самі.

Ще два механізми надійності потребують тестів:

- **Timeouts на кожному рівні.** Connection timeout, read timeout між подіями stream і загальний deadline на запит користувача.
- **Fallback models.** Якщо основна модель недоступна, деякі системи перемикаються на іншу. Fallback модель має проходити той самий evaluation suite; інакше fallback шлях — непротестований продукт.

## Tokens, usage і cost

Providers беруть плату за token, з окремими цінами для input і output tokens. Output tokens зазвичай у кілька разів дорожчі. Кешовані input tokens (prompt caching: повторне використання ідентичного префікса prompt між запитами) мають знижку, а reasoning tokens тарифікуються як output.

```text
cost per request = (uncached input tokens × input price
                    + cached input tokens × cached input price
                    + output tokens (including reasoning) × output price) / 1,000,000
```

Тестувальникам варто відповідати за три виміри cost: cost на запит, cost на розмову і, найважливіше для бізнесу, **cost на розв'язану задачу**. Модель нижче використовує приклад цін і token budget, виміряний з traces.

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

Output:

```text
large-model: 4650 in / 220 out -> $0.01725 per request, $0.01293 with prompt caching
small-model: 4650 in / 220 out -> $0.00160 per request, $0.00124 with prompt caching
large-model: $0.0517 per resolved conversation, $2,070 per month
prompt growth of 1,500 tokens: +26% cost per request
```

Звідси два уроки. Retrieved context домінує в input цього budget, тож налаштування retrieval (скільки chunks, якої довжини) — це й налаштування cost. А невинна на вигляд правка prompt може підняти cost на чверть; cost має бути в regression report кожної зміни prompt ([CI/CD, release gates і міграції](/learn/llm?topic=ci-release-gates)).

## Запис викликів моделі для тестування

Неможливо тестувати, debug-ити чи відтворити те, чого ви не записали. Для кожного виклику моделі логуйте запис на кшталт цього (з персональними даними, прибраними згідно з вашими правилами privacy):

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

Кожне поле відповідає на питання тестування: *яка модель і prompt це створили?* (model, версія template, parameters), *що вона бачила?* (messages hash, retrieved IDs, tools), *чому зупинилася?* (stop reason), *скільки це коштувало і тривало?* (usage, latency) і *що сталося далі?* (outcome). Ці записи стають regression cases ([Evaluation datasets](/learn/llm?topic=evaluation-datasets)), replay fixtures ([Тестування LLM code без моделі](/learn/llm?topic=testing-without-the-model)) і сировиною production monitoring ([Observability і online evaluation](/learn/llm?topic=production-quality)).

## Рішення, що змінюють тестування

- **Фіксуйте версії моделей.** Providers пропонують датовані snapshot IDs і рухомі aliases. Production має використовувати зафіксований snapshot, а перехід на новий — це міграція з повним evaluation run.
- **Відстежуйте deprecations.** Providers виводять моделі з експлуатації за опублікованими графіками. Виведений model ID повертає помилку (часто 404). Ведіть календар дат виведення для кожної моделі, включно з judge і fallback моделями.
- **Локальні та OpenAI-compatible endpoints.** Інструменти на кшталт Ollama надають OpenAI-compatible API для локальних моделей, що корисно для безкоштовної практики та offline integration tests. Поведінка, ліміти й формати помилок усе одно відрізняються від production provider, тож тести проти реального provider вони не замінюють.
- **Gateways.** Gateway чи abstraction library нормалізує providers, додає retries, budgets і logging в одному місці та здешевлює тестування переходу між providers.

## Типові помилки

- **Віддавати обрізаний output**, бо stop reason ніколи не перевіряється.
- **Повторювати non-retryable помилки** або повторювати без backoff, jitter, лімітів спроб чи deadline.
- **Багаторівневі retries** (SDK плюс wrapper плюс черга), що множать спроби під час інцидентів.
- **Непротестовані fallback models.**
- **Вимірювати cost лише на запит**, а не на розмову і на розв'язану задачу.
- **Логувати замало** (без версії моделі чи prompt) або забагато (сирі персональні дані без redaction і лімітів зберігання).

## Вправи

1. Для архітектури Stride виберіть чотири компоненти й напишіть по одному конкретному тесту для кожного, вказавши, чи потрібна реальна модель.
2. Retry policy команди звучить так: «На будь-яку помилку повторювати до 10 разів з фіксованою затримкою 1 секунда. Стандартні retries SDK залишено увімкненими.» Перелічіть усі проблеми й перепишіть policy.
3. Запит має 8 000 input tokens, з яких 2 000 — кешований префікс, і 600 output tokens. За прикладом цін `large-model` обчисліть cost з кешуванням і без. Потім обчисліть місячний cost для 30 000 розмов по 3 запити.
4. Спроєктуйте тести streaming для чату Stride: перелічіть щонайменше п'ять test cases з очікуваною поведінкою.
5. Які поля запису логу потрібні, щоб відповісти: «Чому ця відповідь процитувала policy, замінену минулого тижня?» Поясніть, як допомагає кожне поле.

:::details Розв'язок вправи 1

Приклади: (1) **Context assembly**, без моделі: відрендерити prompt для розмови з 30 turns і перевірити, що system prompt і останнє повідомлення користувача присутні, а історія обрізана від найстаріших. (2) **Model client**, fake model: scripted response зі stop reason `max_tokens` не має віддаватися як фінальна відповідь. (3) **Tool loop**, fake model: scripted tool call для замовлення іншого клієнта має відхилятися перевіркою authorization, а відмова має повертатися моделі як tool result. (4) **Якість output**, реальна модель: прогнати refund evaluation dataset і перевірити faithfulness та abstention rates проти acceptance criteria. Реальна модель потрібна лише для останнього.

:::

:::details Розв'язок вправи 2

Проблеми: «будь-яка помилка» включає 400, 401, 403 і 404, які не можуть стати успішними; фіксована затримка без jitter синхронізує клієнтів і затягує перевантаження; 10 спроб по 1 секунді можуть тримати користувача довше за будь-який розумний deadline, а з власними retries SDK реальна кількість спроб множиться; `Retry-After` ігнорується; 429 через вичерпану квоту повторюються; side effects tool calls не захищені. Переписана policy: повторювати лише 408, 429 (крім помилок квоти чи оплати), 500, 502, 503, 504 і 529; exponential backoff з full jitter і межею 8 секунд; дотримуватися `Retry-After`; щонайбільше 4 спроби загалом і загальний deadline 20 секунд на запит користувача; вимкнути retries SDK або врахувати їх у budget; idempotency keys для tools із side effects; логувати кожен retry з причиною.

:::

:::details Розв'язок вправи 3

Без кешування: (8 000 × 3.00 + 600 × 15.00) / 1 000 000 = (24 000 + 9 000) / 1 000 000 = 0.033 USD. З кешуванням: (6 000 × 3.00 + 2 000 × 0.30 + 600 × 15.00) / 1 000 000 = (18 000 + 600 + 9 000) / 1 000 000 = 0.0276 USD. За місяць: 30 000 × 3 = 90 000 запитів; 90 000 × 0.0276 = 2 484 USD з кешуванням (2 970 USD без).

:::

:::details Розв'язок вправи 4

Test cases: (1) нормальний stream збирається в повний текст, TTFT і загальний час записуються; (2) stream, що обірвався до фінальної події, не показується і не зберігається як повний, а користувач бачить опцію повторити; (3) stop reason `max_tokens` у фінальній події запускає обробку truncation; (4) stream з delta виклику tool збирається в повний tool call до виконання; (5) коли користувач закриває чат, server припиняє читати stream; (6) usage записується з фінальної події, а відсутність usage логується для перерваних streams; (7) подія помилки provider посеред stream обробляється як API error; (8) повільні streams, що впираються в read timeout між подіями, коректно перериваються. Використовуйте записані послідовності подій, відтворені через stream handler, як у прикладі assembler.

:::

:::details Розв'язок вправи 5

`retrieved_chunk_ids` показує, які chunks policy бачила модель: якщо там є ID старого chunk, index не оновився. `timestamp` каже, чи виклик стався до чи після оновлення policy і reindex. `prompt_template.version` і `model` виключають prompt чи модель як причини. `output_text` підтверджує, що саме процитовано. Якщо старий chunk не був отриманий, модель вигадала стару policy з training data чи історії розмови, і `messages_hash` разом зі збереженою історією розмови допомагає підтвердити, що було в context.

:::

## Підсумок

- LLM application — це переважно детерміноване software навколо ймовірнісних викликів моделі; тестуйте це software звичайними техніками.
- Chat APIs мають одну форму: messages з ролями, parameters, контент, stop reason і usage. Нормалізуйте відмінності providers на межі системи.
- Кожен stop reason потребує явної обробки й тесту; обрізаний output ніколи не має віддаватися як повний.
- Streaming потребує тестів на переривання, частковий structured output, пізні дані usage і вимірювання latency.
- Повторюйте лише retryable помилки, з backoff, jitter, лімітами й deadlines; захищайте side effects; тестуйте з fake clock.
- Cost — атрибут якості: вимірюйте його на запит, на розмову і на розв'язану задачу.
- Записуйте модель, версію, версію prompt, parameters, ідентифікатори context, stop reason, usage і latency для кожного виклику.
