<!-- concepts: work-product-reviews, review-types-roles, exploratory-testing, error-guessing, checklist-based, collaboration-feedback, oracle-problem -->

# Статичне, exploratory та collaborative testing

Деяке з найціннішого тестування відбувається без виконання продукту і без дотримання наперед визначеного script. Reviews, exploratory investigation та collaborative feedback виявляють інші класи ризиків, ніж повторювані scripted checks.

## Reviews робочих продуктів

Static testing досліджує робочі продукти без виконання тестованого програмного забезпечення. Вимоги, user stories, designs, API contracts, architecture decisions, test cases, source code та operational procedures можна переглядати.

Requirement review може знайти суперечності ще до появи реалізації. Design review може виявити інтерфейс, який буде складно спостерігати або контролювати під час тестування. Test-case review може знайти відсутні expected results до того, як execution витратить час.

```diagram
Вимога → review до coding
Дизайн → review до фіксації реалізації
Код    → review / static analysis до runtime failure
Testware → review до появи оманливих доказів
```

ISO/IEC 20246 надає загальну рамку для reviews робочих продуктів. Ширший висновок: раннє дослідження інформації може запобігати дефектам, а не лише знаходити їхні runtime-наслідки.

## Підходи та ролі в review

Reviews відрізняються за формальністю. Lightweight peer review може бути розмовою двох людей про story. Формальніші reviews можуть визначати roles, entry criteria, individual preparation, issue logging і follow-up.

Типові responsibilities:

- **author:** надає work product і пояснює intent;
- **reviewer:** досліджує work product на defects, risks та improvements;
- **moderator/facilitator:** тримає review сфокусованим і забезпечує роботу процесу;
- **scribe:** фіксує findings, коли потрібні формальні докази;
- **decision owner:** приймає, відхиляє або пріоритизує actions, коли це потрібно.

Назви відрізняються. Важливо відділяти оцінювання work product від атаки на людину, яка його створила.

> **Поширена помилка:** перетворювати review meetings на live proofreading, до якого ніхто не готується. Individual examination із подальшим сфокусованим обговоренням часто значно ефективніше.

## Exploratory testing

Exploratory testing інтегрує learning, test design та execution. Тестувальник формує гіпотези, взаємодіє з продуктом, спостерігає поведінку, адаптується до нового і вибирає наступний корисний експеримент.

Це не random clicking. Сильна exploratory-робота має mission, корисні notes, свідомі observations і причину для кожної зміни напрямку.

Приклад простого charter:

> Дослідити відновлення checkout після переривання мережі, сфокусувавшись на duplicate orders, stale totals і user-visible recovery messages.

Charter визначає мету, але не диктує кожну дію.

## Як розвивається exploratory session

```diagram
Запитання / charter
      ↓
Експеримент
      ↓
Спостереження
      ↓
Нова інформація
   ↙       ↘
уточнити    піти за несподіваною підказкою
модель      ↓
   ↘       наступний експеримент
      ↺
```

Цей adaptive loop особливо цінний для нових функцій, складних workflows, usability problems і областей, де команда ще не знає ймовірних failure patterns.

## Error guessing

Error guessing — experience-based technique, що використовує знання про поширені failures, попередні defects, architecture і domain behaviour для вибору тестів.

Приклади ідей:

- duplicate submissions після timeout;
- empty або stale cached data;
- timezone boundaries;
- interrupted uploads;
- expired sessions;
- repeated retries;
- незвичний, але валідний Unicode input;
- concurrent updates одного record.

Error guessing стає сильнішим, коли знання явні. Escaped defects та incident history можна перетворювати на reusable heuristics, а не залишати лише в пам’яті одного тестувальника.

## Checklist-based testing

Checklist фіксує важливі області або heuristics без повної процедури. Він додає repeatability, зберігаючи простір для judgment.

Для file-upload feature checklist може містити file size boundaries, allowed types, cancellation, duplicate names, network interruption, accessibility of errors, retry behaviour та storage cleanup.

Checklists корисні, коли детальні cases надто дорогі, але важливе coverage не повинне повністю залежати від пам’яті.

## Collaborative testing

Якість покращується, коли product, development, operations і testing обмінюються інформацією до того, як рішення стають дорогими для зміни.

Корисна collaboration може включати:

- review examples і acceptance criteria до implementation;
- обговорення observability і testability під час design;
- pairing під час складного failure investigation;
- review automated checks щодо того, чи захищають вони змістовні risks;
- передачу production incident evidence людям, які проєктують майбутні tests.

Внесок тестувальника часто полягає в запитанні, яке змінює дизайн ще до написання test case.

## Швидкий feedback кращий за пізній handoff

Порівняйте два workflows.

```diagram
Пізній handoff
Product → Development → QA → defect → Development → QA
                         ↑ дорогий feedback loop

Collaborative feedback
Product ↔ Development ↔ Testing ↔ Operations
          часті запитання та докази
```

Друга модель не прибирає спеціалізовані testing skills. Вона робить їх доступними раніше.

## Проблема test oracle

**Test oracle** — механізм або джерело, за допомогою якого визначають, чи правильний спостережуваний результат. Requirements, calculations, reference systems, invariants, domain rules і human judgment можуть бути oracles.

Oracle problem виникає, коли виконати систему легко, але складно визначити правильну відповідь.

Приклади:

- recommendation algorithm видає правдоподібний результат, але який результат є «правильним»?
- data migration трансформує мільйони records, але незалежного reference output немає;
- rendering engine створює складне image, де exact pixel equality недоречна.

У таких випадках тестувальники можуть використовувати properties, consistency checks, independent calculations, metamorphic relations, sampling, comparison with previous versions або domain-expert review.

> **Ключова думка:** автоматизація не розв’язує oracle problem. Automated assertion настільки надійний, наскільки надійне очікування, що лежить в його основі.

## Поєднання structured та exploratory evidence

Сильне тестування рідко обирає між «documented» і «exploratory» як протилежностями. Зрілий підхід може використовувати стабільні automated regression checks для відомих правил, детальні процедури там, де докази мають бути відтворюваними, checklists для повторюваних heuristics та exploratory sessions для дослідження невизначеності.

Комбінація залежить від risk і context.

## Підсумок

- Static testing може знаходити defects у requirements, designs, code і testware ще до runtime execution.
- Формальність review має відповідати контексту, але roles і focused preparation покращують результат.
- Exploratory testing — adaptive, purposeful investigation, а не random clicking.
- Error guessing перетворює досвід та incident history на targeted test ideas.
- Checklists зберігають важливе coverage, залишаючи execution гнучким.
- Collaboration переносить testing insight раніше в процес прийняття рішень.
- Кожен test залежить від oracle; уміння визначати correctness — фундаментальна проблема тестування.
