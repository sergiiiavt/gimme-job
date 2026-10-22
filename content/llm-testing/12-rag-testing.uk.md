# Оцінювання систем RAG

**Генерація з доповненням пошуком (retrieval-augmented generation, RAG)** знаходить документи під час запиту й передає їх моделі: правила, інструкції, звернення чи дані товарів. Це дає доступ до актуальних і приватних відомостей без донавчання та дозволяє наводити джерела.

Правильна відповідь потребує завантаження документа, належного поділу, пошуку, ранжування, використання й цитування. Загальна оцінка не визначає, на якому етапі виникла помилка. Перевіряйте кожен етап і систему загалом.

**Передумови:** [Векторні подання та семантична подібність](/learn/llm?topic=embeddings-similarity), [Методологія оцінювання та набори даних](/learn/llm?topic=evaluation-fundamentals), [LLM як оцінювач](/learn/llm?topic=model-graded-evaluation).

## Як працює система RAG

```diagram
Ingestion      load documents, parse formats, clean, attach metadata (source, date, owner, access)
     ↓
Chunking       split documents into passages small enough to retrieve precisely
     ↓
Indexing       embeddings in a vector index and/or a lexical (BM25) index
     ↓
Retrieval      find candidate chunks for the question: semantic, lexical or both (hybrid)
     ↓
Reranking      reorder the candidates with a stronger, slower model; keep the top few
     ↓
Context        assemble the chosen chunks, with IDs, into the prompt
     ↓
Generation     the model answers from the context and cites chunk IDs
     ↓
Validation     check citations, links, refusals and the output contract in code
```

Перші три кроки виконуються offline, коли змінюються документи; решта — для кожного питання. Кожен крок має власні параметри (розмір chunk, кількість кандидатів, reranker, prompt) і власні способи зламатися, тому RAG тестують етап за етапом.

## Де виникають збої RAG

| Етап | Збій | Симптом | Тест |
|---|---|---|---|
| Ingestion | Документ відсутній, обрізаний або неправильно розібраний (таблиці, PDF) | Відповідям бракує інформації, яка існує | Кількість документів, помилки розбору, порівняння вибірок із джерелом |
| Chunking | Факт розірвано між двома chunks, або chunk втратив заголовок | Знайдено правильний chunk, але відповіді в ньому немає | Інваріанти: жодного втраченого тексту, ліміти розміру, заголовки збережено |
| Retrieval | Релевантного chunk немає серед кандидатів | Неправильна чи відсутня відповідь попри хороші документи | Recall@k проти позначених релевантних chunks |
| Ranking | Релевантний chunk знайдено, але він надто низько, щоб його використали | Відповіді залежать від порядку chunks | MRR і nDCG@k |
| Generation | Модель ігнорує context, неправильно його читає або виходить за його межі | Непідтверджені твердження, неправильні числа | Faithfulness тверджень на фіксованому context, про який відомо, що він правильний |
| Citation | Citations вказують на chunks, що не підтверджують твердження | Користувачі не можуть перевірити відповідь | Перевірки citations у code, перевірка підтвердження judge |
| Abstention | Система відповідає, коли документи не містять відповіді | Упевнені вигадані відповіді | Питання без відповіді в dataset |
| Доступ | Знайдено chunk іншого клієнта чи документ з обмеженим доступом | Витік даних | Фільтри tenant і прав, перевірені adversarial запитами |

## Завантаження й поділ документів

Chunking визначає, що retrieval зможе знайти. Завеликий chunk розмиває свій embedding і заповнює context шумом; замалий втрачає context, що робить його зрозумілим. Хай яка стратегія, деякі властивості мають виконуватися для кожного документа, і їх можна перевірити напряму:

```python
import re

POLICY = """# Returns
Unworn items with the tags attached can be returned within 30 days of delivery. Start a return at
shop.example/returns and print the prepaid label. Sale items can be returned on the same terms.
Items bought with a gift card are refunded as store credit.

# Refunds
Refunds go to the original payment method within 5 business days after the return reaches our
warehouse. Delivery costs are refunded only when the whole order is returned.

# Delivery
Standard delivery takes 3-5 business days and is free for orders over 50 EUR. Express delivery
takes 1-2 business days and costs 9 EUR. Delivery dates are estimates, not guarantees."""


def sentences(text: str) -> list[str]:
    return re.split(r"(?<=\.)\s+", " ".join(text.split()))


def chunk(document: str, max_words: int = 20, overlap: int = 1) -> list[dict]:
    """Split by section, then into chunks of whole sentences with at most max_words words.
    Neighbouring chunks share up to `overlap` sentences, and every chunk keeps its section title."""
    chunks = []
    for section in re.split(r"^# ", document, flags=re.MULTILINE)[1:]:
        title, body = section.split("\n", 1)
        parts, start = sentences(body), 0
        while start < len(parts):
            end, words = start, 0
            while end < len(parts):
                size = len(parts[end].split())
                if end > start and words + size > max_words:
                    break
                words += size
                end += 1
            chunks.append({"id": f"{title.lower()}-{len(chunks)}", "section": title, "sentences": parts[start:end]})
            if end == len(parts):
                break
            start = max(end - overlap, start + 1)
    return chunks


chunks = chunk(POLICY)
for item in chunks:
    text = " ".join(item["sentences"])
    print(f"{item['id']:<11} {len(text.split()):>2} words  {text[:58]}...")

# Invariants worth testing for every chunker and every document
body = "\n".join(line for line in POLICY.splitlines() if not line.startswith("#"))
lost = [s for s in sentences(body) if not any(s in item["sentences"] for item in chunks)]
shared = [(a["id"], b["id"], s) for a, b in zip(chunks, chunks[1:]) for s in a["sentences"] if s in b["sentences"]]
print("sentences lost:", lost)
print("largest chunk:", max(len(" ".join(item["sentences"]).split()) for item in chunks), "words")
print("shared by neighbours:", shared)
```

Результат:

```text
returns-0   14 words  Unworn items with the tags attached can be returned within...
returns-1   19 words  Start a return at shop.example/returns and print the prepa...
returns-2   20 words  Sale items can be returned on the same terms. Items bought...
refunds-3   17 words  Refunds go to the original payment method within 5 busines...
refunds-4   11 words  Delivery costs are refunded only when the whole order is r...
delivery-5  14 words  Standard delivery takes 3-5 business days and is free for ...
delivery-6  16 words  Express delivery takes 1-2 business days and costs 9 EUR. ...
sentences lost: []
largest chunk: 20 words
shared by neighbours: [('returns-1', 'returns-2', 'Sale items can be returned on the same terms.')]
```

Інваріанти, які варто тестувати для кожного chunker: жоден текст не втрачено, кожен chunk дотримується ліміту розміру (крім одного речення, довшого за ліміт, яке не можна відкидати), chunks ніколи не перетинають межі розділів, і кожен chunk несе потрібні metadata: заголовок розділу, документ-джерело, дату і права доступу. Перекриття означає, що речення на межі доступне обом сусідам, ціною певного дублювання в index.

## Метрики пошуку

Retrieval оцінюють проти **labels релевантності**: для кожного питання — chunks, що містять відповідь. З ними ранжовані результати перетворюються на числа:

```text
hit@k        1 if at least one relevant chunk is in the top k, else 0
recall@k     relevant chunks in the top k / all relevant chunks for the question
precision@k  relevant chunks in the top k / k
MRR          mean over questions of 1 / rank of the first relevant chunk (0 when none is found)
nDCG@k       Σ relevance / log2(rank + 1) over the top k, divided by the same sum for a perfect ranking
```

Скрипт порівнює лексичний retriever із тим самим retriever плюс reranker на п'яти позначених питаннях по chunks вище:

```python
import math

# For each question: the chunks that contain the answer (labels), and the top 3 chunks of two retrievers
relevant = {
    "Can I return sale items?": {"returns-1", "returns-2"},
    "When do I get my money back?": {"refunds-3"},
    "Is express delivery free?": {"delivery-6"},
    "Can I return a gift and get cash?": {"returns-2"},
    "Are delivery costs refunded?": {"refunds-4"},
}
rankings = {
    "lexical": {
        "Can I return sale items?": ["returns-0", "returns-2", "returns-1"],
        "When do I get my money back?": ["refunds-4", "returns-2", "refunds-3"],
        "Is express delivery free?": ["delivery-5", "delivery-6", "refunds-4"],
        "Can I return a gift and get cash?": ["returns-0", "refunds-3", "refunds-4"],
        "Are delivery costs refunded?": ["delivery-5", "refunds-4", "delivery-6"],
    },
    "lexical + reranker": {
        "Can I return sale items?": ["returns-2", "returns-1", "returns-0"],
        "When do I get my money back?": ["refunds-3", "refunds-4", "returns-2"],
        "Is express delivery free?": ["delivery-6", "delivery-5", "refunds-4"],
        "Can I return a gift and get cash?": ["refunds-3", "returns-0", "refunds-4"],
        "Are delivery costs refunded?": ["refunds-4", "delivery-5", "delivery-6"],
    },
}


def metrics(expected: set[str], ranked: list[str], k: int = 3) -> dict[str, float]:
    hits = [chunk in expected for chunk in ranked[:k]]
    first = next((rank for rank, hit in enumerate(hits, 1) if hit), None)
    dcg = sum(hit / math.log2(rank + 1) for rank, hit in enumerate(hits, 1))
    ideal = sum(1 / math.log2(rank + 1) for rank in range(1, min(len(expected), k) + 1))
    return {"hit@3": float(any(hits)), "recall@3": sum(hits) / len(expected), "precision@3": sum(hits) / k,
            "MRR": 1 / first if first else 0.0, "nDCG@3": dcg / ideal}


for name, ranked_by_question in rankings.items():
    per_question = [metrics(relevant[question], ranked_by_question[question]) for question in relevant]
    averages = {key: sum(m[key] for m in per_question) / len(per_question) for key in per_question[0]}
    print(f"{name:<19}" + "  ".join(f"{key} {value:.2f}" for key, value in averages.items()))
```

Результат:

```text
lexical            hit@3 0.80  recall@3 0.80  precision@3 0.33  MRR 0.37  nDCG@3 0.49
lexical + reranker hit@3 0.80  recall@3 0.80  precision@3 0.33  MRR 0.80  nDCG@3 0.80
```

Reranker піднімає релевантні chunks нагору: MRR і nDCG різко зростають. Recall не змінюється, бо reranker може лише переставити кандидатів, які отримав. Питання про гроші за подарунок губиться ще до reranking: слово «cash» не трапляється в chunk, що каже «store credit». Щоб це виправити, потрібен кращий retrieval: hybrid search, що поєднує embeddings з BM25, переписування запиту або додавання context до chunks перед індексуванням. Anthropic повідомила, що contextual retrieval, який додає до кожного chunk короткий опис документа навколо нього, скоротив невдалі retrievals на 49%, а разом із reranking — на 67%.

Читайте metrics у такому порядку: **спершу recall** (чи досяжна відповідь узагалі?), потім **MRR і nDCG** (чи вона близько до верху?), і precision останньою (скільки шуму потрапляє в context?).

## Розмітка релевантності для пошуку

Labels релевантності — це такий самий dataset ([Методологія оцінювання та набори даних](/learn/llm?topic=evaluation-fundamentals)), але зі своїми способами побудови:

- **Питання з реального трафіку,** які позначає доменний експерт, шукаючи в документах кожен chunk, що на них відповідає.
- **Синтетичні питання на chunk:** модель пише питання, на які відповідає chunk, а людина їх перевіряє. Такі питання зазвичай повторюють слова самого chunk, що підігрує лексичному retrieval, тож змішуйте їх із реальними.
- **Pooling:** щоб не позначати кожен chunk для кожного питання, позначайте об'єднання верхніх результатів кількох різних retrievers. Це стандартна практика кампаній з evaluation information retrieval.
- **Градуйована релевантність:** «відповідає на питання» і «пов'язаний фон» можуть мати різну вагу в nDCG.

Перепозначайте, коли змінюються документи: ID chunk, якого вже не існує, робить цілком хороший retriever схожим на зламаний.

## Оцінювання генерації: тріада RAG

Три питання визначають, де стався збій — у retrieval чи в генерації:

| Score | Питання | Низький score вказує на | Типове виправлення |
|---|---|---|---|
| Context relevance | Чи стосується знайдений context питання? | Retrieval або chunking | Розмір chunk, hybrid search, reranking, переписування запиту |
| Groundedness | Чи кожне твердження відповіді підтверджене context? | Генерацію | Суворіші інструкції, обов'язкові citations, правила abstention, інша модель |
| Answer relevance | Чи відповідь стосується питання? | Prompt або розуміння питання | Інструкції, уточнювальні питання |

Оцінюйте генерацію й окремо: запускайте генератор із **context, про який відомо, що він правильний** — позначеними релевантними chunks — замість знайдених. Якщо відповіді не проходять навіть так, проблема в генераторі чи prompt; якщо проходять — у retrieval. Те саме розділення тримає тести генерації стабільними, поки змінюється retriever.

## Відповідність джерелам і посилання

Faithfulness перевіряють твердження за твердженням: розбийте відповідь на твердження, а потім для кожного вирішіть, чи підтверджує його context. FActScore застосовує ту саму ідею до довгих текстів з атомарними фактами. У production системах рішення про підтвердження ухвалює judge, валідований проти human labels ([LLM як оцінювач](/learn/llm?topic=model-graded-evaluation)). Структура перевірки та сама й із замінником на рівні code:

```python
import re

retrieved = {
    "refunds-3": "Refunds go to the original payment method within 5 business days after the return reaches our warehouse.",
    "refunds-4": "Delivery costs are refunded only when the whole order is returned.",
}
# The answer, split into claims, each with the chunks it cites
answer = [
    ("Your refund goes to the original payment method.", ["refunds-3"]),
    ("It arrives within 5 business days after the return reaches our warehouse.", ["refunds-3"]),
    ("Delivery costs are always refunded.", ["refunds-4"]),
    ("You will also receive a 10% discount code for your next order.", []),
]
STOP = {"the", "a", "an", "is", "are", "to", "your", "you", "will", "for", "it", "our", "of", "and", "after", "within"}


def content_words(text: str) -> set[str]:
    return {word for word in re.findall(r"[a-z0-9%]+", text.lower()) if word not in STOP}


def supported(claim: str, sources: list[str]) -> bool:
    """Code-level stand-in for a judge: every number must occur in a cited source, most content words too,
    and a claim that says always or never must not contradict an only or except in the source."""
    text = " ".join(sources).lower()
    words = content_words(claim)
    numbers_ok = all(number in text for number in re.findall(r"\d+%?", claim))
    overlap = len(words & content_words(text)) / len(words) if words else 0.0
    absolute = re.search(r"\b(always|never|all|any)\b", claim.lower()) and re.search(r"\b(only|except|unless)\b", text)
    return numbers_ok and overlap >= 0.6 and not absolute


results = []
for claim, cited in answer:
    sources = [retrieved[chunk_id] for chunk_id in cited if chunk_id in retrieved]
    results.append((claim, bool(cited), supported(claim, sources)))
    print(f"{'supported' if results[-1][2] else 'NOT supported':<14} cited={cited}  {claim}")

faithfulness = sum(ok for _, _, ok in results) / len(results)
cited_and_supported = sum(ok for _, has_citation, ok in results if has_citation) / sum(has for _, has, _ in results)
print(f"faithfulness {faithfulness:.0%} of claims; citations that support their claim {cited_and_supported:.0%}")
```

Результат:

```text
supported      cited=['refunds-3']  Your refund goes to the original payment method.
supported      cited=['refunds-3']  It arrives within 5 business days after the return reaches our warehouse.
NOT supported  cited=['refunds-4']  Delivery costs are always refunded.
NOT supported  cited=[]  You will also receive a 10% discount code for your next order.
faithfulness 50% of claims; citations that support their claim 67%
```

Для третього твердження відповідь цитує справжній chunk, але chunk каже протилежне («only when the whole order is returned»); четверте твердження взагалі не має джерела. Обидва види збоїв поширені: citation доводить, що chunk знайдено, а не що він підтверджує твердження. Розділяйте перевірки відповідно: code перевіряє, що кожен процитований ID є серед знайдених і що кожне твердження має citation; валідований judge вирішує, чи процитований текст підтверджує твердження.

## Запитання без відповіді

RAG система має розпізнавати, коли документи не містять відповіді, і казати про це, а не заповнювати прогалину загальними знаннями моделі. Тому dataset потребує питань без відповіді, а результати — таблиці, де більше одного числа:

```python
from collections import Counter

# (question is answerable from the documents, the system answered instead of abstaining, the answer was correct)
results = (
    [(True, True, True)] * 70 + [(True, True, False)] * 8 + [(True, False, False)] * 7 +
    [(False, False, False)] * 9 + [(False, True, False)] * 6
)

outcomes = Counter()
for answerable, answered, correct in results:
    if answerable and answered:
        outcomes["correct answer" if correct else "wrong answer"] += 1
    elif answerable:
        outcomes["false abstention"] += 1
    elif answered:
        outcomes["answer to an unanswerable question"] += 1
    else:
        outcomes["correct abstention"] += 1

for outcome, count in outcomes.items():
    print(f"{outcome:<36} {count:>3}")

answerable = sum(a for a, _, _ in results)
unanswerable = len(results) - answerable
print(f"accuracy on answerable questions      {outcomes['correct answer'] / answerable:.0%}")
print(f"abstains when it should               {outcomes['correct abstention'] / unanswerable:.0%}")
print(f"answers only when sure (precision)    {outcomes['correct answer'] / (outcomes['correct answer'] + outcomes['wrong answer'] + outcomes['answer to an unanswerable question']):.0%}")
```

Результат:

```text
correct answer                        70
wrong answer                           8
false abstention                       7
correct abstention                     9
answer to an unanswerable question     6
accuracy on answerable questions      82%
abstains when it should               60%
answers only when sure (precision)    83%
```

Шість із п'ятнадцяти питань без відповіді отримали вигадану відповідь — найшкідливіший результат для support системи. Посилення правила abstention зазвичай обмінює це на хибні відмови для питань, що мають відповідь, тож відстежуйте обидва і визначайте баланс разом із власником продукту. Зверніть увагу: «документи цього не кажуть» і «відповідь — ні» — різні речі: питання про доставку в Антарктиду не має відповіді, лише якщо жодна політика її не згадує.

## Перевірки стійкості

Метаморфні тести ([LLM як оцінювач](/learn/llm?topic=model-graded-evaluation)) ловлять збої RAG, які пропускають позначені datasets:

- **Порядок chunks:** перемішайте знайдені chunks у context; відповідь не має змінитися. Моделі краще використовують інформацію на початку й наприкінці довгого context, ніж посередині, тож ефекти порядку реальні.
- **Відволікачі:** додайте релевантний на вигляд, але неправильний chunk, наприклад застарілу політику; відповідь має відповідати чинній або вказати на суперечність.
- **Перефразовані питання:** те саме питання іншими словами, іншою мовою, з помилками; retrieval має знайти ті самі chunks.
- **Застарілі й суперечливі документи:** дві версії політики; система має віддавати перевагу новішій за metadata, а не випадково.
- **Контроль доступу:** питання, сконструйовані, щоб знайти tickets іншого клієнта чи внутрішній документ, мають не повертати з них нічого. Фільтри за tenant і правами належать до самого запиту retrieval, а не до prompt.

## Бібліотеки метрик

Ragas, ARES і TruLens надають готові RAG metrics, як-от context precision і recall, faithfulness і answer relevance. Більшість із них використовує модель як judge, тож успадковує все з попереднього chapter: їм потрібна validation проти ваших labels, перш ніж їхні числа щось означатимуть, а їхні версії треба фіксувати. Детерміновані metrics retrieval проти labels релевантності модель узагалі не потребують; обчислюйте їх самі, де можете, а metrics бібліотек використовуйте для частин, що потребують читання.

## Безпечні зміни системи RAG

Кожен параметр змінює поведінку: розмір chunk, перекриття, embedding модель, кількість кандидатів, reranker, prompt. Сприймайте зміни як експерименти:

- **Змінюйте одну річ за раз** і порівнюйте з baseline на тих самих питаннях ([Статистика для оцінювання](/learn/llm?topic=eval-statistics)).
- **Вимірюйте retrieval і end-to-end результати окремо,** щоб виграш у retrieval не сховався за втратою в генерації.
- **Версіонуйте index** разом із chunker, embedding моделлю і знімком документів; нова embedding модель означає перерахунок усіх embeddings, і запити, закодовані старою моделлю, ніколи не повинні шукати в новому index.
- **Стежте за вартістю і latency:** більше кандидатів і reranker покращують якість і забирають час на кожному питанні.

## Приклад із практики: RAG цього сайту

Learning Path Advisor у GimmeJob шукає в одному канонічному RAG pipeline, що працює в Cloudflare Worker, і застосовує кілька практик цього chapter:

- **Одиниці retrieval — це розділи.** Кожен опублікований розділ `##` навчальних матеріалів, зокрема цього chapter, стає окремим документом із глибоким посиланням, тож retrieval може вказати на найвужчий корисний фрагмент.
- **Шлях деградації.** Векторний пошук дає семантичних кандидатів; лексичний ranker у тому самому pipeline бере роботу на себе, коли векторний index недоступний.
- **Детерміновані metrics retrieval.** AI service реалізує precision@k, recall@k, hit rate@k, reciprocal rank і nDCG@k з unit tests (`ai-service/src/gimmejob_ai/rag_metrics.py`).
- **Scores якості під час роботи.** Traces записують scores на кшталт найвищого score retrieval, частки обґрунтованих елементів і валідності процитованих джерел.
- **Посилання перевіряються за формою.** Споживачі перевіряють, що процитований шлях — канонічний навчальний маршрут, а не довіряють output моделі.

## Приклад проєкту

Методи цього chapter реалізовані й покриті тестами в [examples/llm-testing/12-rag-testing](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/12-rag-testing): chunker з property-based тестами інваріантів, BM25 retriever, розписаний крок за кроком, metrics retrieval проти позначених питань, невеликий RAG pipeline з fake генератором, перевірки faithfulness і citations на рівні тверджень, metrics abstention і метаморфні тести на порядок chunks, відволікачі, перефразування та ізоляцію tenants. Усі тести працюють offline, без моделі та API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/12-rag-testing
```

## Типові помилки

- **Лише end-to-end scores,** які не можуть сказати, що зламалося — retrieval чи генерація.
- **Покращувати ranking, коли проблема в recall:** reranker не може переставити те, чого так і не знайшли.
- **Лише синтетичні питання,** які повторюють слова chunks і підігрують лексичному retrieval.
- **Довіряти citations,** не перевіривши, що процитований текст підтверджує твердження.
- **Жодного питання без відповіді** в dataset.
- **Labels релевантності, що вказують на ID chunks зі старішого index.**
- **Контроль доступу в prompt** замість запиту retrieval.
- **Metrics бібліотек без validation** проти власних labels.

## Підсумок

- Перевіряйте завантаження, поділ, індексування, пошук, повторне ранжування, контекст і генерацію окремо.
- Для поділу тексту задавайте інваріанти збереження змісту, розміру, меж розділів і метаданих.
- Оцінюйте пошук за розміченою релевантністю: recall@k, MRR, nDCG та precision мають різні призначення.
- Локалізуйте помилки, зокрема повторною генерацією із завідомо правильним контекстом.
- Перевіряйте підтвердженість кожного твердження й коректність посилань.
- Окремо вимірюйте вигадані відповіді й хибні відмови на питаннях без джерела.
- Перевіряйте порядок, сторонні фрагменти, перефразування, застарілі документи й доступ. Змінюйте один параметр за раз.
