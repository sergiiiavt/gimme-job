Неможливо добре тестувати те, що не розумієш, як побудувати. Цей chapter розбирає частини типового LLM application і для кожної частини показує testing seam — місце, де можна спостерігати, контролювати або підмінити поведінку.

Наприкінці в тебе буде невеликий **support bot** як system under test. Він робить retrieval по папці документів і викликає один tool. Кожен наступний chapter тестує саме цей bot.

## 1. Анатомія LLM feature

Production LLM feature — це переважно звичайне software навколо одного non-deterministic виклику:

```text
user input
  -> input validation та guardrails
  -> context assembly (system prompt, history, retrieved documents, tool definitions)
  -> model call (provider SDK, parameters, retries, timeouts)
  -> output parsing та validation (schema, policy checks)
  -> tool execution loop (опційно)
  -> post-processing, rendering, logging, tracing
  -> user
```

Імовірнісний лише model call. Усе інше можна і треба тестувати звичайними deterministic тестами. Типова помилка — оцінювати весь pipeline end-to-end через LLM judge, коли базовий parsing і validation code не має жодного unit test.

## 2. Prompts — це code

Prompt — це виконувана конфігурація. Стався до нього як до code:

- зберігай prompts у файлах під version control, а не в string literals по всьому codebase;
- давай кожному prompt identifier і версію;
- рев'юй diffs prompts у pull requests;
- записуй версію prompt у logs і traces;
- запускай evals перед merge зміни prompt.

Базові техніки prompt engineering, які треба впізнавати під час тестування:

| Техніка | Призначення | Типовий bug |
|---|---|---|
| System prompt / role | Задає persona, правила і межі | Правила ігноруються в довгих розмовах |
| Чіткі delimiters (XML tags, fenced sections) | Відділяють інструкції від даних | User data з delimiter ламає структуру |
| Few-shot examples | Показують очікуваний формат і судження | Модель копіює зміст прикладів у реальні відповіді |
| Step-by-step reasoning | Покращує багатокрокові задачі | Reasoning протікає в user-facing output; більша latency |
| Інструкції формату output | Просять JSON, Markdown, ліміти довжини | Формат дотримується здебільшого, але не завжди |
| Prompt templates зі змінними | Повторне використання з динамічним input | Відсутні чи неекрановані змінні, injection через змінні |

## 3. Structured output

Вільний текст важко тестувати. Скрізь, де application програмно використовує output моделі, вимагай **structured output**:

- provider JSON mode або schema-constrained output, де доступно;
- schema в code (наприклад Pydantic у Python чи Zod у TypeScript);
- сувора validation кожної відповіді з чітким failure path.

```python
from pydantic import BaseModel, Field

class TicketTriage(BaseModel):
    category: str = Field(pattern="^(billing|technical|account|other)$")
    priority: int = Field(ge=1, le=4)
    summary: str = Field(max_length=280)
    needs_human: bool
```

Що це дає тестуванню:

- schema validity стає дешевим deterministic assertion для кожного eval case;
- тестуй поведінку application, коли validation падає: retry, fallback, повідомлення про помилку;
- перевіряй enum drift («Billing» vs «billing»), відсутні optional fields і зайві fields.

## 4. Tool calling (function calling)

Модель не виконує code. Вона повертає запит на кшталт «виклич `get_order_status` з `{"order_id": "A-1042"}`». Application виконує tool і повертає результат новим повідомленням.

Testing seams у tool call:

- **Selection:** чи вибрала модель правильний tool, чи взагалі tool?
- **Arguments:** чи валідні вони за schema і чи правильні за змістом?
- **Execution:** чи безпечно tool обробляє невалідні, відсутні чи шкідливі arguments?
- **Result handling:** чи модель чесно використовує результат tool, включно з помилками та порожніми результатами?
- **Authorization:** чи може tool діяти лише від імені поточного користувача? Запит моделі — це untrusted input.

## 5. Retrieval-augmented generation (RAG)

RAG дає моделі свіжі або приватні знання під час запиту:

```text
offline:  documents -> chunking -> embeddings -> vector index
online:   question -> (rewrite) -> retrieve top-k chunks -> (rerank) -> prompt з context -> answer з citations
```

Кожна стрілка — test target. Chapter 5 глибоко тестує RAG. Поки що збери найпростішу версію:

1. розбий Markdown files на chunks за заголовками;
2. зроби embedding кожного chunk і збережи в локальний vector store (Chroma, pgvector або in-memory list);
3. діставай top 4 chunks за cosine similarity;
4. проінструктуй модель відповідати лише з наданого context і цитувати chunk IDs.

## 6. Agents і Model Context Protocol

**Agent** — це цикл, у якому модель вирішує наступну дію, спостерігає результат і продовжує, доки не вирішить, що завершила:

```text
while not done and steps < limit:
    decision = model(context)
    if decision is a tool call: run tool, append result
    else: done = True
```

Agents додають нові ризики: нескінченні цикли, накопичення помилок, стрибки cost і реальні side effects. Chapter 6 присвячений тестуванню agents. Див. також [AI agents & MCP](/learn/agentic).

**Model Context Protocol (MCP)** — відкритий протокол для надання tools, resources і prompts LLM applications через MCP servers. З погляду тестування MCP server — це API з контрактом: tool schemas, поведінка при помилках і permission boundaries.

## 7. Provider call: надійність

Model call — це remote dependency. Тестуй його відповідно:

- timeouts і retries з backoff на rate limits (HTTP 429) та server errors;
- streaming responses: частковий output, перервані streams, відключення клієнта;
- token limits: занадто довгий input, обрізаний output;
- outages provider і fallback models;
- облік cost і tokens.

## 8. Mock моделі в unit tests

Unit tests мають бути швидкими, безкоштовними і детермінованими. Не викликай у них реальну модель.

Варіанти:

| Підхід | Як | Для чого |
|---|---|---|
| Fake client | Inject client, що повертає заскриптовані відповіді | Parsing, routing, retry logic, контроль tool loop |
| Record and replay | Один раз записати реальні HTTP interactions, потім відтворювати (наприклад vcrpy cassettes) | Regression tests integration code |
| Contract fixtures | Зберігати реальні форми provider responses як JSON fixtures | Тестування SDK upgrades і edge cases: tool calls, refusals |

```python
class FakeLLM:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def complete(self, messages, **params):
        self.calls.append({"messages": messages, "params": params})
        return self.responses.pop(0)


def test_invalid_json_triggers_one_retry_then_fallback():
    llm = FakeLLM(["not json", "still not json"])
    result = triage_ticket("My card was charged twice", llm=llm)
    assert result.category == "other"
    assert result.needs_human is True
    assert len(llm.calls) == 2
```

Mocks тестують **твій code**, а не якість моделі. Якість моделі — це робота evals (chapters 3–5).

## 9. Case study: AI service GimmeJob

Learning Path Advisor у GimmeJob — реальний приклад цієї анатомії. Він знаходиться в директорії `ai-service` цього repository:

- **FastAPI** надає HTTP endpoints;
- **LangGraph** відповідає за orchestration як явний workflow: contextualize розмову, retrieve, вибрати grounded чи general composition, потім перевірити source attribution і зв'язність map;
- **LangChain** працює з моделлю, messages і structured output;
- retrieval іде в один canonical RAG pipeline у Cloudflare Worker: Vectorize для semantic search і lexical fallback;
- **Langfuse** записує traces, retrieved IDs, token usage і deterministic quality scores.

Зверни увагу на testing seams: кроки workflow явні, retrieval — окремий сервіс зі своїми metrics, output структурований і перевірений до того, як дійде до користувача. Python tests у `ai-service/tests` покривають ці кроки окремо.

## 10. QA quick reference

- Спочатку намалюй pipeline. Познач, які кроки deterministic.
- Покривай кожен deterministic крок unit tests з fake model.
- Валідуй кожен structured output за schema.
- Стався до tool requests моделі як до untrusted input.
- Версіонуй prompts і логуй версію з кожним викликом.
- Тестуй timeouts, 429, обірвані streams і provider fallback.

## 11. Practice

Збери system under test для решти path.

1. Створи папку з 15–30 Markdown документів для вигаданого продукту: pricing, refunds, shipping, account management.
2. Збери support bot, який дістає top 4 chunks і відповідає з citations.
3. Додай один tool `get_order_status(order_id)` з fake in-memory таблицею замовлень.
4. Повертай structured output: `answer`, `citations`, `used_tool`, `needs_human`.
5. Напиши offline unit tests з fake model для parsing, tool routing і retry behaviour.

**Exit check:** bot працює end-to-end з реальною моделлю, а його unit tests проходять з вимкненою мережею.

## Sources

- [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Pydantic documentation](https://docs.pydantic.dev/)
- [vcrpy — record and replay HTTP interactions](https://github.com/kevin1024/vcrpy)
- [GimmeJob — learning content discovery and canonical RAG](https://github.com/sergiiiavt/gimme-job/blob/main/docs/LEARNING-RAG.md)
