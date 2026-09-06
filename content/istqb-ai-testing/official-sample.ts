import type { IstqbAiTestingModule } from "./modules";

const OFFICIAL_QUESTIONS_URL = "https://istqb.org/?download_id=9561&sdm_process_download=1";
const OFFICIAL_ANSWERS_URL = "https://istqb.org/?download_id=9564&sdm_process_download=1";

export interface LocalizedIstqbAiTestingModule extends IstqbAiTestingModule {
  labelUk: string;
  navLabelUk: string;
  levelUk: string;
  descriptionUk: string;
  markdownUk: string;
}

export const istqbAiOfficialSampleExam: LocalizedIstqbAiTestingModule = {
  id: "official-sample-exam",
  label: "Official ISTQB sample exam — 46 questions",
  labelUk: "Офіційний приклад іспиту ISTQB — 46 запитань",
  navLabel: "Official sample · 46",
  navLabelUk: "Офіційний приклад · 46",
  level: "Official exam practice",
  levelUk: "Офіційна екзаменаційна практика",
  count: 46,
  description: "All official CT-AI v2.2 sample questions published by ISTQB: the 40-question main sample exam plus 6 additional questions, with the official answer and justification document.",
  descriptionUk: "Усі офіційні приклади запитань CT-AI v2.2, опубліковані ISTQB: основний набір із 40 запитань плюс 6 додаткових запитань, а також офіційний документ із відповідями та обґрунтуваннями.",
  sourceIds: ["istqb-ctai-sample-questions-v22", "istqb-ctai-sample-answers-v22", "istqb-ctai-syllabus-v2"],
  markdown: String.raw`# Official ISTQB sample exam — 46 questions

This is the **real official sample material published by ISTQB** for **CT-AI v2.0**, sample-exam document **v2.2** (released 20 July 2026).

It contains:

| Set | Question IDs | Count | Purpose |
| --- | --- | ---: | --- |
| Main official sample exam | 1–40 | 40 | Full exam-format practice; 60-minute target |
| Additional official questions | A1–A6 | 6 | Extra official examples beyond the main set |
| **Total official examples** |  | **46** | All currently published v2.2 sample questions |

## Open the exact official questions

[Open ISTQB CT-AI v2.2 Sample Exam — Questions](${OFFICIAL_QUESTIONS_URL})

The PDF is hosted by ISTQB and contains the exact official wording, answer options, point values, scenarios, and the six additional questions.

## Open the official answers and explanations

[Open ISTQB CT-AI v2.2 Sample Exam — Answers & Justifications](${OFFICIAL_ANSWERS_URL})

The answer document contains the correct answers, learning objectives, K-levels, point values, and reasoning for the options. Do the questions first; use the explanations only during review.

## Important distinction: official sample questions vs live exam questions

These **are official ISTQB sample questions**, but ISTQB explicitly states that they **cannot be used as-is in an official examination**. They are examples of the expected question style and are the most authoritative public practice questions available.

So:

- **Official published examples available:** yes — **46** in v2.2.
- **Actual past/live CT-AI exam questions publicly released by ISTQB:** no.
- **Original GimmeJob mock questions:** useful as extra practice, but they are not a substitute for this official set.

## How to use this set

1. Open the **Questions** PDF and answer questions **1–40 in 60 minutes** without the answer file.
2. Record uncertain answers as well as wrong answers; a lucky guess is still a revision target.
3. Open the **Answers & Justifications** PDF and review the rationale for every uncertain or incorrect option.
4. Complete **A1–A6** as extra official practice.
5. Only then use the separate **Original mock exam** module for another fresh 40-question run.

The official v2.2 sample exam is the first exam-practice resource to use in this learning path.`,
  markdownUk: String.raw`# Офіційний приклад іспиту ISTQB — 46 запитань

Це **реальні офіційні приклади, опубліковані ISTQB** для **CT-AI v2.0** у документі sample exam **v2.2** (опубліковано 20 липня 2026 року).

Набір містить:

| Набір | Ідентифікатори запитань | Кількість | Призначення |
| --- | --- | ---: | --- |
| Основний офіційний sample exam | 1–40 | 40 | Повна практика у форматі іспиту; орієнтир — 60 хвилин |
| Додаткові офіційні запитання | A1–A6 | 6 | Додаткові офіційні приклади поза основним набором |
| **Усього офіційних прикладів** |  | **46** | Усі опубліковані запитання sample exam v2.2 |

> **Важливо:** українська версія цієї сторінки перекладає пояснення GimmeJob. Самі офіційні PDF із запитаннями та відповідями залишаються матеріалами ISTQB мовою оригіналу. Ми не публікуємо власний переклад 46 офіційних запитань як офіційний матеріал ISTQB.

## Відкрити точні офіційні запитання

[Відкрити ISTQB CT-AI v2.2 Sample Exam — Questions](${OFFICIAL_QUESTIONS_URL})

PDF розміщений на сайті ISTQB і містить точне офіційне формулювання запитань, варіанти відповідей, кількість балів, сценарії та шість додаткових запитань.

## Відкрити офіційні відповіді та пояснення

[Відкрити ISTQB CT-AI v2.2 Sample Exam — Answers & Justifications](${OFFICIAL_ANSWERS_URL})

Документ із відповідями містить правильні варіанти, learning objectives, K-рівні, кількість балів і пояснення логіки відповідей. Спочатку виконай запитання самостійно, а пояснення відкривай уже під час розбору результату.

## Важлива різниця: офіційні sample questions і запитання реального іспиту

Це **офіційні приклади запитань ISTQB**, але ISTQB прямо зазначає, що вони **не можуть використовуватися без змін у реальному сертифікаційному іспиті**. Це приклади очікуваного стилю запитань і найавторитетніший публічний матеріал для практики.

Отже:

- **Офіційні опубліковані приклади доступні:** так — **46** у версії v2.2.
- **Реальні минулі або поточні запитання CT-AI, офіційно опубліковані ISTQB:** ні.
- **Авторські mock questions GimmeJob:** корисні як додаткова практика, але не замінюють цей офіційний набір.

## Як працювати з цим набором

1. Відкрий PDF **Questions** і дай відповіді на запитання **1–40 за 60 хвилин**, не відкриваючи файл із відповідями.
2. Познач не лише неправильні, а й невпевнені відповіді: випадково вгадана відповідь усе одно означає тему для повторення.
3. Відкрий PDF **Answers & Justifications** і розбери обґрунтування для кожної неправильної або невпевненої відповіді.
4. Окремо виконай **A1–A6** як додаткову офіційну практику.
5. Лише після цього переходь до окремого модуля **Original mock exam** для ще одного свіжого набору з 40 запитань.

Офіційний sample exam v2.2 має бути першим екзаменаційним практичним матеріалом у цьому learning path.`,
};

export default istqbAiOfficialSampleExam;
