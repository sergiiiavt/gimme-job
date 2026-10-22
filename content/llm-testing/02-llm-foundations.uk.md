# Як LLM генерують текст

Для роботи з LLM потрібно розуміти токени, вибір наступного токена, вплив параметрів, варіативність запусків і навчання, яке формує відмови, підтакування чи вигадування фактів. Ці механізми пояснюють можливості й обмеження моделей без заглиблення в лінійну алгебру трансформерів.

**Передумови:** [Огляд генеративного AI та LLM](/learn/llm?topic=generative-ai-overview).

## Токени й токенізація

Модель отримує числові ідентифікатори. **Токенізатор (tokenizer)** ділить текст на **токени** з фіксованого **словника** й зіставляє їх із цілими числами. Словник може містити слова, частини слів, пунктуацію, цифри й байти.

Словник лише цілих слів не охопить нових слів, імен, помилок чи коду. Поділ лише на символи створює довгі й дорогі послідовності. **Токенізація на частини слів (subword tokenization)** є компромісом: часті послідовності мають окремі токени, рідкісні складаються з менших частин.

### Byte-pair encoding крок за кроком

Поширений метод — **кодування пар байтів (byte-pair encoding, BPE)**, застосований Sennrich із колегами до нейронного перекладу. Навчання відбувається так:

```diagram
1. Start with every word split into single characters, plus an end-of-word marker.
2. Count every pair of adjacent symbols across the corpus, weighted by word frequency.
3. Merge the most frequent pair into one new symbol and record the merge.
4. Repeat steps 2–3 until the vocabulary reaches the target size.
To tokenize new text, apply the recorded merges in the same order.
```

Скрипт навчає невеликий BPE-токенізатор на англійській лексиці підтримки й розбиває чотири слова. Це реалізація алгоритму на малому корпусі.

```python
from collections import Counter

END = "</w>"


def merge_symbols(symbols: list[str], pair: tuple[str, str]) -> list[str]:
    """Replace every adjacent occurrence of `pair` with one merged symbol."""
    merged = []
    i = 0
    while i < len(symbols):
        if i < len(symbols) - 1 and symbols[i] == pair[0] and symbols[i + 1] == pair[1]:
            merged.append(symbols[i] + symbols[i + 1])
            i += 2
        else:
            merged.append(symbols[i])
            i += 1
    return merged


def train_bpe(word_counts: dict[str, int], num_merges: int) -> list[tuple[str, str]]:
    """Learn merge rules: repeatedly merge the most frequent adjacent pair of symbols."""
    words = {word: list(word) + [END] for word in word_counts}
    merges = []
    for _ in range(num_merges):
        pairs = Counter()
        for word, symbols in words.items():
            for i in range(len(symbols) - 1):
                pairs[(symbols[i], symbols[i + 1])] += word_counts[word]
        if not pairs:
            break
        best = pairs.most_common(1)[0][0]
        merges.append(best)
        words = {word: merge_symbols(symbols, best) for word, symbols in words.items()}
    return merges


def tokenize(word: str, merges: list[tuple[str, str]]) -> list[str]:
    """Apply the learned merges, in training order, to a new word."""
    symbols = list(word) + [END]
    for pair in merges:
        symbols = merge_symbols(symbols, pair)
    return symbols


training_counts = {
    "return": 20, "returns": 12, "returned": 8, "refund": 15, "refunds": 9,
    "order": 25, "orders": 10, "ordered": 6, "delivery": 14, "delivered": 9,
    "shoes": 18, "size": 11,
}
merges = train_bpe(training_counts, num_merges=30)
print("first 8 merges:", merges[:8])
for word in ["returned", "refunded", "reorder", "повернення"]:
    tokens = tokenize(word, merges)
    print(f"{word:>12} -> {len(tokens):2d} tokens: {tokens}")
```

Результат:

```text
first 8 merges: [('r', 'e'), ('d', 'e'), ('s', '</w>'), ('o', 'r'), ('or', 'de'), ('re', 't'), ('ret', 'u'), ('retu', 'r')]
    returned ->  3 tokens: ['return', 'e', 'd</w>']
    refunded ->  3 tokens: ['refun', 'de', 'd</w>']
     reorder ->  2 tokens: ['re', 'order</w>']
  повернення -> 11 tokens: ['п', 'о', 'в', 'е', 'р', 'н', 'е', 'н', 'н', 'я', '</w>']
```

Що показує приклад:

- **Нові слова можна скласти з відомих частин.** «reorder» не було в корпусі, але його частини вже відомі.
- **Межі токенів не збігаються зі змістовими частинами.** «refunded» розбито на `refun` + `de` + `d`. Модель не отримує внутрішні літери як окремі елементи, тому точний підрахунок чи перестановка символів можуть бути ненадійними.
- **Незвичний текст може потребувати більше токенів.** Українське слово в цьому прикладі розпадається на символи через англійський корпус. У реальних багатомовних моделях менш представлені мови теж можуть потребувати більше токенів.

### Чому токени важливі для тестування

| Наслідок | Чому так | Що тестувати |
|---|---|---|
| Залежність вартості від мови | Кількість токенів на слово відрізняється | Вимірюйте її на реальних запитах кожною мовою |
| Обмеження в токенах | Контекст, відповідь і частина квот мають токенний бюджет | Перевіряйте довгі документи, розмови й граничні значення |
| Обрив відповіді | Генерація може досягти ліміту посеред JSON | Перевіряйте обробку незавершеного результату |
| Труднощі із символами | Модель працює з токенами | Точні маніпуляції символами доручайте коду |
| Приховані символи | Візуально подібний текст може мати іншу токенізацію | Перевіряйте Unicode, нормалізацію й приховані інструкції |

Оцінка «приблизно чотири англійські символи на токен» є грубою евристикою. Для точного підрахунку використовуйте відповідний токенізатор або API. Для коду, JSON і неанглійського тексту оцінка за символами особливо ненадійна.

```python
# Run on your own machine: pip install tiktoken
import tiktoken

encoding = tiktoken.get_encoding("o200k_base")   # tokenizer used by several OpenAI models
for text in ["Can I return worn shoes?", "Чи можу я повернути ношене взуття?", '{"order_id": "A-1042"}']:
    ids = encoding.encode(text)
    print(len(text), "characters ->", len(ids), "tokens:", [encoding.decode([i]) for i in ids])
```

### Шаблони чату й спеціальні токени

API чату приймає повідомлення з ролями `system`, `user`, `assistant`, `tool`. **Шаблон чату (chat template)** перетворює їх на послідовність із маркерами меж і ролей. Повідомлення, інструменти й документи займають контекстний бюджет. Користувацький текст може імітувати ролі, наприклад рядком «system:»; це один із ризиків ін’єкції промптів ([Безпека, імітація атак і захисні механізми](/learn/llm?topic=security-red-teaming)).

## Цикл генерації

Кожна ітерація генерації додає один токен:

```diagram
 context tokens (system prompt, conversation, documents, tool results, output so far)
        │
        ▼
 model forward pass ──► logits: one score per vocabulary entry (about 100k–200k numbers)
        │
        ▼
 softmax(logits / temperature) ──► probability distribution over the vocabulary
        │
        ▼
 filtering (top-k, top-p) ──► sampling picks one token ID
        │
        ▼
 append token to the context ──► stop? (end-of-sequence token, stop sequence, max tokens)
        │ no                                    │ yes
        └──────────── repeat ◄──────────────────┘──► return text
```

**Логіти (logits)** — ненормалізовані оцінки кандидатів. **Softmax** перетворює їх на ймовірності із сумою 1, а **алгоритм вибірки (sampler)** вибирає токен. Сам цикл не перевіряє фактів: правдиве й вигадане твердження генеруються тим самим механізмом.

### Обробка контексту й генерування відповіді

Процес має дві фази:

- **Обробка контексту (prefill).** Вхідні токени обробляються паралельно, формується **KV-кеш** проміжних значень. Довжина запиту впливає на час до першого токена.
- **Послідовне генерування (decode).** Вихідні токени додаються по одному з використанням кешу. Тривалість зростає з довжиною відповіді.

Довгий промпт переважно затримує початок відповіді, а довга відповідь — її завершення ([Якість у промисловому середовищі](/learn/llm?topic=production-quality)).

## Softmax, температура, top-k і top-p

Формули короткі:

```text
softmax:      p_i = exp(z_i / T) / Σ_j exp(z_j / T)        z = logits, T = temperature

temperature:  T < 1 sharpens the distribution (more likely tokens get even more likely)
              T = 1 leaves the model's distribution unchanged
              T > 1 flattens it (unlikely tokens get more chances)
              T → 0 approaches greedy decoding: always pick the highest logit

top-k:        keep only the k most probable tokens, renormalize, sample
top-p:        keep the smallest set of most probable tokens whose probabilities sum to at least p
              (also called nucleus sampling), renormalize, sample
```

### Розібраний приклад

Після *«Unworn shoes can be returned within»* модель задає логіти п’яти кандидатам. За правилами Stride правильні «30» і «thirty». Скрипт обчислює розподіли й вибирає 1 000 відповідей за трьох температур.

```python
import math
import random
from collections import Counter

# Next-token candidates after "Unworn shoes can be returned within" and the logits a model might assign
tokens = ["30", "thirty", "14", "60", "unlimited"]
logits = [6.0, 4.6, 3.4, 2.6, 1.2]
correct = {"30", "thirty"}


def softmax(values: list[float], temperature: float = 1.0) -> list[float]:
    scaled = [value / temperature for value in values]
    largest = max(scaled)                      # subtract the max for numerical stability
    exps = [math.exp(value - largest) for value in scaled]
    total = sum(exps)
    return [value / total for value in exps]


def top_k(probs: list[float], k: int) -> list[float]:
    keep = sorted(range(len(probs)), key=lambda i: probs[i], reverse=True)[:k]
    kept = [p if i in keep else 0.0 for i, p in enumerate(probs)]
    return [p / sum(kept) for p in kept]


def top_p(probs: list[float], p_threshold: float) -> list[float]:
    order = sorted(range(len(probs)), key=lambda i: probs[i], reverse=True)
    keep, cumulative = [], 0.0
    for i in order:
        keep.append(i)
        cumulative += probs[i]
        if cumulative >= p_threshold:          # smallest set whose mass reaches p
            break
    kept = [p if i in keep else 0.0 for i, p in enumerate(probs)]
    return [p / sum(kept) for p in kept]


def show(label: str, probs: list[float]) -> None:
    cells = "  ".join(f"{token}={prob:.3f}" for token, prob in zip(tokens, probs))
    print(f"{label:<16} {cells}")


for temperature in [0.2, 0.7, 1.0, 1.5]:
    show(f"T={temperature}", softmax(logits, temperature))
show("T=1, top_k=2", top_k(softmax(logits), 2))
show("T=1, top_p=0.95", top_p(softmax(logits), 0.95))

rng = random.Random(0)
for temperature in [0.7, 1.0, 1.5]:
    probs = softmax(logits, temperature)
    draws = Counter(rng.choices(tokens, weights=probs, k=1000))
    wrong = sum(count for token, count in draws.items() if token not in correct)
    print(f"T={temperature}: {wrong} of 1000 sampled answers state a wrong return window")
```

Результат:

```text
T=0.2            30=0.999  thirty=0.001  14=0.000  60=0.000  unlimited=0.000
T=0.7            30=0.856  thirty=0.116  14=0.021  60=0.007  unlimited=0.001
T=1.0            30=0.734  thirty=0.181  14=0.055  60=0.024  unlimited=0.006
T=1.5            30=0.583  thirty=0.229  14=0.103  60=0.060  unlimited=0.024
T=1, top_k=2     30=0.802  thirty=0.198  14=0.000  60=0.000  unlimited=0.000
T=1, top_p=0.95  30=0.757  thirty=0.187  14=0.056  60=0.000  unlimited=0.000
T=0.7: 27 of 1000 sampled answers state a wrong return window
T=1.0: 95 of 1000 sampled answers state a wrong return window
T=1.5: 193 of 1000 sampled answers state a wrong return window
```

Правильна відповідь має найвищу ймовірність, але за температури 1.0 майже кожна десята вибірка хибна. У довгій відповіді помилка можлива на кожному кроці. Нижча температура, top-k і top-p зменшують вибір малоймовірних кандидатів, але не роблять хибний високоймовірний токен правильним.

### Вибір параметрів генерації

| Тип задачі | Типове налаштування | Причина | Нотатка для тестування |
|---|---|---|---|
| Видобування даних, класифікація, структуровані відповіді | Температура 0 або близька | Потрібен стабільний результат | Повторюйте випадки: детермінованість не гарантована |
| Відповіді за документами | Низька температура | Перевага найімовірнішої відповіді | Перевіряйте підтвердження джерелами |
| Творчі завдання | Температура приблизно 0.7–1.0 | Потрібна різноманітність | Оцінюйте багато зразків |
| Код із кількома спробами | Помірна температура | Різні кандидати підвищують шанс успіху | Вимірюйте pass@k ([Статистика для оцінювання](/learn/llm?topic=eval-statistics)) |

Тестуйте з налаштуваннями робочої системи й змінюйте один параметр за раз. Деякі моделі, особливо моделі міркування, фіксують або ігнорують параметри вибірки; перевіряйте документацію конкретного API.

## Чому відповіді відрізняються навіть за нульової температури

За температури 0 обирається найбільший логіт, але результат не обов’язково незмінний. **Додавання чисел із рухомою комою неасоціативне:** `(a + b) + c` може відрізнятися від `a + (b + c)`. Порядок обчислень залежить від GPU, пакета запитів, обладнання й програмної реалізації. Для майже рівних кандидатів мала похибка змінює переможця, після чого відповіді розходяться.

```python
import random

# Floating-point addition is not associative: the order of a sum changes the result.
print((0.1 + 0.2) + 0.3 == 0.1 + (0.2 + 0.3))
print(f"{(0.1 + 0.2) + 0.3:.17f} vs {0.1 + (0.2 + 0.3):.17f}")


def chunked_sum(values: list[float], chunk: int) -> float:
    """Sum in parallel-style blocks, as a GPU reduction kernel might, then add the partial sums."""
    partials = [sum(values[i:i + chunk]) for i in range(0, len(values), chunk)]
    return sum(partials)


# A logit is a sum of many partial products. The order of additions depends on the kernel,
# which can depend on batch size or hardware. Simulate three reduction strategies.
rng = random.Random(1)
contributions = [rng.uniform(-1, 1) for _ in range(4096)]
logits_a = {
    "sequential": sum(contributions),
    "blocks of 64": chunked_sum(contributions, 64),
    "blocks of 256": chunked_sum(contributions, 256),
}
for strategy, value in logits_a.items():
    print(f"logit of token A, {strategy:<13}: {value!r}")

# Suppose a competing token B is in a near-tie: its logit equals the lowest variant above.
logit_b = min(logits_a.values())
print(f"difference between variants: {max(logits_a.values()) - logit_b:.1e}")
for strategy, value in logits_a.items():
    winner = "A" if value > logit_b else "B"
    print(f"{strategy:<13}: greedy decoding picks token {winner}")
```

Результат:

```text
False
0.60000000000000009 vs 0.59999999999999998
logit of token A, sequential   : 18.783645481949275
logit of token A, blocks of 64 : 18.78364548194927
logit of token A, blocks of 256: 18.783645481949275
difference between variants: 3.6e-15
sequential   : greedy decoding picks token A
blocks of 64 : greedy decoding picks token B
blocks of 256: greedy decoding picks token A
```

Приклад показує вплив дуже малої числової різниці. Незалежні від розміру пакета обчислення можуть зменшувати таку варіативність, але потребують окремої перевірки продуктивності.

Інші причини — маршрутизація на різне обладнання, оновлення системи виконання чи моделі, вибір експертних підмереж. Параметр `seed` і відбиток конфігурації допомагають діагностиці, але не є загальною гарантією відтворюваності.

**Для тестування:** повторюйте важливі випадки, оцінюйте властивості й частки результатів, записуйте версію та параметри.

### Якщо нульова температура дає різні відповіді

Коли відповіді тесту видобування відрізняються одним словом:

- перевіряйте витягнуті значення після нормалізації, яку дозволяє специфікація (регістр, пробіли, прийнятні синоніми), а не весь рядок;
- повторюйте випадок і оцінюйте частку успіхів;
- фіксуйте модель і записуйте відбиток виконання, якщо він доступний;
- не послаблюйте перевірку лише заради успіху: хибний результат має відхилятися.

## Як навчання формує поведінку моделі

Діалогові моделі навчають поетапно. Кожен етап формує поведінку, яку потрібно перевіряти.

| Етап | Що відбувається | Поведінка, яку видно | Ідея тесту |
|---|---|---|---|
| Попереднє навчання | Передбачення токенів на великому корпусі | Знання, зв’язна мова, часові межі, запам’ятовані дані й упередження | Нові факти, пізні події, захищений і персональний текст |
| Навчання інструкцій із учителем | Приклади інструкцій і відповідей | Дотримання завдання й формату | Формат, кілька обмежень, пріоритет правил |
| Навчання за перевагами: RLHF, DPO | Оптимізація під людські оцінки чи модель винагороди | Корисний тон, але також підтакування й надмірна впевненість | Заперечення користувача, довжина й упевненість |
| Навчання безпечності | Приклади відмов | Відмови, зокрема надмірні | Шкідливі й схожі на них легітимні запити |
| Донавчання на ваших даних | Наприклад, LoRA-адаптери | Краща предметна поведінка, можлива втрата інших навичок | Загальні можливості й безпечність після зміни |

Два з них варто розглянути детальніше:

- **Підтакування (sycophancy).** Модель може змінити правильну відповідь після заперечення користувача. Перевіряйте двокрокові діалоги: вона має зберігати правильну позицію й виправлятися, якщо помилилася.
- **Надмірні відмови (over-refusal).** Слово «kill» у запиті про завершення процесу Python не робить його шкідливим. Набори на кшталт XSTest містять подібні приклади. Вимірюйте відмови і на шкідливих, і на легітимних запитах.

## Галюцинації: що це й чому виникають

**Галюцинація (hallucination, confabulation)** — правдоподібний текст без підтвердження фактами чи джерелами. Для стислого викладу корисно розрізняти:

- **Внутрішню галюцинацію:** суперечність джерелу, наприклад 60 днів замість 30.
- **Зовнішню галюцинацію:** додану непідтверджену інформацію, наприклад обіцянку оплатити доставку. Непідтвердженість сама по собі не доводить фактичної хибності.

Мета навчання винагороджує передбачення тексту, а не перевірку кожного факту. Оцінювання, яке дає більше балів за здогадку, ніж за обґрунтоване «не знаю», додатково стимулює вгадування. Аналіз 2025 року пропонує винагороджувати належне утримання від відповіді.

Для тест-дизайну це означає:

- Додавайте питання без доступної відповіді й оцінюйте коректне утримання.
- Перевіряйте кожне твердження за джерелами ([Оцінювання систем RAG](/learn/llm?topic=rag-testing)).
- Програмно перевіряйте цитати, URL, назви API й числа, де це можливо.
- Не покладайтеся на твердження моделі про власну впевненість; слова на кшталт «точно» не несуть надійної інформації про правильність.

## Робота з контекстним вікном

**Контекстне вікно** обмежує кількість токенів виклику: інструкції, розмову, документи, інструменти та відповідь. Правила залежать від API. Великий заявлений ліміт не гарантує надійного використання всього контексту.

Для тестування важливі два добре задокументовані ефекти:

- **Чутливість до позиції:** інформація всередині довгого контексту може використовуватися гірше, ніж на початку чи наприкінці («lost in the middle»).
- **Ефективна й заявлена довжина:** тести на кшталт RULER вимірюють падіння якості до досягнення номінального ліміту.

Тест **«голка в копиці сіна»** розміщує потрібний факт на відомій позиції серед стороннього тексту. Варіюйте довжину й позицію, повторюйте комбінації та звітуйте окремо. Нижче виклик моделі явно симульований; для справжньої перевірки замініть `simulated_model` реальним викликом.

```python
import random
from collections import defaultdict

FILLER = [
    "Orders are packed in recycled boxes.",
    "Customer service is available on weekdays.",
    "Gift cards never expire.",
    "Standard delivery takes three to five working days.",
    "Shoe sizes follow the EU standard.",
    "Prices include VAT.",
]


def build_case(depth: float, total_sentences: int, rng: random.Random) -> dict:
    """Create a long context with one 'needle' fact inserted at a relative depth (0.0 = start, 1.0 = end)."""
    code = f"STR-{rng.randint(1000, 9999)}"
    needle = f"The discount code for loyal customers is {code}."
    sentences = [rng.choice(FILLER) for _ in range(total_sentences)]
    sentences.insert(round(depth * total_sentences), needle)
    return {
        "context": " ".join(sentences),
        "question": "What is the discount code for loyal customers?",
        "expected": code,
        "depth": depth,
        "length": total_sentences,
    }


def score(answer: str, expected: str) -> bool:
    return expected in answer


rng = random.Random(7)
cases = [build_case(depth, length, rng)
         for length in [200, 2000]
         for depth in [0.0, 0.25, 0.5, 0.75, 1.0]
         for _ in range(3)]                       # 3 repetitions per cell
print(f"{len(cases)} cases; example context starts: {cases[0]['context'][:90]}...")


def simulated_model(case: dict) -> str:
    """Stand-in for a real model call, only to demonstrate the report format.
    It 'loses' facts in the middle of long contexts, the pattern long-context studies report."""
    middle = 0.2 < case["depth"] < 0.8
    if case["length"] > 1000 and middle and rng.random() < 0.6:
        return "I could not find a discount code."
    return f"The code is {case['expected']}."


results = defaultdict(list)
for case in cases:
    results[(case["length"], case["depth"])].append(score(simulated_model(case), case["expected"]))

print("length  depth  accuracy")
for key in sorted(results):
    outcomes = results[key]
    print(f"{key[0]:>6}  {key[1]:>5.2f}  {sum(outcomes)}/{len(outcomes)}")
```

Результат симульованої моделі:

```text
30 cases; example context starts: The discount code for loyal customers is STR-6305. Customer service is available on weekda...
length  depth  accuracy
   200   0.00  3/3
   200   0.25  3/3
   200   0.50  3/3
   200   0.75  3/3
   200   1.00  3/3
  2000   0.00  3/3
  2000   0.25  2/3
  2000   0.50  0/3
  2000   0.75  1/3
  2000   1.00  3/3
```

Видобування одного факту не доводить здатності зіставляти кілька віддалених фактів. Перевіряйте також скорочення історії, збереження системних інструкцій і повідомлення користувачу про надто довгий документ.

### План перевірки довгого контексту

Для відповідей на питання про договори обсягом до 150 сторінок:

| Вимір | Значення |
|---|---|
| Довжина документа | 5, 50 і 150 сторінок плюс один документ понад ліміт |
| Позиція релевантного пункту | Початок, 25%, 50%, 75%, кінець |
| Тип питання | Пошук одного факту; порівняння двох віддалених пунктів; агрегація на кшталт «перелічи всі умови розірвання» |
| Повтори | 3–5 на комбінацію з урахуванням варіативності |
| Оцінювання | Еталонні факти; перевірений оцінювач або людина для складених відповідей |
| Звіт | Точність за довжиною й позицією, затримка, вартість і поведінка понад ліміт |

## Моделі міркування

Моделі міркування можуть генерувати проміжні **токени міркування (reasoning tokens)**, приховані або показані стисло. Доступні налаштування зусиль чи бюджету залежать від API. Враховуйте їх у перевірках:

- **Час і витрати залежать від бюджету.** Перевіряйте тарифікацію й вимірюйте реальні налаштування.
- **Оцінюйте режим, який випускаєте:** високий і низький рівні міркування можуть давати різну якість.
- **Видимий текст міркування не доводить причин рішення.** Оцінюйте кінцевий результат; проміжний текст є лише підказкою для діагностики.
- **Частина параметрів вибірки може бути зафіксована.** Загальні поради щодо температури застосовні не до всіх моделей.

## Приклад проєкту

Метод реалізований і покритий тестами в [examples/llm-testing/02-generation-mechanics](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/02-generation-mechanics): BPE, softmax, температура, top-k, top-p та генератор довгого контексту. Тести працюють без мережі, моделі та ключів API:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/02-generation-mechanics
```

## Типові помилки

- **Вважати нульову температуру гарантією точного повторення.**
- **Тестувати й випускати з різними налаштуваннями.**
- **Оцінювати токени за символами** замість відповідного токенізатора.
- **Ігнорувати досягнення ліміту відповіді.**
- **Вважати будь-яку відмову успіхом**, навіть для легітимного запиту.
- **Довіряти заявленій упевненості** чи видимому міркуванню як доказу.
- **Робити висновок про довгий контекст за одним прикладом.**

## Підсумок

- Токенізація впливає на мову, вартість, довжину та точні операції із символами.
- Генерація обчислює логіти, ймовірності й вибирає токени; сам цикл не перевіряє фактів.
- Температура змінює розподіл, top-k і top-p відсікають кандидатів. Перевіряйте робочі налаштування.
- Навіть за температури 0 можливі відмінності обчислень. Повторюйте випадки й вимірюйте частоти.
- Етапи навчання пояснюють часові межі знань, підтакування й відмови; потрібні окремі перевірки.
- Довгий контекст оцінюйте за довжиною й позицією, а міркування — за робочим рівнем зусиль.
