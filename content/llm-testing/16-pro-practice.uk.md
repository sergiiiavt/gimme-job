# Benchmarks, human evaluation і governance

На професійному рівні робота змінюється: від написання evaluations до відповідальності за те, як організація вирішує, чи достатньо добрий AI-продукт. Це рішення спирається на докази ззовні (публічні benchmarks і документація моделей) і зсередини: власні benchmarks організації, людські оцінки й результати тестів. Воно також має переконати людей, які не є інженерами: менеджерів, що погоджують release, клієнтів, які питають, як систему тестували, і регуляторів, що вимагають задокументованого керування ризиками.

Цей chapter охоплює такі теми:
- читання публічних benchmarks і виявлення contamination;
- вибір моделі;
- побудова власного benchmark і перевірка його items;
- human evaluation з надійною згодою та рейтингами вподобань;
- тестування поза текстом;
- докази для governance;
- проєктування evaluation platform;
- лідерство в стратегії якості.

**Prerequisites:** [Методологія evaluation і datasets](/learn/llm?topic=evaluation-fundamentals), [Статистика для evaluation](/learn/llm?topic=eval-statistics), [LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation), [Якість у production](/learn/llm?topic=production-quality).

## Від ризиків до рішень

```diagram
risks and requirements ──▶ evaluation plan ──▶ evidence ──▶ decision ──▶ record
(what can go wrong,        (benchmarks,        (results     (ship, block,  (for audits,
 for whom, how badly)       human evaluation,   with         conditions)    incidents and
                            tests, gates)       versions)                   the next release)
```

Кожна діяльність цього chapter живить цей ланцюжок. Публічний benchmark звужує список кандидатів-моделей, але вибір між ними робить ваша власна evaluation. Людська оцінка — це еталон, проти якого валідують judges і benchmarks. Framework для governance нічого з цього не замінює. Він просить показати, що ланцюжок існує, що він покриває важливі ризики і що докази актуальні.

## Як читати публічні benchmarks

Публічні benchmarks вимірюють, що модель уміє загалом. Вони корисні, щоб скласти короткий список, і небезпечні як єдина основа рішення.

| Родина | Приклади | На що зважати |
|---|---|---|
| Знання й міркування | MMLU, MMLU-Pro, GPQA | Множинний вибір винагороджує відкидання варіантів і вгадування; відомі помилки в ключах відповідей |
| Code | HumanEval, SWE-bench | Короткі функції проти справжніх репозиторіїв; contamination публічним code |
| Agents і tool use | SWE-bench, τ-bench, WebArena | Harness і tools важать не менше за модель ([Evaluation agents і tool use](/learn/llm?topic=agent-testing)) |
| Цілісні набори | HELM | Багато сценаріїв і metrics, що показує компроміси замість одного числа |
| Людські вподобання | Chatbot Arena | Голоси анонімних відвідувачів на їхніх власних prompts; довжина й форматування відповіді зсувають рейтинг |
| Свіжі питання | LiveBench | Питання з недавніх джерел, що обмежують contamination |

Перш ніж довіряти різниці в leaderboard, перевірте п'ять речей:
- **Налаштування:** формат prompt, кількість прикладів у prompt, параметри міркування, витягування відповіді й sampling. Та сама модель може зсунутися на кілька пунктів лише від зміни налаштувань. Harnesses на кшталт lm-evaluation-harness, HELM та Inspect роблять налаштування явними й відтворюваними.
- **Розмір і шум:** benchmark — це вибірка питань, і до неї застосовна статистика з [Статистики для evaluation](/learn/llm?topic=eval-statistics).
- **Хто запускав:** числа, які повідомляє provider моделі з власними налаштуваннями, часто відрізняються від незалежних запусків.
- **Дата:** питання, що були публічними до training cutoff моделі, можуть бути в її навчальних даних.
- **Насичення:** коли найкращі моделі всі мають результат біля максимуму, benchmark більше їх не розрізняє.

Шум легко оцінити:

```text
half-width of a 95% interval ≈ 1.96 × sqrt(p × (1 − p) / n)

GPQA Diamond, 198 questions, p = 0.5      ≈ ±7.0 points
MMLU, about 14,000 test questions, p = 0.85 ≈ ±0.6 points
```

На benchmark із 198 питань перевага у два пункти — це шум. Дві моделі, оцінені на тих самих питаннях, можна порівняти точніше парним аналізом, але лише якщо опубліковано результати по кожному питанню.

## Contamination

Benchmark **забруднений** (contaminated) для моделі, коли його питання або близькі їх копії були в її навчальних даних. Тоді модель частково пригадує замість того, щоб розв'язувати, і її результат перебільшує вміння. Ніхто поза provider не може переглянути навчальні дані комерційної моделі, тому contamination вимірюють опосередковано:

| Метод | Ідея | Приклад |
|---|---|---|
| Перетин n-gram | Шукати довгі послідовності слів із тестових items у корпусі, який міг потрапити в навчання | Стаття про GPT-3 позначала items, що мали спільну послідовність із 13 слів із навчальними даними |
| Свіжі копії | Написати нові питання того самого стилю й складності; забруднена модель справляється з ними гірше | GSM1k виявив падіння точності до 8% порівняно з GSM8k, причому зачеплено цілі родини моделей |
| Canary strings | Вбудувати унікальний маркер у кожен файл benchmark, щоб навчальні pipelines могли відфільтрувати ці файли; модель, що відтворює маркер, бачила їх | Кожен файл завдання BIG-bench містить canary string |
| Розбиття за часом | Брати лише питання, опубліковані після training cutoff | LiveBench регулярно оновлює свої питання |
| Приватний hold-out | Ніколи не публікувати тестові питання | Ваш власний benchmark поза публічними репозиторіями |

Перші два методи легко запустити на власних даних:

```python
import math
import re


def words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def ngrams(tokens: list[str], n: int) -> set[tuple[str, ...]]:
    return {tuple(tokens[start:start + n]) for start in range(len(tokens) - n + 1)}


def contains(haystack: list[str], needle: list[str]) -> bool:
    return any(haystack[start:start + len(needle)] == needle for start in range(len(haystack) - len(needle) + 1))


# A forum page from a web crawl that may have ended up in a training set
crawl = words("""Homework help please! A train leaves the station at 9 am travelling at 60 km per hour and a second
train leaves the same station at 10 am travelling at 90 km per hour on the same track. At what time does the second
train catch up with the first one? I got 11 am but the key says noon. Also, what is the capital of Australia?""")

items = {
    "q1 copied": "A train leaves the station at 9 am travelling at 60 km per hour and a second train leaves the same "
                 "station at 10 am travelling at 90 km per hour on the same track. At what time does the second train "
                 "catch up with the first one?",
    "q2 reworded": "The first train leaves at 9 am. A second train leaves the same station at 10 am travelling at 90 km "
                   "per hour on the same track. When are the two trains level?",
    "q3 new": "A delivery van leaves the depot at 8 am at 50 km per hour, and a courier follows at 8:30 am at 75 km "
              "per hour. When does the courier reach the van?",
    "q4 short": "What is the capital of Australia?",
}
N = 13  # the GPT-3 paper flagged test items sharing a 13-gram with the training data
crawl_grams = ngrams(crawl, N)
for name, question in items.items():
    tokens = words(question)
    if len(tokens) < N:
        verdict = "found verbatim" if contains(crawl, tokens) else "not found"
        print(f"{name:<12} {len(tokens):>2} words, shorter than {N}: {verdict}")
        continue
    grams = ngrams(tokens, N)
    shared = len(grams & crawl_grams)
    verdict = "copied" if shared == len(grams) else "partly copied" if shared else "clean"
    print(f"{name:<12} {shared:>2} of {len(grams):>2} 13-grams in the crawl: {verdict}")

# The same 200 questions with new numbers and wording: a model that learned the skill should not care
only_original, only_reworded = 31, 7
discordant = only_original + only_reworded
tail = sum(math.comb(discordant, k) for k in range(min(only_original, only_reworded) + 1)) / 2 ** discordant
print(f"rewording: {only_original} items pass only in the original wording, {only_reworded} only reworded, "
      f"exact p = {min(1.0, 2 * tail):.4f}")
```

Output:

```text
q1 copied    36 of 36 13-grams in the crawl: copied
q2 reworded   8 of 21 13-grams in the crawl: partly copied
q3 new        0 of 22 13-grams in the crawl: clean
q4 short      6 words, shorter than 13: found verbatim
rewording: 31 items pass only in the original wording, 7 only reworded, exact p = 0.0001
```

Скопійоване питання ділить із форумною сторінкою кожну 13-gram. Перефразоване все ще ділить вісім, тож воно теж не чисте. Коротке питання закоротке для 13-grams, і його перевіряють цілим. Тест перефразування ставить інше питання: чи залежить результат моделі від точного формулювання? Якби вміння було справжнім, items проходили б і падали приблизно однаково часто в обох версіях. Тут 31 проти 7 — дуже малоймовірний збіг, і саме таку картину GSM1k виміряв у масштабі. Ті самі перевірки захищають ваш власний benchmark: тримайте його приватним і перевіряйте, що його items не з'являються в публічних даних.

## Вибір моделі

Вибір моделі — це рішення про release з більшою кількістю кандидатів. Практичний процес:

1. **Спершу запишіть вимоги:** поріг якості, ліміти latency й вартості, довжина context, мови, поводження з даними (де дані обробляються, чи використовуються для навчання) і очікуваний строк підтримки.
2. **Складіть короткий список за публічною інформацією:** benchmarks для потрібних умінь, документація моделей і ціни. Відкиньте кандидатів, що не проходять жорстку вимогу.
3. **Вирішуйте власною evaluation:** ті самі cases для кожного кандидата, парні порівняння з інтервалами ([Статистика для evaluation](/learn/llm?topic=eval-statistics)) і важливі зрізи.
4. **Дивіться на компроміси разом:** кандидат домінований, коли інший щонайменше такий самий добрий за якістю, вартістю й latency і кращий за одним із них. Справжні варіанти — лише недоміновані кандидати (фронт Парето), і вибір між ними — це продуктове рішення.
5. **Пілотуйте перед перемиканням:** shadow-трафік і canary release, як у [Якості у production](/learn/llm?topic=production-quality).
6. **Плануйте наступну міграцію:** моделі знімають за опублікованими графіками, тож evaluation suite має бути готовим до повторного запуску.

Погодьте margin якості до порівняння, як для будь-якого release gate. Кандидат, чия парна різниця з найкращим лишається вище мінус margin, для рішення такий самий добрий, навіть якщо його точкова оцінка нижча. Серед таких кандидатів вирішують вартість і latency.

## Побудова власного benchmark

Коли публічні benchmarks не вимірюють вашу предметну область, побудуйте власний — наприклад, для якості згенерованих test cases або для відповідей про ваші страхові продукти.

1. **Визначте вміння** і що поза межами.
2. **Зберіть завдання з реальної роботи** з еталонними відповідями або рубриками оцінювання від експертів.
3. **Перевірте еталони:** два експерти відповідають незалежно, і ви вимірюєте їхню згоду. Items, щодо яких вони не згодні, виправляють або відкидають.
4. **Покрийте рівні складності,** щоб benchmark не наситився з наступним поколінням моделей.
5. **Проаналізуйте items** після перших запусків.
6. **Тримайте приватний hold-out набір** і canary string та задокументуйте benchmark (datasheet, відомі обмеження).
7. **Версіонуйте його** і плануйте оновлення.

Аналіз items прийшов з освітнього тестування. Для кожного item він вимірює **складність** — частку моделей (або запусків), що його розв'язують. Він також вимірює **дискримінацію**: кореляцію між розв'язанням item і результатом на всіх інших items. Добрий item сильніші системи розв'язують частіше, ніж слабші.

```python
from statistics import correlation, fmean

# One row per model, strongest first; one column per item of a custom benchmark (1 = correct)
results = {
    "model-a": "1 1 1 1 0 0 1 1 1 1 1 1",
    "model-b": "1 1 1 1 0 0 1 1 1 0 1 1",
    "model-c": "1 1 1 0 0 0 1 1 0 1 1 0",
    "model-d": "1 1 1 1 0 1 1 0 1 0 0 1",
    "model-e": "1 1 0 0 0 1 1 1 0 0 1 0",
    "model-f": "1 1 0 1 0 1 1 0 0 0 0 0",
    "model-g": "1 1 0 0 0 1 0 0 0 1 0 0",
    "model-h": "1 1 0 0 0 1 0 0 0 0 0 0",
}
rows = [[int(cell) for cell in row.split()] for row in results.values()]

print(f"{'item':<5} {'solved':>7} {'discrimination':>14}  verdict")
for item in range(len(rows[0])):
    scores = [row[item] for row in rows]
    rest = [sum(row) - row[item] for row in rows]  # each model's score on all the other items
    solved = fmean(scores)
    if solved in {0.0, 1.0}:
        discrimination, verdict = None, "nobody solves it: too hard or broken" if solved == 0 else "everyone solves it: no information"
    else:
        discrimination = correlation(scores, rest)
        if discrimination < -0.2:
            verdict = "stronger models fail more often: check the reference answer"
        elif discrimination < 0.2:
            verdict = "weak: hardly separates the models"
        else:
            verdict = "ok"
    shown = "-" if discrimination is None else f"{discrimination:+.2f}"
    print(f"{item + 1:<5} {solved:>7.0%} {shown:>14}  {verdict}")
```

Output:

```text
item   solved discrimination  verdict
1        100%              -  everyone solves it: no information
2        100%              -  everyone solves it: no information
3         50%          +0.80  ok
4         50%          +0.50  ok
5          0%              -  nobody solves it: too hard or broken
6         62%          -0.81  stronger models fail more often: check the reference answer
7         75%          +0.65  ok
8         50%          +0.50  ok
9         38%          +0.76  ok
10        38%          -0.04  weak: hardly separates the models
11        50%          +0.50  ok
12        38%          +0.76  ok
```

Items 1 і 2 коштують грошей і нічого не кажуть. Item 5 або не під силу жодній моделі, або зламаний. Item 6 — головна знахідка: сильніші моделі його провалюють, а слабші проходять. Звичайна причина — неправильна еталонна відповідь, тож сильні моделі «помиляються», даючи правильну відповідь. Публічні benchmarks мають ту саму проблему: повторна розмітка MMLU оцінила, що помилки містять близько 6.5% його питань, а в одному предметі — понад половину. Методи на основі item response theory йдуть далі. Вони оцінюють складність і дискримінацію items разом зі здібністю моделей, знаходять насичені datasets і вибирають малі підмножини, що передбачають повний результат.

## Програми human evaluation

Люди — еталон для критеріїв, які не перевірить code і які не можна довірити judges: корисність, тон, безпека в граничних випадках і експертна правильність. Людські labels — це також те, проти чого валідують LLM judge ([LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation)). Добре провести human evaluation — це процес:

| Елемент | Практика |
|---|---|
| Формат питання | Pass чи fail за рубрикою для дефектів; парне вподобання для «що краще»; уникайте шкал 1–10 без якорів |
| Інструкції | Визначення, приклади й граничні випадки для кожного label, версіоновані як code |
| Калібрування | Анотатори розмічають ті самі items, обговорюють розбіжності й оновлюють інструкції |
| Контроль якості | Gold items з відомими відповідями всередині роботи; згода відстежується для кожного анотатора й у часі |
| Контроль упереджень | Приховуйте, яка система дала відповідь, рандомізуйте порядок відповідей, показуйте всю розмову |
| Розмір вибірки | Досить items для потрібних інтервалів ([Статистика для evaluation](/learn/llm?topic=eval-statistics)) |
| Етика | Справедлива оплата, попередження й ліміти для шкідливого вмісту, жодних персональних даних без правової підстави |

**Згода кількох анотаторів.** Cohen's kappa порівнює двох анотаторів ([Методологія evaluation і datasets](/learn/llm?topic=evaluation-fundamentals)). Krippendorff's alpha узагальнює її на будь-яку кількість анотаторів і на пропущені labels, а також працює з порядковими й інтервальними шкалами. Вона порівнює розбіжність, що спостерігається всередині кожного item, із розбіжністю, очікуваною випадково:

```python
from collections import Counter
from itertools import combinations, permutations

# Three annotators label the same 13 answers; None means the annotator skipped the answer
labels = {
    "ann": ["good", "good", "bad", "unsafe", "good", "bad", None, "good", "bad", "good", "unsafe", "good", "unsafe"],
    "ben": ["good", "bad", "bad", "unsafe", "good", "bad", "bad", "good", "bad", "good", "unsafe", None, "unsafe"],
    "cho": ["good", "good", "bad", "bad", "good", "bad", "bad", None, "bad", "good", "bad", "good", "bad"],
}


def alpha_nominal(columns: list[list[str | None]]) -> float:
    """Krippendorff's alpha for nominal labels: any number of annotators, missing labels allowed."""
    coincidences: Counter = Counter()
    for unit in zip(*columns):
        values = [value for value in unit if value is not None]
        if len(values) < 2:
            continue  # an answer labelled once tells nothing about agreement
        for pair in permutations(values, 2):
            coincidences[pair] += 1 / (len(values) - 1)
    totals: Counter = Counter()
    for pair, weight in coincidences.items():
        totals[pair[0]] += weight
    n = sum(totals.values())
    observed = sum(weight for pair, weight in coincidences.items() if pair[0] != pair[1]) / n
    expected = sum(totals[a] * totals[b] for a in totals for b in totals if a != b) / (n * (n - 1))
    return 1 - observed / expected


def reading(alpha: float) -> str:
    if alpha >= 0.8:
        return "reliable"
    return "tentative conclusions only" if alpha >= 0.667 else "do not use the labels yet"


groups = [tuple(labels)] + list(combinations(labels, 2))
for group in groups:
    alpha = alpha_nominal([labels[name] for name in group])
    print(f"{' + '.join(group):<16} alpha {alpha:5.2f}  {reading(alpha)}")

# Where the reliable pair agrees, what does the third annotator say instead?
confusions = Counter((a, c) for a, b, c in zip(*labels.values()) if a is not None and a == b and c is not None and c != a)
print("where ann and ben agree, cho says:", ", ".join(f"{pair[1]} for {pair[0]} ({count}x)" for pair, count in confusions.items()))
```

Output:

```text
ann + ben + cho  alpha  0.65  do not use the labels yet
ann + ben        alpha  0.87  reliable
ann + cho        alpha  0.57  do not use the labels yet
ben + cho        alpha  0.40  do not use the labels yet
where ann and ben agree, cho says: bad for unsafe (3x)
```

Krippendorff радить покладатися на дані з alpha щонайменше 0.800 і робити лише попередні висновки від 0.667, додаючи, що магічних чисел не існує. Тут два анотатори добре згодні, а третій — ні. Останній рядок показує чому: розбіжність систематична, бо третій анотатор позначає кожну небезпечну відповідь лише як погану. Більше розмітки цього не виправить. Виправить визначення «unsafe» в інструкціях і сесія калібрування з цим анотатором.

**Парні вподобання й рейтинги.** Питання «яка з двох відповідей краща?» людям легше, ніж абсолютні оцінки, і саме так Chatbot Arena ранжує моделі. Щоб перетворити багато голосів на рейтинг, потрібна модель голосів. Модель Bradley–Terry дає кожній системі силу й припускає, що система *i* перемагає систему *j* з імовірністю strength_i / (strength_i + strength_j). Підігнана до всіх голосів одразу, вона дає той самий результат за будь-якого порядку голосів. Онлайн-рейтинг Elo, який використовують у шахах, оновлюється після кожної гри, тож недавні голоси важать більше:

```python
import math
import random
from statistics import fmean

rng = random.Random(13)
strength = {"model-a": 1.5, "model-b": 0.9, "model-c": 0.8, "model-d": 0.0}  # true strengths, unknown to the analysis
names = list(strength)
votes = []  # (winner, loser) from human raters who compared two answers side by side
for _ in range(400):
    first, second = rng.sample(names, 2)
    if rng.random() < 1 / (1 + math.exp(strength[second] - strength[first])):
        votes.append((first, second))
    else:
        votes.append((second, first))


def elo(games: list[tuple[str, str]], k: float = 32) -> dict[str, float]:
    """Online Elo: every vote moves the two ratings, so the result depends on the order of the votes."""
    rating = {name: 1000.0 for name in names}
    for winner, loser in games:
        expected = 1 / (1 + 10 ** ((rating[loser] - rating[winner]) / 400))
        rating[winner] += k * (1 - expected)
        rating[loser] -= k * (1 - expected)
    return rating


def bradley_terry(games: list[tuple[str, str]], rounds: int = 300) -> dict[str, float]:
    """Maximum likelihood fit of the Bradley-Terry model to all votes at once (MM algorithm), on the Elo scale."""
    wins = {name: 0 for name in names}
    pairs: dict[tuple[str, str], int] = {}
    for winner, loser in games:
        wins[winner] += 1
        key = tuple(sorted((winner, loser)))
        pairs[key] = pairs.get(key, 0) + 1
    worth = {name: 1.0 for name in names}
    for _ in range(rounds):
        updated = {}
        for name in names:
            denominator = sum(count / (worth[pair[0]] + worth[pair[1]]) for pair, count in pairs.items() if name in pair)
            updated[name] = wins[name] / denominator
        center = math.exp(fmean(math.log(value) for value in updated.values()))
        worth = {name: value / center for name, value in updated.items()}
    return {name: 1000 + 400 * math.log10(value) for name, value in worth.items()}


def ranking(scores: dict[str, float]) -> str:
    return " > ".join(sorted(names, key=lambda name: scores[name], reverse=True))


forward, backward = elo(votes), elo(votes[::-1])
fitted, fitted_backward = bradley_terry(votes), bradley_terry(votes[::-1])
print(f"{'model':<9} {'Elo, votes in order':>20} {'Elo, reversed':>14} {'Bradley-Terry':>14}")
for name in sorted(names, key=lambda name: fitted[name], reverse=True):
    print(f"{name:<9} {forward[name]:>20.0f} {backward[name]:>14.0f} {fitted[name]:>14.0f}")

print("Elo ranking in order:  ", ranking(forward))
print("Elo ranking reversed:  ", ranking(backward))
print("Bradley-Terry, either order:", ranking(fitted), "| same result:",
      all(abs(fitted[name] - fitted_backward[name]) < 1e-6 for name in names))
```

Output:

```text
model      Elo, votes in order  Elo, reversed  Bradley-Terry
model-a                   1057           1086           1098
model-b                   1077           1069           1022
model-c                    917            985           1012
model-d                    949            860            867
Elo ranking in order:   model-b > model-a > model-d > model-c
Elo ranking reversed:   model-a > model-b > model-c > model-d
Bradley-Terry, either order: model-a > model-b > model-c > model-d | same result: True
```

Ті самі 400 голосів, оброблені в іншому порядку, дають рейтинги Elo, що не згодні між собою. Один із них ставить найслабшу модель третьою. Bradley–Terry відновлює справжній порядок і не залежить від порядку голосів. Chatbot Arena перейшла з онлайн-Elo на Bradley–Terry, бо її коефіцієнти краще підходять для статистичного оцінювання, як-от довірчих інтервалів (стаття порівнює bootstrap і робастні стандартні похибки). Подавайте рейтинги з такими інтервалами: системи, чиї інтервали перекриваються, ділять місце. Arena також публікує рейтинг з контролем стилю, що додає до моделі Bradley–Terry довжину й форматування відповіді, бо сам лише стиль зсуває leaderboard.

## Поза текстом: multimodal і voice

| Система | Що йде не так | Як вимірювати |
|---|---|---|
| Вхід зображень | Помилки OCR, неправильно прочитані графіки й таблиці, вигадані візуальні деталі, інструкції, сховані в зображеннях | Character error rate на документах, питання з відомими відповідями, cases з injection через текст у зображеннях |
| Мовний вхід | Помилки розпізнавання через акцент, шум і словник предметної області, які потім переходять у відповідь | Word error rate для кожного зрізу та end-to-end успіх завдання на записаному аудіо |
| Голосові agents | Повільні відповіді, перебивання користувача, пропущені переривання, вимовлені числа, імена й адреси email | Latency до першого аудіо, тести barge-in, сценарні дзвінки з відомими результатами |
| Згенеровані зображення й аудіо | Порушення політик, невідповідність запиту, відсутні мітки походження | Класифікатори політик і людський перегляд, перевірки метаданих походження |

Розпізнавання мовлення вимірюють **word error rate** — відстанню редагування між розпізнаними й еталонними словами:

```text
WER = (S + D + I) / N
S substitutions, D deletions, I insertions, N words in the reference

reference:  refund   my   order   four  two  one
recognized: refund   my   border  for   two  one   please
            1 substitution (border) + 1 substitution (for) + 1 insertion (please) over 6 words = 0.50
```

Нормалізуйте регістр, пунктуацію й формати чисел перед порівнянням і подавайте частку помилок для кожного зрізу акценту, рівня шуму й словника: середнє приховує користувачів, яких система підводить.

## Governance і докази

Регулятори й корпоративні клієнти дедалі частіше очікують задокументованого керування ризиками AI. Основні frameworks більше перетинаються, ніж відрізняються:

| Framework | Що це | Що дають тестувальники |
|---|---|---|
| NIST AI RMF 1.0 | Добровільний framework із чотирма функціями: Govern, Map, Measure, Manage | Методи вимірювання, результати тестів і відстеження ризиків (функція Measure) |
| NIST AI 600-1 | Профіль AI RMF для generative AI з 12 ризиками, як-от confabulation, цілісність інформації та шкідливе упередження | Evaluation plan, що покриває релевантні ризики |
| EU AI Act, Regulation (EU) 2024/1689 | Закон, заснований на ризиках: заборонені практики, системи високого ризику, обов'язки прозорості, правила для моделей загального призначення | Докази для вимог до систем високого ризику |
| ISO/IEC 42001:2023 | Сертифікований стандарт системи менеджменту для AI | Задокументовані, відтворювані процеси evaluation і моніторингу |

Для систем високого ризику EU AI Act встановлює вимоги, що прямо відповідають роботі з тестування:

| Стаття | Вимога | Докази з тестування |
|---|---|---|
| 9 | Система керування ризиками | Реєстр ризиків, пов'язаний із тестами, залишкові ризики після тестування |
| 10 | Дані та керування даними | Репрезентативність datasets, перевірка на упередження |
| 11 і Annex IV | Технічна документація | Методологія evaluation, metrics і результати з версіями |
| 12 | Ведення записів | Logs і traces, що дають змогу відтворити інциденти |
| 13 | Прозорість для deployers | Задокументована продуктивність, обмеження й відомі режими збоїв |
| 14 | Людський нагляд | Тести, що показують: люди можуть зрозуміти, перевизначити й зупинити систему |
| 15 | Точність, робастність і кібербезпека | Точність по зрізах, тести робастності, результати red team |

AI-системи для найму, як-от фільтрування заявок чи оцінювання кандидатів, належать до високого ризику згідно з Annex III цього закону. Для продуктів, пов'язаних із роботою, як цей сайт, тестування упереджень, документація й людський нагляд — юридичні вимоги, а не лише добра практика. Regulation (EU) 2026/1744 (Digital Omnibus on AI) перенесла дату, з якої ці вимоги застосовуються. Тепер це 2 грудня 2027 року для систем з Annex III і 2 серпня 2028 року для AI у продуктах, на які поширюється Annex I. Основні вимоги лишаються тими самими, а збирання доказів потребує часу, тож перенесення — не привід чекати.

Докази переконливі, коли вони **простежувані й актуальні**. Кожен важливий ризик має бути пов'язаний із тестами, що його покривають, і кожен результат тесту має належати до версії, яку випускають. Model cards для моделей, datasheets для datasets і evaluation reports для releases фіксують це у стандартній формі. Невелика перевірка знаходить прогалини раніше, ніж аудитор чи інцидент:

```python
from datetime import date

release = {"version": "2.4.0", "date": date(2026, 10, 10)}
MAX_AGE_DAYS = 90

# The risk register: every risk names the tests that produce evidence about it
risks = [
    {"id": "R1", "severity": "high", "risk": "answers contradict the refund policy", "tests": ["policy-suite", "policy-judge"]},
    {"id": "R2", "severity": "high", "risk": "one customer sees another's data", "tests": ["tenancy-tests", "red-team-leaks"]},
    {"id": "R3", "severity": "high", "risk": "CV scores differ by gender or origin", "tests": []},
    {"id": "R4", "severity": "medium", "risk": "slow answers at peak load", "tests": ["load-test"]},
    {"id": "R5", "severity": "low", "risk": "answer in the wrong language", "tests": ["language-check"]},
]
# The latest result of every test: status, version tested, date of the run
results = {
    "policy-suite": ("pass", "2.4.0", date(2026, 10, 9)),
    "policy-judge": ("pass", "2.4.0", date(2026, 10, 9)),
    "tenancy-tests": ("pass", "2.4.0", date(2026, 10, 9)),
    "red-team-leaks": ("fail", "2.4.0", date(2026, 10, 8)),
    "load-test": ("pass", "2.1.0", date(2026, 6, 2)),
    "language-check": ("pass", "2.4.0", date(2026, 10, 9)),
    "tone-check": ("pass", "2.4.0", date(2026, 10, 9)),
}

gaps = {}
for risk in risks:
    problems = [] if risk["tests"] else ["no test covers it"]
    for test in risk["tests"]:
        if test not in results:
            problems.append(f"{test} never ran")
            continue
        status, version, ran = results[test]
        age = (release["date"] - ran).days
        if status != "pass":
            problems.append(f"{test} {status}s")
        if version != release["version"]:
            problems.append(f"{test} tested {version}")
        if age > MAX_AGE_DAYS:
            problems.append(f"{test} is {age} days old")
    gaps[risk["id"]] = problems
    print(f"{risk['id']} {risk['severity']:<6} {risk['risk']:<38} {'; '.join(problems) or 'evidence current'}")

linked = {test for risk in risks for test in risk["tests"]}
print("tests that cover no risk:", ", ".join(sorted(set(results) - linked)) or "none")
open_high = [risk["id"] for risk in risks if risk["severity"] == "high" and gaps[risk["id"]]]
print(f"release {release['version']}:", f"no-go, high risks without current evidence: {', '.join(open_high)}" if open_high
      else "evidence complete")
```

Output:

```text
R1 high   answers contradict the refund policy   evidence current
R2 high   one customer sees another's data       red-team-leaks fails
R3 high   CV scores differ by gender or origin   no test covers it
R4 medium slow answers at peak load              load-test tested 2.1.0; load-test is 130 days old
R5 low    answer in the wrong language           evidence current
tests that cover no risk: tone-check
release 2.4.0: no-go, high risks without current evidence: R2, R3
```

Release блокують докази, а не думки. Його блокують red-team тест, що падає, і неперевірений ризик справедливості; load test застарів, і його треба повторити до наступного release. Перевірка також знаходить тест, що не покриває жодного ризику: це або пропущений зв'язок, або змарновані зусилля.

## Проєктування evaluation platform

Коли кілька команд будують LLM features, спільна платформа позбавляє їх потреби перебудовувати ті самі частини й робить результати порівнянними:

```diagram
datasets (versioned, tagged, access-controlled)
   ↓
runners (offline, CI, sampled production traffic)
   ↓
scorers (code checks, validated judges, human review queues)
   ↓
results store (every run, every case, every version)
   ↓
reports and gates (scorecards, trends, alerts, release decisions, evidence)
```

Принципи, завдяки яким така платформа працює:
- **Datasets і scorers — це активи** з власниками, версіями й документацією.
- **Кожен результат пов'язаний із точними версіями** application, prompt, моделі, dataset і judge.
- **Judges публікують результати своєї валідації** (true positive rate, true negative rate, згоду з людьми) поруч зі своїми оцінками.
- **Додавання case з production trace займає один крок,** щоб збої ставали regression cases.
- **Приватність і контроль доступу вбудовані** від початку, бо evaluation дані містять справжні розмови.

## Лідерство в стратегії якості

- **Плануйте від ризиків.** Оцініть кожен ризик за серйозністю й імовірністю та розподіляйте зусилля evaluation відповідно. Серйозний ризик заслуговує на окремий suite і hard gate; косметичний — на кілька перевірок.
- **Погоджуйте критерії release до тестування.** Ліміти, узгоджені після результатів, — це ритуал, а не gate ([Якість у production](/learn/llm?topic=production-quality)).
- **Звітуйте так, щоб керівники могли діяти.** Наприклад: «успіх завдань 92% (90–94%), було 87%; жодних знахідок безпеки високої серйозності; вартість вирішеного звернення нижча на 18%; тестів справедливості для ранжування CV ще немає, тож ця feature лишається вимкненою».
- **Зробіть evaluation роботою кожного.** Якість масштабується, коли кожна команда feature володіє своїми datasets і gates, а команда платформи — інструментами.
- **Знайте, коли evaluation недостатньо.** Деякі ризики потребують поетапних releases, людської перевірки кожного рішення або відмови від feature.

| Ризик | Серйозність | Evaluation | Gate |
|---|---|---|---|
| Відповіді суперечать політиці | Висока | Policy suite з перевірками code і валідованим judge, для кожної мови | Non-inferiority плюс поріг для кожного зрізу |
| Дані одного клієнта потрапляють до іншого | Висока | Тести tenancy, red-team suite витоків | Нульова толерантність |
| Нерівне ставлення в ранжуванні CV | Висока | Контрфактичні пари, аналіз зрізів, людський перегляд | Жодного значущого розриву; людський нагляд у production |
| Повільні відповіді в пік | Середня | Load test проти fake provider і справжніх лімітів | Ліміти p95 |
| Неправильна мова відповіді | Низька | Перевірка мови на всьому трафіку | Поріг тривоги |

## Приклад проєкту

Методи цього chapter реалізовані й покриті тестами в [examples/llm-testing/16-benchmarks-governance](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/16-benchmarks-governance):
- перевірки contamination через перетин n-gram і перефразовані копії;
- аналіз items, що знаходить зламані й непотрібні items;
- рейтинги Bradley–Terry з bootstrap-інтервалами в порівнянні з онлайн-Elo;
- Krippendorff's alpha, звірена з опублікованими прикладами;
- фронт Парето для вибору моделі з парними порівняннями якості;
- word і character error rates;
- перевірка простежуваності, що перетворює реєстр ризиків і результати тестів на звіт із доказами.

Усі тести працюють offline, без моделі та API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/16-benchmarks-governance
```

## Типові помилки

- **Вибирати модель за місцем у leaderboard** без власної evaluation.
- **Порівнювати результати benchmarks з різних налаштувань** або довіряти різницям, меншим за шум benchmark.
- **Ігнорувати contamination,** зокрема власного benchmark після його публікації.
- **Ніколи не аналізувати items** власного benchmark, тож неправильні еталони й непотрібні items лишаються.
- **Використовувати людські labels без вимірювання згоди** або усереднювати разом з анотатором, що систематично не згоден.
- **Ранжувати системи онлайн-Elo** і подавати місця без інтервалів.
- **Подавати середні частки помилок** для мовлення чи зображень без зрізів.
- **Сприймати governance як паперову роботу,** написану після release, а не як докази, що їх дають тести.
- **Критерії release, вирішені після результатів.**

## Підсумок

- Публічні benchmarks складають короткий список; рішення ухвалює ваша власна evaluation на ваших cases.
- Читайте benchmark з урахуванням налаштувань, розміру, дати й насичення. Малі benchmarks шумні, а contamination завищує результати.
- Виявляйте contamination перетином n-gram, перефразованими копіями, canary strings, розбиттям за часом і приватними hold-out наборами.
- Вибирайте моделі на фронті Парето якості, вартості й latency. Серед кандидатів у межах погодженого margin якості від найкращого вирішують вартість і latency. Пілотуйте перед перемиканням.
- Будуйте власні benchmarks з експертними еталонами, рівнями складності й аналізом items і тримайте приватний hold-out набір.
- Проводьте human evaluation як процес з інструкціями, калібруванням, gold items і згодою, виміряною Krippendorff's alpha. Ранжуйте парні вподобання через Bradley–Terry з інтервалами.
- Вимірюйте multimodal і voice системи по зрізах — частками помилок і end-to-end завданнями.
- Створюйте докази для governance як побічний продукт тестування: ризики пов'язані з тестами, результати прив'язані до версій, прогалини знайдено до release.
