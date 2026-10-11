# Як LLM генерують текст

Щоб добре тестувати систему, потрібна робоча модель того, як вона створює output. Лінійна алгебра transformers не потрібна, але треба знати, що таке token, як вибирається наступний token, які parameters змінюють цей вибір, чому повторні runs відрізняються і як процес training формує поведінку на кшталт відмов, згоди з користувачем чи вигадування фактів. Кожен із цих механізмів пояснює родину дефектів, які ви зустрінете на практиці.

**Після цього chapter ви вмієте:**

- пояснити, як текст стає tokens і чому кількість tokens різна для різних мов;
- описати цикл генерації від context до logits і до вибраного token;
- обчислювати softmax з temperature і застосовувати top-k та top-p вручну і в code;
- пояснити, чому outputs можуть відрізнятися навіть при temperature 0;
- пов'язати pretraining, instruction tuning і preference tuning з поведінкою, яку можна тестувати;
- спроєктувати long-context тест і врахувати reasoning tokens у тестах latency та cost.

**Prerequisites:** [Чим особливе тестування LLM](/learn/llm?topic=llm-testing-problem-space).

## Tokens і tokenization

Модель ніколи не бачить символів чи слів. Спершу **tokenizer** ділить текст на **tokens** — одиниці з фіксованого **vocabulary** — і зіставляє кожен token з integer ID. Модель читає і пише послідовності цих ID. Сучасні vocabularies містять приблизно від 100 000 до 200 000 елементів: цілі поширені слова, фрагменти слів, пунктуацію, цифри та сирі bytes.

Чому не слова? Vocabulary зі слів не може представити нові слова, typos, імена чи code. Чому не символи? Послідовності стали б у кілька разів довшими, а моделі — повільнішими і дорожчими. **Subword tokenization** — компроміс: часті рядки отримують власний token, рідкісні збираються з менших частин.

### Byte-pair encoding крок за кроком

Найпоширеніший subword метод — **byte-pair encoding (BPE)**, запропонований для нейронного перекладу Sennrich та колегами; у byte-level варіанті його використовує багато сучасних моделей. Training працює так:

```diagram
1. Start with every word split into single characters, plus an end-of-word marker.
2. Count every pair of adjacent symbols across the corpus, weighted by word frequency.
3. Merge the most frequent pair into one new symbol and record the merge.
4. Repeat steps 2–3 until the vocabulary reaches the target size.
To tokenize new text, apply the recorded merges in the same order.
```

Скрипт нижче тренує крихітний BPE tokenizer на англійській лексиці підтримки й токенізує чотири слова. Це повна реалізація алгоритму, лише корпус малий.

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

Output:

```text
first 8 merges: [('r', 'e'), ('d', 'e'), ('s', '</w>'), ('o', 'r'), ('or', 'de'), ('re', 't'), ('ret', 'u'), ('retu', 'r')]
    returned ->  3 tokens: ['return', 'e', 'd</w>']
    refunded ->  3 tokens: ['refun', 'de', 'd</w>']
     reorder ->  2 tokens: ['re', 'order</w>']
  повернення -> 11 tokens: ['п', 'о', 'в', 'е', 'р', 'н', 'е', 'н', 'н', 'я', '</w>']
```

Три спостереження переносяться прямо на реальні tokenizers:

- **Невідомі слова все одно представлені.** «reorder» не було в training, але воно збирається з відомих частин.
- **Межі tokens не збігаються зі змістом.** «refunded» ділиться на `refun` + `de` + `d`. Модель, яка мусить міркувати про літери всередині token, не бачить їх напряму, тому підрахунок літер, reverse рядків і точні позиції символів — ненадійні задачі.
- **Текст, на якому tokenizer не тренувався, коштує більше tokens.** Українське слово розпадається на окремі символи, бо корпус був англійським. Реальні tokenizers тренують на багатомовних даних, але мови й scripts, рідші в цих даних, усе одно потребують помітно більше tokens на слово, ніж англійська.

### Чому tokens важливі для тестувальника

| Наслідок | Чому так | Що тестувати |
|---|---|---|
| Cost залежить від мови | Ціни — за token, а деяким мовам потрібно більше tokens на слово | Вимірюйте tokens на запит для кожної підтримуваної мови на реальних inputs |
| Ліміти — в tokens | Context window, максимальний output і rate limits рахуються в tokens | Inputs біля ліміту; дуже довгі документи; довгі розмови |
| Обрізаний output | Генерація зупиняється на максимумі output tokens, навіть посеред слова чи JSON | Як application обробляє обрізану відповідь |
| Слабкість на рівні символів | Модель бачить tokens, а не літери | Не будуйте features, що залежать від точних маніпуляцій символами, без code |
| Приховані символи змінюють tokens | Zero-width spaces, homoglyphs і варіанти Unicode токенізуються інакше, хоча виглядають однаково | Нормалізація input; атаки з інструкціями в невидимих символах |

Емпіричне правило для англійського тексту із сучасними tokenizers — приблизно чотири символи на token. Для реальних чисел використовуйте tokenizer library або token-counting endpoint provider, бо емпіричні правила неправильні для code, JSON і неанглійського тексту.

```python
# Run on your own machine: pip install tiktoken
import tiktoken

encoding = tiktoken.get_encoding("o200k_base")   # tokenizer used by several OpenAI models
for text in ["Can I return worn shoes?", "Чи можу я повернути ношене взуття?", '{"order_id": "A-1042"}']:
    ids = encoding.encode(text)
    print(len(text), "characters ->", len(ids), "tokens:", [encoding.decode([i]) for i in ids])
```

### Chat templates і special tokens

Chat APIs приймають список повідомлень з ролями (system, user, assistant, tool). Перед тим як модель їх побачить, provider перетворює повідомлення на одну послідовність tokens за допомогою **chat template**: special tokens позначають, де кожне повідомлення починається й закінчується і яка в нього роль. Звідси два наслідки для тестування. По-перше, кожне повідомлення, визначення tool і фрагмент retrieved тексту споживає tokens контексту. По-друге, user text, що імітує маркери ролей (наприклад фейковий рядок «system:»), — класична техніка prompt injection; її розбирає [Prompt injection і jailbreaks](/learn/llm?topic=prompt-injection).

## Цикл генерації

Генерація — це цикл, що на кожній ітерації створює один token:

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

**Logits** — ненормалізовані scores. **Softmax** перетворює їх на ймовірності із сумою 1. **Sampler** вибирає наступний token за цими ймовірностями. Ніщо в цьому циклі не перевіряє факти: гладке хибне твердження і гладке правдиве створюються одним і тим самим механізмом. Це головна причина, чому hallucination — властивість методу, а не рідкісний bug.

### Prefill і decode

Обробка має дві фази з різними характеристиками performance:

- **Prefill.** Модель паралельно обробляє всі input tokens і будує кеш проміжних результатів (**KV cache**). Час prefill зростає з довжиною input і визначає більшу частину **time to first token**.
- **Decode.** Модель генерує output tokens по одному, кожен раз використовуючи кеш. Час decode зростає з кількістю output tokens.

Отже, довгий prompt здебільшого затримує перший token, а довга відповідь — останній. На цій різниці будується [Тестування performance і cost](/learn/llm?topic=performance-cost).

## Softmax, temperature, top-k і top-p

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

Після тексту *«Unworn shoes can be returned within»* модель присвоює п'ятьом кандидатам такі logits. За policy магазину Stride правильні лише «30» і «thirty». Скрипт обчислює distributions, а потім семплює 1 000 відповідей при трьох temperatures.

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

Output:

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

Прочитайте результат як тестувальник. Модель «знає» правильну відповідь у тому сенсі, що вона має найвищу ймовірність, але при temperature 1.0 майже кожна десята відповідь неправильна. Реальна відповідь містить десятки tokens, і кожен семплюється; помилка може з'явитися в будь-якому. Нижча temperature і відсікання (top-k, top-p) прибирають довгий хвіст малоймовірних tokens, але не можуть зробити неправильний високоймовірний token правильним.

### Вибір і тестування sampling settings

| Тип задачі | Типове налаштування | Причина | Нотатка для тестування |
|---|---|---|---|
| Extraction, classification, structured output | Temperature 0 або близько | Одна правильна відповідь; різноманітність — дефект | Усе одно запускайте cases кілька разів: temperature 0 не детермінована |
| Question answering з документів | Низька temperature | Триматися найімовірнішої grounded відповіді | Вимірюйте faithfulness, а не лише correctness |
| Creative writing, brainstorming | Temperature приблизно 0.7–1.0 | Різноманітність — мета | Вимірюйте distributions (якість на багатьох samples), а не окремі outputs |
| Code generation з кількома спробами | Помірна temperature, кілька samples | Різноманітність підвищує шанс, що одна спроба пройде тести | Показуйте pass@k, див. [Статистика для evaluation](/learn/llm?topic=eval-statistics) |

Два правила діють скрізь. **Тестуйте на production settings**, бо prompt, оцінений при temperature 0, може поводитися інакше при 0.7. І **змінюйте лише один sampling parameter за раз**, порівнюючи runs. Також деякі моделі, особливо reasoning models, фіксують або ігнорують sampling parameters; перевірте документацію provider, перш ніж вважати, що parameter має ефект.

## Чому outputs відрізняються навіть при temperature 0

При temperature 0 sampler завжди бере найвищий logit, тож output мав би бути детермінованим. На практиці часто ні. Головна причина: **додавання floating-point чисел не асоціативне**: `(a + b) + c` може відрізнятися від `a + (b + c)` в останніх бітах. Logit — це сума тисяч добутків, і порядок цих додавань залежить від того, як GPU kernel ділить роботу, а це може залежати від batch size (скільки інших запитів обробляється разом), обладнання і версій software. Якщо два кандидати майже рівні, різниця в останньому біті вирішує, хто переможе, і з цього token два outputs розходяться.

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

Output:

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

Різниця в кілька квадрильйонних змінила вибраний token. Реальні near-ties трапляються часто: щойно два формулювання майже однаково ймовірні, модель фактично підкидає монету з похибок округлення. Дослідження inference engines показали, що залежність від batch size — домінантне джерело цієї поведінки на практиці і що batch-invariant kernels можуть її прибрати ціною частини performance.

До цього додаються інші джерела: provider може направити запит на інше обладнання, оновити serving software чи snapshot моделі, а деякі архітектури маршрутизують tokens через різні expert sub-networks залежно від batch. Деякі APIs приймають parameter `seed` для best-effort reproducibility і повертають fingerprint serving конфігурації; сприймайте це як зручність для debugging, а не як гарантію.

**Наслідок для тестування:** проєктуйте кожну evaluation так, щоб вона витримувала варіацію. Запускайте важливі cases кілька разів, перевіряйте властивості та rates замість точних рядків і записуйте версію моделі та parameters з кожним результатом.

## Як training формує поведінку, яку можна тестувати

Сучасні chat models створюються поетапно. Кожен етап залишає характерну поведінку, яку можна і треба тестувати.

| Етап | Що відбувається | Поведінка, яку видно | Ідея тесту |
|---|---|---|---|
| Pretraining | Next-token prediction на дуже великому корпусі тексту й code | Широкі знання, гладка мова, knowledge cutoff, завчений текст, bias даних | Питання про події після cutoff; факти, що нещодавно змінилися; запити дослівного захищеного чи персонального тексту |
| Supervised instruction tuning | Training на прикладах інструкцій і хороших відповідей | Виконує інструкції та chat format | Дотримання формату, інструкції з кількома обмеженнями, пріоритет інструкцій |
| Preference tuning (RLHF, DPO та варіанти) | Модель оптимізують у бік відповідей, які віддають перевагу люди чи reward models | Корисний тон, але й sycophancy (згода з користувачем), багатослівність, впевнені формулювання | Push-back тести («Ви впевнені? Я думаю, 60 днів»); аналіз довжини |
| Safety training | Training на відмову від шкідливих запитів | Відмови, іноді на нешкідливі запити (over-refusal) | Borderline, але легітимні prompts; шкідливі prompts; обидва вимірюються |
| Ваш власний fine-tuning | Додаткове training на ваших даних (наприклад з LoRA adapters) | Краща доменна поведінка, можлива втрата загальних навичок | Перезапуск загальних capability і safety suites після fine-tuning |

Два з них варто розглянути детальніше:

- **Sycophancy.** Моделі, натреновані на людських вподобаннях, засвоюють, що згода часто винагороджується. Sycophantic модель змінює правильну відповідь, коли користувач заперечує. Тестуйте двоходовими cases: питання, потім заперечення правильної відповіді, і оцінка, чи модель тримає позицію, коли мала рацію, і виправляється, коли помилялася.
- **Over-refusal.** Safety training може узагальнитися надто широко, і тоді «How do I kill a Python process?» отримує відмову. Test sets на кшталт XSTest містять безпечні prompts, зовні схожі на небезпечні. Вимірюйте refusal rate і на безпечних, і на небезпечних prompts; guardrail, що блокує все, ідеально проходить небезпечний набір і провалює продукт.

## Hallucination: що це і чому виникає

**Hallucination** (також confabulation) — гладкий і правдоподібний output, не підтверджений фактами чи наданими джерелами. Дослідження summarization розрізняють два види, корисні для test design:

- **Intrinsic hallucination** суперечить джерелу: policy каже 30 днів, відповідь — 60.
- **Extrinsic hallucination** додає інформацію, якої в джерелі немає і яку з нього не можна перевірити: відповідь додає «і ми оплачуємо зворотну доставку», хоча policy цього не згадує.

Чому так стається: training objective винагороджує правдоподібні продовження, а не перевірену істину, а поширена практика evaluation винагороджує здогадки більше, ніж «я не знаю». Модель, що завжди вгадує, на багатьох benchmarks набирає більше, ніж модель, що утримується, коли не впевнена, тож моделі вчаться вгадувати. Аналіз 2025 року цієї проблеми стимулів стверджує, що для зменшення hallucination дизайн evaluation має винагороджувати калібровану abstention.

Наслідки для test design:

- Включайте **питання без відповіді**, правильна реакція на які — утриматися, і явно оцінюйте abstention.
- Для grounded features перевіряйте **кожен claim проти джерел**, а не лише відповідь загалом ([Evaluation RAG систем](/learn/llm?topic=rag-testing)).
- Механічно перевіряйте **citations, посилання, URLs, назви APIs і числа**, де можливо: це найчастіші hallucinations і їх найлегше перевірити.
- Не покладайтеся на твердження моделі про власну впевненість; слова на кшталт «точно» не несуть надійної інформації про правильність.

## Поведінка context window

**Context window** — максимальна кількість tokens, яку модель обробляє за один виклик: system prompt, розмова, документи, визначення tools, результати tools і сам output. Сучасні моделі мають windows від десятків тисяч до мільйона і більше tokens, але великий window — не те саме, що надійне використання всього, що в ньому.

Для тестування важливі два добре задокументовані ефекти:

- **Чутливість до позиції.** Багато моделей краще використовують інформацію на початку й у кінці довгого context, ніж у середині («lost in the middle»).
- **Ефективна vs заявлена довжина.** Benchmarks на кшталт RULER показують, що точність на задачах retrieval і reasoning часто падає задовго до заявленої максимальної довжини.

Стандартна перевірка — **needle-in-a-haystack** тест: розмістіть один факт (needle) на контрольованій глибині в довгому filler тексті й поставте питання, що його потребує. Варіюйте довжину й глибину, повторюйте кожну клітинку і показуйте accuracy для кожної клітинки. Генератор нижче будує такий test set. Виклик моделі замінено явно позначеною симуляцією, щоб показати формат звіту; замініть `simulated_model` на реальний виклик, щоб запустити тест по-справжньому.

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

Output (симульована модель):

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

Needle tests вимірюють витягування одного явного факту — найлегшу long-context задачу. Реальні features потребують і reasoning над кількома фактами в довгих inputs, тож пройдений needle test — необхідна, але не достатня умова. Також тестуйте, що робить ваш application **до** ліміту: які повідомлення чи документи відкидаються, коли розмова росте, чи переживає system prompt обрізання і як користувачу повідомляють, що документ задовгий.

## Reasoning models

Деякі моделі перед фінальною відповіддю генерують приховану або сумаризовану послідовність проміжних **reasoning tokens**. Providers надають налаштування на кшталт рівня reasoning effort або budget thinking tokens. Це покращує результати на багатокрокових задачах, але змінює картину тестування:

- **Latency і cost ростуть з reasoning budget.** Reasoning tokens зазвичай тарифікуються як output tokens, навіть коли ви їх не бачите. Вимірюйте latency і cost на тому effort setting, з яким випускаєте продукт.
- **Оцінюйте на production setting.** Prompt, налаштований з high effort, може провалитися на low effort.
- **Не сприймайте reasoning текст як пояснення рішення.** Дослідження faithfulness chain-of-thought показують, що заявлене reasoning може пропускати чинники, які насправді визначили відповідь. Оцінюйте фінальний output і його наслідки; видиме reasoning використовуйте лише як підказку для debugging.
- **Деякі sampling parameters можуть бути зафіксовані** для reasoning models, тож поради про temperature не застосовуються без змін.

## Типові помилки

- **Вважати, що temperature 0 дає повторюваний output**, і писати exact-string assertions.
- **Тестувати при одній temperature, а випускати з іншою.**
- **Оцінювати tokens за кількістю символів для неанглійського тексту, code чи JSON.** Використовуйте справжній tokenizer.
- **Ігнорувати truncation:** немає тесту для відповідей, обрізаних на максимальній довжині output.
- **Вважати відмову за pass.** Відмова в легітимному запиті — провал helpfulness.
- **Довіряти формулюванням упевненості моделі** або її видимому reasoning як evidence правильності.
- **Заявляти підтримку long context після одного needle test** на одній глибині.

## Вправи

1. Обчисліть вручну, а потім у code, softmax для logits `[2.0, 1.0, 0.1]` при temperature 1.0 і 0.5. Що відбувається з імовірністю найменш імовірного token?
2. Distribution над п'ятьма tokens — `[0.50, 0.25, 0.15, 0.07, 0.03]`. Які tokens залишаться після top-k з k = 2? Після top-p з p = 0.8? Після top-p з p = 0.9?
3. Користувач повідомляє, що асистент відповів «There are 2 r's in strawberry». Поясніть збій через tokenization і запропонуйте, як продукт має обробляти такі запити.
4. Спроєктуйте long-context test plan для feature, що відповідає на питання про завантажені договори до 150 сторінок: що варіюєте, скільки повторень, як оцінюєте і що показуєте у звіті.
5. Extraction тест при temperature 0 чергує два outputs, що відрізняються одним словом. Назвіть три правдоподібні причини і два способи зробити тест стійким, не приховуючи реальних дефектів.

:::details Розв'язок вправи 1

exp(2) = 7.389, exp(1) = 2.718, exp(0.1) = 1.105; сума 11.212, тож ймовірності 0.659, 0.242 і 0.099. При temperature 0.5 logits спершу подвоюються, що загострює distribution:

```python
import math


def softmax(values: list[float], temperature: float = 1.0) -> list[float]:
    exps = [math.exp(value / temperature) for value in values]
    total = sum(exps)
    return [round(value / total, 3) for value in exps]


print("T=1.0:", softmax([2.0, 1.0, 0.1]))
print("T=0.5:", softmax([2.0, 1.0, 0.1], 0.5))
```

```text
T=1.0: [0.659, 0.242, 0.099]
T=0.5: [0.864, 0.117, 0.019]
```

Найменш імовірний token падає приблизно з 10% до 2%. Нижча temperature концентрує ймовірність на лідерах.

:::

:::details Розв'язок вправи 2

Top-k з k = 2 залишає перші два tokens, після нормалізації 0.667 і 0.333. Top-p з p = 0.8: кумулятивні суми 0.50, 0.75, 0.90, тож найменша множина, що досягає 0.8, — перші три tokens (0.50 + 0.25 + 0.15 = 0.90), після нормалізації 0.556, 0.278 і 0.167. Top-p з p = 0.9 теж зупиняється на трьох tokens, бо 0.90 рівно досягає порогу. Top-p підлаштовує кількість tokens під форму distribution; top-k — ні.

:::

:::details Розв'язок вправи 3

«strawberry» ділиться на кілька багатолітерних tokens, тож модель ніколи не бачить окремих літер, які її просять порахувати. Вона відповідає за patterns з training data, що може бути неправильно. Продукт має передавати такі детерміновані текстові операції в code (tool, що рахує символи), або вимога має прямо казати, що асистент не виконує операцій на рівні символів. Test set для feature має містити такі запити й перевіряти, що відповідь взята з результату tool.

:::

:::details Розв'язок вправи 4

Варіюйте довжину документа (наприклад 5, 50 і 150 сторінок), позицію релевантного пункту (початок, 25%, 50%, 75%, кінець) і тип питання (пошук одного факту, порівняння двох пунктів у різних місцях, агрегація на кшталт «перелічи всі умови розірвання»). Використовуйте реальні договори або реалістичні synthetic з позначеними відповідями. Повторюйте кожну клітинку щонайменше 3–5 разів через варіативність output. Фактичні питання оцінюйте deterministic checks проти позначених значень, а питання з кількома пунктами — валідованим judge або human review. Показуйте accuracy для кожної клітинки таблицею довжина × позиція, плюс latency і cost для кожної довжини. Також тестуйте поведінку понад 150 сторінок: очікуване повідомлення про помилку або стратегію обрізання.

:::

:::details Розв'язок вправи 5

Причини: (1) near-tie між двома tokens у поєднанні із залежним від batch порядком floating-point редукції; (2) provider маршрутизує запити на різне обладнання чи serving версії; (3) оновлення snapshot моделі за alias; (4) незафіксований retrieval або context, що залежить від часу. Щоб зробити тест стійким: перевіряйте витягнуті значення полів після нормалізації (регістр, пробіли, синоніми, визначені в специфікації), а не весь рядок; запускайте case кілька разів і вимагайте порогу pass rate; фіксуйте версію моделі й записуйте serving fingerprint, коли API його повертає. Не розширюйте assertion, доки він не почне проходити завжди: якщо один із двох outputs справді неправильний, тест має й далі на ньому падати.

:::

## Підсумок

- Моделі читають і пишуть tokens. Tokenization пояснює залежний від мови cost, ліміти tokens, обрізання і слабкість у задачах на рівні символів.
- Генерація — це цикл: logits, softmax з temperature, фільтрація, sampling, додавання. Ніщо в циклі не перевіряє факти.
- Temperature змінює форму distribution; top-k і top-p відсікають її хвіст. Тестуйте на production settings і змінюйте один parameter за раз.
- Навіть temperature 0 не детермінована — головно через залежний від batching і обладнання порядок floating-point редукції. Перевіряйте властивості та rates.
- Етапи training пояснюють knowledge cutoff, sycophancy, over-refusal і стимул вгадувати. Для кожного є конкретний test design.
- Підтримку long context треба вимірювати за довжиною і позицією, а reasoning models — тестувати на тому effort setting, з яким ви їх випускаєте.
