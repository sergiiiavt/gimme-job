# Final review & exam-day checklist

Use this after the chapters and the mock exam.

## Terms the exam likes to swap

| Pair | Remember |
| --- | --- |
| Error, defect, failure | Human mistake; flaw in a work product; observed wrong behaviour |
| Testing vs debugging | Find failures or defects; locate and remove the cause |
| QA vs testing | Process and prevention; product evaluation and feedback |
| Test analysis vs test design | What to test (conditions); how to test (cases) |
| Confirmation vs regression | Did the fix work; did anything else break |
| Walkthrough vs inspection | Author-led and informal-ish; most formal, with metrics |
| Project vs product risk | Threatens the project; threatens product quality |
| Definition of Ready vs Done | Optional team entry guidance; exit criteria |

## Formulas and counts

- **2-value BVA:** both sides of each shared partition border; for all integers and valid age 18–65: 17,18,65,66.
- **3-value BVA:** each partition boundary plus both neighbours; for all integers and valid age 18–65: 16,17,18,19,64,65,66,67. Deduplicate overlaps for narrower ranges.
- **Decision table:** n binary conditions give 2 to the power n columns before collapsing.
- **Three-point estimation:** E = (a + 4m + b) / 6 and SD = (b − a) / 6.
- **Coverage:** items exercised divided by items identified, as a percentage.

## Readiness checklist

- [ ] All six chapters read, chapters 4 and 5 twice
- [ ] Every calculation in chapter 4 worked on paper
- [ ] Mock exam score of 32 or more, with every wrong answer explained
- [ ] Official sample exams A to D taken under a 60-minute timer
- [ ] Extra 15 minutes requested if the exam is not in your native language

## Exam day

- 60 minutes for 40 questions is 90 seconds each; calculation questions take longer, so move fast on K1 recall.
- There is no negative marking: answer every question.
- Read for qualifiers such as "most", "best" and "not" before looking at the options.

## Explain before memorising

For each missed question retain a requirement, a worked input/output example and the coverage denominator. Recalculate 3-value BVA for all integers 1–100 as -1,0,1,2,99,100,101,102. Then change the range to 1–1 and deduplicate overlapping neighbourhoods. Explain why test count alone is not a coverage criterion and why a passing mock does not prove readiness across all learning objectives.
