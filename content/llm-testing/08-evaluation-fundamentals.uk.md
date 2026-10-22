# Методологія оцінювання та набори даних

**Оцінювання (evaluation, eval)** — відтворюване вимірювання якості функції на основі LLM. Воно поєднує набір випадків, систему, засоби оцінювання відповідей і правило рішення. Модульні тести з імітаціями перевіряють навколишній код, а оцінювання — поведінку моделі в продукті.

Починайте з критеріїв успіху й аналізу помилок, а не з довільної метрики. Розділ охоплює дані, розмітку, узгодженість, перенавчання, витік відповідей, запуск і читання результатів. Далі розглянуто [програмні оцінювачі](/learn/llm?topic=code-based-scorers), [LLM як оцінювач](/learn/llm?topic=model-graded-evaluation) і [статистику](/learn/llm?topic=eval-statistics).

**Передумови:** [Чим особливе тестування LLM](/learn/llm?topic=llm-testing-problem-space), [Тестування коду LLM-застосунку без моделі](/learn/llm?topic=testing-without-the-model).

## Тести й оцінювання

| Аспект | Класичний тест | Evaluation |
|---|---|---|
| Очікуваний результат | Один точний oracle | Правило оцінювання: assertion, metric, rubric або human label |
| Результат | Pass або fail | Вердикт для кожного case, агрегований у rates по зрізах |
| Детермінованість | Очікується стабільність | Варіація між запусками нормальна, її треба вимірювати |
| Мета | Довести, що вимога виконується | Виміряти якість, порівняти версії, впіймати regressions |
| Розмір | Один case на поведінку | Від десятків до тисяч cases на поведінку |

Кожен evaluation має ті самі п'ять частин:

```text
evaluation = dataset      cases: inputs plus what is needed to judge them (facts, labels, references, tags)
           + task         the system under test, called the same way as in production
           + scorers      code, model judges or people, each returning a verdict with a reason
           + aggregation  pass rates overall and per slice, with their uncertainty
           + decision     a rule fixed in advance that turns results into ship, block or investigate
```

## Цикл оцінювання

Evaluation — не фаза в кінці проєкту. Це цикл, який починається ще до першого prompt і триває в production:

```diagram
1. Success criteria    What must be true for users and the business?
        ↓
2. Error analysis      Read real outputs; name and count what goes wrong
        ↓
3. Dataset             Cases that represent real use and the failures found
        ↓
4. Scorers             One check for each criterion and failure category
        ↓
5. Baseline            Run the current version; it is the reference
        ↓
6. Iterate             Change prompts, models or retrieval; compare with the baseline
        ↓
7. Gate and monitor    Run in CI, sample production; new failures return to step 2
```

Така робота називається eval-driven development. Цикл починається знову щоразу, коли змінюється продукт, модель чи користувачі.

## Критерії успіху

Критерій, який можна оцінити, називає, що має бути правдою, як це вимірюють, поріг і пріоритет ([Чим особливе тестування LLM](/learn/llm?topic=llm-testing-problem-space) показує, як виводити критерії з ризиків). Для support assistant, що проходить через увесь курс:

| Критерій | Чим вимірюють | Поріг |
|---|---|---|
| Правильно називає політику повернень і refunds | Scorer за фактами на 300 питаннях про політику | Щонайменше 95% |
| Частка відповідей із вигаданими правилами | Модель-оцінювач, перевірена за людськими оцінками | Не більше 1% |
| Відповідає мовою клієнта | Перевірений визначник мови й аналіз його помилок | 100% |
| Шукає замовлення, коли дано його номер | Перевірка tool calls у trace | Щонайменше 98% |

Надавайте перевагу **бінарним критеріям**, pass або fail, а не оцінкам від 1 до 5. Двоє рецензентів рідко погоджуються, чи відповідь — це 3 чи 4, середня оцінка приховує, що саме не так, а pass rate легко відстежувати. Якщо якість має кілька аспектів, напишіть окремий бінарний критерій для кожного.

## Аналіз помилок

Error analysis — крок, який більшість команд пропускає, і саме він вирішує, чи вимірюватиме evaluation щось корисне. Він запозичує дві техніки з якісних досліджень:

1. **Зберіть traces:** 100 або більше реальних чи реалістичних inputs, кожен із повним trace: input, retrieved context, tool calls, output.
2. **Open coding:** прочитайте кожен trace і напишіть коротку довільну нотатку про першу річ, що пішла не так. Помилки вище за потоком спричиняють помилки нижче, тож нотуйте неправильний retrieval, а не неправильну відповідь, яку він спричинив.
3. **Axial coding:** згрупуйте нотатки в невелику таксономію збоїв із чіткими назвами, що не перетинаються.
4. **Порахуйте й розставте пріоритети:** як часто трапляється кожна категорія, з урахуванням того, якої шкоди вона завдає.
5. **Дійте:** перетворіть головні категорії на scorers і cases у dataset.

Призначте відповідального експерта предметної області для узгодження критеріїв і розбіжностей. Читайте нові трасування, доки вони не перестануть відкривати нові категорії: це називають **насиченням (saturation)**.

```python
from collections import Counter

# Reading 40 traces of the support assistant: (trace, failure category, or None when nothing was wrong).
# The categories were not chosen in advance. Free-text notes were written first (open coding)
# and then grouped into a short list (axial coding).
reviewed = [
    ("t01", None), ("t02", "invented policy"), ("t03", "missing citation"), ("t04", None),
    ("t05", "too long"), ("t06", "invented policy"), ("t07", None), ("t08", "missed order lookup"),
    ("t09", "missing citation"), ("t10", None), ("t11", None), ("t12", "too long"),
    ("t13", "wrong language"), ("t14", None), ("t15", "missing citation"), ("t16", None),
    ("t17", "invented policy"), ("t18", None), ("t19", "missed order lookup"), ("t20", None),
    ("t21", "missing citation"), ("t22", None), ("t23", "too long"), ("t24", None),
    ("t25", None), ("t26", "invented policy"), ("t27", None), ("t28", "missing citation"),
    ("t29", None), ("t30", None), ("t31", "too long"), ("t32", None),
    ("t33", "missed order lookup"), ("t34", None), ("t35", "missing citation"), ("t36", None),
    ("t37", None), ("t38", "invented policy"), ("t39", None), ("t40", None),
]
SEVERITY = {"invented policy": 3, "missed order lookup": 3, "wrong language": 2, "missing citation": 2, "too long": 1}

failures = Counter(category for _, category in reviewed if category)
print(f"{sum(failures.values())} of {len(reviewed)} traces have a problem")
print("category              traces  severity  priority")
for category, count in sorted(failures.items(), key=lambda item: -item[1] * SEVERITY[item[0]]):
    print(f"{category:<21} {count:>6}  {SEVERITY[category]:>8}  {count * SEVERITY[category]:>8}")

seen, first_seen = set(), []
for position, (_, category) in enumerate(reviewed, 1):
    if category and category not in seen:
        seen.add(category)
        first_seen.append(position)
print("new categories appeared at traces", first_seen, "and none in the last", len(reviewed) - first_seen[-1])
```

Результат:

```text
19 of 40 traces have a problem
category              traces  severity  priority
invented policy            5         3        15
missing citation           6         2        12
missed order lookup        3         3         9
too long                   4         1         4
wrong language             1         2         2
new categories appeared at traces [2, 3, 5, 8, 13] and none in the last 27
```

Найчастіша проблема, відсутні citations, — не найважливіша: вигадані політики трапляються рідше, але шкодять більше. Кожна категорія також підказує свій інструмент. Вигадана політика потребує scorer за фактами або валідованого judge; пропущений пошук замовлення — це детермінована перевірка tool calls у trace; «задовго» — підрахунок слів. Загальний score «helpfulness» із framework не виміряв би жодної з них.

## Побудова набору даних для оцінювання

Dataset має відображати реальне використання, містити відомі вам збої та покривати важливі зрізи. Кожне джерело дає щось своє:

| Джерело | Що дає | На що зважати |
|---|---|---|
| Вибірки production traffic | Реальну суміш запитів і формулювань | Персональні дані; домінують прості часті запити |
| Збої з error analysis та інцидентів | Cases, які точно ламаються | Лише минулі збої; додавайте їх, але не будуйте лише з них |
| Edge cases | Порожні, дуже довгі, змішані за мовою, неоднозначні inputs | Можуть відірватися від реального використання |
| Adversarial cases | Prompt injection, jailbreaks, запити не за темою | Належать до окремого security suite |
| Синтетичні cases | Покриття рідкісних комбінацій | Неприродні формулювання; кожен case потребує перевірки |

Зберігайте один case у рядку версіонованого файлу. Крім input, case містить те, що потрібно його scorers, і tags, за якими зрізають результати:

```json
{"id": "refunds-0042", "input": "Can I return shoes after 40 days?", "expected_facts": ["return-window-30-days", "counted-from-delivery"], "forbidden": ["promises-exception"], "tags": {"lang": "en", "intent": "returns", "difficulty": "policy-boundary"}, "source": "production-2026-09", "added": "2026-10-02"}
```

Скрипт будує dataset із production log за чотири кроки:

```python
import hashlib
import random
import re
from collections import Counter, defaultdict

rng = random.Random(42)
QUESTIONS = {
    "returns": ["Can I return shoes after {n} days?", "How do I send back order A-{order}?"],
    "delivery": ["Where is my parcel A-{order}?", "Order A-{order} is {n} days late"],
    "refunds": ["When will I get my refund for A-{order}?", "Refund A-{order} to {email} please"],
    "account deletion": ["Delete my account {email}, last order A-{order}"],
}
SHARES = {"returns": 0.45, "delivery": 0.30, "refunds": 0.20, "account deletion": 0.05}

# 2,000 logged messages; one in five repeats an earlier one (retries, the same question again)
log = []
for i in range(2000):
    if log and rng.random() < 0.2:
        log.append({**rng.choice(log), "id": f"req-{i:04d}"})
        continue
    intent = rng.choices(list(SHARES), weights=list(SHARES.values()))[0]
    text = rng.choice(QUESTIONS[intent]).format(n=rng.randint(1, 90), order=rng.randint(1000, 9999),
                                                 email=f"user{rng.randint(1, 5000)}@mail.example")
    log.append({"id": f"req-{i:04d}", "intent": intent, "text": text})

# 1. Remove personal data before anything is stored in the dataset
EMAIL = r"[\w.+-]+@[\w-]+\.[\w.]+"
for entry in log:
    entry["text"] = re.sub(EMAIL, "<email>", entry["text"])

# 2. Drop duplicates after normalization: they add cost, not information
unique, seen = [], set()
for entry in log:
    key = " ".join(entry["text"].lower().split())
    if key not in seen:
        seen.add(key)
        unique.append(entry)
print(f"{len(log)} logged messages, {len(unique)} after removing duplicates")

# 3. Stratified sample: proportional to traffic, but at least 10 cases for every intent
target, minimum = 120, 10
by_intent = defaultdict(list)
for entry in unique:
    by_intent[entry["intent"]].append(entry)
sample = []
for intent, entries in by_intent.items():
    size = max(round(target * len(entries) / len(unique)), minimum)
    sample += rng.sample(entries, size)
    print(f"{intent:<17} {len(entries):>4} in the log, {size:>3} in the sample")


# 4. Stable split: a case always lands in the same split, whatever the order of the file
def split(case_id: str) -> str:
    return "test" if int(hashlib.sha256(case_id.encode()).hexdigest(), 16) % 100 < 30 else "dev"


print(f"{len(sample)} cases:", dict(Counter(split(case["id"]) for case in sample)))
print("scrubbed example:", next(case["text"] for case in sample if "<email>" in case["text"]))
```

Результат:

```text
2000 logged messages, 1320 after removing duplicates
delivery           506 in the log,  46 in the sample
refunds            311 in the log,  28 in the sample
returns            424 in the log,  39 in the sample
account deletion    79 in the log,  10 in the sample
123 cases: {'dev': 87, 'test': 36}
scrubbed example: Refund A-7388 to <email> please
```

Навіщо кожен крок:

- **Персональні дані прибирають першими,** тож вони ніколи не потрапляють у dataset, історію його версій чи звіти на його основі.
- **Дублікати спотворюють результати.** Третина цього log повторює інші запити; інакше одна неправильна відповідь на популярне питання рахувалася б десятки разів. Майже-дублікати (те саме питання з дрібними змінами формулювання) потребують перевірки схожості, яку реалізує приклад проєкту.
- **Суто пропорційна вибірка обділяє рідкісні зрізи.** Видалення акаунта — приблизно 6% трафіку, і на нього припало б 7 cases; з мінімумом 10 його pass rate може принаймні показати обвал. Показуйте зрізи окремо, бо загальний rate зважує їх за розміром вибірки, а не за важливістю.
- **Розбиття за hash стабільне.** Додавання cases чи перемішування файлу ніколи не переносить case між development set і test set.

Правила, щоб dataset лишався корисним:

- **Версіонуйте його** поруч із prompts і scorers, а версію dataset зберігайте з кожним результатом.
- **Позначайте кожен case tags** за мовою, наміром, складністю і джерелом, щоб результати можна було зрізати.
- **Поповнюйте його з кожним збоєм у production** і прибирайте cases, які вже не відображають продукт.
- **Документуйте його:** звідки cases, як їх позначали і які відомі прогалини, у дусі datasheets for datasets.

## Синтетичні приклади й покриття

Вибірки з production пропускають рідкісні комбінації: розлючений клієнт, що ставить два питання українською, може не з'явитися за місяць logs. Синтетичні cases закривають такі прогалини, якщо їх генерують систематично: виберіть виміри, що змінюють поведінку, виберіть комбінації їхніх значень, згенеруйте inputs для кожної комбінації моделлю і перевірте кожен згенерований case.

Попарне покриття дозволяє перевірити кожну пару значень меншою кількістю випадків. Воно корисне для помилок взаємодії двох чинників, але не гарантує виявлення складніших взаємодій.

```python
from itertools import combinations, product

DIMENSIONS = {
    "persona": ["new customer", "regular customer", "angry customer"],
    "intent": ["return", "refund", "delivery"],
    "language": ["en", "uk"],
    "difficulty": ["simple", "ambiguous", "two questions"],
}
names = list(DIMENSIONS)
every_tuple = list(product(*DIMENSIONS.values()))


def pairs_of(values):
    return {((names[i], values[i]), (names[j], values[j])) for i, j in combinations(range(len(values)), 2)}


uncovered = set().union(*(pairs_of(values) for values in every_tuple))
print(f"all combinations: {len(every_tuple)}, value pairs to cover: {len(uncovered)}")

chosen = []
while uncovered:
    best = max(every_tuple, key=lambda values: len(pairs_of(values) & uncovered))
    chosen.append(best)
    uncovered -= pairs_of(best)

print(f"cases that cover every pair of values: {len(chosen)}")
for values in chosen[:5]:
    print("  " + " | ".join(values))
```

Результат:

```text
all combinations: 54, value pairs to cover: 45
cases that cover every pair of values: 9
  new customer | return | en | simple
  new customer | refund | uk | ambiguous
  regular customer | return | uk | two questions
  regular customer | delivery | en | ambiguous
  angry customer | refund | en | two questions
```

Дев'ять комбінацій покривають кожну пару, яку покрили б 54. Кожна комбінація стає короткою інструкцією для моделі-генератора («напиши повідомлення розлюченого постійного клієнта, який ставить два питання про refund, українською»), зазвичай із кількома inputs на комбінацію. Людина перевіряє кожен згенерований case, перш ніж він потрапить у dataset: згенерований текст зазвичай чистіший і явніший за реальні повідомлення, а модель не повинна бути єдиним суддею cases, які сама написала.

## Розмітка та еталонні відповіді

Що case зберігає як очікуваний результат, залежить від задачі:

| Очікуваний результат | Підходить для | Чим оцінюють |
|---|---|---|
| Точний label | Класифікація, маршрутизація, extraction | Exact match, classification metrics |
| Очікувані й заборонені факти | Вільні відповіді про відомі факти | Scorers за фактами |
| Еталонна відповідь | Переклад, переписування, summarization | Metrics перетину чи схожості, обережно |
| Нотатки для оцінювання | Відкриті відповіді | Валідований judge або людина |

Labels потребують письмових інструкцій із прикладами граничних cases. Щоб дізнатися, чи інструкції працюють, дайте двом людям позначити ту саму вибірку і виміряйте їхню узгодженість. Сира узгодженість вводить в оману, коли один label рідкісний, тож стандартна міра, **каппа Коена**, віднімає узгодженість, очікувану випадково:

```text
observed agreement   p_o = share of cases with the same label
chance agreement     p_e = Σ over labels of (share of reviewer 1) · (share of reviewer 2)
Cohen's kappa        κ = (p_o − p_e) / (1 − p_e)        1 = perfect, 0 = no better than chance
```

```python
from collections import Counter

# Two reviewers label the same 30 answers as P (pass) or F (fail)
reviewer_1 = "PPPPFPPPPPPPFPPPPPPPPPFPPPPPPP"
reviewer_2 = "PPPPFPPPPPPFPPPPPPPPPPPPPPPPPF"


def cohen_kappa(a: str, b: str) -> tuple[float, float, float]:
    """Observed agreement, agreement expected by chance from each reviewer's label shares, and kappa."""
    n = len(a)
    observed = sum(x == y for x, y in zip(a, b)) / n
    shares_a, shares_b = Counter(a), Counter(b)
    expected = sum(shares_a[label] * shares_b[label] for label in shares_a) / n**2
    return observed, expected, (observed - expected) / (1 - expected)


observed, expected, kappa = cohen_kappa(reviewer_1, reviewer_2)
both_fail = sum(x == y == "F" for x, y in zip(reviewer_1, reviewer_2))
print(f"raw agreement {observed:.0%}, agreement expected by chance {expected:.0%}, kappa {kappa:.2f}")
print(f"failures found: reviewer 1 {reviewer_1.count('F')}, reviewer 2 {reviewer_2.count('F')}, both {both_fail}")
```

Результат:

```text
raw agreement 87%, agreement expected by chance 82%, kappa 0.26
failures found: reviewer 1 3, reviewer 2 3, both 1
```

Узгодженість 87% звучить добре, але двоє рецензентів, які позначають майже все як pass, погоджуються так часто випадково. Каппа 0.26 показує головне: з п'яти відповідей, які хтось позначив як fail, рецензенти погоджуються щодо однієї. Перш ніж позначати сотні cases, обговоріть саме ці розбіжності, уточніть критерій і приклади та виміряйте знову. Та сама міра потім валідує model judges проти human labels ([LLM як оцінювач](/learn/llm?topic=model-graded-evaluation)).

## Поділ вибірок, перенавчання й витік даних

- **Development і test sets.** Ітеруйте над prompts на development set; test set, відкладений окремо, використовуйте для рішень і рідко дивіться на його окремі cases. Коли score на development зростає, а на test — ні, prompt підігнано під cases development.
- **Few-shot приклади, взяті з evaluation cases,** завищують scores: модель уже бачила відповіді. Тримайте приклади в prompts і evaluation cases у множинах, що не перетинаються, і перевіряйте перетин автоматично.
- **Contamination.** Публічні benchmarks і їхні відповіді можуть бути частиною training data моделі під тестом, що робить scores на них ненадійними. Приватні cases, побудовані з вашого продукту, значно менш вразливі; оновлюйте їх із часом.
- **Metric, яка стала ціллю, перестає вимірювати.** Коли команда оптимізує одне число, регулярно читайте вибірки outputs, щоб переконатися, що число досі означає те саме.

## Рівні перевірок

Перевірка належить до найдешевшого рівня, який може виконати її надійно:

```diagram
            /  production monitoring  \      live traffic, online scorers, user feedback
           /     human review          \     expert labels on samples
          /   model-graded evaluation   \    LLM-as-a-judge validated against people
         /  reference-based metrics      \   facts, overlap, retrieval metrics
        /  deterministic assertions       \  schema, patterns, length, citations, cost, latency
       /  unit tests with a fake model     \ parsing, routing, retries, tool loops
```

Нижчі рівні дешеві, швидкі й відтворювані; вищі — дорогі й шумні, але ближчі до того, що відчувають користувачі. Ніколи не питайте model judge, чи output — валідний JSON, і ніколи не довіряйте judge, якого не порівняли з human labels.

## Запуск оцінювання

Запуск evaluation — це експеримент. Записуйте достатньо, щоб його відтворити і пояснити результати:

| Що записати | Навіщо |
|---|---|
| Версію dataset і ID cases | Щоб точно знати, що виміряли |
| ID моделі, версію prompt і параметри | Щоб точно знати, що оцінювали |
| Версії scorers | Результати порівнянні лише за тих самих scorers |
| Сирі outputs і traces | Щоб переоцінити без повторного запуску моделі й прочитати збої |
| Seeds, мітки часу, вартість і latency | Щоб відтворити запуск і стежити за бюджетом |

Практичні правила для harness:

- **Відокремлюйте генерацію від оцінювання.** Зберігайте outputs один раз, а оцінюйте їх стільки разів, скільки змінюються scorers.
- **Керуйте кешем свідомо.** Ключ враховує модель, промпт, параметри й запит. Повторне використання відповіді економить кошти, але не є новою незалежною вибіркою генерації.
- **Запускайте cases паралельно в межах rate limits provider** і повторюйте лише тимчасові помилки ([Анатомія LLM-застосунку та API](/learn/llm?topic=llm-application-anatomy)).
- **Тримайте запуски незмінними.** Запуск, який переоцінили чи частково перегенерували, — це новий запуск.

## Фреймворки оцінювання

Frameworks дають datasets, runners, кешування, вбудовані scorers, звіти та інтеграцію з CI. Поняття цього chapter стосуються їх усіх:

| Інструмент | Стиль | Коли підходить |
|---|---|---|
| promptfoo | Конфігурація YAML і runner у командному рядку; assertions від перевірки підрядка до власного code і model graders | Порівняння prompts і моделей у CI |
| DeepEval | Test cases і metrics у стилі pytest | Команди, чиї тести вже живуть у pytest |
| Inspect AI | Python tasks із datasets, solvers і scorers; sandboxes для agents | Evaluations agents і можливостей |
| OpenAI Evals | Реєстр шаблонів evaluations і benchmarks | Evaluations у стилі benchmark |
| Платформи на кшталт Braintrust, Langfuse чи Phoenix | Datasets, експерименти й production traces з інтерфейсом для перегляду | Команди, яким потрібні анотування і tracing в одному місці |

Конфігурація promptfoo для двох cases про повернення, що порівнює дві версії prompt:

```yaml
description: Support assistant, refund policy
prompts:
  - file://prompts/support-answer/v13.txt
  - file://prompts/support-answer/v14.txt
providers:
  - id: anthropic:messages:claude-sonnet-5-5   # pin the exact model you ship
    config:
      temperature: 0
tests:
  - vars:
      question: Can I return shoes after 40 days?
    assert:
      - type: icontains
        value: 30 days
      - type: not-icontains
        value: exception
  - vars:
      question: Чи можна повернути взуття через 40 днів?
    assert:
      - type: icontains
        value: 30 днів
      - type: llm-rubric
        value: Answers in Ukrainian and says that the 30 days start at delivery
```

Та сама перевірка як task Inspect AI:

```python
# Run on your own machine: pip install inspect-ai
# then: inspect eval refunds.py --model anthropic/claude-sonnet-5-5
from inspect_ai import Task, task
from inspect_ai.dataset import Sample
from inspect_ai.scorer import includes
from inspect_ai.solver import generate, system_message


@task
def refunds():
    return Task(
        dataset=[Sample(input="Can I return shoes after 40 days?", target="30 days")],
        solver=[system_message("You are the support assistant of an online shoe store."), generate()],
        scorer=includes(),
    )
```

Оберіть один framework для offline evaluations, тримайте власні scorers звичайними функціями, які можна протестувати окремо, і уникайте вбудованих metrics, визначення яких не можете пояснити.

## Читання результатів: показники й зміни вердиктів

Результат — це порівняння з baseline, а не одне число. Агрегат — найменш інформативна його частина:

```python
from collections import defaultdict

# Per-case verdicts of the baseline (prompt v2) and the candidate (prompt v3) on the same 12 cases
cases = {
    "c01": ("en", True, True), "c02": ("en", False, True), "c03": ("en", True, True),
    "c04": ("en", False, True), "c05": ("en", True, True), "c06": ("en", True, True),
    "c07": ("en", False, False), "c08": ("en", True, True), "c09": ("uk", True, False),
    "c10": ("uk", True, True), "c11": ("uk", True, False), "c12": ("uk", True, True),
}

baseline = sum(old for _, old, _ in cases.values()) / len(cases)
candidate = sum(new for _, _, new in cases.values()) / len(cases)
print(f"pass rate: baseline {baseline:.0%}, candidate {candidate:.0%}, change {candidate - baseline:+.0%}")

fixed = [case for case, (_, old, new) in cases.items() if new and not old]
broken = [case for case, (_, old, new) in cases.items() if old and not new]
print(f"fixed (fail to pass): {fixed}")
print(f"broken (pass to fail): {broken}")

by_slice = defaultdict(lambda: [0, 0, 0])
for lang, old, new in cases.values():
    by_slice[lang][0] += old
    by_slice[lang][1] += new
    by_slice[lang][2] += 1
for lang, (old, new, total) in sorted(by_slice.items()):
    print(f"lang={lang}: baseline {old}/{total}, candidate {new}/{total}")
```

Результат:

```text
pass rate: baseline 75%, candidate 75%, change +0%
fixed (fail to pass): ['c02', 'c04']
broken (pass to fail): ['c09', 'c11']
lang=en: baseline 5/8, candidate 7/8
lang=uk: baseline 4/4, candidate 2/4
```

«Без змін» приховує два виправлення і два нові збої, обидва українською. Прочитайте кожен case, що змінив вердикт, перш ніж схвалити зміну: такі cases показують, що зміна насправді зробила, а скупчення змін в одному зрізі — це regression, навіть коли середнє не змінилося. Чи більша різниця за шум — питання статистики ([Статистика для оцінювання](/learn/llm?topic=eval-statistics)).

## Приклад проєкту

Метод цього chapter реалізований і покритий тестами в [examples/llm-testing/08-evaluation-methodology](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/08-evaluation-methodology): звіт error analysis із пріоритетами й насиченням, builder dataset, що прибирає персональні дані, дублікати й майже-дублікати, робить вибірку по зрізах і розбиває за hash, validator dataset, що знаходить помилки schema, повторені ID, перетин між розбиттями і тонкі зрізи, pairwise-генератор специфікацій синтетичних cases, звіт про узгодженість labels і runner evaluation із кешем відповідей, manifest запуску та scorecard cases, що змінили вердикт. Усі тести працюють offline, без моделі та API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/08-evaluation-methodology
```

## Типові помилки

- **Вибирати metrics до того, як прочитали outputs,** що дає загальні scores, які пропускають реальні збої.
- **Шкали від 1 до 5 без опорних прикладів** замість бінарних критеріїв із прикладами.
- **Dataset із простих частих cases,** який показує високий pass rate і нічого не каже про рідкісні зрізи.
- **Дублікати й персональні дані в dataset.**
- **Синтетичні cases, які ніхто не перевірив.**
- **Labels без інструкцій чи перевірки узгодженості.**
- **Налаштовувати prompts на test set** або копіювати few-shot приклади з evaluation cases.
- **Незаписані запуски:** без версій dataset, prompt, моделі чи scorer поруч із результатами.
- **Схвалювати зміну за середнім,** не прочитавши cases, що змінили вердикт.

## Підсумок

- Оцінювання поєднує дані, завдання, оцінювачі, зведення результатів і заздалегідь визначене правило рішення.
- Починайте з критеріїв і аналізу помилок: читайте трасування, групуйте збої, враховуйте частоту та наслідки.
- Поєднуйте робочі запити, відомі збої, граничні й перевірені синтетичні приклади. Контролюйте приватність, повтори, групи й поділ даних.
- Генеруйте приклади за важливими вимірами; попарне покриття скорочує кількість комбінацій.
- Задавайте очікування за типом завдання, пишіть правила розмітки й вимірюйте узгодженість каппою Коена.
- Зберігайте незалежну контрольну вибірку й не копіюйте її відповіді до промптів.
- Записуйте запуски, відокремлюйте генерацію від оцінювання, аналізуйте групи й змінені вердикти.
