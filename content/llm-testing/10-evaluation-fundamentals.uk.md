**Eval** — це повторюваний тест якості LLM feature на dataset з визначеним методом оцінювання та порогом рішення. Цей chapter — серцевина роботи: перетворити «на вигляд нормально» на scorecard, який можна порівнювати між версіями.

## 1. Evals vs tests

| | Класичний тест | Eval |
|---|---|---|
| Очікуваний результат | Один точний oracle | Правило оцінювання: assertion, metric, rubric або human label |
| Результат | Pass або fail | Score для кожного case, агрегований у rates і distributions |
| Детермінізм | Очікується стабільність | Варіація між runs нормальна і її треба вимірювати |
| Мета | Довести, що вимога виконується | Виміряти якість, порівняти версії, зловити regressions |
| Типовий розмір | Один case на поведінку | Десятки або тисячі cases на поведінку |

На практиці потрібні обидва. Deterministic tests захищають code навколо моделі. Evals вимірюють поведінку моделі всередині продукту.

## 2. Піраміда тестування LLM

```text
               /  production monitoring  \      live traffic, online judges, user feedback
              /     human review          \     експертні labels на вибірці
             /   model-graded evals        \    LLM-as-a-judge з каліброваними rubrics
            /  reference-based metrics       \  similarity, overlap, retrieval metrics
           /  deterministic assertions        \ schema, regex, contains, length, cost, latency
          /  unit tests з fake model           \ parsing, routing, retries, tool loop
```

Нижні рівні дешеві, швидкі та точні. Верхні дорогі й шумні, але вимірюють те, що реально важливо користувачам. Опускай кожну перевірку якомога нижче: ніколи не питай judge model, чи output — валідний JSON.

## 3. Спочатку error analysis

Не починай з вибору metrics у framework. Почни з даних.

1. Прожени систему на 50–100 реалістичних inputs.
2. Прочитай кожен output. Запиши коротку нотатку про все, що не так.
3. Згрупуй нотатки в категорії. Це **open coding**, а потім **axial coding** — об'єднання схожих нотаток у **failure taxonomy**.
4. Порахуй частоту кожної категорії.
5. Пиши evals для найчастіших і найсерйозніших категорій.

Failure taxonomy для support bot може виглядати так:

| Категорія failure | Кількість / 100 | Severity |
|---|---|---|
| Відповідь не підтверджена docs (вигадана policy) | 9 | High |
| Правильна відповідь без citation | 14 | Medium |
| Не викликав order tool, коли треба | 6 | High |
| Задовго, відповідь загублена | 11 | Low |
| Відповідь не тією мовою | 3 | Medium |

Metrics, вибрані так, вимірюють реальні проблеми. Generic metrics, вибрані заздалегідь, часто не вимірюють нічого важливого для продукту.

## 4. Golden datasets

**Golden dataset** — це версіонований набір inputs з очікуваними outputs або нотатками для оцінювання, де можливо.

Джерела хороших cases:

- реальні user inputs (анонімізовані), вибрані з різних сегментів;
- failures з error analysis та production incidents;
- edge cases: порожній input, дуже довгий input, змішані мови, typos, неоднозначні питання;
- adversarial cases: injections, спроби jailbreak, off-topic запити;
- synthetic cases, згенеровані моделлю і переглянуті людиною.

Практичний JSONL формат:

```json
{"id": "refund-007", "input": "Can I return shoes after 40 days?", "expected_facts": ["30-day return window"], "must_not": ["yes, you can"], "tags": ["refunds", "policy-boundary"], "source": "prod-sample-2026-09"}
```

Правила:

- версіонуй datasets у Git поруч із prompts, які вони тестують;
- тегуй cases, щоб рахувати scores по сегментах (мова, feature, складність);
- тримай **held-out** підмножину, на яку не дивишся під час тюнінгу prompts, щоб не overfit під eval;
- додавай кожен production failure як новий case: dataset має лише рости.

## 5. Deterministic assertions

Багато вимог до якості перевіряються взагалі без моделі:

| Assertion | Приклад |
|---|---|
| Schema validity | Output парситься як JSON і відповідає Pydantic model |
| Contains / not contains | Відповідь містить order ID; ніколи не містить «as an AI language model» |
| Regex | Телефони у локальному форматі; email адреси не протікають |
| Length | Summary до 280 символів |
| Language | Мова відповіді збігається з мовою користувача |
| Citations | Кожен процитований ID існує в retrieved set |
| Latency budget | p95 до 4 секунд |
| Cost budget | До 2 000 tokens на запит |

Вони запускаються на кожному case, майже нічого не коштують і ніколи не суперечать самі собі.

## 6. Reference-based metrics

Коли є reference answer, output можна з ним порівняти.

| Metric | Що вимірює | Обережно |
|---|---|---|
| Exact match | Ідентичний рядок | Занадто суворо для вільного тексту; нормально для classification labels |
| Token F1 | Перетин слів з reference | Винагороджує копіювання слів, ігнорує зміст |
| BLEU / ROUGE | n-gram overlap з досліджень перекладу та summarization | Погано корелюють з людською оцінкою для відкритих відповідей |
| BERTScore | Схожість contextual token embeddings | Краще за n-grams, але сліпий до заперечень і фактичних помилок |
| Embedding cosine similarity | Семантична близькість текстів | Threshold залежить від моделі; «approved» vs «not approved» можуть мати високий score |

Використовуй reference metrics для вузьких задач (classification, extraction, короткі фактичні відповіді). Для відкритих відповідей перевіряй **факти**: чи містить відповідь кожен очікуваний факт і жодного забороненого claim?

## 7. Evaluation frameworks

Evals можна писати на чистому pytest. Frameworks додають datasets, scoring, caching, reporting та інтеграцію з CI.

**promptfoo** використовує декларативний YAML config і добре лягає в CI pipelines:

```yaml
description: Support bot refunds
prompts:
  - file://prompts/support_v3.txt
providers:
  - id: openai:gpt-4.1-mini
tests:
  - vars:
      question: Can I return shoes after 40 days?
    assert:
      - type: icontains
        value: 30 days
      - type: not-icontains
        value: yes, you can
      - type: llm-rubric
        value: States that returns are accepted only within 30 days and offers a next step
```

**DeepEval** працює в стилі pytest:

```python
from deepeval import assert_test
from deepeval.metrics import AnswerRelevancyMetric
from deepeval.test_case import LLMTestCase

def test_refund_answer_is_relevant():
    question = "Can I return shoes after 40 days?"
    case = LLMTestCase(input=question, actual_output=support_bot(question))
    assert_test(case, [AnswerRelevancyMetric(threshold=0.7)])
```

Інші поширені варіанти: **Inspect AI** (від UK AI Security Institute) для структурованих eval tasks та agents, **OpenAI Evals**, **Braintrust** і **Opik**. Вибери один для offline evals, вивчи його добре і уникай framework-specific metrics, які не можеш пояснити.

## 8. Як читати scorecard

Eval run має давати порівняння, а не одне число:

| Metric | Baseline (prompt v2) | Candidate (prompt v3) | Δ |
|---|---|---|---|
| Schema valid | 100% | 100% | 0 |
| Expected facts present | 81% | 88% | +7 pp |
| Forbidden claims | 4% | 1% | −3 pp |
| Citation valid | 86% | 85% | −1 pp |
| Median tokens | 410 | 520 | +27% |

Потім подивись на cases, що змінилися. Агреговані scores ховають regressions у малих, але критичних сегментах. Завжди читай flipped cases (pass→fail і fail→pass), перш ніж схвалити зміну.

## 9. QA quick reference

- Error analysis до metrics. Читай outputs, будуй failure taxonomy, рахуй.
- Опускай перевірки вниз піраміди; не використовуй judge для того, що перевіряє regex.
- Версіонуй datasets, тегуй cases, тримай held-out set, додавай cases з кожного incident.
- Для відкритих відповідей фактчекінг кращий за n-gram metrics.
- Порівнюй з baseline і читай flipped cases.

## Sources

- [Hamel Husain — Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/)
- [promptfoo documentation](https://www.promptfoo.dev/docs/intro/)
- [DeepEval on GitHub](https://github.com/confident-ai/deepeval)
- [Inspect AI](https://inspect.aisi.org.uk/)
- [Eugene Yan — Patterns for Building LLM-based Systems & Products](https://eugeneyan.com/writing/llm-patterns/)
