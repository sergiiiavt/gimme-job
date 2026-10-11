Деякі якості неможливо перевірити regex чи overlap metrics: helpfulness, tone, правильність міркувань, відповідність policy. **Model-graded evaluation** використовує LLM як оцінювача — **LLM-as-a-judge**. Це масштабує людське судження, але judge сам є непротестованою моделлю, доки ти його не виміряв.

Цей chapter також пояснює, як тестувати будь-що, коли outputs відрізняються між runs.

## 1. Коли потрібен judge

Використовуй judge, коли:

- критерій вимагає розуміння змісту (чи відповідь справді відповідає на питання?);
- є багато валідних outputs;
- human review кожного case занадто повільний або дорогий.

Не використовуй judge, коли працює deterministic check або коли judge потребує знань, яких не має (наприклад твоєї приватної policy, якщо не включити її в judge prompt).

## 2. Patterns для judge

| Pattern | Питання до judge | Для чого |
|---|---|---|
| Pointwise з rubric | «Чи відповідає відповідь критерію X? Відповідай PASS або FAIL з причиною.» | Regression suites, CI gates |
| Reference-guided | «Порівняно з reference answer, чи output фактично узгоджений?» | Q&A з відомими відповідями |
| Pairwise | «Яка з відповідей A і B краща для цього питання?» | Порівняння prompts чи моделей |
| Claim decomposition | «Перелічи claims у відповіді; познач кожен як supported чи unsupported context.» | Перевірки faithfulness і hallucination |
| G-Eval style | Judge пише кроки оцінювання з критеріїв, потім ставить score | Research-style scoring з ймовірностями |

## 3. Як написати хорошу rubric

Більшість поганих judges походить від розмитих rubrics. Правила:

- **Один критерій на judge.** Розділяй «faithful», «complete» і «polite». Комбінований score ховає, що саме впало.
- **Binary PASS/FAIL кращий за шкалу 1–10.** Шкали дрейфують, скупчуються навколо 7–8, і за ними важко діяти. Якщо потрібні нюанси — кілька binary критеріїв.
- **Точно визнач failure** з прикладами borderline cases.
- **Проси пояснення перед вердиктом.** Reasoning спочатку зазвичай покращує точність і дає що debug-ити.
- **Structured output** для вердикту, щоб parsing ніколи не падав.
- **Дай judge усе потрібне:** питання, відповідь, context, policy, reference.

```text
You are grading a customer-support answer.

Criterion: FAITHFUL. The answer must not state any policy, number or promise
that is not supported by the CONTEXT. Paraphrasing is fine. Saying "I don't know"
is fine. Adding general advice that is not a policy claim is fine.

<context>{{context}}</context>
<question>{{question}}</question>
<answer>{{answer}}</answer>

Return JSON: {"reasoning": "<one short paragraph>", "verdict": "PASS" | "FAIL"}
```

## 4. Відомі bias judges

| Bias | Опис | Mitigation |
|---|---|---|
| Position bias | У pairwise порівнянні віддає перевагу першій (або другій) відповіді | Запускай обидва порядки; рахуй перемогу лише за узгодженості |
| Verbosity bias | Віддає перевагу довшим відповідям | Скажи judge, що довжина ≠ якість; контролюй довжину в аналізі |
| Self-preference | Віддає перевагу outputs своєї родини моделей | Для порівняння моделей бери judge від іншого provider |
| Leniency | Пропускає майже все | Додай жорсткі negative examples; перевір failure rate на відомо поганих cases |
| Format sensitivity | Дрібні зміни формулювання rubric сильно змінюють scores | Версіонуй judge prompt; перевалідовуй після змін |

## 5. Калібрування judge проти людей

Judge — це classifier. Вимірюй його як classifier.

1. Візьми 100–200 outputs. Нехай доменний експерт позначить кожен PASS або FAIL за критерієм і запише причину кожного FAIL.
2. Прожени judge на тих самих outputs.
3. Порахуй узгодженість:

| | Human PASS | Human FAIL |
|---|---|---|
| Judge PASS | true positive | false positive (пропущений дефект) |
| Judge FAIL | false negative (хибна тривога) | true negative |

- **True positive rate** (recall на хороших outputs) і **true negative rate** (recall на поганих) важливіші за сиру accuracy, бо більшість outputs зазвичай хороші.
- **Cohen's kappa** вимірює узгодженість з поправкою на випадковість. Значення вище приблизно 0.6 зазвичай вважають суттєвою узгодженістю.
4. Прочитай кожну розбіжність. Виправ rubric або додай приклади, потім виміряй знову на **іншій** вибірці, щоб не overfit judge.
5. Перевалідовуй, коли змінюєш judge model або rubric.

Якщо експерти часто не погоджуються між собою — критерій визначено недостатньо добре. Виправ визначення, перш ніж автоматизувати.

## 6. Корекція виміряного rate

Якщо judge каже, що 90% outputs проходять, справжній pass rate не обов'язково 90%. Знаючи TPR і TNR, можна оцінити реальний rate і його невизначеність. Мінімум — показуй TPR і TNR judge поруч із кожною judged metric, щоб читачі знали, наскільки їй довіряти.

## 7. Metamorphic і property-based testing

Коли невідома правильна відповідь, усе одно можна знати, як відповіді мають **співвідноситися**. Це **metamorphic relations**:

| Relation | Трансформація | Очікування |
|---|---|---|
| Paraphrase invariance | Перефразувати питання | Ті самі факти у відповіді |
| Irrelevant noise | Додати нерелевантне речення | Та сама відповідь |
| Order invariance | Переставити retrieved documents | Та сама відповідь |
| Negation | Заперечити ключовий факт у context | Відповідь змінюється відповідно |
| Language | Перекласти питання | Еквівалентна відповідь новою мовою |
| Counterfactual fairness | Замінити ім'я, стать чи регіон | Еквівалентна якість і тон |

**Property-based testing** автоматично генерує багато inputs. Hypothesis генерує структуровані inputs для deterministic частин: prompt templates, parsers і validators.

```python
from hypothesis import given, strategies as st

@given(st.text(min_size=0, max_size=5000))
def test_prompt_builder_always_escapes_user_text(user_text):
    prompt = build_prompt(user_text)
    assert prompt.count("<user_input>") == 1
    assert prompt.count("</user_input>") == 1
```

## 8. Тестування в умовах non-determinism

Оскільки outputs варіюються, один run — це вибірка, а не результат.

- **Повторюй runs.** Запускай кожен case кілька разів (3–10 залежно від cost) і фіксуй pass rate для кожного case.
- **pass@k** — щонайменше одна з k спроб пройшла. Корисно, коли людина чи система може вибрати найкращу спробу, наприклад у code generation.
- **pass^k** — усі k спроб пройшли. Це міра надійності, і саме це відчуває користувач, викликаючи feature повторно. pass^k швидко падає: case, що проходить у 90% випадків, проходить усі 8 runs лише приблизно в 43%.
- **Ставь thresholds на rates, а не на одиничні runs.** Наприклад: «cases про refund policy проходять щонайменше 95% за 5 runs кожен».
- **Відокремлюй flaky cases.** Case, що часто перемикається, або тестує неоднозначну вимогу, або реальну нестабільність. Розберися перед quarantine.
- **Зменшуй, що можеш:** низька temperature, зафіксована версія моделі та structured output знижують варіацію, але ніколи її не прибирають.

## 9. Контроль cost для suites з judges

- Спочатку deterministic checks; пропускай judge, якщо вони вже впали.
- Для простих критеріїв використовуй меншу judge model після валідації проти більшої.
- Під час розробки кешуй outputs моделі та вердикти judge за hash input.
- Швидкий smoke subset на кожен pull request, повний suite — щоночі.

## 10. QA quick reference

- Один критерій на judge, binary вердикти, пояснення перед вердиктом, structured output.
- Валідуй кожен judge проти human labels; показуй TPR, TNR і kappa.
- Пом'якшуй position, verbosity і self-preference bias.
- Використовуй metamorphic relations, коли правильна відповідь невідома.
- Вимірюй pass rates за повторних runs; для надійності показуй pass^k.

## Sources

- [Zheng et al. — Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685)
- [Liu et al. — G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634)
- [Hamel Husain — Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/)
- [Chen et al. — Evaluating Large Language Models Trained on Code (pass@k)](https://arxiv.org/abs/2107.03374)
- [Hypothesis documentation](https://hypothesis.readthedocs.io/)
