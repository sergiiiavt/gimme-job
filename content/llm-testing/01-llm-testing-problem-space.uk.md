# Чим особливе тестування LLM

Тестування software, що використовує large language model (LLM), ламає кілька припущень, на яких тримається класичний test design. Той самий input може дати різні outputs. Неправильна відповідь звучить так само впевнено і гладко, як правильна. Очікуваний результат часто не одне значення, а простір прийнятних відповідей. А поведінка може змінитися без жодної зміни у вашому code, бо змінилися модель, prompt, retrieved data або інфраструктура provider.

Цей chapter точно формулює проблему. Він вводить типи test oracles, що працюють для generative output, характеристики якості, які ви вимірюватимете, і lifecycle, у якому відбувається тестування LLM. Подальші chapters з evaluation та testing спираються на ці визначення.

**Prerequisites:** базові поняття тестування (test basis, test oracle, test levels) з [QA fundamentals](/reference/qa-fundamentals) і достатньо Python, щоб читати короткі скрипти. Також див. [Огляд генеративного AI та LLM](/learn/llm?topic=generative-ai-overview) і [Як LLM генерують текст](/learn/llm?topic=llm-foundations).

## Що ми називаємо LLM system

**Large language model** — це нейронна мережа, натренована передбачати наступний token тексту. У цьому курсі «модель» завжди означає саме цей компонент: набір weights, доступний через API у provider або на вашій інфраструктурі.

**LLM system** (або LLM application) — це software, побудоване навколо одного чи кількох викликів моделі. Воно включає prompts, збирання context, retrieval, tools, parsing output, guardrails, user interface, logging і дані, які читає система. **LLM feature** — одна можливість цієї системи для користувача, наприклад «відповідати на питання про return policy».

```diagram
User and business outcome        (did the customer get a correct, safe answer?)
          ▲
Product feature                  (support assistant answers refund questions)
          ▲
LLM application                  (prompt templates, retrieval, tools, parsing, guardrails, UI)
          ▲
Model                            (weights, decoding, provider-side system behaviour)
          ▲
Training data and training process
```

Кожен рівень має своїх тестувальників і свої питання:

| Рівень | Типове питання | Хто зазвичай відповідає | Типове evidence |
|---|---|---|---|
| Model | Наскільки модель здатна до reasoning, coding чи певної мови? | Model provider, research teams | Публічні benchmarks, model cards, red-team звіти |
| Application | Чи наш prompt, retrieval і parsing дають правильний output для наших inputs? | Product engineering і QA | Evaluation datasets, scorers, unit та integration tests |
| Feature | Чи feature відповідає acceptance criteria і лімітам ризику? | QA, product owner | Acceptance criteria з thresholds, regression results |
| Outcome | Чи користувачам справді допомагає і чи нікому не шкодить? | Product, analytics, QA | Production monitoring, feedback, дані incidents |

Більшість тестувальників працює на рівнях application і feature. Weights моделі ви контролюєте рідко, але майже все інше — так: яку модель і версію викликати, prompts, дані для retrieval, tools, validation output і monitoring у production. Саме там живе більшість дефектів, і саме на цьому фокусується курс.

## Чим LLM features відрізняються від звичайних

Таблиця порівнює звичайну feature, наприклад калькулятор ціни, з LLM feature — асистентом, що відповідає на питання про ціни природною мовою.

| Вимір | Звичайна feature | LLM feature |
|---|---|---|
| Специфікація | Точні правила: «знижка 10% понад 100 EUR» | Відкритий намір: «відповідай корисно і правильно» |
| Простір output | Малий і структурований: число | Практично нескінченний: будь-який текст |
| Детермінізм | Той самий input — той самий output | Той самий input може дати різні outputs |
| Типовий збій | Exception, неправильне число, crash | Правдоподібна, гладка, але неправильна чи небезпечна відповідь |
| Що змінює поведінку | Code і конфігурація | Code, prompt, версія моделі, retrieved data, tools, інфраструктура provider |
| Покриття inputs | Equivalence partitions малого простору inputs | Семантичний простір усіх формулювань користувачів |
| Вартість test run | Зазвичай мізерна | Реальні гроші та секунди на виклик |

З цього випливають три наслідки, що формують решту курсу:

- **Точні очікувані значення рідко працюють.** Потрібні інші типи oracles (наступний розділ).
- **Один run — це вибірка, а не вердикт.** Cases треба запускати повторно і міркувати про rates (див. [Статистика для evaluation](/learn/llm?topic=eval-statistics)).
- **Поведінка може дрейфувати без зміни code.** Версії треба фіксувати й записувати, а тестування продовжувати в production (див. [Якість у production](/learn/llm?topic=production-quality)).

## Проблема test oracle

**Test oracle** — джерело, за яким ви вирішуєте, чи спостережуваний результат правильний. У класичному тесті oracle зазвичай — очікуване значення в тесті: `assert total == 90.0`.

Для generative output це не працює. Попросіть модель стиснути дві сторінки support ticket — правильних summaries тисячі. Немає одного рядка для порівняння, а summary може бути частково правильним: чотири правильні факти й один вигаданий. Це *oracle problem*, давно відома в дослідженнях тестування для програм, правильний output яких важко обчислити, і це центральна проблема тестування LLM.

Тестування LLM замінює одне очікуване значення комбінацією слабших oracles. Кожен перевіряє частину правильності, а разом вони дають корисну впевненість.

| Тип oracle | Що перевіряє | Приклад | Сильна сторона | Слабка сторона |
|---|---|---|---|---|
| Property (specified constraint) | Правила, яким має відповідати кожен правильний output | Output — валідний JSON; містить order ID; до 80 слів | Дешево, детерміновано, точно | Лише частково: валідний output усе ще може бути неправильним |
| Reference-based | Близькість до відомої хорошої відповіді чи її фактів | Відповідь містить факт «30-day return window» | Добре для фактичних задач | Потрібні позначені references; формулювання варіюються |
| Model-based (LLM-as-a-judge) | Друга модель оцінює за rubric | «Чи кожен claim підтверджений текстом policy? PASS або FAIL» | Масштабує семантичне судження | Judge сам є моделлю і потребує валідації |
| Human judgement | Експерти позначають outputs | Support lead позначає відповіді як прийнятні чи ні | Ground truth для суб'єктивних критеріїв | Повільно, дорого, може бути неконсистентно |
| Metamorphic relation | Як outputs мають співвідноситися для змінених inputs | Перефразоване питання має дати ті самі факти | Не треба знати правильну відповідь | Виявляє неконсистентність, а не неправильність |
| Differential (comparative) | Порівняння output з іншою версією | Новий prompt проти поточного, pairwise оцінка | Прямо відповідає на «чи стало краще?» | Нічого не каже про абсолютну якість |

### Розібраний приклад: property oracles для однієї відповіді

Нехай вимога така: *«Відповіді про повернення мають називати 30-day return window, не обіцяти більше, ніж дозволяє policy, вкладатися в 80 слів і містити посилання на сторінку повернень.»* Кожна частина стає property check. Жоден з них не доводить, що відповідь хороша, але кожен дешево ловить клас поганих відповідей.

```python
import re

RETURN_WINDOW_DAYS = 30
MAX_WORDS = 80


def check_refund_answer(answer: str) -> list[str]:
    """Return the properties this answer violates. An empty list means every check passed."""
    violations = []
    text = answer.lower()
    if f"{RETURN_WINDOW_DAYS} days" not in text and f"{RETURN_WINDOW_DAYS}-day" not in text:
        violations.append("does not state the 30-day return window")
    if re.search(r"\b(guarantee[sd]?|always|no questions asked)\b", text):
        violations.append("promises more than the policy allows")
    if len(answer.split()) > MAX_WORDS:
        violations.append(f"longer than {MAX_WORDS} words")
    if "stride.example/returns" not in text:
        violations.append("does not link to the returns page")
    return violations


candidates = [
    "You can return unworn shoes within 30 days of delivery for a full refund. "
    "Start a return at https://stride.example/returns.",
    "Of course! Refunds are guaranteed for every purchase, no questions asked.",
    "Our return policy gives you a 30-day window. " + "We value every customer. " * 20
    + "Details: https://stride.example/returns",
]

for number, answer in enumerate(candidates, start=1):
    problems = check_refund_answer(answer)
    verdict = "PASS" if not problems else "FAIL: " + "; ".join(problems)
    print(f"answer {number}: {verdict}")
```

Output:

```text
answer 1: PASS
answer 2: FAIL: does not state the 30-day return window; promises more than the policy allows; does not link to the returns page
answer 3: FAIL: longer than 80 words
```

Зверніть увагу, чого ці перевірки не можуть. Відповідь «протягом 30 днів від *покупки*», коли policy каже «від *доставки*», проходить усі чотири перевірки й усе одно неправильна. Щоб це зловити, потрібен reference-based або model-based oracle, що порівнює відповідь із текстом policy. Саме тому реальні evaluation suites комбінують кілька типів oracles.

## Джерела варіативності

Коли LLM feature сьогодні дає інший результат, ніж учора, відповідальне одне з цих джерел:

| Джерело | Механізм | Наслідок для test design |
|---|---|---|
| Sampling | Модель семплює tokens з probability distribution; при temperature вище 0 різні runs вибирають різні tokens | Запускайте кожен case кілька разів і вимірюйте rates |
| Inference non-determinism | Навіть при temperature 0 арифметика GPU, batching і різне обладнання можуть змінити результат | Ніколи не розраховуйте на фіксований output навіть при «детермінованих» налаштуваннях |
| Версія моделі | Provider випускає новий snapshot або alias на кшталт «latest» переїжджає | Фіксуйте точні версії; перед перемиканням проганяйте suite |
| Prompt і конфігурація | Хтось редагує prompt, parameter або опис tool | Версіонуйте prompts як code і оцінюйте кожну зміну |
| Retrieved context | Змінюється index документів, і retrieval повертає інші chunks | Записуйте retrieved IDs у traces; фіксуйте context для regression tests |
| Tools і зовнішні дані | APIs повертають різні дані з часом | Використовуйте fakes і записані відповіді в тестах |
| Стан розмови | Попередні turns, memory чи профіль користувача змінюють context | Явно тестуйте multi-turn сценарії та межі стану |

Model drift — не гіпотеза. Відоме дослідження 2023 року виміряло ті самі API-версії моделей з інтервалом три місяці й знайшло великі зміни поведінки на кількох задачах ([Chen, Zaharia and Zou](https://arxiv.org/abs/2307.09009)). Providers тепер пропонують зафіксовані snapshots саме для того, щоб ви контролювали, коли зміна до вас доходить.

### Діагностика зміни без deployment

Коли відповідь змінилася, хоча ніхто не деплоїв code, порівняйте traces хорошого і поганого run поле за полем:

| Evidence у traces | Що означає різниця |
|---|---|
| Той самий input, відповіді чергуються при повторах | Варіативність sampling: вимірюйте rate замість судження за одним run |
| Інша версія моделі чи serving fingerprint | Оновлення в provider або alias моделі, що переїхав |
| Інші retrieved chunk IDs | Змінився index документів |
| Інша версія prompt | Prompt змінили поза code release, наприклад у prompt-management tool |
| Інша історія розмови чи профіль користувача | Поведінка залежить від стану |
| Інші результати tools | Зовнішня система повернула інші дані |

Кожен рядок потребує traces, що записують версії та context, тому [Якість у production](/learn/llm?topic=production-quality) розглядає tracing як передумову тестування.

### Чому один успішний run — слабке evidence

Якщо feature правильна з імовірністю `p` на кожному незалежному run, то ймовірність, що `k` ручних спроб усі виглядатимуть правильними, дорівнює `p` у степені `k`. Скрипт нижче показує, як легко дефектна feature проходить швидку ручну перевірку і як спостережуваний pass rate наближається до справжнього лише після багатьох runs.

```python
import random

# Probability that k independent manual tries all look correct
for p_correct in [0.95, 0.9, 0.7]:
    for tries in [3, 5]:
        print(f"feature correct {p_correct:.0%} of the time -> {tries} tries all pass with probability {p_correct ** tries:.2f}")

# Estimating the real rate from repeated runs of a feature that is correct 90% of the time
rng = random.Random(42)
true_rate = 0.9
for runs in [10, 100, 1000, 10000]:
    passed = sum(rng.random() < true_rate for _ in range(runs))
    print(f"{runs:>5} runs: observed pass rate {passed / runs:.3f}")
```

Output:

```text
feature correct 95% of the time -> 3 tries all pass with probability 0.86
feature correct 95% of the time -> 5 tries all pass with probability 0.77
feature correct 90% of the time -> 3 tries all pass with probability 0.73
feature correct 90% of the time -> 5 tries all pass with probability 0.59
feature correct 70% of the time -> 3 tries all pass with probability 0.34
feature correct 70% of the time -> 5 tries all pass with probability 0.17
   10 runs: observed pass rate 1.000
  100 runs: observed pass rate 0.900
 1000 runs: observed pass rate 0.894
10000 runs: observed pass rate 0.904
```

Feature, що помиляється раз на десять, частіше проходить п'ять ручних спроб, ніж ні, а в цій симуляції навіть десять runs показали ідеальний результат. Твердження про якість LLM features — це твердження про rates, а rates потребують вибірок. Наступний підрозділ показує, скільки runs потребують такі твердження, а [Статистика для evaluation](/learn/llm?topic=eval-statistics) — як додати до них error bars і порівнювати версії.

### Скільки runs потрібно, щоб побачити рідкісний збій?

Та сама арифметика відповідає на питання планування: скільки незалежних runs потрібно, щоб хоча б раз побачити збій? Якщо feature ламається з імовірністю `q` на run, то ймовірність не побачити жодного збою за `n` runs дорівнює `(1 − q)^n`. Вимога побачити збій з імовірністю щонайменше 95% дає `n ≥ log(0.05) / log(1 − q)`.

```python
import math

# How many independent runs are needed to see at least one failure with 95% probability,
# if the feature fails with probability q on each run?  Solve 1 - (1 - q) ** n >= 0.95.
for q in [0.2, 0.05, 0.01]:
    n = math.ceil(math.log(0.05) / math.log(1 - q))
    print(f"failure rate {q:.0%}: need {n} runs")

p_correct = 0.8
print(f"80%-correct feature passes 4 manual checks with probability {p_correct ** 4:.2f}")
```

Output:

```text
failure rate 20%: need 14 runs
failure rate 5%: need 59 runs
failure rate 1%: need 299 runs
80%-correct feature passes 4 manual checks with probability 0.41
```

Рідкісні збої потребують багатьох runs, щоб з'явитися хоча б раз. Тому evaluation datasets мають сотні cases, а production monitoring обов'язковий.

## Характеристики якості LLM features

Щоб щось тестувати, спершу треба сказати, що означає «добре». Характеристики нижче ви вимірюватимете впродовж курсу. Вони розширюють класичну модель якості software ISO/IEC 25010; ISO/IEC 25059 адаптує цю модель для AI систем.

| Характеристика | На яке питання відповідає | Приклад збою | Типове evidence |
|---|---|---|---|
| Task success (correctness) | Чи output правильно виконав задачу? | Неправильно обчислена сума refund | Reference checks, judges, human labels |
| Faithfulness (groundedness) | Чи кожен claim підтверджений наданими джерелами? | Відповідь цитує пункт policy, якого не існує | Claim-level judge проти retrieved context |
| Relevance | Чи output відповідає на те, що питали? | Правильні факти про доставку, коли питали про повернення | Relevance judge, human review |
| Completeness | Чи присутнє все потрібне? | Пропущено виняток для товарів зі знижкою | Checklist очікуваних фактів |
| Format compliance | Чи output відповідає потрібній структурі? | JSON без обов'язкового поля | Schema validation |
| Consistency і robustness | Чи стабільна поведінка для парафраз, typos і шуму? | Різні відповіді на два формулювання одного питання | Metamorphic tests, повторні runs |
| Safety | Чи система уникає шкідливого контенту і дій? | Дає небезпечні інструкції | Safety classifiers, red-team datasets |
| Security | Чи протистоїть маніпуляціям і захищає дані? | Виконує інструкції, сховані в retrieved web page | Prompt-injection tests, leakage tests |
| Fairness | Чи якість однакова для різних груп користувачів? | Гірші відповіді для неанглійських імен | Counterfactual tests за групами |
| Privacy | Чи правильно обробляються персональні дані? | Розкриває адресу іншого клієнта | Leakage tests, PII scanners |
| Latency | Чи достатньо швидко для use case? | 12 секунд до першого token у чаті | Time to first token, p95 latency |
| Cost | Чи доступно за очікуваного обсягу? | Prompt розрісся до 9 000 tokens на запит | Облік tokens на запит і на задачу |

Не кожній feature потрібні всі характеристики. Code-review асистент для інженерів може терпіти 10 секунд latency, але не вигадані APIs. Публічний chat widget має бути передусім швидким і безпечним.

## Від розмитої вимоги до тестованих критеріїв

Вимоги до LLM features зазвичай приходять розмитими: *«Асистент має давати корисні відповіді про refunds.»* Так це протестувати неможливо. Процес нижче перетворює вимогу на критерії, які можна перевірити.

```diagram
1. Users and tasks      Who asks what, in which language, with what goal?
        ↓
2. Risks                What happens if the answer is wrong, unsafe, slow or leaks data?
        ↓
3. Characteristics      Which quality characteristics matter for these risks?
        ↓
4. Criteria             Measurable statement + measurement method + threshold + priority
        ↓
5. Evidence plan        Which data, scorers and reviews will produce the measurements?
```

### Розібраний приклад: refund assistant

*Крок 1, користувачі та задачі.* Клієнти вигаданого магазину взуття **Stride** питають про повернення і refunds англійською та українською. Вони хочуть знати, чи можна повернути товар, до якого терміну і як.

*Крок 2, ризики.* Хибне «так» створює обіцянку, яку компанія мусить виконати, або конфлікт з клієнтом. Хибне «ні» втрачає продаж. Відповіді, що розкривають замовлення іншого клієнта, — privacy incident. Повільні відповіді змушують людей кидати чат.

*Крок 3, характеристики.* Faithfulness до policy, коректне утримання від відповіді (abstention), коли policy не покриває випадок, формат, мова, privacy і latency.

*Крок 4, критерії.*

| ID | Критерій | Вимірювання | Threshold | Пріоритет |
|---|---|---|---|---|
| R1 | Кожне твердження про policy підтверджене поточним документом policy | Faithfulness judge, валідований на 100 human labels | Щонайменше 97% evaluation cases проходять | Critical |
| R2 | Коли policy не покриває питання, асистент каже, що не може підтвердити, і пропонує живого агента | Abstention check на 40 питаннях поза policy | Щонайменше 95% | High |
| R3 | Відповідь не довша за 120 слів і містить посилання на сторінку повернень | Deterministic checks | 100% | Medium |
| R4 | Мова відповіді збігається з мовою питання | Перевірка мови за script | Щонайменше 99% | High |
| R5 | Жодна відповідь не містить персональних даних іншого клієнта | Leakage test set з підкинутими даними | 0 збоїв | Critical |
| R6 | Time to first token | Load test на очікуваному піку | p95 до 1.5 s | High |

*Крок 5, план evidence.* Evaluation dataset з реальних (анонімізованих) і synthetic питань, валідований judge для R1, deterministic scorers для R3 і R4, leakage test set для R5 і load test для R6. Наступні chapters показують, як побудувати кожен з них.

Кожен критерій називає, *що* вимірюється, *як* вимірюється, *який результат прийнятний* і *наскільки це важливо*. Це мінімум, щоб критерій був тестованим.

## Де тестування відбувається в lifecycle

Тестування LLM — не одна фаза. Воно відбувається на кожному етапі, а production повертає знання в розробку.

```diagram
 design ──► build ──► offline evaluation ──► pre-release ──► release ──► production
   │          │              │                    │             │            │
 criteria   unit tests,   datasets, scorers,   red teaming,   canary,     tracing, online
 and risks  fake models,  judges, regression   performance,   shadow      evaluation,
            prompt review baselines            release gate   traffic     feedback, alerts
   ▲                                                                         │
   └────────────── new failure cases become evaluation dataset cases ◄───────┘
```

| Етап | Основні активності | Chapter |
|---|---|---|
| Design | Критерії якості, аналіз ризиків, evaluation plan | Цей chapter, [Benchmarks, human evaluation і governance](/learn/llm?topic=pro-practice) |
| Build | Unit tests з fake models, рев'ю prompts і schemas | [Тестування LLM code без моделі](/learn/llm?topic=testing-without-the-model) |
| Offline evaluation | Datasets, scorers, judges, статистика | [Методологія evaluation і datasets](/learn/llm?topic=evaluation-fundamentals) і наступні chapters |
| Pre-release | Security testing, performance tests, release gates | [Security, red teaming і guardrails](/learn/llm?topic=security-red-teaming), [Якість у production](/learn/llm?topic=production-quality) |
| Release | Canary і shadow deployments, міграції моделей | [Якість у production](/learn/llm?topic=production-quality) |
| Production | Tracing, online evaluation, feedback loops | [Якість у production](/learn/llm?topic=production-quality) |

## Приклад проєкту

Метод цього chapter реалізований і покритий тестами в [examples/llm-testing/01-property-oracles](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/01-property-oracles): property oracles для refund асистента, тест, що документує, чого вони не можуть виявити, і арифметика кількості runs. Усі тести працюють offline, без моделі та API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/01-property-oracles
```

## Типові помилки

- **Сприймати demo як тест.** Кілька гарних відповідей мало що доводять; див. ймовірності вище.
- **Тестувати лише модель.** Більшість збоїв походить від prompts, retrieval, parsing і tools, які ви контролюєте.
- **Використовувати exact-match oracles для вільного тексту.** Вони падають на правильних парафразах і привчають команду ігнорувати failures.
- **Вибирати metrics до того, як подивилися на outputs.** Generic metrics часто не вимірюють нічого важливого для продукту. Почніть з error analysis (див. [Методологія evaluation і datasets](/learn/llm?topic=evaluation-fundamentals)).
- **Не записувати версії.** Результат без версії моделі, версії prompt і parameters неможливо відтворити чи порівняти.
- **Ігнорувати latency і cost.** Правильна відповідь, що приходить запізно чи коштує задорого, — це невиконана вимога.

## Підсумок

- LLM system — це значно більше, ніж модель. Тестувальники здебільшого працюють на рівнях application і feature, де prompts, retrieval, tools і validation створюють більшість дефектів.
- Generative output не має одного очікуваного значення. Тестування LLM комбінує property, reference-based, model-based, human, metamorphic і differential oracles.
- Output варіюється через sampling, inference non-determinism, версії моделей, prompts, retrieved context, tools і стан розмови. Твердження про якість — це твердження про rates.
- Якість треба розкласти на характеристики на кшталт faithfulness, relevance, safety, latency і cost, а потім на критерії з методом вимірювання, threshold і пріоритетом.
- Тестування відбувається впродовж усього lifecycle, і production failures мають повертатися в evaluation datasets.
