# Статистика для оцінювання

Результат evaluation — це вимірювання на вибірці. «Версія B проходить 84% golden set, версія A проходила 81%» звучить як прогрес, але інші 200 cases, ще один запуск тих самих cases або інший grader дали б інші числа. Без оцінки цієї мінливості ніхто не може сказати, чи B краща, така сама чи гірша.

Цей chapter перетворює числа evaluation на твердження з відомою невизначеністю: довірчі інтервали для pass rate, коректні порівняння двох версій на тих самих cases, інтервали для будь-якої metric через bootstrap, повторні запуски недетермінованих систем, розміри вибірок і power, багато порівнянь одночасно та release gates, які не падають випадково.

**Передумови:** [Методологія оцінювання та набори даних](/learn/llm?topic=evaluation-fundamentals), [Програмні оцінювачі та метрики](/learn/llm?topic=code-based-scorers). Джерела випадковості в генерації пояснено в [Як LLM генерують текст](/learn/llm?topic=llm-foundations).

## Звідки береться невизначеність

Score evaluation змінюють чотири речі. Статистика працює з першими трьома; четверта — питання validity, яке жодна формула не виправить.

| Джерело | Що змінюється | Що зменшує | Що не допомагає |
|---|---|---|---|
| Вибірка cases | Які inputs випадково потрапили в dataset | Більше cases, стратифікована вибірка важливих зрізів | Більше запусків тих самих cases |
| Випадковість генерації | Output для того самого input | Кілька запусків на case, нижча temperature там, де feature це дозволяє | Більше cases з одним запуском кожен |
| Шум grader | Вердикт для того самого output | Валідовані scorers, кілька judges чи оцінювачів, усереднення | Лише більше cases |
| Validity dataset | Чи відображає dataset реальне використання | Вибірка з production, оновлення dataset | Будь-яка кількість статистики |

Навіть за temperature 0 outputs hosted моделей можуть відрізнятися між запусками через batching і ефекти floating point ([Як LLM генерують текст](/learn/llm?topic=llm-foundations)), тож випадковість генерації присутня майже в кожному evaluation LLM.

## Частка успіху як оцінка

Якщо система проходить `k` з `n` незалежних cases, спостережений pass rate оцінює rate, який ви побачили б на всій сукупності inputs, з якої взято cases. Біноміальна модель дає його невизначеність:

```text
observed pass rate        p = k / n
standard error            SE = sqrt(p · (1 − p) / n)
Wald 95% interval         p ± 1.96 · SE
Wilson 95% interval       (p + z²/2n ± z · sqrt(p · (1 − p)/n + z²/4n²)) / (1 + z²/n),   z = 1.96
zero failures in n cases  95% upper bound on the failure rate ≈ 3 / n   (the rule of three)
```

Інтервал Вальда пам'ятає більшість людей. Скрипт порівнює його з інтервалом Вілсона на типових результатах evaluation:

```python
import math
from statistics import NormalDist

Z = NormalDist().inv_cdf(0.975)  # 1.96 for a two-sided 95% interval


def wald(k: int, n: int) -> tuple[float, float]:
    """The textbook normal approximation: p plus or minus z times sqrt(p(1 - p) / n)."""
    p = k / n
    half = Z * math.sqrt(p * (1 - p) / n)
    return p - half, p + half


def wilson(k: int, n: int) -> tuple[float, float]:
    """Wilson score interval: stays inside [0, 1] and keeps its coverage for small n and extreme rates."""
    p = k / n
    denominator = 1 + Z**2 / n
    center = (p + Z**2 / (2 * n)) / denominator
    half = Z / denominator * math.sqrt(p * (1 - p) / n + Z**2 / (4 * n**2))
    return center - half, center + half


print("passed/cases   rate    Wald 95% interval    Wilson 95% interval")
for k, n in [(42, 50), (9, 10), (50, 50), (1, 30), (980, 1000)]:
    wald_low, wald_high = wald(k, n)
    low, high = wilson(k, n)
    print(f"{k:>6}/{n:<6} {k / n:6.1%}   [{wald_low:6.1%}, {wald_high:6.1%}]    [{low:6.1%}, {high:6.1%}]")
```

Результат:

```text
passed/cases   rate    Wald 95% interval    Wilson 95% interval
    42/50      84.0%   [ 73.8%,  94.2%]    [ 71.5%,  91.7%]
     9/10      90.0%   [ 71.4%, 108.6%]    [ 59.6%,  98.2%]
    50/50     100.0%   [100.0%, 100.0%]    [ 92.9%, 100.0%]
     1/30       3.3%   [ -3.1%,   9.8%]    [  0.6%,  16.7%]
   980/1000    98.0%   [ 97.1%,  98.9%]    [ 96.9%,  98.7%]
```

Інтервал Вальда стверджує, що 50 проходжень з 50 доводять pass rate рівно 100%, дозволяє 108.6% для 9 з 10 і від'ємний rate для 1 з 30. Інтервал Вілсона лишається між 0 і 1 і каже те, що підтримують дані: 50 з 50 узгоджуються зі справжнім pass rate навіть 92.9%. Наводьте pass rate з інтервалом і розміром вибірки, наприклад «84% (95% CI 72–92%, n = 50)».

Правило трьох відповідає на часте питання про тести безпеки: якщо 300 adversarial cases не дали жодного збою, частота збоїв нижча приблизно за 1% (3/300) з довірою 95%, а не дорівнює нулю.

### Перевірка методу інтервалів симуляцією

Метод 95% інтервалу правильний, коли інтервал містить справжній rate у 95% повторених експериментів. Цю властивість, coverage, можна перевірити напряму, симулюючи evaluations системи з відомим справжнім pass rate:

```python
import math
import random
from statistics import NormalDist

Z = NormalDist().inv_cdf(0.975)


def wald(k, n):
    p = k / n
    half = Z * math.sqrt(p * (1 - p) / n)
    return p - half, p + half


def wilson(k, n):
    p = k / n
    denominator = 1 + Z**2 / n
    center = (p + Z**2 / (2 * n)) / denominator
    half = Z / denominator * math.sqrt(p * (1 - p) / n + Z**2 / (4 * n**2))
    return center - half, center + half


rng = random.Random(7)
experiments = 2000
print("true rate  cases  Wald covers  Wilson covers")
for true_rate, n in [(0.95, 30), (0.80, 30), (0.95, 300)]:
    wald_hits = wilson_hits = 0
    for _ in range(experiments):
        k = sum(rng.random() < true_rate for _ in range(n))
        low, high = wald(k, n)
        wald_hits += low <= true_rate <= high
        low, high = wilson(k, n)
        wilson_hits += low <= true_rate <= high
    print(f"{true_rate:9.0%}  {n:5}  {wald_hits / experiments:11.1%}  {wilson_hits / experiments:13.1%}")
```

Результат:

```text
true rate  cases  Wald covers  Wilson covers
      95%     30        78.0%          94.7%
      80%     30        95.2%          96.5%
      95%    300        92.2%          94.8%
```

Для feature, яка насправді проходить 95% cases, «95%» інтервал Вальда з 30 cases не містить істини частіше ніж один раз із п'яти. Браун, Кай і ДасГупта показали, що таке нестабільне coverage не обмежується малими вибірками. Хороші LLM features мають pass rate близько 100% — саме там, де інтервал Вальда не працює, — тож використовуйте інтервал Вілсона або точний інтервал Клоппера–Пірсона, коли інтервал ніколи не має покривати менше обіцяного. Бібліотеки на кшталт statsmodels реалізують усі ці методи.

## Порівняння версій на однакових прикладах

Більшість порівнянь у роботі з LLM — **парні**: поточна версія A і кандидат B відповідають на ті самі cases. Тоді кожен case потрапляє в одну з чотирьох клітинок, і лише дві з них несуть інформацію про різницю:

| Результат | B проходить | B не проходить |
|---|---|---|
| A проходить | обидві проходять: жодної інформації про різницю | проходить лише A: свідчення на користь A |
| A не проходить | проходить лише B: свідчення на користь B | обидві не проходять: жодної інформації про різницю |

Якби A і B були однаково хороші, case, який проходить лише одна з них, з однаковою ймовірністю свідчив би на користь будь-якої, як чесна монета. Тест Мак-Немара перевіряє, чи розподіл цих розбіжних cases занадто нерівний для чесної монети:

```text
discordant cases     b = cases only A passes,  c = cases only B passes,  n = all cases
difference           d = (c − b) / n
paired standard error sqrt(b + c − (c − b)² / n) / n
exact McNemar test   two-sided p = 2 · P(X ≤ min(b, c)),   X ~ Binomial(b + c, 1/2)
```

Скрипт порівнює те саме покращення на три пункти на 200 і на 1 000 cases, проаналізоване правильно як парне і неправильно як дві непов'язані вибірки:

```python
import math
from statistics import NormalDist

Z = NormalDist().inv_cdf(0.975)


def mcnemar_exact(only_a: int, only_b: int) -> float:
    """Two-sided exact McNemar test: if A and B are equally good, each discordant case is a fair coin flip."""
    n = only_a + only_b
    tail = sum(math.comb(n, i) for i in range(min(only_a, only_b) + 1)) / 2**n
    return min(1.0, 2 * tail)


def paired_interval(both: int, only_a: int, only_b: int, neither: int) -> tuple[float, float]:
    """95% interval for the difference in pass rate (B minus A) when both ran on the same cases."""
    n = both + only_a + only_b + neither
    diff = (only_b - only_a) / n
    se = math.sqrt(only_a + only_b - (only_b - only_a) ** 2 / n) / n
    return diff - Z * se, diff + Z * se


def unpaired_interval(passed_a: int, passed_b: int, n: int) -> tuple[float, float]:
    """The same comparison analysed as if A and B had run on two unrelated samples of cases."""
    p_a, p_b = passed_a / n, passed_b / n
    se = math.sqrt(p_a * (1 - p_a) / n + p_b * (1 - p_b) / n)
    return p_b - p_a - Z * se, p_b - p_a + Z * se


# both pass, only A passes, only B passes, both fail
for both, only_a, only_b, neither in [(150, 12, 18, 20), (760, 30, 60, 150)]:
    n = both + only_a + only_b + neither
    low, high = paired_interval(both, only_a, only_b, neither)
    u_low, u_high = unpaired_interval(both + only_a, both + only_b, n)
    print(f"{n} cases: A {(both + only_a) / n:.1%}, B {(both + only_b) / n:.1%}, only A passes {only_a}, only B passes {only_b}")
    print(f"  paired:   B - A in [{low:+.1%}, {high:+.1%}], McNemar p = {mcnemar_exact(only_a, only_b):.3f}")
    print(f"  unpaired: B - A in [{u_low:+.1%}, {u_high:+.1%}]")
```

Результат:

```text
200 cases: A 81.0%, B 84.0%, only A passes 12, only B passes 18
  paired:   B - A in [-2.4%, +8.4%], McNemar p = 0.362
  unpaired: B - A in [-4.4%, +10.4%]
1000 cases: A 79.0%, B 82.0%, only A passes 30, only B passes 60
  paired:   B - A in [+1.1%, +4.9%], McNemar p = 0.002
  unpaired: B - A in [-0.5%, +6.5%]
```

Як це читати:

- **На 200 cases три пункти — це шум.** Вісімнадцять розбіжних cases проти дванадцяти — звичайний результат підкидання монети (p = 0.36), а інтервал тягнеться від B, гіршої на 2.4 пункта, до B, кращої на 8.4.
- **На 1 000 cases парний аналіз знаходить реальне свідчення**: B краща на 1.1–4.9 пункта.
- **Непарний аналіз тих самих даних нічого не знаходить**, бо вважає складність кожного case шумом. Обидві версії мають цю складність спільно, і парність її скасовує. Запуск обох версій на тих самих cases з парним аналізом — найдешевший спосіб зробити порівняння чутливішими.

Дітеріх рекомендував тест Мак-Немара для порівняння двох classifiers на одному test set з тієї самої причини. Для порівняння більше ніж двох систем або для metrics, що не є pass rates, використовуйте bootstrap.

## Бутстреп-інтервали для метрик

Багато metrics не мають простої формули невизначеності: середній score judge від 1 до 5, F1 на всьому dataset, вартість одного вирішеного завдання. **Bootstrap** оцінює невизначеність симуляцією: він формує нові datasets того самого розміру з наявних cases з поверненням і перераховує metric на кожному. Розкид перерахованих значень наближає розкид, який ви побачили б на реальних вибірках cases.

Для порівнянь **парний bootstrap** перевибирає cases, тримаючи результати A і B кожного case разом, що зберігає перевагу парності. Кон запровадив його для порівняння систем машинного перекладу.

```python
import random
from statistics import fmean

# Judge scores from 1 to 5 for the same 40 cases, answered by version A and by version B
a = [4, 5, 3, 4, 4, 2, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4, 2, 4, 4, 5, 3, 4, 4, 5, 4, 3, 4, 4, 5, 2, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4]
b = [4, 5, 4, 4, 5, 2, 5, 4, 4, 4, 5, 4, 3, 4, 5, 5, 3, 4, 4, 5, 4, 4, 4, 5, 4, 3, 5, 4, 5, 3, 4, 4, 4, 5, 4, 5, 4, 3, 5, 4]

rng = random.Random(11)
differences = []
for _ in range(5000):
    picked = [rng.randrange(len(a)) for _ in range(len(a))]  # resample cases; each pair stays together
    differences.append(fmean(b[i] for i in picked) - fmean(a[i] for i in picked))
differences.sort()
low, high = differences[int(0.025 * len(differences))], differences[int(0.975 * len(differences)) - 1]

print(f"mean score A {fmean(a):.2f}, B {fmean(b):.2f}, difference {fmean(b) - fmean(a):+.3f}")
print(f"95% paired bootstrap interval for B - A: [{low:+.3f}, {high:+.3f}]")
print(f"share of resamples where B is not better: {sum(d <= 0 for d in differences) / len(differences):.2%}")
```

Результат:

```text
mean score A 3.90, B 4.15, difference +0.250
95% paired bootstrap interval for B - A: [+0.100, +0.400]
share of resamples where B is not better: 0.04%
```

Практичні правила для bootstrap:

- **Перевибирайте ту одиницю, яку вибирали.** Якщо dataset містить 50 розмов по 10 реплік, перевибирайте розмови, а не репліки; репліки однієї розмови не незалежні.
- **Достатньо перевибірок і фіксований seed:** кілька тисяч для інтервалу, а seed записуйте, щоб звіт можна було відтворити.
- **Bootstrap не врятує малий чи нерепрезентативний dataset.** За дуже малої кількості cases bootstrap-інтервал занадто вузький, і жодне перевибирання не додасть cases, яких немає в dataset.

## Повторні запуски: pass@k, pass^k і залежні помилки

Коли той самий case може пройти в одному запуску й не пройти в наступному, один запуск на case змішує два питання: як часто система права і наскільки стабільно. Кілька запусків кожного case розділяють їх. За `c` проходжень у `n` запусках case дві різні зведені величини відповідають на два різні продуктові питання:

```text
pass@k   chance that at least one of k attempts passes   = 1 − C(n − c, k) / C(n, k)
pass^k   chance that all k attempts pass                   = C(c, k) / C(n, k)
         C(n, k) is the number of ways to choose k runs out of n; both are averaged over cases
```

Оцінка pass@k — це незміщена форма, запроваджена разом із benchmark HumanEval; pass^k запровадив τ-bench для вимірювання надійності agents.

```python
from math import comb


def pass_at_k(n: int, c: int, k: int) -> float:
    """Unbiased estimate of the chance that at least one of k attempts passes, from c passes in n runs."""
    if n - c < k:
        return 1.0
    return 1 - comb(n - c, k) / comb(n, k)


def pass_hat_k(n: int, c: int, k: int) -> float:
    """Estimate of the chance that all k attempts pass: the reliability a returning user experiences."""
    return comb(c, k) / comb(n, k)


runs = 10
passes = [10, 10, 9, 9, 8, 7, 7, 5, 3, 2]  # passes out of 10 runs, for 10 cases
for k in [1, 3, 5]:
    at_k = sum(pass_at_k(runs, c, k) for c in passes) / len(passes)
    hat_k = sum(pass_hat_k(runs, c, k) for c in passes) / len(passes)
    print(f"k={k}: pass@k = {at_k:.2f}   pass^k = {hat_k:.2f}")
```

Результат:

```text
k=1: pass@k = 0.70   pass^k = 0.70
k=3: pass@k = 0.91   pass^k = 0.45
k=5: pass@k = 0.97   pass^k = 0.34
```

З тих самих запусків система «розв'язує 97% завдань за п'ять спроб» і «правильно виконує завдання п'ять разів поспіль лише в 34% випадків». Обирайте величину за тим, як використовують output:

- **pass@k** підходить, коли verifier або людина обирає серед кількох спроб, як зі згенерованим code, що перевіряється тестами.
- **pass^k** підходить, коли успішною має бути кожна взаємодія: agent, яким клієнт користується щодня, відповідь support, яку кожен клієнт бачить один раз.

### Кластеризовані стандартні похибки

П'ять запусків 100 cases — це не 500 незалежних спостережень. Запуски того самого case мають спільну складність, тож узгоджуються між собою більше, ніж запуски різних cases. Стандартна похибка, обчислена так, ніби 500 запусків незалежні, занадто мала; правильна вважає одиницею вибірки case:

```python
import math
import random
from statistics import fmean, stdev

rng = random.Random(3)
# 100 cases of different difficulty: the chance that one run of each case passes
difficulty = [0.98] * 50 + [0.85] * 30 + [0.40] * 15 + [0.05] * 5
runs = 5
results = [[rng.random() < p for _ in range(runs)] for p in difficulty]

every_run = [passed for case in results for passed in case]
rate = fmean(every_run)
naive_se = math.sqrt(rate * (1 - rate) / len(every_run))  # pretends the 500 runs are independent
case_rates = [fmean(case) for case in results]
clustered_se = stdev(case_rates) / math.sqrt(len(case_rates))  # the case is the unit that was sampled

print(f"pass rate {rate:.1%} from {len(results)} cases with {runs} runs each")
print(f"naive standard error     {naive_se:.2%}, 95% interval about {rate:.1%} plus or minus {1.96 * naive_se:.1%}")
print(f"clustered standard error {clustered_se:.2%}, 95% interval about {rate:.1%} plus or minus {1.96 * clustered_se:.1%}")
```

Результат:

```text
pass rate 82.2% from 100 cases with 5 runs each
naive standard error     1.71%, 95% interval about 82.2% plus or minus 3.4%
clustered standard error 2.87%, 95% interval about 82.2% plus or minus 5.6%
```

Наївний інтервал майже на 40% вужчий, ніж треба. Більше запусків на case зменшують шум генерації всередині cases, але невизначеність щодо того, з якими cases система впорається, зменшують лише нові cases. Стаття Міллера про error bars для evaluations мовних моделей детально описує кластеризовані стандартні похибки, парні різниці та інші методи зменшення дисперсії.

## Розмір вибірки та статистична потужність

Два питання планування визначають, яким великим має бути evaluation dataset: наскільки точно він вимірює одну версію і наскільки малу різницю між двома версіями може виявити.

```text
precision   n = z² · p(1 − p) / E²                                   cases for a 95% interval of about ±E
unpaired    n = (z_α + z_β)² · (p_A(1 − p_A) + p_B(1 − p_B)) / δ²    cases per version
paired      n = (z_α · sqrt(π_d) + z_β · sqrt(π_d − δ²))² / δ²        cases run by both versions (Connor, 1987)
            δ = p_B − p_A,  π_d = share of discordant cases,  z_α = 1.96 (5% level),  z_β = 0.84 (80% power)
```

**Power** — це ймовірність, що порівняння виявить різницю, яка справді існує; поширена ціль — 80%.

```python
import math
from statistics import NormalDist

z = NormalDist().inv_cdf


def cases_for_margin(margin: float, expected_rate: float = 0.5) -> int:
    """Cases needed for a 95% interval of about plus or minus margin around a pass rate."""
    return math.ceil(z(0.975) ** 2 * expected_rate * (1 - expected_rate) / margin**2)


def cases_to_detect(p_a: float, p_b: float, discordant: float, power: float = 0.8) -> tuple[int, int]:
    """Cases needed to detect p_b - p_a at the 5% level: unpaired per version, and paired (Connor, 1987)."""
    delta = p_b - p_a
    z_alpha, z_beta = z(0.975), z(power)
    unpaired = (z_alpha + z_beta) ** 2 * (p_a * (1 - p_a) + p_b * (1 - p_b)) / delta**2
    paired = (z_alpha * math.sqrt(discordant) + z_beta * math.sqrt(discordant - delta**2)) ** 2 / delta**2
    return math.ceil(unpaired), math.ceil(paired)


for margin in [0.10, 0.05, 0.03, 0.02]:
    print(f"margin {margin:4.0%}: {cases_for_margin(margin):>5} cases at a 50% pass rate, {cases_for_margin(margin, 0.9):>5} at 90%")
for p_a, p_b in [(0.80, 0.85), (0.80, 0.83), (0.90, 0.91)]:
    unpaired, paired = cases_to_detect(p_a, p_b, discordant=0.10)
    print(f"{p_a:.0%} to {p_b:.0%}: {unpaired:>6} cases per version unpaired, {paired:>6} cases paired")
```

Результат:

```text
margin  10%:    97 cases at a 50% pass rate,    35 at 90%
margin   5%:   385 cases at a 50% pass rate,   139 at 90%
margin   3%:  1068 cases at a 50% pass rate,   385 at 90%
margin   2%:  2401 cases at a 50% pass rate,   865 at 90%
80% to 85%:    903 cases per version unpaired,    312 cases paired
80% to 83%:   2626 cases per version unpaired,    870 cases paired
90% to 91%:  13493 cases per version unpaired,   7847 cases paired
```

Що це означає для реальних evaluation suites:

- **Golden set на 50 cases** вимірює pass rate з точністю приблизно ±10 пунктів. Він ловить обвал, а не regression на три пункти.
- **Парність скорочує потрібну кількість cases** тут у два-три рази; виграш залежить від того, як часто версії розходяться, а це можна виміряти з попереднього порівняння.
- **Покращення хорошої системи на один пункт потребують тисяч cases.** Якщо suite не може бути таким великим, укажіть найменшу різницю, яку він здатен виявити, і вважайте менші зміни невідомими, а не «відсутністю змін». Кард із колегами виявили, що багато опублікованих порівнянь у NLP мали саме таку недостатню power.

## Зрізи, метрики й множинні порівняння

Кожен тест на рівні 5% має 5% шансу хибної тривоги, коли нічого не змінилося. Двадцять зрізів, metrics чи judges, порівняних одночасно, майже гарантують одну таку тривогу:

```python
import random

rng = random.Random(5)
slices, alpha, evaluations = 20, 0.05, 10000
# When nothing changed, every p-value is uniformly distributed between 0 and 1.
false_alarms = sum(any(rng.random() < alpha for _ in range(slices)) for _ in range(evaluations))
print(f"{slices} slices and no real change: a significant slice in {false_alarms / evaluations:.0%} of evaluations")
print(f"expected 1 - (1 - alpha) ** slices = {1 - (1 - alpha) ** slices:.0%}")


def holm(p_values: dict[str, float], alpha: float = 0.05) -> dict[str, bool]:
    """Holm-Bonferroni: the i-th smallest p-value must be at most alpha / (m - i); stop at the first that is not."""
    ordered = sorted(p_values.items(), key=lambda item: item[1])
    significant, still_rejecting = {}, True
    for i, (name, p) in enumerate(ordered):
        still_rejecting = still_rejecting and p <= alpha / (len(ordered) - i)
        significant[name] = still_rejecting
    return significant


p_values = {"lang=uk": 0.004, "feature=refunds": 0.03, "feature=delivery": 0.20, "lang=en": 0.45}
for name, significant in holm(p_values).items():
    verdict = "significant" if significant else "not significant after correction"
    print(f"{name:<17} p = {p_values[name]:.3f}  {verdict}")
```

Результат:

```text
20 slices and no real change: a significant slice in 64% of evaluations
expected 1 - (1 - alpha) ** slices = 64%
lang=uk           p = 0.004  significant
feature=refunds   p = 0.030  not significant after correction
feature=delivery  p = 0.200  not significant after correction
lang=en           p = 0.450  not significant after correction
```

Як тримати хибні тривоги під контролем:

- **Визначте основну metric і правило рішення до запуску.** Усе інше — дослідницький аналіз.
- **Коригуйте на кількість порівнянь,** коли рішення ухвалюють для кожного зрізу окремо. Процедура Голма контролює ймовірність будь-якої хибної тривоги і ніколи не слабша за простішу поправку Бонферроні.
- **Сприймайте несподівані результати зрізів як гіпотези.** Прочитайте cases, що не пройшли ([Методологія оцінювання та набори даних](/learn/llm?topic=evaluation-fundamentals)), і підтвердьте ефект на нових cases, перш ніж діяти.

## Від статистики до критеріїв випуску

Gate на кшталт «кандидат не має отримати нижчий score, ніж поточна версія» падає приблизно в половині випадків, коли версії однаково хороші, тож команди вчаться його ігнорувати. Gate, що враховує шум, порівнює інтервал різниці з margin, який погодила продуктова команда:

```diagram
Run A (current) and B (candidate) on the same cases
        ↓
Any zero-tolerance case failed?      → yes: block
        ↓ no
Paired difference B − A, 95% interval
        ↓
Lower bound above −δ (the margin)?   → yes: ship
        ↓ no
Upper bound below 0?                 → yes: block, a regression
        ↓ no
Inconclusive: add cases or keep A
```

Це рішення **non-inferiority**: кандидат виходить, коли дані показують, що він не гірший за поточну версію більш ніж на δ, наприклад на два пункти. Margin — продуктове рішення, ухвалене до запуску. Hard gates лишаються поза статистикою: один витеклий секрет чи один зламаний контракт блокує release незалежно від середніх ([Структуровані відповіді та їх перевірка](/learn/llm?topic=structured-output-validation)).

Повний звіт evaluation містить:

| Пункт | Приклад |
|---|---|
| Вибірка | 1 000 cases з production, стратифіковано за мовою |
| Запуски | 3 запуски на case, temperature 0.2 |
| Оцінка з інтервалом | 82.0% (95% CI Вілсона 79.5–84.3%) |
| Порівняння | B − A = +3.0 пункта, парний 95% CI від +1.1 до +4.9, p Мак-Немара = 0.002 |
| Правило рішення | Margin non-inferiority 2 пункти, визначений до запуску |
| Відтворюваність | Версія dataset, версія scorer, random seed |
| Зрізи | З поправкою Голма; несподівані зрізи передано на error analysis |

## Приклад проєкту

Методи цього chapter реалізовані й покриті тестами в [examples/llm-testing/11-eval-statistics](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/11-eval-statistics): інтервали Вальда, Вілсона і Клоппера–Пірсона із симульованим coverage, точний тест Мак-Немара, перевірений повним перебором, парний bootstrap, pass@k і pass^k, кластеризовані стандартні похибки, розрахунки розміру вибірки й power, поправка Голма та порівняння двох записаних запусків із командного рядка, яке завершується рішенням ship, block або inconclusive. Усі тести працюють offline, без моделі та API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/11-eval-statistics
```

## Типові помилки

- **Наводити pass rate без кількості cases чи інтервалу.**
- **Використовувати інтервал Вальда** для малих вибірок або pass rates близько 0% чи 100%.
- **Порівнювати дві версії, що працювали на тих самих cases, непарним тестом** або просто дивлячись на два середні.
- **Вважати повторні запуски тих самих cases незалежними cases,** через що інтервали стають занадто вузькими.
- **Наводити pass@k, коли користувачі відчувають pass^k.**
- **Тестувати багато зрізів і діяти за тим, що вийшов значущим,** без поправки чи підтвердження.
- **Release gates без margin,** які падають випадково, коли нічого не змінилося.
- **Тримати golden set, замалий для виявлення важливих regressions,** не вказуючи найменшу різницю, яку він здатен виявити.

## Підсумок

- Score evaluation — це оцінка; вибірка cases, випадковість генерації і шум grader змушують його коливатися, а validity dataset — окреме питання.
- Наводьте кожен pass rate з розміром вибірки та інтервалом; надавайте перевагу інтервалу Вілсона і пам'ятайте правило трьох для нуля збоїв.
- Порівнюйте версії на тих самих cases і аналізуйте їх як пари: тест Мак-Немара і парний інтервал використовують лише cases, де версії розходяться.
- Парний bootstrap дає інтервали для будь-якої metric; перевибирайте ту одиницю, яку вибирали.
- За повторних запусків обирайте pass@k чи pass^k за тим, як використовують output, і обчислюйте стандартні похибки по cases.
- Плануйте розмір вибірки заздалегідь: малі покращення потребують від сотень до тисяч парних cases.
- Коригуйте на множинні порівняння, а releases пропускайте через margin non-inferiority плюс hard gates для збоїв із нульовою толерантністю.
