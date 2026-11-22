# Лабораторна зі спостережуваності

Найшвидше закріпити ідеї цього шляху — побачити їх в одній невеликій системі, яку можна запустити, зламати й полагодити. Лабораторна — це сервіс пошуку вакансій, що пише структуровані логи, віддає метрики й продовжує трасування, плюс інструменти, якими QA-інженер оцінює реліз за цими сигналами: SLO, обчислені з метрик, синтетична перевірка й рішення щодо canary.

У цьому розділі: що є в лабораторній, як її запустити, як читати кожен сигнал, який вона видає, як самостійно обчислити її SLO, вправи, що навмисно її ламають, і чому відповідає кожна частина серед інструментів, які ви зустрінете на роботі.

**Передумови:** [Логи, що відповідають на питання](/learn/observability?topic=structured-logs), [Метрики, золоті сигнали й перцентилі](/learn/observability?topic=metrics), [Розподілене трасування](/learn/observability?topic=distributed-tracing), [SLI, SLO та error budget](/learn/observability?topic=slo-error-budgets), [Тестування в продакшні](/learn/observability?topic=testing-in-production).

## Що є в лабораторній

Лабораторна в [examples/observability-lab](https://github.com/sergiiiavt/gimme-job/tree/main/examples/observability-lab) використовує лише стандартну бібліотеку Python: без Prometheus, без колектора, без API-ключа. Вона пише ті самі формати, що й справжні системи, тож усе, чого ви тут навчитеся, безпосередньо застосовне до інструментів продакшну.

```diagram
lab.py        запускає контрольну версію (1.4.0) і canary з багом (1.5.0), надсилає трафік, оцінює canary
   ↓  HTTP, заголовок traceparent у кожному запиті
service.py    /api/search, /healthz, /metrics; один рядок JSON-логу на запит; canary провалює кожен 8-й пошук
   ↓  збирання /metrics
slo.py        SLI доступності й затримки, burn rate   →   canary.py   просувати, відкотити чи чекати
synthetic.py  black-box перевірки ззовні, з trace id на кожному кроці
```

| Файл | Що робить |
|---|---|
| `telemetry.py` | Розбирає й продовжує W3C `traceparent`, веде лічильники й гістограми в текстовому форматі Prometheus, пише рядки JSON |
| `service.py` | Сервіс з обмеженими мітками маршрутів і детермінованими збоями: кожен N-й пошук падає або повільний |
| `slo.py` | Розбирає зібрані метрики й обчислює SLI, burn rate і вердикти SLO |
| `canary.py` | Порівнює canary й контрольну групу за тими самими цілями |
| `synthetic.py` | Звертається до сервісу ззовні, як це зробив би користувач |
| `test_observability_lab.py` | 24 перевірки, від правил формату до рішення щодо canary, які запускає CI цього репозиторію |

## Запуск

З кореня репозиторію, з Python 3.12 або новішим:

```bash
python examples/observability-lab/lab.py
python -m unittest discover -s examples/observability-lab -v
```

Лабораторна друкує п'ять кроків; ось скорочена версія. Час і id відрізняються щоразу, а частки — ні, бо збої детерміновані:

```text
1. Synthetic checks: one request per step, from outside
   control 1.4.0 search  200    2.5 ms trace bf3e05c1... ok
   canary 1.5.0  search  200    2.9 ms trace 5ca4b647... ok
3. SLOs computed from each version's /metrics
   control 1.4.0 availability 100.00% of  61 (target 99%, burn rate   0.0) met
   canary 1.5.0  availability  88.52% of  61 (target 99%, burn rate  11.5) MISSED
   canary 1.5.0  latency       80.33% of  61 (target 95%, burn rate   3.9) MISSED
4. Canary decision
   ROLLBACK: availability 88.5% on the canary vs 100.0% on the control; latency 80.3% on the canary vs 100.0% on the control
5. From a failed request to its log line: trace b50a2e97...
```

Перший урок уже є в цьому виводі: обидві версії проходять синтетичні перевірки, але canary провалює кожен восьмий пошук. Одна проба знаходить збої; частку помилок показують лише метрики з усього трафіку.

## Читаємо сигнали

### Логи

Кожен запит дає рівно одну подію з тими самими полями, як описано в розділі [Логи, що відповідають на питання](/learn/observability?topic=structured-logs):

```json
{"ts": "2026-11-22T09:46:28.614Z", "level": "info", "service": "search", "version": "1.5.0", "event": "http_request", "method": "GET", "route": "/api/search", "status": 200, "duration_ms": 0.11, "trace_id": "fe815c9d9e8298ac421f5ae4678510b0", "span_id": "383580d0c71e879e", "parent_span_id": "09d7f256ac362362"}
```

Важать три деталі. Поле `version` дає змогу розбити будь-який запит до логів за релізом, а саме це й потрібно для canary. Подія записує маршрут, а не повний URL, бо рядок запиту містить пошукові слова, email і токени; один із тестів надсилає адресу email і токен і перевіряє, що жодне з них не потрапило в лог. А `trace_id` разом із `parent_span_id` пов'язують подію з тим, хто почав трасування.

### Метрики

Ендпоінт `/metrics` віддає текстовий формат Prometheus. Фрагмент із canary після трафіку лабораторної:

```text
# HELP http_requests_total HTTP requests handled, by route and status code.
# TYPE http_requests_total counter
http_requests_total{route="/api/search",status="200"} 54
http_requests_total{route="/api/search",status="500"} 7
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{route="/api/search",le="0.1"} 49
http_request_duration_seconds_bucket{route="/api/search",le="0.25"} 61
http_request_duration_seconds_bucket{route="/api/search",le="+Inf"} 61
http_request_duration_seconds_sum{route="/api/search"} 1.81
http_request_duration_seconds_count{route="/api/search"} 61
```

Формат має правила, які перевіряють тести: один рядок `HELP` і один `TYPE` на метрику, перед її першим значенням; бакети гістограми в порядку зростання `le`, кожен рахує всі спостереження до своєї межі, тож значення ніколи не зменшуються; обов'язковий бакет `+Inf`, що дорівнює `_count`; і `_sum` для обчислення середніх. Мітка маршруту обмежена: кожен невідомий шлях рахується як `route="unmatched"`, тож сканер, що запитує сотню випадкових URL, додає один ряд, а не сотню.

### Трасування

Заголовок `traceparent` має чотири поля: версію, trace id, span id батька й прапорці, наприклад `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`. Сервіс зберігає trace id, створює новий span id для власної роботи й записує span id того, хто викликав, як `parent_span_id`. Заголовок, який не можна використати, наприклад з id із самих нулів, забороненою версією `ff` чи шістнадцятковими цифрами у верхньому регістрі, ігнорується, і починається нове трасування; сам запит через це ніколи не падає.

Сервіс також повертає trace id у заголовку відповіді `x-trace-id`. Це домовленість цієї лабораторної, а не стандарт, і корисна для тестувальників: додайте id до баг-репорту, і той, хто розслідуватиме, одразу перейде до потрібного рядка логу, як це робить крок 5 лабораторної.

## Обчисліть SLO самі

Арифметика, яку система моніторингу виконує над цими метриками, коротка. Приклад нижче розбирає наведений вище фрагмент, обчислює обидва SLI та їхній burn rate і показує, чому поріг затримки в SLO має бути однією з меж бакетів гістограми:

```python
import re

METRICS = """
# TYPE http_requests_total counter
http_requests_total{route="/api/search",status="200"} 54
http_requests_total{route="/api/search",status="500"} 7
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{route="/api/search",le="0.05"} 49
http_request_duration_seconds_bucket{route="/api/search",le="0.1"} 49
http_request_duration_seconds_bucket{route="/api/search",le="0.25"} 61
http_request_duration_seconds_bucket{route="/api/search",le="+Inf"} 61
http_request_duration_seconds_sum{route="/api/search"} 1.81
http_request_duration_seconds_count{route="/api/search"} 61
"""
SAMPLE = r"(\w+)\{(.*)\} (\S+)"
LABEL = r'(\w+)="([^"]*)"'
TARGETS = {"availability": 0.99, "latency": 0.95}
THRESHOLD = "0.1"

def parse(text):
    samples = []
    for line in text.strip().splitlines():
        match = re.fullmatch(SAMPLE, line)
        if match:
            labels = dict(re.findall(LABEL, match.group(2)))
            samples.append({"name": match.group(1), "labels": labels, "value": float(match.group(3))})
    return samples

def value(samples, name, **labels):
    return sum(s["value"] for s in samples
               if s["name"] == name and all(s["labels"].get(key) == labels[key] for key in labels))

samples = parse(METRICS)
total = value(samples, "http_requests_total", route="/api/search")
failed = value(samples, "http_requests_total", route="/api/search", status="500")
fast = value(samples, "http_request_duration_seconds_bucket", route="/api/search", le=THRESHOLD)
count = value(samples, "http_request_duration_seconds_count", route="/api/search")

slis = {"availability": (total - failed) / total, "latency": fast / count}
for name in slis:
    burn = (1 - slis[name]) / (1 - TARGETS[name])
    print(f"{name:<12} {slis[name]:.2%}  target {TARGETS[name]:.0%}  burn rate {burn:.1f}")

bounds = {s["labels"]["le"] for s in samples if s["name"].endswith("_bucket")}
for threshold in ["0.1", "0.3"]:
    verdict = "is a bucket bound" if threshold in bounds else "has no bucket, so this SLI cannot be computed exactly"
    print(f"latency threshold {threshold}s {verdict}")
```

Класична гістограма знає лише, скільки запитів потрапило в кожен бакет, а не де саме всередині нього, тож частку запитів, швидших за 0,3 секунди, неможливо обчислити з бакетів 0,25 і 0,5. Власна порада Prometheus — заздалегідь ставити межі бакетів на порогах SLO, бо змінювати їх потім болісно; новіші native histograms натомість інтерполюють. Функція `slo.latency` у лабораторній відмовляється приймати поріг, що не є межею бакета, замість повертати хибне число.

Burn rate пов'язаний з розділом про [алерти за burn rate](/learn/observability?topic=slo-error-budgets&section=burn-rate-and-alerting): версія, що провалює 11,5% пошуків за цілі 99%, витрачає error budget в 11,5 раза швидше, ніж дозволено. Якби вона обслуговувала весь трафік, то лишилася б нижче порогу швидкого витрачання 14,4, але запустила б другий page — burn rate 6 за шість годин і тридцять хвилин. Це ще одна причина впіймати її, поки вона малий canary.

## Вправи

Перш ніж запускати кожну, передбачте результат, а потім перевірте:

1. **Здоровий canary.** У `lab.py` передайте canary `Faults()` без збоїв. Рішення стає `PROMOTE`.
2. **Замало трафіку.** Виконайте `run(traffic=20)` з оболонки Python у теці лабораторної. Canary обслужив замало запитів, і рішення — `WAIT`, а не `PROMOTE`.
3. **Поріг без бакета.** Додайте до `DEFAULT_OBJECTIVES` у `slo.py` ціль із `threshold_seconds=0.3`. Лабораторна зупиниться зі зрозумілою помилкою; вставте 0.3 у `LATENCY_BUCKETS` у `service.py`, зберігаючи межі в порядку зростання, і все запрацює.
4. **Кардинальність.** Змініть `service.py`, щоб міткою маршруту був сирий шлях, надішліть запити на тисячу випадкових шляхів і порахуйте ряди в `/metrics`. Потім поверніть обмежену мітку.
5. **Лог, що витікає.** Записуйте в лог повну ціль запиту замість маршруту й запустіть тести: тест на приховування даних упаде й назве значення, що витекло.
6. **Синтетичний трафік.** Додайте до події логу поле `synthetic`, що дорівнює true, коли user agent належить пробі, щоб бізнес-звіти могли виключати трафік проб.
7. **Алерт.** За таблицею burn rate з розділу про SLO напишіть три умови алертів для SLO доступності пошуку й з'ясуйте, які з них спрацюють при burn rate 11,5, а які ні.

## Від лабораторної до справжніх інструментів

Кожна частина лабораторної має відповідник, що робить ту саму роботу в масштабі:

| У лабораторній | На роботі |
|---|---|
| Лічильники й гістограми в `telemetry.py` | Клієнтська бібліотека Prometheus або OpenTelemetry metrics SDK |
| JSON-логер | Бібліотека структурованого логування й конвеєр логів, наприклад Workers Logs на цьому сайті |
| Розбір `traceparent` і дочірні span | Передавання контексту OpenTelemetry, яке також передає контекст у виклики далі |
| `slo.py` | Recording rules, SLO-дашборди й алерти за burn rate у системі моніторингу |
| `canary.py` | Автоматичний аналіз canary в системі деплою |
| `synthetic.py` | Сервіс синтетичного моніторингу, що безперервно запускає перевірки з кількох точок |

Незмінним лишається міркування: спершу домовтеся про поля й мітки, вимірюйте те, що бачать користувачі, порівнюйте зміну з контрольною групою, вирішуйте лише з достатніми даними й тримайте trace id для кожного збою.

## Типові помилки

- **Додавати телеметрію після інциденту.** Сигнали лабораторної існують до першого запиту; сервісам у продакшні потрібне те саме.
- **Записувати в лог повний URL.** Рядки запиту містять персональні дані й секрети; записуйте маршрут.
- **Необмежені значення міток.** Сирі шляхи, id користувачів чи рядки запиту як мітки створюють ряд на кожне значення.
- **Поріг SLO між бакетами.** З класичною гістограмою SLI не обчислити точно; плануйте бакети разом із SLO.
- **Довіряти пройденій синтетичній перевірці.** Вона знаходить збої, а не частку помилок.
- **Оцінювати canary відносно минулого або на замалому трафіку.** Порівнюйте з контрольною групою за той самий період і чекайте достатньо запитів.
- **Ламати запити через поганий заголовок трасування.** Ігноруйте його й починайте нове трасування.

## Підсумок

Лабораторна вміщує весь шлях в одну систему, яку можна запустити: сервіс, що пише одну структуровану подію на запит, віддає лічильники й гістограми в текстовому форматі Prometheus і продовжує контекст трасування W3C; SLI й burn rate, обчислені із зібраних метрик; синтетичну перевірку, що працює ззовні; і рішення щодо canary, яке порівнює з контрольною групою й чекає достатнього трафіку. Її вивід показує головні уроки на практиці: пройдена проба не доводить здоров'я, SLO затримки потребують відповідних меж бакетів, мітки мають бути обмеженими, логи не повинні розкривати рядки запиту, а trace id перетворює невдалий запит на один рядок логу. Те саме міркування без змін працює з Prometheus, OpenTelemetry та інструментами деплою й моніторингу, якими ви користуєтеся на роботі.
