# Code-based scorers і metrics

**Scorer** перетворює один output моделі на вердикт або число. Code-based scorers роблять це звичайним code: парсингом, зіставленням зі шаблонами, порівнянням з reference, арифметикою. Вони безкоштовні, миттєві, ідеально відтворювані й позбавлені bias model judges, тому є першим рівнем будь-якого evaluation suite. Їхня межа так само очевидна: вони перевіряють лише те, що можна специфікувати механічно, а погано спроєктований scorer дуже точно вимірює не те.

Цей chapter будує поширені code-based scorers з перших принципів, показує, де саме кожен із них помиляється, і розглядає scorers як software, що потребує власних тестів і validation.

**Prerequisites:** [Методологія evaluation і datasets](/learn/llm?topic=evaluation-fundamentals), [Structured output і validation](/learn/llm?topic=structured-output-validation).

## Що таке code-based scorer

Scorer — це функція від test case і output до score з причиною:

```text
scorer(case, output) -> Score(passed: bool or value: float, reason: str)

case    the input plus everything needed to judge it: reference answer, expected facts,
        allowed sources, labels, tags for slicing
output  what the system produced for that input
reason  why the scorer decided as it did, so that a failure can be read without re-running anything
```

Хороші scorers мають чотири властивості:

- **Детермінованість:** той самий case і output завжди дають той самий score.
- **Пояснюваність:** причина називає правило, що не пройшло, і evidence («found ['60']»).
- **Версіонованість:** зміна scorer змінює кожен результат, який він дає, тож scorers живуть у version control, а їхня версія зберігається з результатами.
- **Протестованість:** scorer — це code з власними unit tests і, для будь-чого нетривіального, validation проти human labels.

## Assertions, яким не потрібен reference

Багато вимог можна перевірити лише за output або за output та input:

| Assertion | Як реалізувати | Приклад збою, який ловить |
|---|---|---|
| Валідний JSON / schema | Парсинг і validation проти контракту | Обрізаний object, відсутнє поле |
| Ліміти довжини | Підрахунок слів, символів чи tokens | Відповідь на 300 слів там, де дозволено 120 |
| Обов'язкові й заборонені фрази | Шаблони з прийнятними формулюваннями | Немає посилання на сторінку повернень; «guaranteed refund» |
| Мова | Визначення script і специфічних літер мови | Англійська відповідь на українське питання |
| Персональні дані | Шаблони email, телефону, IBAN, номерів карток | Email іншого клієнта у відповіді |
| Citations | Кожен процитований ID є в retrieved set | Citation на документ, якого не було в retrieval |
| Посилання | Кожен URL у allow-list | Посилання на домен-двійник |
| Числа | Витягти числа з одиницями й порівняти | «60 days», хоча policy каже 30 |

Ці перевірки вводилися в попередніх chapters ([Prompts як тестовані артефакти](/learn/llm?topic=prompts-as-artifacts), [Structured output і validation](/learn/llm?topic=structured-output-validation)). Решта chapter присвячена scores, що порівнюють output з reference, та інфраструктурі навколо scorers.

## Exact match і token F1

Для коротких фактичних відповідей класичні metrics походять з extractive question answering (benchmark SQuAD):

```text
normalize(text)   lowercase, remove punctuation and the articles a/an/the, collapse whitespace
exact match (EM)  1 if normalize(prediction) == normalize(reference), else 0
token F1          precision = shared tokens / prediction tokens
                  recall    = shared tokens / reference tokens
                  F1        = 2 · precision · recall / (precision + recall)
```

```python
import string
from collections import Counter

ARTICLES = {"a", "an", "the"}


def normalize_answer(text: str) -> str:
    """SQuAD-style normalization: lowercase, drop punctuation and articles, collapse whitespace."""
    text = text.lower()
    text = "".join(ch for ch in text if ch not in string.punctuation)
    return " ".join(word for word in text.split() if word not in ARTICLES)


def exact_match(prediction: str, reference: str) -> float:
    return float(normalize_answer(prediction) == normalize_answer(reference))


def token_f1(prediction: str, reference: str) -> float:
    pred, ref = normalize_answer(prediction).split(), normalize_answer(reference).split()
    if not pred or not ref:
        return float(pred == ref)  # two empty answers match, as in the official SQuAD script
    common = Counter(pred) & Counter(ref)
    overlap = sum(common.values())
    if overlap == 0:
        return 0.0
    precision, recall = overlap / len(pred), overlap / len(ref)
    return 2 * precision * recall / (precision + recall)


reference = "30 days from delivery"
for prediction in ["30 days from delivery", "The 30 days, from delivery!", "Within 30 days of the delivery date",
                   "60 days from delivery", "You have a month after the parcel arrives"]:
    print(f"EM={exact_match(prediction, reference):.0f}  F1={token_f1(prediction, reference):.2f}  {prediction!r}")
```

Output:

```text
EM=1  F1=1.00  '30 days from delivery'
EM=1  F1=1.00  'The 30 days, from delivery!'
EM=0  F1=0.60  'Within 30 days of the delivery date'
EM=0  F1=0.75  '60 days from delivery'
EM=0  F1=0.00  'You have a month after the parcel arrives'
```

Останні три рядки містять увесь урок. **Неправильна** відповідь «60 days from delivery» має вищий F1, ніж **правильний** парафраз, а правильна відповідь інакшими словами отримує нуль. Перетин tokens вимірює формулювання, а не істину. Exact match і F1 доречні, коли очікувана відповідь коротка й її формулювання фіксоване: labels, IDs, витягнуті значення, імена. Для вільних відповідей перевіряйте факти.

## Оцінювання за фактами

Scorer за фактами кодує, що правильна відповідь має сказати, чого не має казати і як розпізнати кожен факт у різних формулюваннях. Для питання «Can I return shoes after 40 days?»:

- **Обов'язково:** return window — 30 днів (прийнятні формулювання: «30 days», «thirty days», «one month»); вікно рахується від доставки («delivery», «delivered», «arrives»).
- **Заборонено:** обіцянка винятку; будь-яка кількість днів, крім значення з policy.

Скрипт нижче реалізує цей scorer двічі. Перша версія має реалістичний bug, і єдиний спосіб його знайти — порівняти scorer з людським судженням.

```python
import re

QUESTION = "Can I return shoes after 40 days?"
REQUIRED = {
    "return window is 30 days": r"\b(30|thirty)[- ]days?\b|\b(one|a) month\b",
    "counted from delivery": r"\b(delivery|delivered|arriv(e|es|al))\b",
}
FORBIDDEN = {"promises an exception": r"\b(exception|guarantee|no problem)\b"}
DAY_COUNT = r"\b(\d+)[- ]days?\b"


def unsupported_days_naive(answer: str, question: str) -> set[str]:
    return {n for n in re.findall(DAY_COUNT, answer.lower()) if n != "30"}


def unsupported_days(answer: str, question: str) -> set[str]:
    """Day counts that are neither the policy value nor numbers the customer used."""
    echoed = set(re.findall(DAY_COUNT, question.lower()))
    return {n for n in re.findall(DAY_COUNT, answer.lower()) if n != "30" and n not in echoed}


def score(answer: str, question: str, day_check) -> tuple[bool, list[str]]:
    text = answer.lower()
    failed = [name for name, pattern in REQUIRED.items() if not re.search(pattern, text)]
    failed += [name for name, pattern in FORBIDDEN.items() if re.search(pattern, text)]
    if day_check(answer, question):
        failed.append(f"unsupported day count {sorted(day_check(answer, question))}")
    return not failed, failed


# Human labels: is the answer acceptable?
labelled = [
    ("No. Returns are accepted within 30 days of delivery, and 40 days is outside that window.", True),
    ("You have a month after the parcel arrives, so after 40 days it is too late.", True),
    ("Returns are accepted within 60 days from delivery.", False),
    ("We can make an exception for you this time!", False),
]
for label, day_check in [("naive scorer", unsupported_days_naive), ("fixed scorer", unsupported_days)]:
    agreement = 0
    print(label)
    for answer, acceptable in labelled:
        passed, failed = score(answer, QUESTION, day_check)
        agreement += passed == acceptable
        print(f"  human={acceptable!s:<5} scorer={passed!s:<5} {failed}")
    print(f"  agreement with human labels: {agreement}/{len(labelled)}")
```

Output:

```text
naive scorer
  human=True  scorer=False ["unsupported day count ['40']"]
  human=True  scorer=False ["unsupported day count ['40']"]
  human=False scorer=False ['return window is 30 days', "unsupported day count ['60']"]
  human=False scorer=False ['return window is 30 days', 'counted from delivery', 'promises an exception']
  agreement with human labels: 2/4
fixed scorer
  human=True  scorer=True  []
  human=True  scorer=True  []
  human=False scorer=False ['return window is 30 days', "unsupported day count ['60']"]
  human=False scorer=False ['return window is 30 days', 'counted from delivery', 'promises an exception']
  agreement with human labels: 4/4
```

Наївне правило «жодної кількості днів, крім 30» відхиляє обидві хороші відповіді, бо хороші відповіді повторюють «40 days» самого клієнта. Scorer виглядав розумно і повідомляв би про хибну regression на кожній правильній відповіді. Дві практики запобігають цьому:

- **Проєктуйте факти з реальних outputs.** Перш ніж писати шаблони, прочитайте вибірку хороших і поганих відповідей і врахуйте, як правильні відповіді насправді формулюють думку.
- **Валідуйте scorer проти human labels,** перш ніж йому довіряти, так само як валідуєте model judge ([LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation)). Зберігайте позначені відповіді як unit tests scorer.

## BLEU і ROUGE крок за кроком

BLEU (з машинного перекладу) і ROUGE (з summarization) порівнюють n-grams — послідовності з n слів поспіль — між кандидатом і reference:

```text
BLEU   p_n = clipped n-gram matches / candidate n-grams          (n = 1..4; clipping counts each
                                                                   reference n-gram at most as often
                                                                   as it occurs in the reference)
       BP  = 1 if candidate is longer than the reference, else exp(1 − reference length / candidate length)
       BLEU = BP · exp( (1/4) Σ log p_n )                        (precision-oriented)

ROUGE-n recall = n-gram overlap / reference n-grams              (recall-oriented)
ROUGE-L        = F1 of the longest common subsequence (LCS) of words
               = 2 · LCS / (candidate length + reference length)
```

```python
import math
from collections import Counter


def ngrams(tokens: list[str], n: int) -> Counter:
    return Counter(tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1))


def bleu(candidate: str, reference: str, max_n: int = 4) -> float:
    """Sentence BLEU: geometric mean of clipped n-gram precisions times a brevity penalty.
    Add-one smoothing of the 2- to 4-gram precisions keeps short sentences from scoring exactly zero."""
    cand, ref = candidate.lower().split(), reference.lower().split()
    if not cand or not ref:
        return 0.0
    log_precisions = []
    for n in range(1, max_n + 1):
        cand_ngrams, ref_ngrams = ngrams(cand, n), ngrams(ref, n)
        clipped = sum(min(count, ref_ngrams[gram]) for gram, count in cand_ngrams.items())
        total = sum(cand_ngrams.values())
        if n > 1:
            clipped, total = clipped + 1, total + 1
        if clipped == 0:
            return 0.0
        log_precisions.append(math.log(clipped / total))
    brevity = 1.0 if len(cand) > len(ref) else math.exp(1 - len(ref) / len(cand))
    return brevity * math.exp(sum(log_precisions) / max_n)


def lcs_length(a: list[str], b: list[str]) -> int:
    table = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i, x in enumerate(a, 1):
        for j, y in enumerate(b, 1):
            table[i][j] = table[i - 1][j - 1] + 1 if x == y else max(table[i - 1][j], table[i][j - 1])
    return table[-1][-1]


def rouge(candidate: str, reference: str) -> dict[str, float]:
    cand, ref = candidate.lower().split(), reference.lower().split()
    scores = {}
    for n in [1, 2]:
        overlap = sum((ngrams(cand, n) & ngrams(ref, n)).values())
        scores[f"ROUGE-{n} recall"] = overlap / max(sum(ngrams(ref, n).values()), 1)
    lcs = lcs_length(cand, ref)
    scores["ROUGE-L F1"] = 2 * lcs / (len(cand) + len(ref)) if lcs else 0.0  # F1 of lcs/len(cand) and lcs/len(ref)
    return scores


reference = "unworn shoes can be returned within 30 days of delivery"
candidates = {
    "same words": "unworn shoes can be returned within 30 days of delivery",
    "correct paraphrase": "you may send back shoes you have not worn for a month after they arrive",
    "wrong number": "unworn shoes can be returned within 60 days of delivery",
    "opposite meaning": "unworn shoes cannot be returned within 30 days of delivery",
}
for name, candidate in candidates.items():
    r = rouge(candidate, reference)
    print(f"{name:<19} BLEU={bleu(candidate, reference):.2f}  " + "  ".join(f"{k}={v:.2f}" for k, v in r.items()))
```

Output:

```text
same words          BLEU=1.00  ROUGE-1 recall=1.00  ROUGE-2 recall=1.00  ROUGE-L F1=1.00
correct paraphrase  BLEU=0.07  ROUGE-1 recall=0.10  ROUGE-2 recall=0.00  ROUGE-L F1=0.08
wrong number        BLEU=0.70  ROUGE-1 recall=0.90  ROUGE-2 recall=0.78  ROUGE-L F1=0.90
opposite meaning    BLEU=0.74  ROUGE-1 recall=0.90  ROUGE-2 recall=0.78  ROUGE-L F1=0.90
```

Відповідь з неправильним числом і відповідь із протилежним змістом обидві отримують приблизно від 0.7 до 0.9; правильний парафраз — не більше 0.1. Дослідження генерації природної мови показали, що ці metrics слабко корелюють з людським судженням для відкритого тексту, а значення BLEU навіть непорівнянні між статтями без стандартизованої tokenization (для цього створено інструмент sacreBLEU). Значення за замовчуванням у бібліотеках теж важливі: стандартний tokenizer пакета rouge-score залишає лише символи a–z і 0–9, тож український текст узагалі не має tokens, якщо не передати власний tokenizer.

Де n-gram metrics залишаються корисними:

- **Regression smoke checks** майже детермінованих outputs, де велике падіння перетину з попередньою версією варто переглянути.
- **Задачі перекладу й нормалізації тексту** з кількома references, де формулювання — частина вимоги.
- **Тренди на рівні корпусу** на тисячах outputs, а не рішення щодо окремих cases. BLEU спочатку визначили для всього test set, з n-gram counts, підсумованими по всіх реченнях; середнє оцінок окремих речень — інше число.

## Embedding similarity і BERTScore

Embedding similarity порівнює зміст, а не формулювання, тож винагороджує правильні парафрази. Вона все одно оцінює заперечення, неправильні числа й переставлені ролі як близькі ([Embeddings і semantic similarity](/learn/llm?topic=embeddings-similarity)). **BERTScore** зіставляє кожен token кандидата з найсхожішим token reference за допомогою contextual embeddings; він краще корелює з людським судженням, ніж n-grams, але успадковує ту саму сліпоту до дрібних правок, що змінюють зміст.

```python
# Run on your own machine: pip install bert-score
from bert_score import score

candidates = ["you may send back shoes you have not worn for a month after they arrive"]
references = ["unworn shoes can be returned within 30 days of delivery"]
precision, recall, f1 = score(candidates, references, lang="en")
print(f"BERTScore F1 = {f1[0]:.3f}")
```

Використовуйте similarity scorers як **попередні фільтри й сигнали трендів**: відповідь не на тему отримує низький score і може впасти рано; високий score ніколи сам не доводить правильність.

## Classification metrics

Багато LLM features — замасковані classifiers: triage tickets, визначення наміру, guardrails, прапорець «потрібна людина», PASS/FAIL judge. Для них використовуйте classification metrics на позначеному наборі.

```python
from collections import Counter

LABELS = ["billing", "returns", "technical", "other"]
# (human label, model label) for 20 triaged messages
pairs = ([("billing", "billing")] * 5 + [("billing", "returns")] * 1 +
         [("returns", "returns")] * 6 + [("returns", "other")] * 1 +
         [("technical", "technical")] * 3 + [("technical", "other")] * 2 +
         [("other", "other")] * 1 + [("other", "returns")] * 1)

confusion = Counter(pairs)
print("human vs model" + "".join(f"{label:>11}" for label in LABELS))
for expected in LABELS:
    print(f"{expected:<14}" + "".join(f"{confusion[(expected, predicted)]:>11}" for predicted in LABELS))

per_class = {}
for label in LABELS:
    tp = confusion[(label, label)]
    fp = sum(confusion[(other, label)] for other in LABELS if other != label)
    fn = sum(confusion[(label, other)] for other in LABELS if other != label)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    per_class[label] = (precision, recall, f1, tp + fn)
    print(f"{label:<10} precision={precision:.2f} recall={recall:.2f} F1={f1:.2f} support={tp + fn}")

accuracy = sum(confusion[(label, label)] for label in LABELS) / len(pairs)
macro_f1 = sum(values[2] for values in per_class.values()) / len(LABELS)
weighted_f1 = sum(values[2] * values[3] for values in per_class.values()) / len(pairs)
print(f"accuracy={accuracy:.2f}  macro F1={macro_f1:.2f}  weighted F1={weighted_f1:.2f}")
```

Output:

```text
human vs model    billing    returns  technical      other
billing                 5          1          0          0
returns                 0          6          0          1
technical               0          0          3          2
other                   0          1          0          1
billing    precision=1.00 recall=0.83 F1=0.91 support=6
returns    precision=0.75 recall=0.86 F1=0.80 support=7
technical  precision=1.00 recall=0.60 F1=0.75 support=5
other      precision=0.25 recall=0.50 F1=0.33 support=2
accuracy=0.75  macro F1=0.70  weighted F1=0.77
```

Як це читати:

- **Accuracy** (0.75) приховує, які класи не працюють. Confusion matrix показує, що технічні tickets протікають в «other» (recall 0.60): ці клієнти чекають не на ту команду.
- **Macro F1** усереднює класи рівно, тож малі класи важать стільки ж, скільки великі; **weighted F1** йде за частотами класів. Показуйте ту, що відповідає бізнес-питанню, і завжди показуйте числа по класах.
- **Precision проти recall** — це рішення про ціну: для прапорця escalation пропустити case (низький recall) зазвичай гірше, ніж зайво ескалювати (низька precision).
- **Двадцять cases — замало** для рішень; тут ідеться про метод. Розміри вибірок розглянуто в розділі [Статистика для evaluation](/learn/llm?topic=eval-statistics).

## Оцінювання виконанням

Коли output — це code, запит чи обчислення, найсильніший scorer його **виконує**:

- **Згенерований code:** запускайте проти unit tests у sandbox (ізольований контейнер чи процес без мережі, з обмеженими CPU, пам'яттю й часом). Benchmark HumanEval популяризував це разом із мірою pass@k для кількох спроб.
- **Згенерований SQL:** виконуйте запит на фіксованій тестовій базі й порівнюйте **набори результатів**, а не текст запиту; два різні запити можуть бути однаково правильними. Неправильний запит теж може випадково повернути правильні рядки на одній невеликій базі, тому запускайте кожен запит на кількох базах, побудованих так, щоб розрізняти такі запити (test-suite accuracy), лише для читання і з лімітом часу чи кроків.
- **Згенеровані обчислення чи плани:** перераховуйте відповідь довіреним code і порівнюйте значення з явною tolerance.

Виконання code, згенерованого моделлю, — окремий ризик безпеки: ніколи не запускайте його в самому процесі evaluation чи з доступом до секретів або мережі.

## Побудова scoring harness

На практиці на кожному case працює кілька scorers, а результати агрегуються загалом і за зрізами (мова, feature, складність). Зріз, що падає, поки середнє виглядає нормально, — найпоширеніший спосіб, яким ховаються regressions.

```python
import json
import re
from collections import defaultdict
from dataclasses import dataclass


@dataclass(frozen=True)
class Score:
    scorer: str
    passed: bool
    reason: str = ""


def valid_json(case: dict, output: str) -> Score:
    try:
        json.loads(output)
        return Score("valid_json", True)
    except ValueError as error:
        return Score("valid_json", False, str(error))


def mentions_expected_days(case: dict, output: str) -> Score:
    days = re.findall(r"\b(\d+) (?:days?|днів)\b", output)
    ok = case["expected_days"] in days and all(d == case["expected_days"] for d in days)
    return Score("expected_days", ok, "" if ok else f"found {days}")


def short_enough(case: dict, output: str) -> Score:
    try:
        words = len(json.loads(output).get("answer", "").split())
    except ValueError:
        return Score("max_40_words", False, "not JSON")
    return Score("max_40_words", words <= 40, f"{words} words")


SCORERS = [valid_json, mentions_expected_days, short_enough]

cases = [
    {"id": "r1", "lang": "en", "expected_days": "30", "output": '{"answer": "Returns: 30 days from delivery."}'},
    {"id": "r2", "lang": "en", "expected_days": "30", "output": '{"answer": "You can return within 60 days."}'},
    {"id": "r3", "lang": "uk", "expected_days": "30", "output": '{"answer": "Повернення протягом 30 днів від доставки."}'},
    {"id": "r4", "lang": "uk", "expected_days": "30", "output": 'Відповідь: 30 днів'},
    {"id": "r5", "lang": "en", "expected_days": "14", "output": '{"answer": "Exchanges are possible for 14 days."}'},
]

by_slice = defaultdict(lambda: [0, 0])
failures = []
for case in cases:
    scores = [scorer(case, case["output"]) for scorer in SCORERS]
    case_passed = all(score.passed for score in scores)
    for key in ["all", f"lang={case['lang']}"]:
        by_slice[key][0] += case_passed
        by_slice[key][1] += 1
    failures += [(case["id"], score.scorer, score.reason) for score in scores if not score.passed]

for key, (passed, total) in sorted(by_slice.items()):
    print(f"{key:<8} pass rate {passed}/{total} = {passed / total:.0%}")
for failure in failures:
    print("FAIL", failure)
```

Output:

```text
all      pass rate 3/5 = 60%
lang=en  pass rate 2/3 = 67%
lang=uk  pass rate 1/2 = 50%
FAIL ('r2', 'expected_days', "found ['60']")
FAIL ('r4', 'valid_json', 'Expecting value: line 1 column 1 (char 0)')
FAIL ('r4', 'max_40_words', 'not JSON')
```

Важливі рішення в дизайні harness: кожен збій несе ID case, назву scorer і причину; зрізи обчислюються з tags cases, а не захардкожені; scorers — звичайні функції, тож кожну можна покрити unit tests і повторно використати в evaluation frameworks на кшталт promptfoo чи DeepEval, що приймають власні code assertions.

## Тестування й validation scorers

Неправильний scorer дає впевнені, але неправильні результати evaluation. Захищайте scorers як production code:

- **Unit tests з ворожими outputs:** для кожного scorer — outputs, що мають пройти (включно з незвичними правильними формулюваннями), і outputs, що мають впасти (включно з майже-влучаннями на кшталт «60 days»).
- **Властивості:** scores лишаються у своєму діапазоні, ідентичний текст отримує максимальний score, scorer ніколи не падає на порожньому, величезному чи пошкодженому output.
- **Лінійний час:** scorer працює на кожному output, зокрема на зацикленому output на 200 000 символів; регулярний вираз із квадратичним backtracking перетворює такий output на завислий evaluation run.
- **Узгодженість з human labels:** для будь-якого scorer, що інтерпретує мову, вимірюйте узгодженість на позначеній вибірці й зберігайте її як regression test scorer.
- **Versioning:** коли scorer змінюється, переоцініть baseline новою версією перед порівнянням; інакше виправлення scorer виглядатиме як regression чи покращення моделі.

## Приклад проєкту

Метод цього chapter реалізований і покритий тестами в [examples/llm-testing/09-code-based-scorers](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/09-code-based-scorers): exact match, token F1, BLEU і ROUGE з property-based tests, classification metrics на прикладі triage, двомовний scorer за фактами, валідований проти human labels, scoring harness, що порівнює дві версії системи по зрізах, і оцінювання згенерованого SQL виконанням на fixture databases лише для читання. Усі тести працюють offline, без моделі та API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/09-code-based-scorers
```

## Типові помилки

- **Використовувати перетин tokens (F1, BLEU, ROUGE) для оцінки правильності вільного тексту,** що винагороджує неправильні відповіді зі знайомими словами.
- **Писати шаблони фактів лише з reference answer,** не прочитавши, як насправді формулюють правильні outputs.
- **Довіряти scorer, якого ніколи не порівнювали з human labels.**
- **Показувати лише середнє:** без результатів по класах чи зрізах і без причин збоїв.
- **Порівнювати результати, отримані різними версіями scorer.**
- **Запускати згенерований code в процесі evaluation** без sandbox.

## Підсумок

- Code-based scorers — найдешевший, найшвидший і найбільш відтворюваний рівень evaluation; вони мають бути детермінованими, пояснюваними, версіонованими й протестованими.
- Exact match і token F1 підходять для коротких відповідей з фіксованим формулюванням; для вільного тексту вони винагороджують формулювання, а не істину.
- Scorers за фактами кодують обов'язкові й заборонені факти з прийнятними формулюваннями і мають валідуватися проти human labels, як показує bug з «40 days».
- BLEU і ROUGE високо оцінюють неправильні числа й протилежний зміст; використовуйте їх лише для трендів і майже детермінованих outputs.
- Embedding similarity і BERTScore винагороджують парафрази, але пропускають дрібні правки, що змінюють зміст; використовуйте їх як фільтри.
- Classification features потребують confusion matrices і precision та recall по класах, вибраних за ціною помилок; виконуваний code і запити найкраще оцінювати виконанням у sandbox.
- Scoring harness показує кожен збій з причиною і кожен зріз окремо.
