# Якість у production

LLM feature, що пройшла evaluations, усе одно може зламатися в production. Користувачі ставлять питання, яких не було в dataset, provider оновлює модель, новий документ збиває retrieval, latency зростає разом із трафіком, а витрати дрейфують. Якість у production — це дисципліна раннього виявлення таких змін: release gates, що блокують regressions до того, як їх побачать користувачі, і моніторинг, що виявляє те, чого gates не могли передбачити.

Цей chapter охоплює обидва цикли: evaluation у CI/CD і release gates, tracing і observability, online evaluation і виявлення дрейфу, зворотний зв'язок користувачів, тестування performance і вартості, міграції моделей, експерименти з реальними користувачами та обробку інцидентів.

**Prerequisites:** [Методологія evaluation і datasets](/learn/llm?topic=evaluation-fundamentals), [Статистика для evaluation](/learn/llm?topic=eval-statistics), [LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation).

## Два цикли

```diagram
Offline loop (before release)                 Online loop (after release)
dataset + scorers + judges                     traces of real traffic
        ↓                                              ↓
release gates in CI/CD           ──ship──▶     code checks on every request, judges on a sample
        ↑                                              ↓
new cases from production        ◀──learn──    drift alerts, feedback, incidents, error analysis
```

Offline цикл захищає користувачів від відомих збоїв; online цикл відкриває невідомі й повертає їх як нові cases. Жоден не працює сам: команда без online циклу тестує вчорашній продукт, а команда без offline циклу дізнається про regressions від клієнтів.

## Evaluation у CI/CD

Запускайте suites різної вартості в різні моменти:

| Етап | Тригер | Обсяг | Типовий gate |
|---|---|---|---|
| Unit tests з fake models | Кожен push | Увесь детермінований code | Усі тести проходять |
| Smoke evaluation | Кожен pull request, що зачіпає prompts, моделі, retrieval чи LLM code | 20–50 критичних cases, перевірки code і кілька валідованих judges | Жоден критичний case не падає |
| Повна evaluation | Щоночі й перед кожним release | Увесь dataset із повторними запусками, усі зрізи | Non-inferiority для кожної metric і зрізу проти baseline |
| Suite red team | Щотижня й перед releases | Корпус атак і автоматизовані сканери | Жодної нової знахідки високої серйозності |

Release gate перевіряє одразу кілька видів вимог, і одна перевірка, що не пройшла, блокує release навіть тоді, коли головна metric покращилася:

```python
# Results of the release suite for the current prompt and model and for the candidate (a cheaper model)
checks = [
    ("hard: zero-tolerance safety cases failed", 0, 0, "must be 0"),
    ("quality: lower bound of paired difference", None, -0.012, "at least -0.02"),
    ("latency: p95 end-to-end seconds", 6.8, 5.1, "at most 8.0"),
    ("cost: EUR per resolved conversation", 0.041, 0.019, "at most 0.05"),
    ("language: Ukrainian slice pass rate", 0.91, 0.84, "at least 0.88"),
]


def passes(value: float, limit: str) -> bool:
    kind, number = limit.rsplit(" ", 1)
    bound = float(number)
    return {"must be": value == bound, "at least": value >= bound, "at most": value <= bound}[kind]


blocking = []
for name, before, after, limit in checks:
    ok = passes(after, limit)
    shown_before = "-" if before is None else before
    print(f"{'PASS' if ok else 'FAIL'}  {name:<44} baseline {shown_before!s:>6}  candidate {after!s:>6}  ({limit})")
    if not ok:
        blocking.append(name)
print("decision:", "ship" if not blocking else f"block, {len(blocking)} check(s) failed")
```

Output:

```text
PASS  hard: zero-tolerance safety cases failed     baseline      0  candidate      0  (must be 0)
PASS  quality: lower bound of paired difference    baseline      -  candidate -0.012  (at least -0.02)
PASS  latency: p95 end-to-end seconds              baseline    6.8  candidate    5.1  (at most 8.0)
PASS  cost: EUR per resolved conversation          baseline  0.041  candidate  0.019  (at most 0.05)
FAIL  language: Ukrainian slice pass rate          baseline   0.91  candidate   0.84  (at least 0.88)
decision: block, 1 check(s) failed
```

Дешевша модель у середньому така сама добра, швидша й удвічі дешевша — і все одно не виходить, бо її українські відповіді опускаються нижче погодженого порогу. Практичні правила для gates:

- **Визначайте ліміти до запуску,** зокрема margin non-inferiority для якості ([Статистика для evaluation](/learn/llm?topic=eval-statistics)).
- **Перевіряйте важливі зрізи,** а не лише середнє: мови, критичні наміри, сегменти клієнтів.
- **Тримайте hard gates поза статистикою:** один витеклий секрет чи один зламаний контракт блокує release.
- **Робіть gates достатньо дешевими, щоб запускати їх на кожну релевантну зміну:** кешуйте outputs моделі за моделлю, prompt і input, а дорогі suites запускайте за розкладом.
- **Ніколи не перезапускайте evaluation, що не пройшла, доки вона не пройде.** Gate, що іноді падає, повідомляє про реальну варіативність; вимірюйте її ([Evaluation agents і tool use](/learn/llm?topic=agent-testing) показує pass^k).

## Tracing і observability

Кожен запит до LLM feature має лишати **trace**: дерево spans для retrieval, кожного виклику моделі, кожного виклику tool і постобробки з даними, потрібними, щоб пояснити результат.

| Що записувати в span | Навіщо |
|---|---|
| Inputs і outputs із замаскованими персональними даними | Щоб відтворювати й читати збої |
| ID моделі, версію prompt, параметри | Щоб точно знати, що створило output |
| Tokens на вході й виході, вартість | Щоб знаходити дорогі запити й features |
| Latency, час до першого token, повтори, помилки | Щоб знаходити повільні й ненадійні залежності |
| ID знайдених документів і їхні scores | Щоб відрізняти збої retrieval від збоїв генерації |
| Scores від перевірок code і judges, зворотний зв'язок | Щоб пов'язати якість із trace, що її дав |

Семантичні конвенції OpenTelemetry для generative AI стандартизують назви таких атрибутів, а інструменти на кшталт Langfuse і Phoenix зберігають traces, шукають у них і оцінюють їх. Вважайте traces чутливими даними: маскуйте перед експортом, обмежуйте доступ і строк зберігання.

## Тестування performance

Користувачі відчувають latency як два числа: скільки чекати першого token і скільки — повної відповіді. Обидва мають довгі хвости, бо повільний tool, повтор чи довга відповідь можуть помножити час звичайного запиту:

```python
import math
import random
from statistics import fmean, quantiles

rng = random.Random(8)
# 2,000 calls: time to first token plus generation, and one call in twenty waits for a slow tool
ttft, total = [], []
for _ in range(2000):
    first = rng.lognormvariate(math.log(0.6), 0.35)
    generation = rng.uniform(150, 400) / rng.uniform(40, 80)  # tokens / tokens per second
    tool = rng.uniform(4, 9) if rng.random() < 0.05 else 0.0
    ttft.append(first + tool)
    total.append(first + tool + generation)


def percentiles(values: list[float]) -> dict[str, float]:
    cuts = quantiles(values, n=100, method="inclusive")
    return {"mean": fmean(values), "p50": cuts[49], "p95": cuts[94], "p99": cuts[98]}


for name, values in [("time to first token", ttft), ("end-to-end latency", total)]:
    print(f"{name:<20} " + "  ".join(f"{key} {value:5.2f}s" for key, value in percentiles(values).items()))

# Little's law: calls in flight = arrival rate x time in the system
peak_per_minute = 900
in_flight = peak_per_minute / 60 * fmean(total)
print(f"at {peak_per_minute} calls per minute about {in_flight:.0f} calls are in flight on average")
```

Output:

```text
time to first token  mean  0.99s  p50  0.61s  p95  4.94s  p99  8.87s
end-to-end latency   mean  5.67s  p50  5.25s  p95  9.77s  p99 13.42s
at 900 calls per minute about 85 calls are in flight on average
```

Середній час до першого token — менше секунди, але кожен двадцятий користувач чекає близько п'яти секунд, і все через повільний tool. Показуйте перцентилі, а не середні, і ставте вимоги саме до них (наприклад, «p95 часу до першого token менше 2 секунд»). Закон Літтла (кількість запитів у роботі = частота надходження × час у системі) перетворює latency на місткість: за 900 запитів на хвилину і приблизно 5.7 секунди на запит система одночасно обробляє близько 85 запитів, і rate limits provider та пули з'єднань мають дозволяти таку паралельність.

Навантажувальні тести LLM features додають до класичного навантажувального тестування поведінку provider: rate limits (HTTP 429) із заголовками retry-after, таймаути довгих генерацій, streaming-з'єднання, що лишаються відкритими, і вартість самого тесту. Запускайте їх проти fake model server для поведінки самого application і проти справжнього provider лише в масштабі, потрібному, щоб підтвердити ліміти. Перевіряйте, що clients чекають щонайменше стільки, скільки каже retry-after, і відступають експоненційно з випадковим jitter: так більшість помилок короткого сплеску перетворюється на очікування. Проте жодна політика повторів не створює місткості: коли попит тривало перевищує те, що витримують ліміти, падає та сама частка запитів, хоч би що робив client.

## Тестування вартості

Вартість — атрибут якості з власними regressions: prompt, що виріс на абзац, зміна моделі, зміна retrieval, що додає context, agent, якому потрібно більше кроків.

- **Вимірюйте вартість одного вирішеного завдання,** а не виклику: дешева модель, якій потрібно три спроби, може коштувати більше за дорогу, що вдається з першого разу ([Анатомія LLM application і APIs](/learn/llm?topic=llm-application-anatomy)).
- **Додайте вартість у release gate** з лімітом на вирішену розмову.
- **Використовуйте prompt caching** для довгих стабільних префіксів prompt і перевіряйте, що кеш справді спрацьовує: одне змінне значення на початку prompt непомітно вимикає його.
- **Обмежуйте бюджет на користувача й на задачу,** щоб стримати шкоду від циклів і зловживань ([Security, red teaming і guardrails](/learn/llm?topic=security-red-teaming)).

## Online evaluation і дрейф

У production немає labels, але є три види сигналів:

- **Перевірки code на кожному запиті:** валідність schema, citations, посилання, мова, довжина, відмови, помилки tools.
- **Валідовані judges на випадковій вибірці:** кількох сотень розмов на день зазвичай досить, щоб відстежувати pass rate.
- **Моніторинг розподілів:** співвідношення мов, намірів, довжин inputs і знайдених документів.

Питання в тому, коли зміна — справжня проблема, а не шум. Контрольні карти зі статистичного контролю процесів відповідають на нього: денний pass rate поза трьома стандартними похибками від його нормального рівня навряд чи випадковий:

```python
import math

# Daily online evaluation: a validated judge scores a random sample of 200 conversations per day
judged = 200
passed = [176, 181, 178, 174, 180, 177, 179, 175, 182, 178, 164, 161, 176, 179]
baseline = sum(passed[:10]) / (10 * judged)  # the first ten days define normal behaviour
sigma = math.sqrt(baseline * (1 - baseline) / judged)
low = baseline - 3 * sigma
print(f"baseline pass rate {baseline:.1%}, lower control limit {low:.1%}")
for day, count in enumerate(passed, 1):
    rate = count / judged
    print(f"day {day:>2}: {rate:6.1%}{'   ALERT' if rate < low else ''}")


def psi(expected: dict[str, float], actual: dict[str, float]) -> float:
    """Population stability index between two distributions over the same categories."""
    return sum((actual[k] - expected[k]) * math.log(actual[k] / expected[k]) for k in expected)


languages_before = {"en": 0.72, "uk": 0.25, "other": 0.03}
languages_now = {"en": 0.55, "uk": 0.38, "other": 0.07}
print(f"population stability index of the language mix: {psi(languages_before, languages_now):.2f}")
```

Output:

```text
baseline pass rate 89.0%, lower control limit 82.4%
day  1:  88.0%
day  2:  90.5%
day  3:  89.0%
day  4:  87.0%
day  5:  90.0%
day  6:  88.5%
day  7:  89.5%
day  8:  87.5%
day  9:  91.0%
day 10:  89.0%
day 11:  82.0%   ALERT
day 12:  80.5%   ALERT
day 13:  88.0%
day 14:  89.5%
population stability index of the language mix: 0.13
```

Дні 11 і 12 опускаються нижче контрольної межі й заслуговують розслідування; дні 13 і 14 свідчать, що причину, наприклад збій index retrieval, усунули. Невеликий тривалий зсув рідко перетинає межу в три стандартні похибки в будь-який окремий день; натомість його ловить правило серій, наприклад вісім днів поспіль по один бік від центральної лінії (одне з правил Western Electric). Правила серій дають більше хибних тривог, тож застосовуйте їх до кількох головних metrics, а не до кожного зрізу.

Population stability index порівнює співвідношення inputs із попереднім періодом; поширене емпіричне правило вважає значення нижче 0.1 стабільними, а вище 0.25 — великим зсувом, тож 0.13 — помірна зміна: більше українського трафіку, через що український зріз evaluation dataset стає важливішим, ніж раніше.

## Зворотний зв'язок користувачів

- **Явний зворотний зв'язок** (палець угору чи вниз, оцінки) рідкісний і зміщений у бік сильних реакцій; використовуйте його, щоб знаходити cases, а не щоб вимірювати rates.
- **Неявні сигнали** трапляються частіше: користувач перефразовує питання, просить людину, кидає розмову чи копіює відповідь.
- **Кожен негативний відгук — це trace, який треба прочитати.** Передавайте збої в error analysis і dataset, щоб offline цикл навчився того, чого навчив production ([Методологія evaluation і datasets](/learn/llm?topic=evaluation-fundamentals)).

## Міграції моделей

Providers знімають моделі з підтримки за опублікованими графіками, а новіші моделі змінюють поведінку, навіть коли кращі на benchmarks. Сприймайте міграцію як будь-який інший release:

1. **Запустіть повну evaluation** з новою моделлю на тих самих cases і порівнюйте парами; прочитайте cases, що змінили вердикт.
2. **Переналаштуйте prompts, якщо потрібно,** і повторно валідуйте judges, якщо змінюється й модель judge.
3. **Shadow-трафік:** запускайте нову модель на копіях реальних запитів, не показуючи її відповідей, і порівнюйте.
4. **Canary release:** спрямуйте невелику частку користувачів на нову модель за прапорцем, стежте за online-сигналами і поступово розширюйте.
5. **Тримайте старий шлях доступним,** доки новий не доведе себе, і плануйте міграції до дати зняття з підтримки, а не на неї.

## Експерименти з реальними користувачами

Коли offline evaluation не може відповісти на питання (чи новий стиль відповідей вирішує більше розмов?), проведіть контрольований експеримент: випадково розподіліть користувачів між поточною й новою версією і порівнюйте metrics результату, як-от частку вирішених розмов, разом із захисними metrics, як-от ескалації й скарги. Перш ніж читати будь-який результат, перевірте, що розподіл відповідає задуму: невідповідність співвідношення вибірок (sample ratio mismatch), як-от 5000 користувачів в одній групі й 5300 в іншій, означає, що зламані розподіл або логування, і результатам не можна довіряти.

Найпоширеніша помилка — щодня дивитися на результати й зупинятися, щойно різниця виглядає значущою. Кожен погляд — ще один шанс для шуму перетнути поріг:

```python
import math
import random
from statistics import NormalDist

Z = NormalDist().inv_cdf(0.975)
rng = random.Random(21)


def z_statistic(success_a: int, n_a: int, success_b: int, n_b: int) -> float:
    pooled = (success_a + success_b) / (n_a + n_b)
    se = math.sqrt(pooled * (1 - pooled) * (1 / n_a + 1 / n_b))
    difference = success_b / n_b - success_a / n_a
    return difference / se if se else 0.0


# A/A test: both arms are the same system with a 30% task success rate, so every "win" is a false alarm.
experiments, days, users_per_day = 500, 14, 100
stopped_early = fixed_horizon = 0
for _ in range(experiments):
    a = b = n = 0
    declared = False
    for _ in range(days):
        a += sum(rng.random() < 0.30 for _ in range(users_per_day))
        b += sum(rng.random() < 0.30 for _ in range(users_per_day))
        n += users_per_day
        if not declared and abs(z_statistic(a, n, b, n)) > Z:
            declared = True  # someone looked at the dashboard today and stopped the test
    stopped_early += declared
    fixed_horizon += abs(z_statistic(a, n, b, n)) > Z

print(f"false alarms when checking every day and stopping at the first significant result: {stopped_early / experiments:.1%}")
print(f"false alarms when analysing once, at the planned end: {fixed_horizon / experiments:.1%}")
```

Output:

```text
false alarms when checking every day and stopping at the first significant result: 21.0%
false alarms when analysing once, at the planned end: 3.8%
```

Обидві групи ідентичні, тож кожен оголошений переможець — помилка. Якщо аналізувати один раз у запланований кінець, хибна тривога виникає приблизно в 4% цих експериментів, близько до закладених 5%; зі щоденними підгляданнями — приблизно в кожному п'ятому. Визначайте розмір вибірки заздалегідь ([Статистика для evaluation](/learn/llm?topic=eval-statistics)) і аналізуйте один раз, або використовуйте методи для безперервного моніторингу, як-от завжди валідні послідовні тести.

## Інциденти й відкат

- **Feature flags** для prompts, моделей і налаштувань retrieval, щоб погану зміну можна було відкотити за хвилини без deployment.
- **Fallbacks:** простіша модель, статична відповідь чи передавання людині, коли ламаються модель, provider чи guardrail.
- **Runbooks** для передбачуваних інцидентів: збій provider, rate limiting, стрибок вартості, атака injection, шкідливий output.
- **Postmortems без пошуку винних,** що завершуються новими regression cases, щоб наступного разу той самий збій спіймав offline цикл.

## Приклад із практики: Learning Path Advisor цього сайту

Learning Path Advisor у GimmeJob застосовує кілька практик цього chapter:

- **Traces зі scores якості.** Кожен запит трасується в Langfuse зі scores на кшталт найвищого score retrieval, частки обґрунтованих елементів, валідності процитованих джерел і того, чи зв'язна створена карта навчання.
- **Детерміновані перевірки перед показом.** Процитовані посилання перевіряються за формою проти канонічних навчальних маршрутів, тож модель не може відправити користувача на вигадану сторінку.
- **Плавна деградація.** Коли векторний пошук недоступний, лексичний ranker у тому самому pipeline тримає retrieval робочим ([Evaluation RAG систем](/learn/llm?topic=rag-testing)).
- **Протестовано без моделі.** Code application навколо моделі має unit tests із fakes, а AI service має власний набір тестів у CI ([Тестування LLM code без моделі](/learn/llm?topic=testing-without-the-model)).

## Приклад проєкту

Методи цього chapter реалізовані й покриті тестами в [examples/llm-testing/15-production-quality](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/15-production-quality): release gate з hard-перевірками, перевірками якості, latency, вартості й зрізів; tracer із вкладеними spans, маскуванням і вартістю trace; перцентилі latency, закон Літтла і симуляція навантаження на fake provider з rate limits; контрольна карта, правило серій та індекс дрейфу для online моніторингу; і симуляції експериментів, що показують ціну підглядань і два безпечні способи дивитися на результати. Усі тести працюють offline, без моделі та API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/15-production-quality
```

## Типові помилки

- **Evaluation лише перед першим release,** без online циклу.
- **Gates лише на середнє,** без зрізів, latency і вартості.
- **Перезапускати evaluations, що не пройшли, доки вони не пройдуть.**
- **Середні замість перцентилів** для latency.
- **Повтори без backoff** або повтори замість відсутньої місткості.
- **Traces без версій моделі й prompt** або traces із персональними даними у відкритому вигляді.
- **Явний зворотний зв'язок як metric якості.**
- **Міграції моделей у день зняття з підтримки,** без парної evaluation чи canary.
- **Зупиняти експерименти на першому значущому результаті.**
- **Інциденти, виправлені без нових regression cases.**

## Підсумок

- Якість у production — це два цикли: offline evaluation з release gates і online моніторинг, що повертає нові cases.
- Запускайте suites різної вартості в різні моменти й перевіряйте в gates одночасно hard-перевірки, якість із margin, зрізи, latency і вартість.
- Трасуйте кожен запит із версіями, tokens, вартістю, latency, retrieval і scores і маскуйте персональні дані.
- Вимірюйте latency перцентилями, плануйте місткість за законом Літтла і тестуйте вартість вирішеного завдання й спрацювання кешу.
- Моніторте online перевірками code на всьому трафіку, валідованими judges на вибірці, контрольними картами й індексами дрейфу.
- Сприймайте міграції моделей як releases з парною evaluation, shadow-трафіком і canaries.
- Плануйте експерименти заздалегідь і не зупиняйтеся на першому значущому погляді; тримайте fallbacks, прапорці й runbooks для інцидентів.
