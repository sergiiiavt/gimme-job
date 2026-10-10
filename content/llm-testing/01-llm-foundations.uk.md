Large language model — це не детермінована функція, яку викликаєш з input і порівнюєш з одним expected output. Це probability machine, яка генерує текст по одному token. Кожна техніка тестування в цьому learning path випливає з цього факту.

Цей chapter дає mental model LLM для тестувальника. Внутрішньої будови тут рівно стільки, щоб передбачати, як модель ламається, без лінійної алгебри.

## 1. Звідки починається і де закінчується path

Path упорядкований: кожен chapter спирається на попередній.

| Рівень | Chapters | Ти вмієш… |
|---|---|---|
| Beginner | 1–2 | Пояснити, як LLM генерує output, і зібрати невеликий LLM application для тестування |
| Intermediate | 3–5 | Будувати datasets, писати deterministic та model-graded evals, оцінювати RAG pipelines |
| Advanced | 6–8 | Тестувати agents, робити red teaming LLM applications, запускати evals у CI та production |
| Pro | 9 | Проєктувати статистично коректні evaluation programs, benchmarks та governance evidence |

Prerequisites: основи Python, pytest, HTTP/JSON APIs та Git. Якщо щось із цього нове — почни з [Programming](/learn/programming), [API & Integration](/learn/api) та [Test automation](/learn/automation). ISTQB [CT-AI syllabus](/learn/certifications?track=ct-ai-v2) корисний для термінології. Цей path глибше заходить у generative systems.

## 2. Tokens, а не символи чи слова

LLM ніколи не бачить текст напряму. **Tokenizer** спочатку ділить текст на tokens: часті слова, частини слів, пунктуацію та bytes. Кожен token стає integer ID.

Практичні наслідки:

- **Ліміти та ціна рахуються в tokens.** Context window, максимальна довжина output, rate limits і cost вимірюються в tokens. Для англійської в середньому приблизно 4 символи на token. Українська, code, JSON і рідкісні слова зазвичай потребують більше tokens на символ.
- **Задачі на рівні символів ненадійні.** Підрахунок літер, reverse рядків, точні позиції символів і частина арифметики ламаються, бо модель не бачить окремих символів.
- **Однаковий видимий текст може токенізуватися по-різному.** Leading spaces, Unicode normalization, невидимі символи та homoglyphs змінюють tokens. Атакувальники використовують це, щоб ховати інструкції.
- **Truncation відбувається на межі token.** Коли output досягає `max_tokens`, він може обірватися посеред слова чи JSON. Завжди тестуй truncated response.

## 3. Next-token prediction

Генерація — це цикл:

1. Модель читає всі tokens у context: system prompt, розмову, retrieved documents, tool results та вже згенерований output.
2. Обчислює probability distribution по всьому vocabulary для наступного token.
3. **Sampler** вибирає один token з цього distribution.
4. Token додається, і цикл повторюється до stop token, stop sequence або ліміту tokens.

У моделі немає окремого кроку «перевірити факт». Впевнена неправильна відповідь і впевнена правильна виникають тим самим механізмом. Тому **hallucination — це властивість методу, а не рідкісний bug**.

## 4. Transformers та attention на рівні інтуїції

Сучасні LLM — це **transformers**. Ключовий механізм — **attention**: генеруючи кожен token, модель зважує, наскільки релевантний кожен попередній token.

Що важливо для тестування:

- **Context window — єдина робоча пам'ять моделі.** Того, чого немає в context, для цього виклику не існує, якщо модель не вивчила це під час training.
- **Довгі contexts деградують нерівномірно.** Моделі часто краще використовують інформацію на початку та в кінці довгого context, ніж у середині (*lost in the middle*). Тестуй long-context features, ставлячи ключовий факт у різні позиції.
- **Порядок і форматування мають значення.** Переміщення інструкції, delimiter чи прикладу може змінити поведінку. Стався до layout prompt як до code.

## 5. Sampling parameters

| Parameter | Ефект | Що це означає для тестування |
|---|---|---|
| `temperature` | Масштабує probability distribution. 0 — майже greedy; вищі значення додають випадковості | Низькі значення для extraction і classification; creative features тестуй на production-значенні |
| `top_p` | Семплює лише з найменшої множини tokens із сумарною ймовірністю `p` | Порівнюючи runs, змінюй лише один sampling parameter за раз |
| `max_tokens` | Жорсткий ліміт довжини output | Тестуй truncated outputs і те, що з ними робить application |
| stop sequences | Зупиняють генерацію, коли з'являється рядок | Перевір, що stop-рядок усередині легітимного контенту не обрізає відповідь |
| `seed` | Деякі providers дають best-effort reproducibility | Ніколи не вважай, що це гарантує однаковий output |

### Temperature 0 — не детермінізм

Навіть при temperature 0 outputs можуть відрізнятися між runs. Причини: floating-point non-associativity на GPU, batching з іншими запитами, оновлення моделі на боці provider, рівні ймовірності tokens. **Тест, який пройшов один раз, нічого не довів.** Chapter 4 пояснює, як тестувати в умовах non-determinism.

## 6. Як тренують моделі

1. **Pretraining.** Модель передбачає наступний token на величезному корпусі тексту. Вона вивчає мову, факти, code і patterns — разом з помилками та bias цих даних.
2. **Instruction tuning.** Supervised examples вчать виконувати інструкції та працювати в chat format.
3. **Preference tuning.** RLHF, DPO та подібні методи зсувають модель до відповідей, які люди або rubric graders вважають кращими: helpful, honest, harmless.
4. **System prompt і runtime context.** Application додає інструкції, tools і дані під час запиту.

Кожен етап залишає сліди, які можна тестувати:

- **Knowledge cutoff.** Модель нічого не знає після кінця training data, якщо не дати їй свіжий context.
- **Sycophancy.** Preference tuning може навчити модель погоджуватися з користувачем, навіть коли він помиляється.
- **Over-refusal та under-refusal.** Safety tuning може блокувати легітимні запити або пропускати шкідливі.
- **Bias з training data.** Стереотипи та нерівна якість між мовами приходять з даних.

## 7. Embeddings і semantic similarity

**Embedding model** перетворює текст на vector чисел. Тексти зі схожим значенням отримують vectors, що вказують у схожих напрямках. Схожість зазвичай міряють **cosine similarity**.

Embeddings використовують у semantic search, RAG retrieval, clustering, deduplication та similarity-based assertions у тестах.

Обмеження, які треба знати:

- Висока similarity не означає однакове значення. «Refund схвалено» і «Refund не схвалено» можуть мати дуже близький score.
- Scores не порівнювані між різними embedding models; threshold для однієї моделі ламається з іншою.
- Embedding models мають свої token limits; довгий текст може бути мовчки обрізаний.
- Доменний жаргон, code, числа та рідкісні мови часто embed-яться погано.

## 8. Каталог failure modes LLM

Використовуй цей список як checklist для test design.

| Failure mode | Як виглядає | Перша ідея тесту |
|---|---|---|
| Hallucination | Впевнені неправильні факти, вигадані citations чи APIs | Питання про факти, яких немає в context; перевірка кожного claim за sources |
| Unfaithfulness | Відповідь суперечить документам або виходить за їх межі | Порівняння claims відповіді з retrieved context |
| Instruction drift | Ігнорує system rule після кількох turns або довгого input | Multi-turn тести, де правило оскаржують пізно |
| Format violation | Невалідний JSON, відсутні поля, зайвий текст навколо JSON | Schema validation кожного output |
| Sycophancy | Змінює правильну відповідь, коли користувач тисне | Наступний turn «Ти впевнений? Я думаю X» |
| Over-refusal | Відмовляє в легітимному запиті | Borderline, але легітимні prompts у dataset |
| Inconsistency | Різні відповіді на парафрази того самого питання | Metamorphic paraphrase tests |
| Lost in the middle | Пропускає факти в середині context | Position sweep ключового факту |
| Prompt injection | Виконує інструкції, сховані в user data чи документах | Injected instructions усередині retrieved content |
| Bias | Різна якість чи тон залежно від імені, статі, регіону, мови | Counterfactual пари inputs |
| Stale knowledge | Відповідає застарілими фактами | Питання про нещодавні зміни з context і без |

## 9. Ландшафт моделей

Ти тестуватимеш applications на дуже різних моделях. Порівнюй їх за:

- **Доступом:** closed API (Anthropic, OpenAI, Google та інші) vs open-weight models, які хостиш сам.
- **Capability vs cost vs latency:** більші моделі зазвичай сильніші, повільніші й дорожчі. Багато продуктів маршрутизують прості запити на малу модель.
- **Context window і лімітами output.**
- **Modalities:** text, images, audio, tool use, підтримка structured output.
- **Model cards і system cards:** intended use, відомі обмеження, evaluation results та safety testing.
- **Versioning:** зафіксовані версії моделі vs рухомі aliases. Рухомий alias може змінити поведінку без жодної зміни у твоєму code.

Стався до зміни моделі як до dependency upgrade: перед перемиканням запускай увесь evaluation suite.

## 10. Чому класичні test oracles ламаються

Класичний автотест має **oracle** — точний очікуваний результат. LLM features часто мають:

- **багато правильних outputs** (summary можна сформулювати тисячами валідних способів);
- **частково правильні outputs** (чотири claims правильні, один ні);
- **non-deterministic outputs** (різні на кожному run);
- **оцінки якості** (tone, helpfulness, safety) замість рівності.

Решта path замінює «assert output == expected» набором інструментів:

- deterministic checks структури та обмежень;
- reference-based metrics;
- model-graded evaluation з каліброваними judges;
- human review;
- статистику по багатьох runs.

## 11. QA quick reference

- Ніколи не приймай один успішний run як evidence. Повторюй і вимірюй.
- Зберігай з кожним результатом назву моделі, версію, parameters і версію prompt.
- Завжди тестуй truncation, порожній output, невалідний JSON і refusal paths.
- Перевіряй поведінку в кожній мові продукту, не лише англійською.
- Стався до context window як до budget: вимірюй token counts реальних inputs.
- Веди живий failure-mode checklist для кожної feature.

## 12. Practice

1. Токенізуй одне речення англійською та українською через tokenizer playground або бібліотеку. Порівняй кількість tokens і оціни різницю в cost для 10 000 запитів.
2. Надішли той самий prompt 30 разів при temperature 0 і 30 разів при temperature 1. Порахуй унікальні outputs та pairwise embedding similarity. Напиши абзац про те, що це означає для test design.
3. Сховай один ключовий факт на початку, в середині та в кінці довгого документа. Постав питання, яке його потребує, і запиши accuracy для кожної позиції.
4. Візьми знайому feature продукту і зістав її щонайменше з п'ятьма failure modes із розділу 8.

**Exit check:** ти можеш пояснити розробнику, з цифрами з вправи 2, чому «у мене спрацювало» — не test result.

## Sources

- [Andrej Karpathy — Intro to Large Language Models](https://www.youtube.com/watch?v=zjkBMFhNj_g)
- [Jay Alammar — The Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/)
- [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course)
- [Liu et al. — Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172)
- [OWASP — Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)
