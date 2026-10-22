# Векторні подання та семантична подібність

**Embedding** — це список чисел, що представляє зміст фрагмента тексту. Embeddings присутні скрізь в LLM системах: retrieval у RAG pipelines, semantic caches, topic guardrails, дедуплікація, кластеризація і similarity-based assertions у тестах. Тестувальник зустрічає їх двічі: як компонент system under test і як інструмент для побудови тестів. Обидві ролі вимагають однакового розуміння того, що означають similarity scores і, що важливіше, чого вони не означають.

**Передумови:** [Як LLM генерують текст](/learn/llm?topic=llm-foundations).

## Що таке векторне подання

**Embedding model** — функція, що відображає текст у vector фіксованої довжини `d`, зазвичай від 256 до 3 072 чисел. Її тренують так, щоб тексти зі схожим змістом відображалися у vectors зі схожим напрямком. Звичайний метод — **contrastive learning**: модель бачить пари текстів, що пасують одне одному (питання і відповідь, речення і його парафраз), і пари, що не пасують, і її оптимізують зближувати перші та розводити другі.

Embedding models окремі від chat models. Вони мають власні API endpoints чи бібліотеки, власні версії, власну максимальну довжину input і власне покриття мов. Для того самого input і тієї самої версії моделі вони повертають той самий vector (з точністю до дрібних floating-point відмінностей), тому тестувати їх значно легше, ніж генератори.

```diagram
"Can I return worn shoes?"          ──► embedding model ──► [0.021, -0.113, 0.087, … ]  (d numbers)
"Is it possible to send shoes back?" ──► embedding model ──► [0.019, -0.098, 0.091, … ]
                                                               ▲ similar direction = similar meaning
"What is your delivery time?"       ──► embedding model ──► [-0.140, 0.052, 0.006, … ]
```

Окремі числа не мають людського змісту. Змістовні лише співвідношення між vectors, виміряні similarity function, і лише для vectors, створених **тією самою версією моделі**.

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

Багато embedding APIs повертають vectors, уже нормалізовані до довжини 1. Тоді dot product, cosine і Euclidean distance дають однаковий ranking, і vector databases можуть використовувати найшвидшу міру. Якщо vectors **не** нормалізовані, dot product змішує напрямок з довжиною і може поставити довгий, слабо пов'язаний vector вище короткого, тісно пов'язаного. Скрипт реалізує формули й перевіряє тотожності.

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

### Як читати значення similarity

Cosine similarity визначена від −1 до 1, але реальні embedding models використовують лише частину цього діапазону. У багатьох моделей навіть непов'язані тексти мають score помітно вище 0, а scores парафраз і просто тематичних сусідів перекриваються. Шкала **залежить від моделі**: threshold 0.8 може бути суворим для однієї моделі й м'яким для іншої. Ніколи не копіюйте threshold зі статті чи з іншої моделі; калібруйте його (див. нижче).

## Подібність та еквівалентність

Embeddings значно краще вловлюють тему і формулювання, ніж логіку. Два речення на одну тему можуть мати дуже високу similarity і стверджувати протилежне. Скрипт нижче використовує найпростіший embedding — bag-of-words vector з кількостей слів, — щоб механізм був видимим. Навчені embedding models значно краще працюють із синонімами, але мають ті самі слабкості на запереченнях, числах і ролях — у меншій, але все ще важливій мірі.

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

Перші три пари означають різне і мають високий score; остання пара означає те саме і має низький. Навчена модель виправляє останній випадок (вона знає, що «send back» і «return» пов'язані), але й далі оцінює перші три пари як близькі, бо в них спільні тема, лексика і структура.

| Клас збою | Приклад пари | Чому similarity вводить в оману | Кращий oracle |
|---|---|---|---|
| Заперечення | «approved» vs «not approved» | Одне коротке слово перевертає зміст | Перевірка факту чи claim, judge |
| Числа й одиниці | «30 days» vs «60 days» | Числа мало важать у vector | Витягнути число і порівняти точно |
| Ролі й порядок | «Kyiv to Lviv» vs «Lviv to Kyiv» | Ті самі слова, інше відношення | Structured extraction, judge |
| Обсяг і квантори | «all items» vs «some items» | Квантори — маленькі tokens | Rubric, що називає квантор |
| Підміна сутностей | «order A-1042» vs «order A-1024» | IDs схожі між собою | Exact match по IDs |

**Наслідок для тестування:** similarity score може сказати, що відповідь *про те саме*. Він не може сказати, що відповідь *правильна*. Використовуйте similarity для retrieval, кластеризації і як дешевий перший фільтр; для correctness — перевірки фактів, structured extraction або валідовані judges ([Програмні оцінювачі та метрики](/learn/llm?topic=code-based-scorers), [LLM як оцінювач](/learn/llm?topic=model-graded-evaluation)).

## Калібрування порога подібності

Коли система чи тест використовує similarity threshold, наприклад «вважати відповідь відповідною reference, якщо cosine ≥ t» або «віддати кешовану відповідь, якщо нове питання ближче за t до кешованого», threshold — це бінарний classifier, і калібрувати його треба відповідно:

```diagram
1. Collect pairs from the real domain (hundreds, not dozens), including hard negatives:
   same topic, different meaning.
2. Have humans label each pair: equivalent (1) or not (0).
3. Compute the similarity of every pair with the exact model version you will use.
4. Sweep thresholds; at each one compute precision, recall, F1 and false-positive rate.
5. Choose the threshold from the cost of errors, not from the prettiest metric.
6. Confirm the choice on a separate held-out set of labelled pairs.
```

Скрипт перебирає thresholds на невеликому позначеному наборі. Scores — приклад даних у реалістичному діапазоні.

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

- **Перекриття — норма.** Еквівалентні й нееквівалентні пари ділять діапазон 0.78–0.89. Жоден threshold не розділяє їх ідеально; кожен вибір обмінює false positives на false negatives.
- **Правильний threshold залежить від ціни кожної помилки.** Для semantic cache false positive віддає користувачу чужу відповідь («скасуй моє замовлення» отримує кешовану відповідь на «не скасовуй моє замовлення»), тож найважливіша висока precision, навіть ціною меншої кількості cache hits. Для test assertion, що лише попередньо фільтрує відповіді для judge, важливіший recall.
- **Малі вибірки вводять в оману.** На 24 парах одна пара зсуває precision на кілька пунктів. Використовуйте сотні пар і показуйте невизначеність як confidence interval ([Статистика для оцінювання](/learn/llm?topic=eval-statistics) показує як).

## Векторний пошук

Щоб знайти документи, найсхожіші на запит, система порівнює vector запиту зі збереженими vectors.

- **Exact k-nearest-neighbour (kNN) search** порівнює запит з кожним збереженим vector. Він завжди правильний, але cost росте лінійно з кількістю vectors.
- **Approximate nearest-neighbour (ANN) search** використовує index, щоб переглядати лише частину колекції. Поширені типи index — graph-based (HNSW) і cluster-based (IVF, «inverted file»). ANN значно швидший і зрідка пропускає справжніх найближчих сусідів.

Якість ANN вимірюють як **recall@k відносно exact search**: для вибірки запитів — частка справжніх top-k результатів, які index теж повертає. Parameters index обмінюють recall на швидкість: для IVF `nprobe` — кількість кластерів, у яких шукають; для HNSW `ef_search` — розмір списку кандидатів. Симуляція нижче будує простий IVF index над випадковими unit vectors і вимірює recall для кількох значень `nprobe`.

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

Випадкові vectors не мають кластерної структури, тож це близько до найгіршого випадку; реальні embeddings кластеризуються за темами й зазвичай досягають високого recall, переглядаючи меншу частку. Урок — у методі, а не в числах: **вимірюйте recall index на власних даних**, бо неправильно налаштований index мовчки прибирає релевантні документи ще до того, як мовна модель їх побачить.

Інша поведінка vector store, яку треба тестувати:

- **Metadata filters.** Production запити зазвичай фільтрують за tenant, мовою, продуктом чи правами доступу. Перевірте, що фільтри застосовуються *до* повернення результатів (користувач ніколи не повинен отримати документ іншого tenant) і що фільтрація не обвалює recall, коли збігів мало.
- **Freshness.** Після оновлення чи видалення документа старий vector має зникнути. Тестуйте шляхи оновлення і видалення, а не лише вставки.
- **Узгодженість моделі.** Vectors запиту і документів мають походити від однієї версії embedding model. Зберігайте назву й версію моделі разом з index і явно падайте при невідповідності.

## Векторні подання в інженерії тестування

Embeddings також практичний інструмент тестувальника:

| Задача | Як допомагають embeddings | Обережно |
|---|---|---|
| Дедуплікація evaluation dataset | Cases з дуже високою similarity (наприклад вище каліброваних 0.95) — ймовірні дублікати; перегляньте й об'єднайте | Майже-дублікати можуть відрізнятися однією критичною деталлю; переглядайте перед видаленням |
| Кластеризація failures для error analysis | Зробіть embeddings провальних outputs чи inputs і кластеризуйте, щоб побачити групи збоїв | Кластери відображають тему, а не причину; називайте їх після читання прикладів |
| Аналіз coverage | Зробіть embeddings production запитів і evaluation cases; production кластери без близьких cases — прогалини coverage | Потрібен доступ до (анонімізованих) production даних |
| Тестування semantic cache | Генеруйте пари майже однакових питань з різним змістом і перевіряйте, що cache не відповідає на одне відповіддю на інше | False hits — дефекти, видимі користувачу |
| Виявлення input drift | Порівнюйте distribution сьогоднішніх запитів з минуломісячними | Обережно; див. [Якість у промисловому середовищі](/learn/llm?topic=production-quality) |

Перевірка coverage з реальною embedding model займає кілька рядків. Запустіть її на своїй машині:

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

Публічні leaderboards на кшталт MTEB порівнюють embedding models на багатьох задачах і мовах — це добра відправна точка. Вони не замінюють тестування на ваших даних, бо якість retrieval сильно залежить від доменної лексики, стилю документів і змішування мов. Оцінюйте кандидатів retrieval metrics з [Оцінювання систем RAG](/learn/llm?topic=rag-testing) на позначених запитах з вашого домену, а також порівнюйте:

- **максимальну довжину input:** текст понад неї обрізається, часто мовчки, тож довгі chunks втрачають кінець;
- **мови:** перевірте кожну мову користувачів і cross-language retrieval, якщо питають однією мовою про документи іншою;
- **розмірність, latency і cost:** більші vectors коштують більше в зберіганні та пошуку;
- **versioning:** заміна моделі означає повторне embedding усього корпусу, бо vectors різних моделей непорівнянні.

Типовий виклик API виглядає так (OpenAI Python SDK; інші providers схожі):

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

### Перехід на іншу embedding model

Зміна моделі — це міграція:

1. Виміряйте якість retrieval (recall@k, MRR, nDCG) старої й нової моделі на тих самих позначених запитах кожною підтримуваною мовою, включно з cross-language запитами.
2. Виміряйте end-to-end якість відповідей на RAG evaluation set, а також latency і cost embedding та пошуку.
3. Перевірте нову максимальну довжину input проти розмірів ваших chunks.
4. Перегенеруйте embeddings усього корпусу в новий index замість змішування vectors; зберігайте версію моделі в metadata index і перевіряйте під час запиту, що запит і index використовують одну модель.
5. Перемикайтеся лише тоді, коли нова модель щонайменше не гірша за погодженими metrics зі статистичною впевненістю і жодна мова чи сегмент не регресує понад tolerance; залиште старий index для rollback.

## Приклад проєкту

Метод цього chapter реалізований і покритий тестами в [examples/llm-testing/03-similarity-thresholds](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/03-similarity-thresholds): міри similarity, command-line tool для калібрування threshold з позначеним набором, що містить hard negatives, і вимірювання recall approximate index. Усі тести працюють offline, без моделі та API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/03-similarity-thresholds
```

## Типові помилки

- **Повторно використовувати similarity threshold** з іншої моделі, іншого домену чи статті.
- **Використовувати cosine similarity як oracle правильності** для відповідей, де важливі заперечення, числа чи ролі.
- **Змішувати vectors різних embedding models чи версій** в одному index.
- **Ігнорувати обрізання input** довгих chunks embedding model.
- **Не вимірювати recall ANN** і не тестувати metadata filters, оновлення та видалення.
- **Використовувати dot product на ненормалізованих vectors** і отримувати ranking, спотворений довжиною.

## Підсумок

- Embedding відображає текст у vector; схожий зміст — схожий напрямок. Vectors порівнянні лише в межах однієї версії моделі.
- Cosine similarity, dot product і Euclidean distance еквівалентні для нормалізованих vectors. Шкали similarity залежать від моделі.
- Similarity — не еквівалентність: заперечення, числа, ролі, квантори та IDs — місця, де вона підводить. Використовуйте її для теми, а не для істини.
- Будь-який similarity threshold — це classifier; калібруйте його на позначених парах і вибирайте з огляду на ціну помилок.
- Approximate vector search обмінює recall на швидкість; вимірюйте recall index, фільтри, freshness і узгодженість моделі.
- Embeddings — також інструмент тестування для дедуплікації, кластеризації failures і аналізу coverage.
