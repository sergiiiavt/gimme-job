import type { IstqbAiTestingModule } from "./modules";

const OFFICIAL_QUESTIONS_URL = "https://istqb.org/?download_id=9561&sdm_process_download=1";
const OFFICIAL_ANSWERS_URL = "https://istqb.org/?download_id=9564&sdm_process_download=1";

export const istqbAiOfficialSampleExam: IstqbAiTestingModule = {
  id: "official-sample-exam",
  label: "Official ISTQB sample exam — 46 questions",
  navLabel: "Official sample · 46",
  level: "Official exam practice",
  count: 46,
  description: "All official CT-AI v2.2 sample questions published by ISTQB: the 40-question main sample exam plus 6 additional questions, with the official answer and justification document.",
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
};

export default istqbAiOfficialSampleExam;
