# Векторні подання та семантична подібність

**Векторне подання (embedding)** кодує зміст тексту списком чисел. Його використовують для пошуку в RAG, семантичного кешування, тематичних обмежень, дедуплікації, кластеризації та перевірок подібності. Це і компонент тестованої системи, і інструмент тестувальника. В обох випадках потрібно розуміти, що означає оцінка подібності та чого вона не доводить.

**Передумови:** [Як LLM генерують текст](/learn/llm?topic=llm-foundations).

## Що таке векторне подання

**Модель векторних подань** перетворює текст на вектор фіксованої розмірності `d`. За **контрастивного навчання** відповідні пари — питання й відповідь або речення та перефразування — зближуються в просторі, а невідповідні віддаляються.

Ці моделі відрізняються від діалогових: мають власні API, версії, ліміти й підтримувані мови. Для однакового тексту та версії результат зазвичай стабільний із точністю до малих обчислювальних похибок.

```diagram
"Can I return worn shoes?"          ──► embedding model ──► [0.021, -0.113, 0.087, … ]  (d numbers)
"Is it possible to send shoes back?" ──► embedding model ──► [0.019, -0.098, 0.091, … ]
                                                               ▲ similar direction = similar meaning
"What is your delivery time?"       ──► embedding model ──► [-0.140, 0.052, 0.006, … ]
```

Окремі координати зазвичай не мають прямого людського тлумачення. Важливі відношення між векторами, обчислені мірою подібності. Порівнюйте лише подання **сумісної моделі й версії**.

## Вимірювання подібності

Поширені три міри:

```text
dot product:         a · b = Σ a_i b_i
length (norm):       |a| = sqrt(a · a)
cosine similarity:   cos(a, b) = (a · b) / (|a| |b|)          range −1 … 1; 1 = same direction
Euclidean distance:  dist(a, b) = sqrt(Σ (a_i − b_i)²)

for unit-length vectors (|a| = |b| = 1):
    cos(a, b) = a · b
    dist(a, b)² = 2 − 2 cos(a, b)        so ranking by distance equals ranking by cosine
```

Для векторів одиничної довжини скалярний добуток, косинусна подібність і евклідова відстань дають однаковий порядок за близькістю. Без нормалізації скалярний добуток враховує також довжину й може підвищувати позицію довших, але менш пов’язаних векторів. Скрипт перевіряє відповідні тотожності.

```python
import math


def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def norm(a: list[float]) -> float:
    return math.sqrt(dot(a, a))


def cosine(a: list[float], b: list[float]) -> float:
    return dot(a, b) / (norm(a) * norm(b))


def euclidean(a: list[float], b: list[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def normalize(a: list[float]) -> list[float]:
    length = norm(a)
    return [x / length for x in a]


a = [0.20, 0.71, 0.05, 0.40]
b = [0.25, 0.60, 0.10, 0.52]
c = [0.90, -0.10, 0.30, 0.05]

print(f"cosine(a, b) = {cosine(a, b):.3f}   cosine(a, c) = {cosine(a, c):.3f}")
print(f"dot(a, b) = {dot(a, b):.3f}   (not comparable across vectors of different length)")

ua, ub = normalize(a), normalize(b)
print(f"after normalization: dot = {dot(ua, ub):.3f}, equal to cosine")
distance = euclidean(ua, ub)
print(f"euclidean distance of unit vectors = {distance:.3f}; sqrt(2 - 2*cos) = {math.sqrt(2 - 2 * cosine(a, b)):.3f}")
```

Результат:

```text
cosine(a, b) = 0.978   cosine(a, c) = 0.179
dot(a, b) = 0.689   (not comparable across vectors of different length)
after normalization: dot = 0.978, equal to cosine
euclidean distance of unit vectors = 0.211; sqrt(2 - 2*cos) = 0.211
```

### Тлумачення оцінок подібності

Косинусна подібність лежить між −1 і 1, але реальна модель може використовувати лише частину діапазону. Оцінки перефразувань і просто тематичних сусідів перекриваються. Поріг 0.8 має різний зміст для різних моделей, тому калібруйте його на власних даних.

## Подібність та еквівалентність

Векторні подання часто краще відображають тему й лексику, ніж логічні відношення. Близькі речення можуть стверджувати протилежне. Приклад із вектором частот слів (**bag of words**) показує ризик. Навчені моделі краще розпізнають синоніми, але теж потребують перевірок заперечень, чисел і ролей.

```python
import math
import re
from collections import Counter


def bag_of_words(text: str) -> Counter:
    return Counter(re.findall(r"[a-z0-9]+", text.lower()))


def cosine(a: Counter, b: Counter) -> float:
    shared = sum(a[word] * b[word] for word in a)
    return shared / (math.sqrt(sum(v * v for v in a.values())) * math.sqrt(sum(v * v for v in b.values())))


pairs = [
    ("The refund was approved.", "The refund was not approved."),
    ("Returns are accepted within 30 days.", "Returns are accepted within 60 days."),
    ("Ship the order from Kyiv to Lviv.", "Ship the order from Lviv to Kyiv."),
    ("Can I send the shoes back?", "Is it possible to return the shoes?"),
]
for left, right in pairs:
    score = cosine(bag_of_words(left), bag_of_words(right))
    print(f"{score:.2f}  {left!r} vs {right!r}")
```

Результат:

```text
0.89  'The refund was approved.' vs 'The refund was not approved.'
0.83  'Returns are accepted within 30 days.' vs 'Returns are accepted within 60 days.'
1.00  'Ship the order from Kyiv to Lviv.' vs 'Ship the order from Lviv to Kyiv.'
0.31  'Can I send the shoes back?' vs 'Is it possible to return the shoes?'
```

Перші три пари різні за змістом, але мають високу оцінку; остання еквівалентна, але має низьку. Навчена модель може краще розпізнати «send back» і «return». Здатність розрізняти критичні відмінності потрібно виміряти.

| Помилка | Приклад пари | Причина ризику | Краща перевірка |
|---|---|---|---|
| Заперечення | «approved» і «not approved» | Одне слово змінює зміст | Перевірка твердження, модель-оцінювач |
| Числа й одиниці | «30 days» і «60 days» | Число може мало змінити вектор | Видобування й точне порівняння числа |
| Ролі й порядок | «Kyiv to Lviv» і «Lviv to Kyiv» | Ті самі слова, інший напрямок | Структуровані дані, змістове оцінювання |
| Квантори | «all items» і «some items» | Короткий квантор змінює обсяг твердження | Рубрика з явним критерієм |
| Сутності | «order A-1042» і «order A-1024» | Схожі ID означають різні об’єкти | Точний збіг ID |

**Подібність не доводить правильності.** Вона корисна для пошуку, кластеризації й попереднього відбору. Для змісту потрібні фактичні перевірки, структуроване видобування чи перевірені моделі-оцінювачі ([Програмні оцінювачі та метрики](/learn/llm?topic=code-based-scorers), [LLM як оцінювач](/learn/llm?topic=model-graded-evaluation)).

## Калібрування порога подібності

Правило «прийняти відповідь, якщо подібність до еталона ≥ t» або «використати кеш за подібності понад t» є бінарним класифікатором. Його потрібно калібрувати відповідно:

```diagram
1. Collect pairs from the real domain (hundreds, not dozens), including hard negatives:
   same topic, different meaning.
2. Have humans label each pair: equivalent (1) or not (0).
3. Compute the similarity of every pair with the exact model version you will use.
4. Sweep thresholds; at each one compute precision, recall, F1 and false-positive rate.
5. Choose the threshold from the cost of errors, not from the prettiest metric.
6. Confirm the choice on a separate held-out set of labelled pairs.
```

Скрипт перебирає пороги на невеликому розміченому наборі з прикладовими оцінками.

```python
# Labelled pairs: (similarity from your embedding model, 1 if a human judged the pair equivalent, else 0).
# In a real calibration you would have a few hundred pairs; 24 keep the example readable.
labelled = [
    (0.95, 1), (0.93, 1), (0.92, 1), (0.91, 1), (0.90, 1), (0.89, 1), (0.88, 1), (0.87, 1),
    (0.86, 1), (0.84, 1), (0.82, 1), (0.79, 1),
    (0.89, 0), (0.86, 0), (0.85, 0), (0.83, 0), (0.81, 0), (0.80, 0), (0.78, 0), (0.75, 0),
    (0.72, 0), (0.68, 0), (0.64, 0), (0.58, 0),
]


def confusion(threshold: float) -> tuple[int, int, int, int]:
    tp = sum(1 for score, label in labelled if score >= threshold and label == 1)
    fp = sum(1 for score, label in labelled if score >= threshold and label == 0)
    fn = sum(1 for score, label in labelled if score < threshold and label == 1)
    tn = sum(1 for score, label in labelled if score < threshold and label == 0)
    return tp, fp, fn, tn


print("threshold  precision  recall   F1    false-positive rate")
best = None
for step in range(15):
    threshold = round(0.76 + step * 0.01, 2)
    tp, fp, fn, tn = confusion(threshold)
    precision = tp / (tp + fp) if tp + fp else 1.0
    recall = tp / (tp + fn)
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    fpr = fp / (fp + tn)
    print(f"  {threshold:.2f}      {precision:.2f}      {recall:.2f}   {f1:.2f}        {fpr:.2f}")
    better = best is None or recall > best[1]
    if precision >= 0.9 and better:
        best = (threshold, recall)

print(f"lowest threshold with precision >= 0.90: {best[0]:.2f} (recall {best[1]:.2f})")
```

Результат:

```text
threshold  precision  recall   F1    false-positive rate
  0.76      0.63      1.00   0.77        0.58
  0.77      0.63      1.00   0.77        0.58
  0.78      0.63      1.00   0.77        0.58
  0.79      0.67      1.00   0.80        0.50
  0.80      0.65      0.92   0.76        0.50
  0.81      0.69      0.92   0.79        0.42
  0.82      0.73      0.92   0.81        0.33
  0.83      0.71      0.83   0.77        0.33
  0.84      0.77      0.83   0.80        0.25
  0.85      0.75      0.75   0.75        0.25
  0.86      0.82      0.75   0.78        0.17
  0.87      0.89      0.67   0.76        0.08
  0.88      0.88      0.58   0.70        0.08
  0.89      0.86      0.50   0.63        0.08
  0.90      1.00      0.42   0.59        0.00
lowest threshold with precision >= 0.90: 0.90 (recall 0.42)
```

Як інтерпретувати таблицю:

- **Діапазони перекриваються.** У межах 0.78–0.89 є і еквівалентні, і нееквівалентні пари. Ідеального порога немає.
- **Поріг залежить від ціни помилки.** Семантичний кеш не має плутати «скасуй» і «не скасовуй». Тут потрібна висока точність позитивних рішень (precision). Для попереднього відбору на подальше оцінювання важливішою може бути повнота (recall).
- **Малі вибірки ненадійні.** Одна помилка на 24 парах помітно змінює показник. Використовуйте більше прикладів і довірчі інтервали ([Статистика для оцінювання](/learn/llm?topic=eval-statistics)).

## Векторний пошук

Пошук порівнює вектор запиту зі збереженими векторами документів.

- **Точний пошук k найближчих сусідів (kNN)** переглядає всі вектори й знаходить точних сусідів за вибраною мірою. Витрати лінійно зростають із колекцією.
- **Наближений пошук (ANN)** переглядає частину індексу: наприклад, граф HNSW або кластери IVF. Він швидший, але може пропускати справжніх сусідів.

**Recall@k відносно точного пошуку** — частка точних top-k результатів, знайдених наближеним індексом. `nprobe` в IVF задає кількість переглянутих кластерів, `ef_search` в HNSW — список кандидатів. Приклад вимірює цей компроміс на випадкових одиничних векторах.

```python
import math
import random

rng = random.Random(3)
DIM, N_DOCS, N_LISTS, K = 16, 800, 16, 10


def unit(vector: list[float]) -> list[float]:
    length = math.sqrt(sum(x * x for x in vector))
    return [x / length for x in vector]


def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


docs = [unit([rng.gauss(0, 1) for _ in range(DIM)]) for _ in range(N_DOCS)]
queries = [unit([rng.gauss(0, 1) for _ in range(DIM)]) for _ in range(20)]

# Build an IVF-style index: pick list centroids and assign every document to its nearest centroid.
centroids = rng.sample(docs, N_LISTS)
lists = {i: [] for i in range(N_LISTS)}
for doc_id, doc in enumerate(docs):
    nearest = max(range(N_LISTS), key=lambda c: dot(doc, centroids[c]))
    lists[nearest].append(doc_id)


def exact_top_k(query: list[float]) -> list[int]:
    return sorted(range(N_DOCS), key=lambda d: dot(query, docs[d]), reverse=True)[:K]


def ivf_top_k(query: list[float], nprobe: int) -> tuple[list[int], int]:
    probe = sorted(range(N_LISTS), key=lambda c: dot(query, centroids[c]), reverse=True)[:nprobe]
    candidates = [doc_id for c in probe for doc_id in lists[c]]
    best = sorted(candidates, key=lambda d: dot(query, docs[d]), reverse=True)[:K]
    return best, len(candidates)


truth = [set(exact_top_k(q)) for q in queries]
print("nprobe  scanned  recall@10")
for nprobe in [1, 2, 4, 8, 16]:
    recalls, scanned = [], []
    for query, expected in zip(queries, truth):
        found, count = ivf_top_k(query, nprobe)
        recalls.append(len(expected & set(found)) / K)
        scanned.append(count)
    print(f"{nprobe:>6}  {sum(scanned) / len(scanned) / N_DOCS:>6.0%}   {sum(recalls) / len(recalls):.2f}")
```

Результат:

```text
nprobe  scanned  recall@10
     1      6%   0.24
     2     13%   0.45
     4     26%   0.63
     8     51%   0.90
    16    100%   1.00
```

Випадкові вектори не мають виразних тематичних кластерів. Реальні дані можуть давати іншу якість. Вимірюйте повноту індексу на власному корпусі: інакше потрібні документи можуть зникнути до передавання моделі.

Перевіряйте також:

- **Фільтри метаданих:** належність організації, мову, продукт і права. Чужий документ не повинен потрапити в результат, а фільтрація — непомітно зруйнувати повноту.
- **Актуальність:** оновлення й видалення прибирають застарілі подання з результатів.
- **Сумісність:** запит і документи мають використовувати сумісну модель. Записуйте версію в метаданих і відхиляйте несумісність.

## Векторні подання в інженерії тестування

Застосування для тестувальника:

| Завдання | Допомога векторних подань | Обмеження |
|---|---|---|
| Дедуплікація даних | Пошук майже однакових прикладів | Перед об’єднанням перевіряйте критичні відмінності |
| Аналіз помилок | Групування невдалих запитів і відповідей | Спільна тема не обов’язково означає спільну причину |
| Покриття | Пошук робочих тем без близьких тестів | Потрібні належно анонімізовані дані |
| Семантичний кеш | Майже однакові питання з різним змістом | Хибний збіг є дефектом |
| Зміна даних | Порівняння поточних і попередніх запитів | Зміна тем не доводить падіння якості ([Якість у промисловому середовищі](/learn/llm?topic=production-quality)) |

Приклад перевірки покриття з реальною моделлю для запуску на своїй машині:

```python
# pip install sentence-transformers
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")   # supports English and Ukrainian

eval_cases = ["Can I return worn shoes?", "How long does delivery take?", "Do you ship to Poland?"]
production_queries = ["чи можна повернути взуття після 40 днів", "my parcel is late", "do you have vegan sneakers?"]

case_vectors = model.encode(eval_cases, normalize_embeddings=True)
query_vectors = model.encode(production_queries, normalize_embeddings=True)
similarity = query_vectors @ case_vectors.T                   # cosine, because vectors are normalized

for query, row in zip(production_queries, similarity):
    nearest = row.argmax()
    flag = "COVERED" if row[nearest] >= 0.6 else "GAP"      # calibrate this threshold on labelled pairs
    print(f"{flag:<8} {row[nearest]:.2f}  {query!r} -> nearest case {eval_cases[nearest]!r}")
```

## Вибір і тестування моделі векторних подань

Рейтинги на кшталт MTEB допомагають вибрати кандидатів, але не замінюють перевірки вашої лексики, документів і мов. Вимірюйте пошук за метриками з розділу [Оцінювання систем RAG](/learn/llm?topic=rag-testing). Порівнюйте також:

- **довжину тексту:** перевищення може спричинити обрізання чи помилку API;
- **мови:** включно з пошуком документів іншою мовою;
- **розмірність, затримку й вартість:** більший вектор потребує більше ресурсів;
- **версії:** зміна моделі зазвичай вимагає переобчислення всього корпусу.

Приклад API (OpenAI Python SDK; принцип подібний для інших постачальників):

```python
from openai import OpenAI

client = OpenAI()                                  # reads OPENAI_API_KEY from the environment
response = client.embeddings.create(
    model="text-embedding-3-small",                # record the exact model name with the index
    input=["Can I return worn shoes?", "Is it possible to send shoes back?"],
)
vectors = [item.embedding for item in response.data]
print(len(vectors), "vectors of", len(vectors[0]), "dimensions")
```

### Перехід між моделями векторних подань

Зміна моделі — це міграція:

1. Порівняйте recall@k, MRR і nDCG на тих самих розмічених запитах кожною мовою, включно з міжмовними.
2. Оцініть кінцеві відповіді RAG, затримку й вартість подань і пошуку.
3. Звірте допустиму довжину з розмірами фрагментів.
4. Побудуйте окремий новий індекс усього корпусу й перевіряйте сумісність моделі запиту.
5. Перемикайтеся після виконання погоджених критеріїв для всіх важливих груп. Збережіть шлях відкату.

## Приклад проєкту

Метод реалізований і покритий тестами в [examples/llm-testing/03-similarity-thresholds](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/03-similarity-thresholds): міри подібності, калібрування зі складними негативними прикладами та повнота індексу. Тести працюють без мережі, моделі та ключів API:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/03-similarity-thresholds
```

## Типові помилки

- **Копіювати поріг** з іншої моделі чи предметної області.
- **Доводити правильність косинусною подібністю.**
- **Змішувати несумісні подання** в одному індексі.
- **Ігнорувати ліміт довжини** текстових фрагментів.
- **Не перевіряти повноту, фільтри й актуальність.**
- **Використовувати скалярний добуток без урахування нормалізації.**

## Підсумок

- Векторне подання кодує текст; порівнюйте сумісні моделі й версії.
- Для одиничних векторів три міри дають однакове ранжування, але не однакові числові значення.
- Тема не доводить логічної еквівалентності чи істинності.
- Калібруйте пороги як класифікатори за ціною помилок.
- Вимірюйте повноту наближеного пошуку, права, актуальність і сумісність.
- Використовуйте подання для дедуплікації, аналізу збоїв і покриття.
