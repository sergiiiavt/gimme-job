<!-- concepts: agile-values, agile-not-scrum, whole-team-quality, definition-of-done, shift-left-right, continuous-testing, automation-boundaries, production-feedback -->

# QA в Agile та сучасній delivery-моделі

Сучасна delivery змінює **цикл зворотного зв’язку**, а не фундаментальну потребу в тестуванні. Agile-командам усе одно потрібні докази щодо якості та ризику; вони намагаються отримувати їх безперервно, а не відкладати до окремої тестової фази перед релізом.

## Agile values і principles

Agile Manifesto підкреслює цінність individuals and interactions, working software, customer collaboration і responding to change. Його principles наголошують на частій delivery, тісній collaboration, sustainable work, technical excellence та adaptation.

Жоден із цих принципів не каже «тестуйте менше». Вони означають, що testing information має надходити достатньо швидко, щоб впливати на наступне рішення.

```diagram
Довгий feedback loop
requirement → implementation → handoff → testing → feedback через тижні

Короткий feedback loop
example ↔ design ↔ implementation ↔ automated checks ↔ exploration ↔ production evidence
                       feedback безперервно впливає на наступну зміну
```

## Agile — не Scrum

Agile — набір values і principles. Scrum — один із frameworks для розробки complex products. Команда може працювати iteratively без Scrum, а використання Scrum-термінології саме по собі не робить feedback loops ефективними.

Актуальний офіційний Scrum Guide визначає accountabilities, events, artifacts і commitments. QA-specific roles там не передбачені. Отже, testing work належить до спільної product-development responsibility команди, а не є зовнішньою фазою, створеною Scrum.

> **Поширена помилка:** говорити «в Agile немає документації» або «в Agile всі тестувальники, тому спеціалізоване тестування не потрібне». Agile віддає перевагу корисним результатам і collaboration, а не усуненню expertise або evidence.

## Whole-team ownership якості

Якість — відповідальність команди, але відповідальності не однакові.

Product specialist може уточнювати examples і user outcomes. Developers створюють testable designs та lower-level checks. Test specialists приносять risk analysis, test design, exploratory investigation і quality modeling. Operations додає production constraints, observability та incident evidence.

```diagram
Product ── user need і acceptance examples
   ↕
Development ── design, implementation, component evidence
   ↕
Testing ── risk, coverage, test design, investigation
   ↕
Operations ── runtime constraints і production evidence

Спільний результат: корисна й підтримувана якість продукту
```

Whole-team ownership означає, що якість не можна делегувати комусь одному. Це не означає, що кожна людина має однакову глибину testing skills.

## Definition of Done і очікування щодо якості

У Scrum Definition of Done — формальний опис стану Increment, коли він відповідає required quality measures. Загальніше, командам корисно мати явні спільні очікування щодо того, що означає «готово».

Корисні quality expectations можуть включати relevant review, automated checks, required exploratory coverage, migration validation, accessibility criteria, documentation, observability або production-readiness checks.

Definition of Done не має ставати гігантським checklist з усіма можливими тестами. Він має визначати стійкі quality expectations, що послідовно застосовуються до завершеної роботи.

## Shift-left

Shift-left означає отримувати корисний feedback раніше в lifecycle. Приклади:

- review requirements до implementation;
- обговорення examples і edge cases під час refinement;
- design для observability і testability;
- запуск component і contract checks до full-system testing;
- scanning code і dependencies під час development.

Shift-left — не «змусити developers робити QA». Це зменшення затримки між створенням проблеми і моментом, коли команда про неї дізнається.

## Shift-right

Shift-right використовує production або production-like evidence, щоб вчитися на реальній поведінці системи. Приклади: monitoring, synthetic checks, canary releases, feature flags, user telemetry, incident analysis і controlled experiments.

Shift-right не замінює pre-release testing. Production evidence може показати поведінку, яку test environments не відтворюють ідеально, але виявляти запобіжні катастрофічні failures у production — неприйнятна стратегія.

```diagram
До релізу                        Під час / після релізу
reviews → tests → staging   →    canary → monitoring → incidents → learning
        shift-left                            shift-right
               одна безперервна feedback system
```

## Continuous testing і CI/CD

Continuous testing означає, що корисні testing activities інтегровані в delivery flow, а не накопичуються для пізньої фази. У CI/CD automated checks можуть давати швидкі докази на кожну зміну, тоді як повільніші suites та human investigation запускаються у відповідних точках.

Раціональний feedback stack може виглядати так:

| Feedback | Типова швидкість | Мета |
| --- | --- | --- |
| Static checks / component tests | секунди | дешево знаходити локальні defects |
| Service / integration tests | секунди–хвилини | перевіряти boundaries і business rules |
| Selected system checks | хвилини | перевіряти критичну integrated behaviour |
| Exploratory / specialist testing | adaptive | досліджувати uncertainty і new risks |
| Production telemetry | continuous | спостерігати реальну поведінку та emerging failures |

Швидкий feedback має цінність лише тоді, коли failures надійні й diagnosable.

## Що автоматизація може і не може довести

Автоматизація чудово підходить для repeated checks з explicit expectations. Вона може захищати known behaviour, запускати великі data sets, перевіряти contracts і давати швидкий regression feedback.

Автоматизація не може самостійно вирішити, що неочікуване visual arrangement заплутує користувача, помітити несподіваний business consequence, який ніхто не encoded, або визначити, чи нова вимога вирішує правильну user problem.

> **Ключова думка:** automated tests виконують encoded expectations. Вони не усувають потребу в test analysis, exploration, judgment або new test design.

Окремий learning path **Test automation** глибше розглядає frameworks, architecture, CI та reliability. QA Fundamentals лише визначає концептуальне місце автоматизації.

## Production feedback замикає цикл

Incidents, support tickets, telemetry і user behaviour — inputs для майбутнього тестування. Escaped defect має впливати не лише на один regression case. Запитайте:

1. Яке припущення було неправильним?
2. Чому попередні докази цього не показали?
3. Ризик був відсутній, недооцінений чи його було складно спостерігати?
4. Чи потрібно змінити requirements, design, monitoring, test data або test techniques?

```diagram
Production observation
      ↓
Оновити risk model
      ↓
Покращити requirement / design / test / monitoring
      ↓
Нові release evidence
      ↓
Production observation
      ↺
```

Так quality system навчається, а не просто накопичує більше test cases.

## Сучасна delivery не скасовує фундаментальні принципи

Термінологія попередніх розділів залишається актуальною:

- requirements і risks усе ще формують test basis;
- test levels існують, навіть якщо запускаються в одному pipeline;
- confirmation і regression залишаються різними objectives;
- coverage усе ще потребує визначеного denominator;
- reviews залишаються static testing;
- residual risk усе ще має належати decision owner.

Сучасні tooling змінюють **коли і наскільки швидко** отримуються докази. Вони не скасовують reasoning, що лежить в основі хорошого тестування.

## Підсумок

- Agile скорочує feedback loops; він не прибирає потребу в testing або documentation.
- Agile і Scrum — не синоніми.
- Quality — whole-team responsibility, а specialist testing expertise залишається цінною.
- Definition of Done може фіксувати стійкі quality expectations.
- Shift-left переносить корисний feedback раніше; shift-right вчиться з runtime evidence.
- Continuous testing поєднує automated і human evidence протягом delivery.
- Automation захищає known expectations, але не замінює investigation і judgment.
- Production evidence має оновлювати майбутні risks, designs і tests.
