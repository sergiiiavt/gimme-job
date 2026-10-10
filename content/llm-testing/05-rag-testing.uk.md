Retrieval-augmented generation (RAG) відповідає на питання з документів, отриманих під час запиту. Коли RAG відповідь неправильна, причина може бути в будь-якому етапі: ingestion, chunking, embedding, retrieval, ranking, prompt assembly чи generation. Мета тестування RAG — **знайти етап, що зламався**, з evidence.

## 1. Розділи pipeline

```text
ingest -> parse -> chunk -> embed -> index          (offline)
question -> rewrite -> retrieve top-k -> rerank -> assemble prompt -> generate -> cite   (online)
```

Тестуй етапи окремо, потім разом:

| Етап | Питання | Evidence |
|---|---|---|
| Ingestion | Чи кожен документ потрапив і правильно розпарсений? | Кількість документів, parse error logs, вибіркові diffs |
| Chunking | Чи chunks зберігають цілісність змісту? | Розподіл розмірів chunks, ручний огляд точок розбиття |
| Retrieval | Чи правильні chunks у top k? | Retrieval metrics проти позначених релевантних chunks |
| Generation | Маючи правильні chunks, чи відповідь коректна і faithful? | Faithfulness і correctness evals з фіксованим context |
| End to end | Чи отримує користувач правильну відповідь з citation? | Answer correctness і перевірки citations |

Ключова техніка: **оцінюй generation з фіксованим, свідомо правильним context.** Якщо відповідь неправильна навіть з правильними chunks — проблема не в retrieval.

## 2. Retrieval metrics

Потрібен позначений набір: для кожного питання — IDs релевантних chunks чи документів.

| Metric | Значення |
|---|---|
| Hit rate@k | Щонайменше один релевантний елемент у top k |
| Recall@k | Частка всіх релевантних елементів, що потрапили в top k |
| Precision@k | Частка top k, що є релевантною |
| MRR (mean reciprocal rank) | Наскільки високо перший релевантний елемент, у середньому по питаннях |
| nDCG@k | Якість ranking, що винагороджує релевантні елементи вгорі |

Для RAG **зазвичай найважливіший recall@k**: generator не може використати chunk, якого не бачив. Precision важлива, коли нерелевантні chunks відволікають модель або виводять context за budget.

```python
def recall_at_k(expected_ids, retrieved_ids, k):
    expected = set(expected_ids)
    if not expected:
        return 1.0
    return len(expected & set(retrieved_ids[:k])) / len(expected)
```

## 3. RAG triad

Три питання покривають більшість проблем якості RAG:

1. **Context relevance:** чи retrieved context релевантний питанню?
2. **Groundedness (faithfulness):** чи кожен claim відповіді підтверджений context?
3. **Answer relevance:** чи відповідь стосується поставленого питання?

Провал кожного вказує на різне виправлення:

| Низький score | Ймовірна причина | Типове виправлення |
|---|---|---|
| Context relevance | Retrieval або chunking | Розмір chunks, hybrid search, reranker, query rewriting |
| Groundedness | Generation | Суворіший prompt, обов'язкові citations, інша модель, правила abstention |
| Answer relevance | Prompt або розуміння питання | Інструкції prompt, уточнювальні питання |

## 4. Ragas та схожі бібліотеки metrics

**Ragas** реалізує LLM-based RAG metrics:

- **faithfulness:** claims відповіді, які можна вивести з context;
- **answer relevancy:** наскільки відповідь стосується питання;
- **context precision:** чи релевантні chunks стоять вище за нерелевантні;
- **context recall:** чи містить context інформацію з reference answer.

DeepEval і TruLens мають порівнянні metrics. Вони корисні, але пам'ятай chapter 4: ці metrics — це judges. Вибірково звіряй їх зі своїми labels, перш ніж довіряти числам, і фіксуй версії бібліотеки та judge model, бо визначення metrics змінюються між релізами.

## 5. Як зібрати RAG test set

Хороший RAG test set потребує чотирьох типів питань:

| Тип | Приклад | Очікувана поведінка |
|---|---|---|
| Single-hop | «Скільки триває return window?» | Правильний факт з citation |
| Multi-hop | «Чи можна повернути знижений товар, куплений за кордоном?» | Коректно поєднує два документи |
| Unanswerable | «Чи доставляєте в Антарктиду?» (немає в docs) | Каже, що не знає; пропонує escalation |
| Conflicting або stale | Два документи з різними return windows | Віддає перевагу новішому джерелу або позначає конфлікт |

### Synthetic generation

Пари питання/відповідь можна генерувати з корпусу моделлю. Це швидко, але стеж за:

- питаннями, що копіюють формулювання джерела — retrieval виглядає кращим, ніж з реальними формулюваннями користувачів;
- занадто легкими питаннями (лише single-hop);
- неправильними reference answers, які ніхто не перевірив.

Synthetic sets — для розширення coverage, але ніколи не як єдине джерело. Завжди додавай реальні питання користувачів.

## 6. Тюнінг — це експерименти

Кожен RAG parameter — тестова змінна. Змінюй по одному і вимірюй:

- розмір chunks і overlap;
- стратегію розбиття (фіксована довжина, за заголовками, за реченнями);
- embedding model;
- top k;
- hybrid search (vector плюс keyword, наприклад BM25);
- reranker увімкнений чи ні;
- query rewriting.

Веди таблицю результатів для кожного експерименту: retrieval metrics, end-to-end correctness, latency і cost. Конфігурація, що виграє в recall, але подвоює latency, може програти загалом.

## 7. Перевірки citations і hallucination

Якщо продукт показує citations:

- **validity:** кожен процитований ID існує в retrieved set (deterministic check);
- **support:** процитований фрагмент справді підтверджує речення, до якого прикріплений (judge або людина);
- **coverage:** кожне фактичне речення має citation;
- **link safety:** посилання citations ведуть лише на дозволені адреси.

## 8. Edge cases RAG

- порожній retrieval (нічого вище score threshold);
- дуже довгі документи і таблиці, погано розрізані між chunks;
- дублікати або майже дублікати документів;
- документи іншою мовою, ніж питання;
- **access control:** користувач ніколи не повинен отримати приватні документи іншого tenant чи користувача. Тестуй це з двома акаунтами; це security defect, а не питання якості;
- **freshness:** оновлений документ має замінити старий в index; тестуй reindex path;
- **injection у документах:** retrieved content може містити інструкції. Див. chapter 7.

## 9. Case study: canonical RAG у GimmeJob

Learning Path Advisor у GimmeJob дістає матеріали з єдиного canonical RAG pipeline у Cloudflare Worker. Repository демонструє кілька практик цього chapter:

- **Retrieval units на рівні розділів.** Опубліковані Markdown `##` розділи стають окремими документами з deep links на кшталт `/learn/api?topic=http-foundations&section=http-status-codes`, тож retrieval вказує на найвужчий корисний матеріал. Цей chapter індексується так само.
- **Degradation path.** Vectorize дає semantic candidates; lexical ranker у тому самому pipeline — fallback, коли Vectorize недоступний.
- **Deterministic retrieval metrics.** `ai-service/src/gimmejob_ai/rag_metrics.py` реалізує precision@k, recall@k, hit rate@k, reciprocal rank і nDCG@k, з unit tests у `ai-service/tests/test_rag_metrics.py`.
- **Runtime quality scores.** Кожен Learning Path trace у Langfuse записує scores на кшталт `retrieval_top_score`, `grounded_node_ratio`, `source_validity` і `map_connected`.
- **Валідація посилань за формою.** Consumers перевіряють, що source path має форму canonical learning route, замість довіряти output моделі.

## 10. QA quick reference

- Оцінюй retrieval і generation окремо; generation тестуй з фіксованим правильним context.
- Спочатку відстежуй recall@k; для роботи над ranking додай precision, MRR і nDCG.
- Використовуй RAG triad, щоб знайти етап, що зламався.
- Включай unanswerable, multi-hop і conflicting питання.
- Перевіряй citations детерміновано, потім support — через judge.
- Тестуй ізоляцію tenants і reindexing як частину тестування RAG.

## 11. Practice

1. Познач релевантні chunk IDs для 50 питань по документах свого support bot.
2. Порахуй hit rate@4, recall@4, MRR і nDCG@4 для свого retriever.
3. Порівняй три конфігурації chunking і обґрунтуй переможця retrieval metrics, answer correctness і latency.
4. Запусти faithfulness evaluation (Ragas або власний claim-decomposition judge) і вручну перевір 20 cases.
5. Додай 10 unanswerable і 5 conflicting-document питань; виміряй, як часто bot правильно утримується від відповіді.

**Exit check:** для будь-якої неправильної відповіді bot ти можеш показати, чи її спричинив retrieval, чи generation.

## Sources

- [Es et al. — RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217)
- [Ragas on GitHub](https://github.com/explodinggradients/ragas)
- [TruLens — evaluation and tracing for LLM applications](https://www.trulens.org/)
- [Liu et al. — Lost in the Middle](https://arxiv.org/abs/2307.03172)
- [GimmeJob — learning content discovery and canonical RAG](https://github.com/sergiiiavt/gimme-job/blob/main/docs/LEARNING-RAG.md)
