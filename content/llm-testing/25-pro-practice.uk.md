На pro-рівні робота змінюється: від написання evals до відповідальності за те, **як організація вирішує, чи AI продукт достатньо хороший для релізу**. Для цього потрібні статистична строгість, розуміння benchmarks, програми human evaluation, governance evidence і вміння пояснити все це неспеціалістам.

## 1. Статистична строгість

Кожен eval score — це оцінка з вибірки. Показуй його разом з невизначеністю.

### Confidence intervals

Для pass rate `p`, виміряного на `n` незалежних cases, грубий 95% інтервал — `p ± 1.96 × sqrt(p(1−p)/n)`:

| Cases (n) | Спостережений pass rate | Приблизний 95% інтервал |
|---|---|---|
| 50 | 85% | ±10 pp |
| 100 | 85% | ±7 pp |
| 400 | 85% | ±3.5 pp |
| 1 600 | 85% | ±1.7 pp |

Щоб удвічі звузити інтервал, потрібно вчетверо більше cases. Покращення на 2 пункти на 100 cases майже завжди шум. Для малих вибірок або rates біля 0% чи 100% використовуй Wilson interval замість нормального наближення.

### Порівняння двох версій

- Використовуй **paired** порівняння: запускай обидві версії на тих самих cases і аналізуй різниці по кожному case. Paired аналіз прибирає варіацію між cases і потребує значно менше даних, ніж порівняння двох незалежних середніх.
- **Bootstrap** resampling cases дає інтервали для будь-якої metric, включно зі складними.
- Коли cases кластеризовані (кілька питань про один документ, кілька turns однієї розмови), роби resampling по кластерах, інакше інтервали будуть занадто вузькими.
- Повторні runs кожного case зменшують шум від sampling; показуй і варіацію між cases, і між runs.

### Як не обманювати себе

- **Overfitting під eval:** тюнінг prompts на тому самому dataset, доки score не виросте. Тримай held-out set і оновлюй його.
- **Multiple comparisons:** якщо тестуєш 20 варіантів prompt, один виглядатиме кращим випадково.
- **Metric gaming:** модель, оптимізована під judge, може вивчити його сліпі зони. Перевалідовуй judges на свіжих human labels.

## 2. Benchmarks та їхні межі

Публічні benchmarks вимірюють загальні можливості моделі. Поширені harnesses:

- **lm-evaluation-harness** (EleutherAI): запускає сотні академічних benchmarks на open models;
- **HELM** (Stanford CRFM): широка оцінка за сценаріями й metrics, включно з calibration, robustness і fairness;
- **Inspect AI**: framework для написання й запуску evaluation tasks, зокрема agentic;
- leaderboards у стилі **Chatbot Arena** з парними людськими вподобаннями.

Знай їхні межі:

- **Contamination:** питання benchmark можуть бути в training data, що завищує scores.
- **Saturation:** коли топові моделі мають майже 100%, benchmark більше їх не розрізняє.
- **Mismatch:** місце моделі в публічних benchmarks мало що каже про твій support bot. Твій власний eval suite — той benchmark, що важливий для продукту.
- **Чутливість до setup:** формат prompt, кількість few-shot прикладів і витягування відповіді змінюють scores.

## 3. Власний benchmark

Коли домен потребує власного benchmark (наприклад якість генерації QA test cases):

1. точно визнач capability і що поза scope;
2. збери задачі з реальної роботи з reference відповідями або rubrics від експертів;
3. виміряй **inter-annotator agreement** на references; прибери або виправ задачі, де експерти не згодні;
4. розділи на публічний development і приватний held-out set;
5. додай рівні складності, щоб benchmark не насичувався швидко;
6. опублікуй методологію та відомі обмеження;
7. версіонуй і плануй оновлення.

## 4. Програми human evaluation

Люди залишаються ground truth для суб'єктивних і high-stakes критеріїв. Робити human evaluation добре означає:

- **письмові guidelines** з визначеннями, прикладами і borderline cases;
- **calibration sessions**, де annotators позначають ті самі елементи й обговорюють розбіжності;
- **metrics узгодженості** (Cohen's kappa для двох оцінювачів, Krippendorff's alpha для більше) у динаміці;
- **gold questions** з відомими відповідями для перевірки уважності annotators;
- **tooling**, що показує повний context (розмова, retrieved documents, tool calls) в одному вікні;
- **етику:** чесна оплата, захист від шкідливого контенту, жодних персональних даних без згоди.

## 5. Multimodal і voice системи

- **Images:** точність OCR, читання графіків і таблиць, вигадані візуальні деталі, prompt injection через текст на зображеннях.
- **Audio input:** помилки speech recognition залежно від акценту, шуму та доменної лексики; як помилки поширюються в LLM.
- **Voice agents:** end-to-end latency, обробка перебивань (barge-in), turn-taking, тиша і розриви, вимова чисел, імен та emails.
- **Generated media:** відповідність policy, маркування provenance, відповідність запиту.

## 6. Governance і compliance evidence

Регулятори та клієнти дедалі частіше просять evidence управління AI ризиками. Знай основні frameworks:

| Framework | Що це | Внесок тестувальника |
|---|---|---|
| **NIST AI RMF 1.0** | Добровільний framework з чотирма функціями: Govern, Map, Measure, Manage | Методи вимірювання, результати тестів, відстеження ризиків |
| **NIST AI 600-1** (Generative AI Profile) | Застосовує AI RMF до ризиків generative AI: confabulation, information integrity, шкідливий контент | Покриття категорій ризиків профілю в eval планах |
| **EU AI Act** (Regulation (EU) 2024/1689) | Закон на основі ризиків: заборонені практики, high-risk системи, вимоги прозорості, правила для general-purpose AI models | Evidence точності, robustness, кібербезпеки та human oversight для high-risk систем |
| **ISO/IEC 42001** | Сертифікований стандарт системи управління AI | Задокументовані, повторювані процеси evaluation і monitoring |

Примітка для продуктів, пов'язаних з роботою: AI системи для рекрутингу чи оцінювання кандидатів віднесені до high-risk за EU AI Act. Bias testing, документація і human oversight там — юридичні вимоги, а не лише хороша практика.

Хороше evidence **відтворюване**: версіоновані datasets, версіоновані prompts і моделі, збережені eval results і зв'язок від кожного виявленого ризику до тестів, що його покривають.

## 7. Проєктування evaluation platform

Коли кілька команд випускають LLM features, спільна платформа рятує від перебудови тих самих частин:

```text
datasets (версіоновані, теговані, з контролем доступу)
   -> runners (offline, CI, online sampling)
   -> scorers (deterministic checks, валідовані judges, human review queues)
   -> results store (кожен run, кожен case, кожна версія)
   -> dashboards і gates (scorecards, тренди, alerts, рішення про реліз)
```

Принципи платформи:

- dataset і scorer — повторно використовувані assets з власниками та версіями;
- кожен результат прив'язаний до точних версій app, prompt, моделі та judge;
- judges мають опубліковану статистику валідації (TPR, TNR, kappa);
- розробнику легко додати case з production trace;
- privacy і контроль доступу вбудовані, а не додані згодом.

## 8. Лідерство у стратегії якості

- **Risk-based eval plans:** починай з того, що може піти не так для користувачів і бізнесу, і масштабуй зусилля за severity.
- **Критерії ship / no-ship** погоджені до початку тестування, а не після результатів.
- **Metrics, зрозумілі керівництву:** «task success 92% ± 2 pp, було 87%; немає high-severity safety findings; cost на вирішений ticket менший на 18%».
- **Навчай розробників писати evals.** Якість масштабується, коли кожна feature team володіє своїми datasets.
- **Знай, коли evals недостатньо:** деякі ризики потребують поетапного розгортання, human oversight або відмови від релізу.

## 9. QA quick reference

- Показуй кожен score з confidence interval; порівнюй версії paired аналізом.
- Тримай held-out дані й стеж за overfitting і multiple comparisons.
- Публічні benchmarks — це context, а твої власні evals — основа рішень.
- Проводь human evaluation з guidelines, калібруванням і metrics узгодженості.
- Мапуй ризики на тести, щоб мати governance evidence.
- Погоджуй критерії релізу до тестування.

## Sources

- [Miller — Adding Error Bars to Evals](https://arxiv.org/abs/2411.00640)
- [EleutherAI — lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness)
- [Stanford CRFM — HELM](https://crfm.stanford.edu/helm/)
- [Inspect AI](https://inspect.aisi.org.uk/)
- [Chiang et al. — Chatbot Arena](https://arxiv.org/abs/2403.04132)
- [NIST — AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [NIST AI 600-1 — Generative AI Profile](https://doi.org/10.6028/NIST.AI.600-1)
- [EU AI Act — Regulation (EU) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)
- [ISO/IEC 42001 — AI management systems](https://www.iso.org/standard/81230.html)
