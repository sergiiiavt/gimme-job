# Структуровані відповіді та їх перевірка

Вільний текст пишуть для людей. Щойно output моделі читає code — щоб маршрутизувати ticket, заповнити форму, записати рядок у базу чи викликати tool, — він стає інтерфейсом між двома програмами, і йому потрібен контракт: schema, що визначає валідний output, і validation, що щоразу її забезпечує. Цей chapter показує, як спроєктувати такий контракт, як забезпечити його validation pipeline, що також виправляє і безпечно відступає на fallback, чим допомагають нативні structured outputs providers і де їхня допомога закінчується, а також які test cases потрібні кожному structured output.

**Передумови:** [Анатомія LLM-застосунку та API](/learn/llm?topic=llm-application-anatomy), [Промпти як артефакти, які можна тестувати](/learn/llm?topic=prompts-as-artifacts).

## Коли потрібна структурована відповідь

Вимагайте structured output щоразу, коли результат споживає code:

| Споживач | Приклад в асистенті Stride | Структура |
|---|---|---|
| Логіка маршрутизації | Направити ticket до billing, returns чи technical support | Enum `category`, integer `priority` |
| User interface | Показати відповідь з клікабельними джерелами | Текст `answer` плюс масив source IDs |
| Запис у базу | Зберегти витягнуту адресу доставки | Object з типізованими полями адреси |
| Tool call | Знайти замовлення | Arguments відповідно до input schema tool |
| Наступний крок моделі | Передати витягнуті claims до judge | Масив рядків-claims |

Витягувати значення з вільного тексту регулярними виразами постфактум крихко: формулювання змінюються між runs, версіями prompt і моделями. Запит структури заздалегідь переводить проблему з парсингу прози у validation даних, а це вирішена інженерна задача.

## Проєктування контракту відповіді

Schema — це API contract між моделлю та вашим code. Проєктуйте її з тією самою ретельністю:

- **Мінімальність.** Кожне поле — те, що модель може зробити неправильно. Питайте лише те, що використовує споживач.
- **Enums замість вільного тексту** для всього, що керує логікою. `"category": "returns"` тестується; `"category": "клієнт хоче щось повернути"` — ні.
- **Представимість «невідомо».** Якщо модель може не знати значення, дозвольте `null` або явне `"other"` / `"unknown"`. Інакше schema змушує модель його вигадати.
- **Обмежуйте все.** Максимальні довжини рядків, числові діапазони й розміри масивів захищають UI і базу та роблять можливими boundary tests.
- **Посилайтеся на inputs через ID.** Citations мають бути IDs retrieved chunks, а не назвами вільним текстом, щоб code міг їх перевірити.
- **Відокремлюйте reasoning від результату.** Якщо просите пояснення, виділіть йому окреме поле і ніколи випадково не показуйте його користувачам.
- **Версіонуйте schema.** Зміна schema — breaking зміна інтерфейсу для кожного споживача і кожного збереженого запису.

Наскрізний приклад — object triage для повідомлень клієнтів:

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

Використані тут keywords покривають більшість реальних schemas:

| Keyword | Значення |
|---|---|
| `type` | JSON-тип значення; список на кшталт `["string", "null"]` дозволяє кілька |
| `properties` | Schema кожного іменованого поля |
| `required` | Поля, що мають бути присутні (присутнє зі значенням `null` — усе одно присутнє) |
| `additionalProperties: false` | Інших полів, крім перелічених, не дозволено |
| `enum` | Значення має бути одним із перелічених |
| `minimum`, `maximum` | Числові межі |
| `maxLength`, `minLength` | Межі довжини рядка |
| `pattern` | Регулярний вираз, якому має відповідати рядок |
| `items`, `minItems`, `maxItems` | Schema і розмір масивів |

### Рев'ю слабкої schema

`{"type": "object", "properties": {"category": {"type": "string"}, "urgent": {"type": "string"}, "details": {"type": "object"}}}` має шість дефектів: `category` — вільний текст, тож code маршрутизації не може на нього покладатися; `urgent` — рядок там, де мається на увазі boolean; `details` — необмежений object, тож проходить будь-що; нічого не `required`, тож `{}` валідний; зайві поля дозволені; і немає лімітів довжини та способу сказати «невідомо».

### Той самий контракт як Pydantic model

У Python контракт зазвичай записують як Pydantic model, що валідує дані й генерує JSON Schema для запитів до provider (запускайте на своїй машині):

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

Зверніть увагу на дві поведінки Pydantic, важливі для тестів. За замовчуванням Pydantic **приводить** сумісні типи, тож `"priority": "2"` стає integer 2; використовуйте strict mode, якщо контракт вимагає справжніх integers. А значення enum **чутливі до регістру**: `"Returns"` не проходить, що правильно для контракту, але означає, що треба вирішити, чи нормалізувати регістр перед validation.

## Послідовність перевірки

Надійний споживач output моделі пропускає кожну відповідь через той самий pipeline:

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

- **Семантична validation** перевіряє те, чого не може JSON Schema: що `order_id` справді є в повідомленні клієнта (інакше його вигадано), що `language` відповідає повідомленню, що кожен процитований source ID був серед retrieved chunks, що сума refund не перевищує суму замовлення.
- **Fallback** має бути безпечним і видимим. Для triage безпечний fallback — «category other, потрібна людина»; це коштує трохи ручної роботи, але ніколи впевнено не маршрутизує ticket неправильно. Кожен fallback логується й рахується, бо зростання fallback rate — ранній сигнал regression.

Повна реалізація нижче відповідає діаграмі. Scripted fake model відтворює відповіді, тож кожну гілку можна перевірити без мережі.

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

Кожен рядок — тест однієї гілки. У реальному test suite кожен був би окремим test case з перевіркою результату, кількості викликів моделі та залогованої події.

**Що містить repair prompt.** Друга спроба надсилає початковий запит плюс повідомлення на кшталт: *«Your previous output was invalid: priority must be an integer from 1 to 4. Return only the corrected JSON object.»* Repair prompts добре працюють для помилок формату й погано — для семантичних: модель, що один раз вигадала order ID, часто вигадує інший, як показує останній case. Обмежуйте кількість спроб (зазвичай достатньо одного repair) і рахуйте repair rates у monitoring.

## Вбудована підтримка структурованих відповідей

Сучасні APIs providers можуть обмежити генерацію JSON schema, щоб повернений текст завжди парсився і відповідав структурі schema. Реалізації використовують **constrained decoding**: на кожному кроці tokens, що порушили б schema, виключаються з sampling.

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

Без SDK helpers schema надсилається в тілі запиту: в Anthropic API — у `output_config.format` з `"type": "json_schema"`, в OpenAI Responses API — у `text.format` з `"type": "json_schema"` і `"strict": true`. Strict modes вимагають, щоб кожна property була в `required` (опційні значення виражаються nullable типами), і `additionalProperties: false`.

### Що гарантують нативні structured outputs, а що ні

| Гарантовано (коли генерація завершується нормально) | Не гарантовано |
|---|---|
| Output парситься як JSON | Що значення правильні |
| Структура відповідає schema: назви полів, типи, обов'язкові поля | Семантичні правила: order ID, що є в input, citations, що були retrieved |
| Значення enum зі списку | Однаковий регістр enum у кожного provider (один provider документує, що регістр може змінюватися, тож порівнюйте без урахування регістру) |
| | Обмеження, які provider не підтримує: деякі providers відхиляють або ігнорують keywords на кшталт числових діапазонів чи довжин рядків, тож їх треба перевіряти в code |
| | Повний object, коли генерація зупиняється на ліміті tokens |
| | Object відповідно до schema, коли модель відмовляє |

Отже, нативний structured output прибирає більшість збоїв парсингу, що цінно, але validation pipeline вище лишається: семантичні перевірки, перевірки довжин і діапазонів, які provider не забезпечує, обробка refusal і truncation та fallback.

Ще одне міркування для evaluation: дослідження повідомляли, що жорсткі обмеження формату можуть знижувати якість reasoning на деяких задачах порівняно з вільними відповідями. Якщо переводите наявну feature на constrained output, запускайте повну evaluation якості, а не лише перевірку parse rate.

### Tool calling як structured output

До появи нативних structured outputs стандартною технікою було визначити tool, чия input schema — це бажаний output, і змусити модель його викликати. Це досі працює з кожним provider, що підтримує tool calling, і до arguments tools застосовуються ті самі правила validation ([Оцінювання агентів і викликів інструментів](/learn/llm?topic=agent-testing)).

## Обрізана або некоректно сформована відповідь

Два різні збої спершу виглядають однаково: JSON не парситься. Вони потребують різної обробки.

- **Обрізаний output** виникає, коли генерація досягає максимальної довжини output. Stop reason каже `max_tokens` (або `length`), а помилка парсингу — в кінці тексту. Виправлення — більший ліміт або менший запитаний output, а не repair prompt.
- **Malformed output** повний, але невалідний: trailing commas, одинарні лапки, неекрановані символи, коментарі. Він іде на крок repair (або не виникає з нативним structured output).

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

При **streaming** JSON неповний до останньої події. Валідуйте лише зібраний object. Якщо UI потребує живого preview, використовуйте parser, розроблений для часткового JSON, і вважайте preview недовіреним, доки фінальна validation не пройде.

## Обов’язкові тестові сценарії для структурованої відповіді

Використовуйте schema як checklist. Для object triage:

| Група | Test cases |
|---|---|
| Валідні outputs | Типовий object; кожне значення enum хоча б раз; `order_id` і null, і присутній |
| Межі | `priority` 1 і 4 (валідні), 0 і 5 (невалідні); `summary` з 280 символів (валідний) і 281 (невалідний); порожній summary |
| Типи | `"priority": "2"` (рядок), `"needs_human": "false"` (рядок), `"priority": true` (boolean у контракті не integer), `2.0` |
| Структура | Відсутнє кожне обов'язкове поле; одне зайве поле; масив замість object; вкладений object там, де очікується рядок |
| Кодування і синтаксис | Проза до і після JSON; Markdown fence; trailing comma; одинарні лапки; неекранована лапка в рядку; український текст та emoji в рядках |
| Truncation | Output, обрізаний у кількох місцях, зі stop reason `max_tokens` |
| Семантика | `order_id`, якого немає в повідомленні; мова не відповідає повідомленню; category суперечить явним ключовим словам у повідомленні |
| Поведінка моделі | Refusal; порожня відповідь; повторний невалідний output, що веде до fallback |
| Операційне | Кожен repair, fallback і refusal логується й рахується |

Цю таблицю покривають два види тестів:

- **Unit tests pipeline** на записаних чи synthetic сирих outputs (як у прикладі вище). Вони запускаються на кожен commit, не потребують моделі й мають покривати кожен рядок.
- **Evaluation outputs моделі** на позначеному dataset з вимірюванням schema validity rate, repair rate, fallback rate і точності кожного поля.

Сильне доповнення для pipeline — property-based testing: згенеруйте багато валідних objects зі schema і перевірте, що validator приймає всі, потім мутуйте їх і перевірте, що він відхиляє мутації (запускайте на своїй машині):

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

Валідний object усе ще може бути неправильним. На позначеному evaluation set вимірюйте точність кожного поля, точність запису цілком і помилки, найважливіші для бізнесу:

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

Показуйте всі три погляди. Точність полів тут виглядає прийнятною, але цілком правильна лише третина записів, а одна пропущена escalation може важити більше за всі інші помилки разом. Acceptance criteria для structured outputs мають явно називати дорогу помилку, наприклад «не більше 1% пропущених escalations».

Виправлення однієї дорогої помилки часто створює іншу. Якщо змінити модель так, щоб вона завжди ставила `needs_human` у true для priority 3 і 4, пропущена escalation вище зникне, але cases з priority 3 чи 4, яким не потрібна людина, ескалюватимуться зайво. Вимірюйте rate хибних escalations (ручне навантаження) поруч із rate пропущених escalations і погоджуйте прийнятний компроміс з бізнесом перед зміною правила.

## Приклад проєкту

Метод цього chapter реалізований і покритий тестами в [examples/llm-testing/06-structured-output](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/06-structured-output): Pydantic контракт, повний validation pipeline на 19 записаних сирих outputs, property tests, згенеровані з JSON Schema, звіт точності по полях і опційний live check нативного structured output. Усі тести працюють offline, без моделі та API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/06-structured-output
```

## Типові помилки

- **Парсити регулярними виразами** замість того, щоб просити структуру.
- **Довіряти нативному structured output у правильності**, пропускаючи семантичну validation і перевірки, які provider не забезпечує.
- **Вважати truncation malformed відповіддю** і відправляти її в repair prompt.
- **Необмежені repair loops**, що множать cost і latency.
- **Небезпечні fallbacks**, що впевнено вгадують значення замість escalation.
- **Забувати, що `bool` у Python — це `int`**, тож `True` проходить перевірку на integer.
- **Показувати лише schema validity rate**, який нічого не каже про правильність значень.

## Підсумок

- Коли output моделі споживає code, output потребує контракту: мінімальної, обмеженої, версіонованої schema з enums для логіки і явним способом сказати «невідомо».
- Валідуйте кожну відповідь pipeline: extract, parse, нормалізація нешкідливого дрейфу, validation schema, семантична validation, обмежена кількість repair і безпечний та видимий fallback.
- Нативні structured outputs providers прибирають більшість збоїв парсингу, але не семантичні помилки, непідтримувані обмеження, truncation чи refusals.
- Розрізняйте обрізаний output (збільшити ліміт) і malformed output (repair).
- Тестуйте кожну гілку pipeline записаними outputs, fuzz-тестуйте його property-based tests і оцінюйте модель точністю по полях та rates помилок, критичних для бізнесу.
