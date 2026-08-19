# Interview prevalence review

Reviewed: 2026-08-19

The QA interview catalog uses four qualitative occurrence bands: **Very common**, **Common**, **Occasional**, and **Specialist**. They are not percentages and do not represent a claim that every company uses the same interview set.

Every published question is passed through the same maintained review policy in `scripts/interview-prevalence-policy.mjs`. `scripts/validate-interview-content.mjs` fails CI when a stored question prevalence does not match that policy, and the expansion generator applies the policy to authored and generated questions alike.

The review uses four signals:

1. the exact wording and concept of the question;
2. recurrence in the maintained DOU, Katalon, Indeed, and GeeksforGeeks QA interview banks;
3. how broadly the concept applies across general QA roles;
4. whether the question is inherently role/domain-specific.

**Very common** is reserved for recurring foundations such as testing purpose, QA/QC, verification/validation, test levels and types, core test-design techniques, regression/retesting, smoke/sanity, severity/priority, defect lifecycle, test cases, test plans, STLC, and closely recurring fundamentals.

**Common** covers mainstream interview material and practical exercises that are frequently relevant but not universal. **Occasional** is the default for narrower or deeper questions and for generated scenario variants. **Specialist** is used for questions whose relevance depends strongly on a specialist role or domain; the current full-catalog rule keeps Embedded/IoT, AI/ML/LLM, and regulated-domain questions in that band.

Generated scenario variants can never become **Very common** merely because of their position in a topic. This removes the previous position-based behavior.

Personal stars are completely separate from prevalence. The public/editorial star catalog is removed, and `drizzle/0013_clear_interview_stars.sql` clears all pre-existing star rows once. After that reset, a star can exist only after an explicit personal user action and never changes the occurrence band of a question. The site keeps one canonical interview URL: anonymous visitors get the public view with no star controls, while an authenticated session may expose the personal star controls and private state on that same content surface.
