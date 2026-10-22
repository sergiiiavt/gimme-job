# LLM як оцінювач

**Модель-оцінювач (judge)** оцінює відповідь іншої моделі за критерієм: відповідність джерелу, тон, релевантність чи змістове виконання інструкцій. Це дозволяє обробляти багато прикладів, але потребує часу й оплати викликів.

Оцінювач сам є LLM-застосунком: він може бути недетермінованим, упередженим і чутливим до промпту. Без порівняння з людськими оцінками його числа мають невідому надійність. Розділ пояснює проєктування, калібрування, перевірку помилок та упереджень і підтримку цього вимірювального інструмента.

**Передумови:** [Методологія оцінювання та набори даних](/learn/llm?topic=evaluation-fundamentals), [Програмні оцінювачі та метрики](/learn/llm?topic=code-based-scorers), [Структуровані відповіді та їх перевірка](/learn/llm?topic=structured-output-validation).

## Коли використовувати модель-оцінювач

Використовуйте code, коли можете; judge — коли критерій потребує читання; людей — щоб визначати критерії й валідувати judge:

| Критерій | Інструмент |
|---|---|
| Output — валідний JSON, містить посилання, коротший за 80 слів | Code |
| Відповідь називає 30-денне вікно повернення | Code-based scorer за фактами, доки прийнятні формулювання можна перелічити |
| Кожне твердження відповіді підтверджене retrieved політикою | Judge, твердження за твердженням |
| Тон лишається спокійним і ввічливим із розлюченим клієнтом | Judge |
| Assistant ставить одне уточнювальне питання, коли запит неоднозначний | Judge |
| Яка з двох відповідей більше допомогла б клієнту | Pairwise judge, валідований проти людей |

Judge — правильний інструмент, коли правильні outputs надто різноманітні, щоб їх перелічити, а критерій усе ж можна сформулювати настільки точно, щоб двоє експертів погодилися.

## Види моделей-оцінювачів

| Вид | Питання до judge | Для чого |
|---|---|---|
| Pointwise, бінарний | «Чи відповідає ця відповідь критерію X? PASS або FAIL, з critique.» | Regression suites і release gates |
| З reference | «Чи узгоджується ця відповідь з еталонною?» | Питання з відомими відповідями в різних формулюваннях |
| Pairwise | «Яка з відповідей A і B краще відповідає критерію X?» | Порівняння двох prompts чи моделей |
| Розкладання на твердження | «Перелічи твердження у відповіді й познач, чи підтверджує кожне context.» | Перевірки faithfulness і hallucinations |
| Шкала за rubric | «Оціни відповідь від 1 до 5 за критерієм X» (G-Eval використовує ймовірності tokens для score) | Дослідницькі порівняння; у regression suites на неї важко реагувати |
| Fine-tuned judge | Менша модель, навчена оцінювати (наприклад, Prometheus) | Великі обсяги, після validation на ваших критеріях |

Для regression testing надавайте перевагу **одному бінарному pointwise judge на критерій**. Бінарні вердикти легше позначати, валідувати й на них реагувати, ніж шкалу, а окремий judge на критерій показує, яка саме властивість не пройшла.

## Промпт для моделі-оцінювача

Prompt для judge — це специфікація критерію плюс evidence, потрібне judge. Шаблон нижче перевіряє один критерій support assistant, «не вигадує політику»:

```text
You evaluate one property of answers written by the support assistant of an online shoe store.

Criterion: the answer must not state any rule, number, deadline, fee or promise that the policy
text does not contain.
PASS: every policy statement in the answer is supported by the policy text. Paraphrases are fine.
FAIL: at least one statement adds to or changes the policy.

Examples:
{examples}        (two passing and two failing answers from the development labels, with critiques)

Policy text: {policy}
Customer question: {question}
Answer to evaluate: {answer}

First write a short critique that quotes each policy statement you checked, then give the verdict.
Respond with JSON: {"critique": "...", "verdict": "PASS" or "FAIL"}
```

Що робить його робочим:

- **Один критерій, визначений через збої.** «Корисна й точна» — це два критерії без визначення; «додає до політики чи змінює її» — один, і він каже, що шукати.
- **Приклади з ваших власних позначених даних,** лише з development labels, щоб test labels і далі чесно вимірювали judge.
- **Лише те evidence, що потрібне критерію.** Для faithfulness це джерело; judge без джерела може перевірити лише правдоподібність.
- **Critique перед вердиктом.** Запис evidence спершу зазвичай дає обґрунтованіші вердикти, а critique пояснює рецензенту, чому judge так вирішив.
- **Structured output,** валідований як будь-який інший output моделі ([Структуровані відповіді та їх перевірка](/learn/llm?topic=structured-output-validation)), зафіксована версія моделі, temperature 0 і версіонований prompt.

Виклик judge через Anthropic SDK з контрактом Pydantic:

```python
# Run on your own machine: pip install anthropic pydantic
from typing import Literal

import anthropic
from pydantic import BaseModel


class Verdict(BaseModel):
    critique: str
    verdict: Literal["PASS", "FAIL"]


client = anthropic.Anthropic()
JUDGE_MODEL = "claude-sonnet-5-5"  # pin the exact version that was validated


def judge(prompt: str) -> Verdict:
    response = client.messages.parse(
        model=JUDGE_MODEL,
        max_tokens=800,
        temperature=0,
        messages=[{"role": "user", "content": prompt}],
        output_format=Verdict,
    )
    return response.parsed_output
```

## Звіряння з людською розміткою

Бінарний judge — це classifier, тож його валідують як classifier, проти labels доменного експерта:

1. **Позначте відповіді вручну:** 100 або більше, з достатньою кількістю збоїв (орієнтуйтеся щонайменше на 30–50), кожну з причиною вердикту.
2. **Розділіть labels:** development set — щоб покращувати prompt judge і вибирати приклади, і test set, який використовують один раз, для фінального вимірювання.
3. **Виміряйте узгодженість** на test set трьома числами:

```text
TPR (true positive rate)  share of answers that people pass and the judge passes too
TNR (true negative rate)  share of answers that people fail and the judge fails too
kappa                     agreement corrected for chance (see Evaluation methodology and datasets)
```

Сира accuracy приховує важливу помилку: коли 85% відповідей проходять, judge, що пропускає все, має accuracy 85% і нічого не ловить. TNR — це частка справжніх збоїв, яку judge ловить, і саме вона потрібна regression suite.

```python
from collections import Counter

# Human labels and judge verdicts (P = pass, F = fail) on labelled answers.
# The dev set is used to improve the judge prompt; the test set is used once, for the final report.
human_dev = "PPPPFPPFPPPPFPPPPFPPPPPFPPPPFPPPPPFPPPPP"
judge_v1_dev = "PPPPPPPFPPPPPPPPPPPPPPPFPPPPPPPPPPFPPPPP"
judge_v2_dev = "PPPPFPPFPPPPFPPPPFPPPFPFPPPPFPPPPPFPPPPP"
human_test = "PPPFPPPPPPFPPPPPPFPPPPPPFPPPPPFPPPFPPPPP"
judge_v2_test = "PPPFPPPPPPFPPPPPPPPPPPPPFPPPPPFPPFFPPPPP"


def agreement(human: str, judge: str) -> dict[str, float]:
    pairs = Counter(zip(human, judge))
    tpr = pairs[("P", "P")] / (pairs[("P", "P")] + pairs[("P", "F")])  # human passes, judge agrees
    tnr = pairs[("F", "F")] / (pairs[("F", "F")] + pairs[("F", "P")])  # human fails, judge agrees
    n = len(human)
    observed = (pairs[("P", "P")] + pairs[("F", "F")]) / n
    expected = (human.count("P") * judge.count("P") + human.count("F") * judge.count("F")) / n**2
    return {"TPR": tpr, "TNR": tnr, "kappa": (observed - expected) / (1 - expected), "missed failures": pairs[("F", "P")]}


for name, human, judge in [("judge v1, dev", human_dev, judge_v1_dev), ("judge v2, dev", human_dev, judge_v2_dev),
                           ("judge v2, test", human_test, judge_v2_test)]:
    metrics = agreement(human, judge)
    print(f"{name:<15} TPR {metrics['TPR']:.2f}  TNR {metrics['TNR']:.2f}  kappa {metrics['kappa']:.2f}  "
          f"missed failures {metrics['missed failures']} of {human.count('F')}")
```

Результат:

```text
judge v1, dev   TPR 1.00  TNR 0.43  kappa 0.55  missed failures 4 of 7
judge v2, dev   TPR 0.97  TNR 1.00  kappa 0.92  missed failures 0 of 7
judge v2, test  TPR 0.97  TNR 0.83  kappa 0.80  missed failures 1 of 6
```

Перша версія prompt judge поблажлива: вона пропускає майже все і не помічає чотирьох збоїв із семи. Після того як розбіжності з development set перетворили на точніше визначення і приклади, версія 2 виглядає ідеальною на development set, але на ньому її і налаштовували. Недоторканий test set дає чесні числа: пропущено один збій із шести. Коли в test set лише шість збоїв, сама TNR невизначена, тож найкращий наступний крок — зібрати більше прикладів збоїв ([Статистика для оцінювання](/learn/llm?topic=eval-statistics)).

Визначте мінімальні TPR і TNR до validation і прочитайте кожну розбіжність. Коли двоє експертів розходяться між собою так само часто, як із judge, критерій визначено недостатньо, щоб його автоматизувати.

## Коригування виміряної частки успіху

Коли валідований judge оцінює непозначені відповіді з production, його помилки все одно спотворюють результат. Поблажливий judge показує завищений pass rate. Якщо TPR і TNR відомі, спостережений rate можна виправити:

```text
observed pass rate   p_obs = θ · TPR + (1 − θ) · (1 − TNR)          θ = true pass rate
corrected estimate   θ̂ = (p_obs + TNR − 1) / (TPR + TNR − 1)          (Rogan and Gladen, 1978)
                     valid only when TPR + TNR > 1, a judge better than chance; clip to [0, 1]
```

Невизначеність має два джерела: вибірку оцінених відповідей і позначений набір, на якому виміряли TPR і TNR. Bootstrap по обох її враховує:

```python
import random

# Judge quality measured on 80 human-labelled test answers: (human verdict, judge verdict)
labelled = [("P", "P")] * 57 + [("P", "F")] * 3 + [("F", "F")] * 12 + [("F", "P")] * 8
# The judge then scores 1,000 unlabelled production answers and passes 812 of them
unlabelled = ["P"] * 812 + ["F"] * 188


def corrected_rate(labelled, unlabelled) -> float:
    """Rogan-Gladen: the true pass rate implied by the observed rate and the judge error rates."""
    human_pass = [judge for human, judge in labelled if human == "P"]
    human_fail = [judge for human, judge in labelled if human == "F"]
    tpr = human_pass.count("P") / len(human_pass)
    tnr = human_fail.count("F") / len(human_fail)
    observed = unlabelled.count("P") / len(unlabelled)
    return min(1.0, max(0.0, (observed + tnr - 1) / (tpr + tnr - 1)))


rng = random.Random(1)
estimates = sorted(
    corrected_rate([rng.choice(labelled) for _ in labelled], [rng.choice(unlabelled) for _ in unlabelled])
    for _ in range(2000)
)
print(f"judge says: {unlabelled.count('P') / len(unlabelled):.1%} of answers pass")
print(f"corrected for judge errors: {corrected_rate(labelled, unlabelled):.1%}")
print(f"95% bootstrap interval: {estimates[50]:.1%} to {estimates[1949]:.1%}")
```

Результат:

```text
judge says: 81.2% of answers pass
corrected for judge errors: 74.9%
95% bootstrap interval: 55.3% to 86.4%
```

Judge пропускає 8 із 20 позначених збоїв (TNR 0.60), тож завищує pass rate приблизно на шість пунктів. Інтервал широкий, бо 20 позначених збоїв погано вимірюють TNR: більше позначених збоїв звузить його значно сильніше, ніж більше відповідей із production. Бібліотека judgy реалізує це виправлення з bootstrap-інтервалами. Щонайменше наводьте оцінену judge metric разом із TPR і TNR judge.

## Упередження та способи їх вимірювання

| Упередження | Що відбувається | Як виміряти | Що допомагає |
|---|---|---|---|
| Позиційне | У pairwise-порівнянні частіше перемагає відповідь, показана першою (або другою) | Оцінювати кожну пару в обох порядках; рахувати неузгоджені вердикти | Завжди обидва порядки; неузгоджені пари рахувати нічиєю |
| Багатослів'я | Довші відповіді частіше перемагають чи проходять | Доповнити правильні відповіді нерелевантним текстом; вердикт не має покращитися | Сказати, що довжина — не якість; аналізувати результати за довжиною |
| Перевага власних | Judge віддає перевагу відповідям своєї родини моделей | Порівняти його вердикти з human labels окремо для кожної моделі | Judge з іншої родини, валідований на всіх порівнюваних моделях |
| Поблажливість | Judge пропускає майже все | TNR на позначених збоях | Точні визначення збоїв і приклади збоїв |
| Чутливість до prompt | Дрібні правки prompt judge зсувають вердикти | Повторювати validation після кожної зміни | Версіонувати prompt і модель judge; повторна validation після змін |
| Переконливість відповіді | Упевнені заяви про правильність схиляють judge | Позначені відповіді, що заявляють про дотримання політики, але не дотримуються | Давати джерело; вимагати цитат як evidence у critique |

Позиційне упередження в pairwise-порівнянні двох версій prompt:

```python
from collections import Counter

# Each pair of answers (A from the current prompt, B from the candidate) was judged twice:
# once with A shown first and once with B shown first. Each entry is the winner in (first run, second run).
verdicts = ([("B", "B")] * 18 + [("A", "A")] * 12 + [("A", "B")] * 14 + [("B", "A")] * 6)

consistent = [first for first, second in verdicts if first == second]
shown_first_won = sum(first == "A" for first, _ in verdicts) + sum(second == "B" for _, second in verdicts)
print(f"{len(verdicts)} pairs, consistent in both orders: {len(consistent)} ({len(consistent) / len(verdicts):.0%})")
print(f"the answer shown first won {shown_first_won} of {2 * len(verdicts)} judgements ({shown_first_won / (2 * len(verdicts)):.0%})")

naive = Counter(first for first, _ in verdicts)
wins = Counter(consistent)
ties = len(verdicts) - len(consistent)
print(f"one order only:  B wins {naive['B'] / len(verdicts):.0%}")
print(f"both orders:     B wins {wins['B']}, A wins {wins['A']}, inconsistent (tie) {ties}; "
      f"B win rate counting ties as half {(wins['B'] + ties / 2) / len(verdicts):.0%}")
```

Результат:

```text
50 pairs, consistent in both orders: 30 (60%)
the answer shown first won 58 of 100 judgements (58%)
one order only:  B wins 48%
both orders:     B wins 18, A wins 12, inconsistent (tie) 20; B win rate counting ties as half 56%
```

Коли A завжди показано першою, кандидат ніби програє; оцінений в обох порядках, він перемагає. Сорок відсотків вердиктів залежать лише від порядку, а це також означає, що багато пар надто близькі, щоб цей judge їх розрізнив. Чи 18 перемог проти 12 — більше, ніж шум, вирішують sign test або bootstrap-інтервал ([Статистика для оцінювання](/learn/llm?topic=eval-statistics)). Системи, що ранжують багато моделей за pairwise-вердиктами, як Chatbot Arena, підганяють під них модель Бредлі–Террі; для двох версій достатньо win rate з інтервалом.

## Підтримання надійності оцінювача

- **Judge має версію:** його prompt, приклади й модель. Зміна будь-чого з них потребує нової validation на test labels.
- **Регулярно позначайте свіжу вибірку,** наприклад щомісяця, і перераховуйте TPR і TNR. Змінюються система, користувачі й модель за judge.
- **Стежте за часткою вердиктів fail у production.** Різка зміна означає зміну в системі або в judge, і обидві потребують уваги.
- **Перетворюйте розбіжності на приклади,** але додавайте їх до development labels, ніколи — до test labels.
- **Очікуйте дрейфу критеріїв.** Читання outputs під час оцінювання уточнює, що означає «добре»; коли критерій змінюється, оновлюйте labels разом із ним.

## Вартість і затримка

- **Залучайте judge лише там, де code не може вирішити,** і пропускайте judge, коли перевірка code вже відхилила відповідь.
- **Оцінюйте вибірку** production traffic, достатню для потрібної точності, а не кожну відповідь.
- **Кешуйте вердикти** за версією judge, input і output.
- **Використовуйте меншу модель judge,** якщо вона проходить ту саму validation, що й більша.
- **Відстежуйте вартість оцінювання** для кожного evaluation run поруч із вартістю генерації.

## Метаморфні відношення без еталона

Іноді немає ні reference, ні надійного judge. Метаморфне тестування перевіряє, як outputs для пов'язаних inputs мають співвідноситися між собою, і для цього правильна відповідь узагалі не потрібна:

| Відношення | Перетворення input | Очікуване відношення outputs |
|---|---|---|
| Незмінність до перефразування | Переформулювати питання | Ті самі факти в обох відповідях |
| Нерелевантні доповнення | Додати непов'язане речення | Та сама відповідь |
| Порядок документів | Перемішати retrieved документи | Та сама відповідь |
| Заперечення | Заперечити ключовий факт у context | Відповідь змінюється відповідно |
| Мова | Перекласти питання | Еквівалентна відповідь новою мовою |
| Контрфактична справедливість | Змінити ім'я, стать чи регіон | Еквівалентні якість і тон |

Порівняння двох outputs знову виконує code (ті самі факти, ті самі tool calls) або judge, що бачить обидві відповіді ([Чим особливе тестування LLM](/learn/llm?topic=llm-testing-problem-space) познайомив із property oracles такого типу).

## Приклад проєкту

Методи цього chapter реалізовані й покриті тестами в [examples/llm-testing/10-llm-judge](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/10-llm-judge): версіонований prompt judge з валідованими structured вердиктами, fake judge з налаштовуваними поблажливістю, позиційним упередженням і упередженням до багатослів'я, звіт validation з TPR, TNR, kappa та їхніми інтервалами на development і test labels, виправлений pass rate з bootstrap-інтервалом, перевірений симуляцією, проби на позиційне упередження й багатослів'я, і pairwise win rate з обох порядків. Необов'язкова live-перевірка запускає того самого judge на реальній моделі. Усі інші тести працюють offline, без моделі та API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/10-llm-judge
```

## Типові помилки

- **Довіряти judge, якого ніколи не порівнювали з human labels.**
- **Наводити accuracy замість TPR і TNR,** що приховує judge, який пропускає більшість збоїв.
- **Вимірювати judge на labels, якими налаштовували його prompt.**
- **Один judge для кількох критеріїв** з розмитим визначенням на кшталт «корисна й правильна».
- **Judge без джерела,** якого питають, чи відповідь відповідає цьому джерелу.
- **Pairwise-порівняння лише в одному порядку.**
- **Змінювати prompt чи модель judge без повторної validation** і порівнювати результати різних версій judge.
- **Наводити оцінений judge pass rate без виправлення** або хоча б без TPR і TNR judge.

## Підсумок

- Програмні перевірки використовуйте для формалізованих правил, модельні — для змісту. Люди визначають критерії й перевіряють оцінювачів.
- Для окремого критерію задайте чіткий бінарний вердикт, приклади, потрібні докази та структуру відповіді.
- Перевіряйте на відкладених людських мітках TPR, TNR і каппу. За кодуванням «успіх = позитивний клас» TNR показує виявлення справжніх збоїв.
- Коригуйте частку успіхів з урахуванням виміряних помилок оцінювача; для оцінки Rogan–Gladen враховуйте невизначеність параметрів.
- Вимірюйте позиційне упередження, перевагу довших відповідей і власних результатів. Порівнюйте пари в обох порядках.
- Версіонуйте й повторно перевіряйте оцінювачів на свіжих людських оцінках.
- Метаморфні відношення допомагають перевіряти зв’язок результатів навіть без точного еталона.
