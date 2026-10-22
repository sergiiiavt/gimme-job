# Структуровані відповіді та їх перевірка

Коли відповідь моделі використовує програма — маршрутизує звернення, записує дані чи викликає інструмент — потрібен контракт. Схема визначає допустимі дані, а перевірка забезпечує її виконання. Розділ пояснює проєктування контракту, послідовність перевірок, обмежені виправлення й безпечний резервний шлях.

**Передумови:** [Анатомія LLM-застосунку та API](/learn/llm?topic=llm-application-anatomy), [Промпти як артефакти, які можна тестувати](/learn/llm?topic=prompts-as-artifacts).

## Коли потрібна структурована відповідь

Вимагайте структури, якщо результат використовує код:

| Споживач | Приклад в асистенті Stride | Структура |
|---|---|---|
| Маршрутизація | Оплата, повернення, технічна підтримка | Перелік `category`, ціле число `priority` |
| Інтерфейс | Відповідь із посиланнями | `answer` і масив ID джерел |
| База даних | Адреса доставки | Типізований об’єкт |
| Інструмент | Пошук замовлення | Аргументи за вхідною схемою |
| Наступний виклик моделі | Твердження для оцінювання | Масив тверджень |

Видобування даних із довільної прози крихке: формулювання змінюються. Задана структура переводить частину проблеми в перевірку даних за контрактом.

## Проєктування контракту відповіді

Проєктуйте схему як API між моделлю й кодом:

- **Мінімальність:** лише поля, які потрібні споживачу.
- **Переліки значень для логіки:** `"category": "returns"` має однозначний маршрут, на відміну від вільного опису.
- **Явне «невідомо»:** `null`, `"other"` або `"unknown"` замість вимоги вигадати значення.
- **Межі:** довжини, числові діапазони й розміри масивів.
- **Посилання через ID:** джерело має бути серед знайдених фрагментів.
- **Окреме пояснення:** визначте, чи можна показувати його користувачу.
- **Версії:** зміни можуть порушувати сумісність споживачів і записів.

Приклад — класифікація й маршрутизація звернення:

```json
{
  "type": "object",
  "properties": {
    "category": {"type": "string", "enum": ["billing", "technical", "account", "returns", "other"]},
    "priority": {"type": "integer", "minimum": 1, "maximum": 4},
    "summary": {"type": "string", "maxLength": 280},
    "needs_human": {"type": "boolean"},
    "order_id": {"type": ["string", "null"], "pattern": "^A-[0-9]{4}$"},
    "language": {"type": "string", "enum": ["en", "uk"]}
  },
  "required": ["category", "priority", "summary", "needs_human", "order_id", "language"],
  "additionalProperties": false
}
```

Ключові слова JSON Schema:

| Ключове слово | Значення |
|---|---|
| `type` | JSON-тип значення; список на кшталт `["string", "null"]` дозволяє кілька |
| `properties` | Схема кожного іменованого поля |
| `required` | Поля, що мають бути присутні (присутнє зі значенням `null` — усе одно присутнє) |
| `additionalProperties: false` | Інших полів, крім перелічених, не дозволено |
| `enum` | Значення має бути одним із перелічених |
| `minimum`, `maximum` | Числові межі |
| `maxLength`, `minLength` | Межі довжини рядка |
| `pattern` | Регулярний вираз, якому має відповідати рядок |
| `items`, `minItems`, `maxItems` | Схема елементів і межі кількості |

### Рецензування недостатньої схеми

Схема `{"type": "object", "properties": {"category": {"type": "string"}, "urgent": {"type": "string"}, "details": {"type": "object"}}}` допускає довільну категорію, рядок замість логічної терміновості й необмежені `details`. Немає обов’язкових полів, заборони зайвих полів, меж і способу позначити невідоме.

### Контракт як модель Pydantic

Модель Pydantic перевіряє дані й генерує JSON Schema. Приклад для локального запуску:

```python
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError


class TicketTriage(BaseModel):
    model_config = ConfigDict(extra="forbid")            # additionalProperties: false

    category: Literal["billing", "technical", "account", "returns", "other"]
    priority: int = Field(ge=1, le=4)
    summary: str = Field(min_length=1, max_length=280)
    needs_human: bool
    order_id: str | None = Field(default=None, pattern=r"^A-\d{4}$")
    language: Literal["en", "uk"]


schema = TicketTriage.model_json_schema()               # send this to the provider

raw = '{"category": "Returns", "priority": "2", "summary": "Return request", "needs_human": false, "order_id": null, "language": "en"}'
try:
    TicketTriage.model_validate_json(raw)
except ValidationError as error:
    print(error)                                         # category: input should be 'billing', 'technical', ...
```

Pydantic може перетворювати сумісні типи: `"2"` стає числом 2. Суворий режим забороняє небажані перетворення. Переліки чутливі до регістру; якщо потрібна нормалізація, визначте її явно.

## Послідовність перевірки

Перевіряйте кожну відповідь однаковою послідовністю:

```diagram
raw model text
   │
   ▼
extract ── find the JSON object (models sometimes add prose or a Markdown fence)
   │
   ▼
parse ── json.loads; on failure: truncated (stop reason max_tokens) or malformed
   │
   ▼
normalize ── repair harmless drift only: enum casing, surrounding whitespace
   │
   ▼
schema validation ── types, required fields, enums, ranges, lengths, patterns, no extra fields
   │
   ▼
semantic validation ── rules a schema cannot express: agreement with the input and between fields
   │
   ├── valid ──► accept, log
   │
   └── invalid ──► repair: call the model again with the validation errors (bounded attempts)
                      │
                      └── still invalid ──► fallback: safe default + escalate + log
```

Два кроки варто підкреслити:

- **Зміст:** ID є в повідомленні, мова визначена правильно, посилання було в контексті, сума повернення не перевищує замовлення.
- **Резервний шлях:** категорія `other` і передавання людині безпечніші за впевнене вгадування. Записуйте такі переходи й стежте за їх часткою.

Імітація моделі повертає задані відповіді, щоб перевірити гілки без мережі.

```python
import json
import re

CATEGORIES = {"billing", "technical", "account", "returns", "other"}
LANGUAGES = {"en", "uk"}
FIELDS = {"category", "priority", "summary", "needs_human", "order_id", "language"}
FALLBACK = {"category": "other", "priority": 3, "summary": "Needs manual triage",
            "needs_human": True, "order_id": None, "language": "en"}


def extract_json(text: str) -> str:
    """Models sometimes wrap JSON in prose or a Markdown fence: take the outermost object."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object found")
    return text[start:end + 1]


def normalize(data: dict) -> dict:
    """Repair harmless drift before validating: enum casing and surrounding spaces."""
    fixed = dict(data)
    for key in ["category", "language"]:
        if isinstance(fixed.get(key), str):
            fixed[key] = fixed[key].strip().lower()
    return fixed


def schema_errors(data: dict) -> list[str]:
    errors = []
    if FIELDS - data.keys():
        errors.append(f"missing fields: {sorted(FIELDS - data.keys())}")
    if data.keys() - FIELDS:
        errors.append(f"unexpected fields: {sorted(data.keys() - FIELDS)}")
    if data.get("category") not in CATEGORIES:
        errors.append(f"category must be one of {sorted(CATEGORIES)}")
    priority = data.get("priority")
    if isinstance(priority, bool) or not isinstance(priority, int) or not 1 <= priority <= 4:
        errors.append("priority must be an integer from 1 to 4")     # bool is a subclass of int!
    summary = data.get("summary")
    if not isinstance(summary, str) or not summary.strip() or len(summary) > 280:
        errors.append("summary must be a non-empty string of at most 280 characters")
    if not isinstance(data.get("needs_human"), bool):
        errors.append("needs_human must be true or false")
    order_id = data.get("order_id")
    valid_id = isinstance(order_id, str) and re.fullmatch(r"A-\d{4}", order_id)
    if order_id is not None and not valid_id:
        errors.append("order_id must be null or match A-1234")
    if data.get("language") not in LANGUAGES:
        errors.append("language must be en or uk")
    return errors


def semantic_errors(data: dict, message: str) -> list[str]:
    """Rules a schema cannot express: the output must agree with the input."""
    errors = []
    if data["order_id"] is not None and data["order_id"] not in message:
        errors.append(f"order_id {data['order_id']} does not appear in the message")
    expected_language = "uk" if re.search(r"[а-яіїєґ]", message.lower()) else "en"
    if data["language"] != expected_language:
        errors.append(f"language should be {expected_language}")
    return errors


def parse_and_validate(raw: str, message: str) -> tuple:
    try:
        data = json.loads(extract_json(raw))
    except ValueError as error:                       # JSONDecodeError is a ValueError
        return None, [f"not valid JSON: {error}"]
    if not isinstance(data, dict):
        return None, ["top-level value must be an object"]
    data = normalize(data)
    errors = schema_errors(data) or semantic_errors(data, message)
    return (None if errors else data), errors


def triage(message: str, model, max_attempts: int = 2) -> tuple:
    feedback = []
    for attempt in range(1, max_attempts + 1):
        raw = model(message, feedback)                # feedback goes into the repair prompt
        data, errors = parse_and_validate(raw, message)
        if data is not None:
            return data, f"accepted on attempt {attempt}"
        feedback = errors
    return dict(FALLBACK), f"fallback after {max_attempts} attempts; last errors: {feedback}"


def scripted(*responses):
    """Fake model that returns the scripted responses in order."""
    queue = list(responses)
    return lambda message, feedback: queue.pop(0)


good = '{"category": "returns", "priority": 2, "summary": "Wants to return shoes", "needs_human": false, "order_id": "A-1042", "language": "en"}'
message = "Hi, I want to return my order A-1042, the shoes are too small."
cases = [
    ("clean JSON", scripted(good)),
    ("JSON inside prose and a fence", scripted("Sure! Here it is:\n```json\n" + good + "\n```")),
    ("enum casing drift", scripted(good.replace('"returns"', '"Returns"'))),
    ("priority as a string, then fixed", scripted(good.replace('"priority": 2', '"priority": "2"'), good)),
    ("truncated output, then fixed", scripted(good[:70], good)),
    ("hallucinated order id twice", scripted(good.replace("A-1042", "A-9999"), good.replace("A-1042", "A-7777"))),
]
for name, model in cases:
    data, outcome = triage(message, model)
    print(f"{name:<34} -> {outcome}")
```

Результат:

```text
clean JSON                         -> accepted on attempt 1
JSON inside prose and a fence      -> accepted on attempt 1
enum casing drift                  -> accepted on attempt 1
priority as a string, then fixed   -> accepted on attempt 2
truncated output, then fixed       -> accepted on attempt 2
hallucinated order id twice        -> fallback after 2 attempts; last errors: ['order_id A-7777 does not appear in the message']
```

Для кожної гілки перевіряйте результат, кількість викликів і записану подію.

**Запит на виправлення** додає опис помилки до завдання, наприклад вимогу повернути лише JSON із пріоритетом 1–4. Він може виправити формат, але не доводить змісту: модель здатна замінити вигаданий ID іншим вигаданим. Обмежуйте повтори й рахуйте їх.

## Вбудована підтримка структурованих відповідей

Деякі API підтримують декодування з обмеженнями: токени, що порушують допустиму структуру, виключаються з вибору. Підтримується визначена підмножина JSON Schema.

```python
# Anthropic Messages API with a Pydantic model (run on your own machine)
import os
import anthropic

client = anthropic.Anthropic()
response = client.messages.parse(
    model=os.environ["LLM_MODEL"],
    max_tokens=500,
    system="Classify the customer message for the support team.",
    messages=[{"role": "user", "content": "Hi, I want to return my order A-1042."}],
    output_format=TicketTriage,                    # the Pydantic model defined above
)
if response.stop_reason in ("refusal", "max_tokens"):
    print("no usable output:", response.stop_reason)   # fall back; output may not match the schema
else:
    print(response.parsed_output)
```

```python
# OpenAI Responses API with a Pydantic model (run on your own machine)
import os
from openai import OpenAI

client = OpenAI()
response = client.responses.parse(
    model=os.environ["LLM_MODEL"],
    input=[
        {"role": "system", "content": "Classify the customer message for the support team."},
        {"role": "user", "content": "Hi, I want to return my order A-1042."},
    ],
    text_format=TicketTriage,
)
print(response.output_parsed)                      # None when the model refused; check the refusal item
```

Anthropic приймає схему через `output_config.format`, OpenAI Responses — через `text.format`. Суворий формат OpenAI вимагає всіх полів у `required`, а відсутнє значення представляється через `null`. Anthropic підтримує необов’язкові поля. Обидва режими вимагають `additionalProperties: false` для об’єктів. Не переносіть вимоги одного API на інший.

### Гарантії й межі вбудованої підтримки

| Що забезпечує підтримуваний режим за звичайного завершення | Що перевіряти окремо |
|---|---|
| JSON придатний до розбору | Правильність значень |
| Підтримувана структура й типи | Зв’язок із запитом і джерелами |
| Перелік значень у межах гарантій API | Anthropic документує можливі зміни регістру `enum` і `const`; потрібне явне правило нормалізації |
| | Непідтримувані межі чисел, довжин та інших обмежень |
| | Повнота після досягнення ліміту токенів |
| | Відповідність схемі під час відмови |

Вбудований формат не замінює перевірок змісту, непідтримуваних обмежень, відмов, обривів і резервного шляху.

Зміна формату може вплинути на якість завдання. Оцінюйте кінцеві відповіді, а не лише успішний розбір.

### Виклик інструмента для отримання структури

Схему бажаного результату можна задати як аргументи інструмента. Підтримка примусового вибору залежить від API; аргументи все одно потребують перевірки ([Оцінювання агентів і викликів інструментів](/learn/llm?topic=agent-testing)).

## Обрізана або некоректно сформована відповідь

Невдалий розбір JSON може мати різні причини:

- **Обрив:** `max_tokens` чи `length`. Збільште бюджет або скоротіть потрібний результат.
- **Некоректний синтаксис:** зайві коми, лапки, коментарі чи неекрановані символи. Можлива обмежена спроба виправлення.

```python
import json

complete = '{"category": "returns", "priority": 2, "summary": "Return request"}'
truncated = complete[:48]          # what arrives when generation stops at max_tokens


def diagnose(raw: str, stop_reason: str) -> str:
    try:
        json.loads(raw)
        return "valid JSON"
    except json.JSONDecodeError as error:
        near_end = error.pos >= len(raw.rstrip()) - 1
        if stop_reason == "max_tokens" or near_end:
            return f"truncated output ({error.msg} at position {error.pos}): retry with a larger max_tokens"
        return f"malformed output ({error.msg} at position {error.pos}): send to the repair step"


print(diagnose(complete, "end"))
print(diagnose(truncated, "max_tokens"))
print(diagnose('{"category": "returns", "priority": 2,}', "end"))
```

Результат:

```text
valid JSON
truncated output (Expecting ':' delimiter at position 48): retry with a larger max_tokens
malformed output (Illegal trailing comma before end of object at position 37): send to the repair step
```

У потоці JSON неповний до завершення. Перевіряйте остаточний об’єкт; попередній показ не означає, що дані вже перевірено.

## Обов’язкові тестові сценарії для структурованої відповіді

Виводьте перевірки зі схеми:

| Група | Випадки |
|---|---|
| Коректні | Типовий об’єкт, усі значення переліку, `order_id` і `null` |
| Межі | `priority` 1 і 4 проти 0 і 5; `summary` 280 і 281 символ; порожній рядок |
| Типи | Рядок замість числа чи логічного значення; `true` замість цілого; `2.0` |
| Структура | Пропущене чи зайве поле; неправильне вкладення або тип контейнера |
| Синтаксис | Текст навколо JSON, огорожі Markdown, коми, лапки, Unicode й емодзі |
| Обрив | Різні позиції завершення з `max_tokens` |
| Зміст | Вигаданий ID, неправильна мова чи категорія |
| Модель | Відмова, порожня відповідь, повторна помилка |
| Експлуатація | Запис виправлень, відмов і резервних переходів |

Цю таблицю покривають два види тестів:

- **Модульні тести обробника** на записаних чи синтетичних відповідях для кожної гілки.
- **Оцінювання моделі:** частки відповідності схемі, виправлень, резервних переходів і точність полів.

Генеруйте коректні дані зі схеми й перевіряйте приймання; потім вносьте зміни, які порушують контракт, і перевіряйте відхилення:

```python
# pip install hypothesis hypothesis-jsonschema
from hypothesis import given
from hypothesis_jsonschema import from_schema

SCHEMA = TicketTriage.model_json_schema()


@given(from_schema(SCHEMA))
def test_every_schema_valid_object_is_accepted_by_the_pipeline(obj):
    obj["language"] = "en"                       # keep the semantic language rule satisfied
    obj["order_id"] = None                       # and the order-ID rule
    data, errors = parse_and_validate(json.dumps(obj), message="Hello")
    assert errors == []
```

### Вимірювання точності по полях

Вимірюйте точність кожного поля, повного запису й критичних помилок:

```python
from collections import Counter

# (expected labels from a human, prediction from the model) for six evaluation cases
results = [
    ({"category": "returns", "priority": 2, "needs_human": False, "order_id": "A-1042"},
     {"category": "returns", "priority": 2, "needs_human": False, "order_id": "A-1042"}),
    ({"category": "billing", "priority": 3, "needs_human": True, "order_id": None},
     {"category": "billing", "priority": 2, "needs_human": True, "order_id": None}),
    ({"category": "technical", "priority": 1, "needs_human": False, "order_id": None},
     {"category": "account", "priority": 1, "needs_human": False, "order_id": None}),
    ({"category": "returns", "priority": 3, "needs_human": True, "order_id": "A-2001"},
     {"category": "returns", "priority": 3, "needs_human": False, "order_id": "A-2001"}),
    ({"category": "account", "priority": 2, "needs_human": False, "order_id": None},
     {"category": "account", "priority": 2, "needs_human": False, "order_id": None}),
    ({"category": "billing", "priority": 4, "needs_human": True, "order_id": "A-3310"},
     {"category": "returns", "priority": 4, "needs_human": True, "order_id": "A-3310"}),
]

fields = ["category", "priority", "needs_human", "order_id"]
for field in fields:
    correct = sum(expected[field] == predicted[field] for expected, predicted in results)
    print(f"{field:<12} accuracy {correct}/{len(results)} = {correct / len(results):.0%}")

exact = sum(expected == predicted for expected, predicted in results)
print(f"whole record exactly right: {exact}/{len(results)}")

confusion = Counter((expected["category"], predicted["category"]) for expected, predicted in results)
print("category errors (expected -> predicted):",
      {f"{pair[0]} -> {pair[1]}": count for pair, count in confusion.items() if pair[0] != pair[1]})

# The costly error for the business: a case that needed a human but was not escalated
missed_escalations = sum(expected["needs_human"] and not predicted["needs_human"] for expected, predicted in results)
print(f"missed escalations: {missed_escalations}")
```

Результат:

```text
category     accuracy 4/6 = 67%
priority     accuracy 5/6 = 83%
needs_human  accuracy 5/6 = 83%
order_id     accuracy 6/6 = 100%
whole record exactly right: 2/6
category errors (expected -> predicted): {'technical -> account': 1, 'billing -> returns': 1}
missed escalations: 1
```

Висока точність окремих полів може приховати малу частку повністю правильних записів. Пропущене передавання людині може бути особливо дорогим; задайте для нього окремий критерій.

Зменшення пропусків може збільшити зайві передавання людині. Вимірюйте обидві частки й погоджуйте компроміс із потребами продукту.

## Приклад проєкту

Метод реалізований і покритий тестами в [examples/llm-testing/06-structured-output](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/06-structured-output): Pydantic, 19 записаних відповідей, генерування даних зі схеми й точність полів. Основні тести працюють без мережі, моделі та ключів API:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/06-structured-output
```

## Типові помилки

- **Видобувати структуру з довільного тексту**, коли можна задати контракт.
- **Плутати правильний формат із правильним змістом.**
- **Плутати обрив із синтаксичною помилкою.**
- **Не обмежувати спроби виправлення.**
- **Вгадувати на резервному шляху.**
- **Не враховувати `bool` як підклас `int`:** `isinstance(True, int)` істинне, але контракт може вимагати відрізняти ці значення.
- **Звітувати лише про схему**, не про значення.

## Підсумок

- Програмному споживачу потрібна мінімальна версіонована схема з межами й явним невідомим значенням.
- Поєднуйте розбір, перевірку схеми й змісту, обмежені виправлення та безпечний резервний шлях.
- Вбудований формат має обмеження й винятки.
- Причину обриву перевіряйте окремо від синтаксису.
- Перевіряйте обробник і властивості даних окремо від точності моделі.
