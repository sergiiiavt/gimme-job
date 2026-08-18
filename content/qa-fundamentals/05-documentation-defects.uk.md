<!-- concepts: test-documentation-model, test-policy-strategy-plan, test-plan-purpose, test-plan-content, test-approach-schedule, test-plan-reporting-loop, test-case-checklist-charter, test-suite-data-environment, test-reporting, good-defect-report, severity-priority, defect-lifecycle, root-cause-symptom -->

# Тестова документація та дефекти

Документація корисна, коли вона зберігає рішення, робить роботу відтворюваною, підтримує traceability або передає докази. Вона є марною, коли існує лише тому, що шаблон вимагає певного документа.

Важливе запитання не «які документи має створити QA?», а **яка інформація повинна зберегтися, щоб тестування можна було спланувати, виконати, зрозуміти й використати для рішень?** Вона може бути у формальному документі, test-management tool, tickets, wiki, version-controlled files або їх комбінації.

## Тестова документація протягом test process

Testware — це значно більше, ніж test cases. Різні test activities створюють і використовують різні work products.

```diagram
PLANNING
├── test plan
├── estimates і schedule
├── risk information
└── entry / exit або completion criteria

MONITORING & CONTROL
├── progress / status information
├── updated risks і forecasts
└── control decisions та зміни плану

ANALYSIS
├── test conditions
├── coverage targets
└── defects / ambiguities у test basis

DESIGN
├── test cases
├── exploratory charters
├── coverage items
├── test-data requirements
└── environment requirements

IMPLEMENTATION
├── test procedures / scripts
├── automated tests
├── test suites
├── prepared test data
├── execution order
└── environment configuration

EXECUTION
├── test results / logs / evidence
└── defect reports

COMPLETION
├── test completion report
├── residual risks і unresolved items
├── lessons learned
└── maintained / archived testware
```

Це **не обов'язково окремі файли**. Невелика команда може тримати більшість інформації в одному project space. У regulated або safety-critical проєкті артефакти можуть вимагати формального control, review і versioning. Інформаційна потреба залишається подібною, навіть якщо форма відрізняється.

## Test policy, strategy, plan, approach і schedule

Ці поняття часто зводять до одного «test plan», через що стає незрозуміло, яке саме рішення документується.

| Термін | Основна мета | Типовий scope |
| --- | --- | --- |
| **Test policy** | Визначає організаційні принципи, очікування або governance для тестування. | Організація / product family |
| **Test strategy** | Визначає reusable високорівневий підхід до отримання доказів якості. | Організація, продукт, programme або довгострокова ініціатива |
| **Test plan** | Визначає, як будуть досягнуті test objectives конкретного test effort. | Project, release, iteration, migration або significant change |
| **Test approach** | Описує вибрані levels, types, techniques, priorities та інші методи всередині плану. | Частина конкретного плану, часто похідна від strategy |
| **Test schedule** | Розміщує test activities, dependencies і milestones у часі та визначає порядок виконання. | Конкретний test effort |

Організації можуть використовувати назви по-різному. Важлива не назва, а **рішення, яке за нею стоїть**.

```diagram
Організаційний напрям
Test policy / reusable strategy
            ↓
Конкретний release або test effort
          TEST PLAN
            ├── scope і objectives
            ├── risks
            ├── test approach
            ├── responsibilities
            ├── environments і data
            ├── criteria і metrics
            └── estimates / schedule
                       ↓
                 execution
```

> **Поширена помилка:** називати список browsers, test types і tools «test plan». Це може бути частиною **test approach**, але plan також визначає scope, objectives, responsibilities, risks, resources, criteria і coordination.

## Test plan: призначення

**Test plan** описує, як і коли будуть досягнуті цілі визначеного test effort. Його цінність не в наявності документа, а в тому, що важливі рішення про тестування приймаються явно до того, як execution витратить більшість доступного часу.

Корисний test plan допомагає команді:

- погодити, що **in scope і out of scope**;
- визначити **test objectives** і потрібні докази;
- пов'язати depth і priority тестування з **product і project risks**;
- визначити потрібні **people, environments, tools і test data**;
- призначити **responsibilities і decision ownership**;
- зробити явними **assumptions, dependencies і constraints**;
- визначити, коли тестування може початися і що означає достатнє завершення;
- визначити, що вимірюється і як reporting працює;
- створити baseline для **monitoring and control**, коли реальність відрізняється від плану.

Отже, plan — це і coordination artifact, і baseline для рішень.

## Що має бути в test plan

Немає сенсу примушувати кожен проєкт до одного жорсткого шаблону. Практичний plan зазвичай має зберігати таку інформацію.

| Розділ | На яке запитання відповідає |
| --- | --- |
| **Context** | Для якого продукту, release, change або test effort створено plan? Навіщо? |
| **Test basis / references** | Які requirements, designs, contracts, standards, risk analyses або інші джерела визначають expected behaviour? |
| **Scope** | Які test objects, features, interfaces і quality characteristics включені? Що явно виключено? |
| **Test objectives** | Які докази має дати тестування? Які рішення вони повинні підтримати? |
| **Assumptions and constraints** | Що ми припускаємо? Що обмежує time, budget, access, tools, platforms або depth? |
| **Stakeholders and responsibilities** | Хто тестує, надає data/environment, прибирає blockers, приймає residual risk і приймає release decision? |
| **Risks and priorities** | Які product/project risks визначають depth, order і contingency planning? |
| **Test approach** | Які levels, test types, techniques, exploratory work, automation та independence доречні? |
| **Testware / deliverables** | Які cases, charters, scripts, suites, evidence і reports треба створити або підтримувати? |
| **Environment, data and tools** | Які systems, versions, accounts, datasets, devices, browsers, simulators або services потрібні? |
| **Entry criteria** | Що має бути правдою, перш ніж testing activity має сенс починати? |
| **Exit / completion criteria** | Які докази або умови потрібні, щоб effort вважався достатньо завершеним? |
| **Metrics and reporting** | Що вимірюється, як часто передається status і кому? |
| **Communication and escalation** | Як передаються blockers, critical defects, risk changes і decisions? |
| **Estimate, resources and budget** | Який effort/capacity очікується і які resources потрібні? |
| **Schedule and dependencies** | Коли відбуваються activities, у якому порядку і які external events можуть їх блокувати? |

Не кожен рядок потребує окремого heading. Для однієї feature на тиждень це може бути одна сторінка. Для multi-system programme — значно більший документ.

### Компактний реальний приклад test plan

Припустимо, release змінює checkout retry behaviour і додає нового payment provider.

| Частина plan | Приклад |
| --- | --- |
| **Scope** | card checkout, retry behaviour, duplicate-payment prevention, new provider integration; gift-card flow не змінюється і out of scope |
| **Objectives** | показати, що successful payment створює рівно одне order; failed/timeout payment не створює duplicate charge; provider errors мають recoverable поведінку |
| **Main risks** | duplicate charge, order without confirmed payment, timeout з unknown state, regression existing provider |
| **Approach** | API decision-table coverage для payment outcomes; state-transition coverage для retry/recovery; provider contract tests; focused browser E2E happy path; exploratory session для interrupted network states |
| **Environment/data** | staging build, provider sandbox, webhook receiver, test cards для success/decline/timeout, clean-cart accounts |
| **Entry** | provider sandbox reachable; webhook configuration verified; release candidate deployed; seed data available |
| **Completion** | усі critical payment risks мають evidence; немає unresolved critical/high duplicate-charge defect без explicit acceptance; planned provider rules covered; known gaps recorded |
| **Reporting** | daily risk/blocker update під час execution; completion report перед release decision |
| **Schedule** | contract/API checks спочатку, потім integration recovery, потім focused E2E/regression після стабілізації provider configuration |

Зверніть увагу, чого тут **немає**: сотень назв test cases. Plan визначає тестовий effort; execution detail живе у відповідному testware.

## Entry, exit і completion criteria у plan

Criteria перетворюють нечітке «почнемо, коли буде готово» або «закінчимо, коли все пройде» на decision rules.

**Entry criteria** описують умови, за яких testing activity має сенс починати. Наприклад:

- потрібні environment і build доступні;
- critical interfaces deployed і reachable;
- test data або accounts можна створити;
- test basis достатньо стабільний, щоб визначити expectations;
- blocking prerequisite defects вирішені.

**Exit / completion criteria** описують evidence, потрібний для достатнього завершення effort. Наприклад:

- agreed high-risk scenarios covered;
- requirement/risk/technique coverage targets досягнуті або deviations прийняті;
- немає unresolved defect вище погодженого impact threshold без explicit risk acceptance;
- planned test results і known limitations доступні decision-makers;
- residual risks documented.

Criterion має підтримувати рішення. «100% tests passed» є слабким критерієм, якщо suite не представляє важливі risks.

Деякі команди також визначають **suspension і resumption criteria** — коли execution треба зупинити, бо продовження марне, і що має змінитися перед відновленням.

## Test approach є частиною plan

Test approach пояснює, **як саме буде отримано запланований evidence**. Він може включати:

- test levels і test objects;
- functional та relevant non-functional test types;
- specification-based, structure-based, experience-based і collaborative techniques;
- risk-based prioritization і test depth;
- manual, exploratory і automated execution;
- regression і confirmation approach;
- degree of test independence;
- environment і data strategy;
- automation boundaries і CI/CD placement;
- production / operational evidence, де доречно.

Сильний approach є selective. «Run every test type at every level» — це не strategy, а ігнорування cost і risk.

## Test schedule — не test plan

Schedule відповідає на питання **коли й у якому порядку** виконуються planned activities. Він має показувати dependencies, а не лише QA start/end date.

```diagram
API contract stable
       ↓
provider sandbox configured
       ↓
integration tests
       ↓
recovery / retry tests
       ↓
focused E2E regression
       ↓
completion assessment
```

Schedule також може визначати test execution order. Наприклад, fast build-verification checks запускаються перед expensive regression, щоб broken environment виявлявся рано.

## Plan → progress report → control → completion report

Planning і reporting утворюють один feedback loop.

```diagram
TEST PLAN
Що ми плануємо досягти і як?
        ↓
PROGRESS / STATUS REPORT
Де ми відносно plan?
        ↓
TEST CONTROL
Що треба змінити, бо reality відрізняється?
        ↓
updated scope / priorities / schedule / approach
        ↺
TEST COMPLETION REPORT
Що реально досягнуто, що відхилилося і який risk залишився?
```

Це пояснює, чому test plan корисний і в adaptive project: plan є поточним baseline, а control дозволяє свідомо його змінювати.

Корисний **progress report** може показувати:

- completed і remaining work;
- evidence для important risks;
- defects і blockers;
- environment/data constraints;
- relevant coverage і execution metrics;
- deviations from current plan;
- changed product/project risks;
- forecast і next activities.

Корисний **completion report** може показувати:

- що тестувалось і що не тестувалось;
- чи досягнуті objectives і completion criteria;
- важливі deviations from plan;
- significant defect status;
- achieved coverage, де це meaningful;
- unresolved limitations і residual risks;
- lessons / follow-up actions.

Percent passed може бути корисним операційно, але 99% passing tests не означають 99% product quality. Suite може містити багато low-value tests і пропускати critical risk.

> **Історична примітка:** класичні IEEE 829 templates досі зустрічаються у старих курсах та interview material. IEEE 829-2008 superseded сімейством ISO/IEC/IEEE 29119. Варто вчити purpose та інформацію артефактів, а не memorizing obsolete rigid template.

## Test case, checklist і exploratory charter

Різні work products підтримують різні види тестування. Жоден із них не є універсально «кращим». Практичне питання — скільки prescriptiveness, reproducibility та свободи виконання потрібно.

| Вимір | Детальний test case | Checklist | Exploratory charter |
| --- | --- | --- | --- |
| Prescriptiveness | Висока | Середня або низька | Низька |
| Reproducibility | Висока, якщо case підтримується | Середня | Залежить від session notes |
| Свобода виконавця | Низька–середня | Середня–висока | Висока |
| Maintenance cost | Зазвичай високий | Зазвичай нижчий | Зазвичай низький |
| Domain knowledge | Залежить від контексту | Часто важливий | Зазвичай важливий |
| Найкраще підходить | repeatable, delegated або regulated checks | recurring coverage areas | investigation і uncertainty |

Детальний test case може містити preconditions, inputs, steps за потреби та expected results. Checklist фіксує prompts на кшталт «minimum/maximum value», «cancel and retry» або «permission boundary», не визначаючи кожну дію. Exploratory charter задає місію, наприклад: «Explore checkout recovery after network interruption, focusing on duplicate orders and stale totals.»

> **Ключова думка:** обирайте найменший артефакт, який зберігає інформацію, реально потрібну команді.

### Одна функція — три стилі документації

Припустимо, formatting dialog дозволяє обрати font family, style і size.

```diagram
Detailed case
Open dialog → choose Arial → choose Bold → size 12 → Apply
Expected: selected text is Arial Bold 12

Checklist
font family / style / size / invalid combination / persistence / reset

Exploratory charter
Explore formatting changes, focusing on combinations, persistence and recovery after undo/redo
```

Функція та сама. Форма документації змінюється залежно від мети тестування.

## Test suites, дані та середовища

Test suite групує тести для певної мети: smoke, regression, component area, release gate або іншого рішення. Назва suite має передавати цю мету, а не перетворюватися на сховище всіх historical tests.

Інформація про test data та environment є частиною reproducibility. Корисно фіксувати:

- стан account/persona;
- спосіб створення або reset даних;
- application/build version;
- service і dependency versions;
- feature flags і configuration;
- device/browser/OS, де релевантно;
- external-service assumptions.

Без цього контексту «cannot reproduce» часто означає «ми більше не знаємо умов, за яких виникло спостереження».

## Що робить defect report дієвим

Хороший defect report зменшує effort для reproduce, understand, prioritize і fix проблеми.

Зазвичай мінімально потрібні:

1. короткий title, що описує observed failure;
2. relevant environment/build;
3. clear preconditions і data;
4. minimal reproduction steps або triggering sequence;
5. actual behaviour;
6. expected behaviour і basis для цього expectation;
7. useful evidence — logs, screenshots, traces або request/response details, коли доречно;
8. impact information.

Найкращий report не обов'язково найдовший. Приберіть нерелевантні кроки й зафіксуйте shortest reproducible path.

### Від слабкого report до дієвого

Слабкий report:

> **Title:** Button does not work
>
> **Steps:** Open the site, log in, go to checkout, enter data, click the button.
>
> **Result:** Nothing happens.

Такий report змушує читача заново знаходити failure condition. Сильніший варіант фіксує observation і state, що має значення:

| Поле | Приклад |
| --- | --- |
| Title | Checkout remains on Payment step after successful card authorization |
| Build / environment | staging, build 2026.08.16.3, Chrome 140 |
| Preconditions | cart contains one in-stock item; test card authorizes successfully |
| Minimal steps | 1. Open Payment. 2. Enter valid test-card details. 3. Select **Pay**. |
| Actual | authorization succeeds, spinner disappears, page remains on Payment; no order confirmation appears |
| Expected | after successful authorization, order is created and Confirmation is displayed |
| Evidence | payment request/response ID, console trace, screenshot/video |
| Impact | user may retry payment because the UI gives no confirmation |

```diagram
Symptom у title
      ↓
Reproducible state і minimal trigger
      ↓
Actual vs expected behaviour
      ↓
Evidence для investigation
      ↓
Impact для triage
```

Не варто записувати в title guessed technical root cause, якщо його не доведено. «Payment API race condition» — hypothesis; «Checkout remains on Payment after successful authorization» — observation.

## Defect, failure та issue — не синоніми

Defect не обмежується кодом, написаним програмістом. Defects можуть існувати у requirements, design, code, configuration, data, infrastructure та інших work products. **Failure** — це observable incorrect behaviour, коли відповідні умови активують defect. **Issue** зазвичай є workflow container і може представляти defect, question, task, incident або improvement.

Це важливо, тому що перший visible symptom не обов'язково знаходиться там, де defect був внесений.

## Severity і priority

Ці виміри відповідають на різні запитання.

- **Severity:** наскільки серйозним є impact дефекту на продукт, користувача, систему або бізнес?
- **Priority:** наскільки терміново організація має address його відносно іншої роботи?

| Приклад | Severity | Можливий priority |
| --- | --- | --- |
| Рідкісний crash в admin-only migration screen | High | Medium, якщо migration буде через кілька місяців |
| Typo на homepage під час великої campaign | Low | High, бо сьогодні її побачать мільйони users |
| Payment charged twice | Critical | Critical |

Priority враховує timing, exposure, workaround, business commitments та інший context. Severity сам по собі не визначає schedule. Жоден вимір не «належить QA» або «належить management» за визначенням; ownership залежить від organization і часто вирішується через triage.

## Життєвий цикл дефекту та triage

Defect зазвичай проходить через states reported, reviewed/triaged, assigned, fixed, verified і closed, а також variants rejected, duplicate, deferred або cannot reproduce.

Точний workflow відрізняється. Важливо, щоб кожен transition мав clear meaning.

```diagram
Reported
   ↓
Triage / validate
   ├── duplicate / not a defect / deferred
   ↓
Accepted and assigned
   ↓
Fixed
   ↓
Confirmation testing
   ├── still failing → reopen
   ↓
Closed
```

Triage — не суперечка про те, хто «правий», QA чи development. Це shared decision щодо evidence, impact, ownership і next action.

## Симптом, причина і root cause

Visible failure — це **symptom**, а не обов'язково cause.

```diagram
Користувач бачить duplicate order
       ↓
API обробив той самий request двічі
       ↓
Client повторив request після timeout
       ↓
Server endpoint не мав idempotency protection
```

Defect report може починатися із symptom. Investigation визначає technical cause. Root-cause analysis запитує, чому system і process дозволили цій condition виникнути або escape.

Корисна corrective action часто виходить за межі виправлення одного рядка code. Вона може покращити requirements, design patterns, test coverage, observability або review practices, щоб той самий class of problem став менш імовірним.

## Документація має еволюціонувати

Test artifacts — maintained assets. Коли requirements змінюються, obsolete cases треба оновлювати або видаляти. Коли regression test постійно захищає від escaped defect, original manual case може більше не потребувати тієї самої форми. Коли checklist стає надто vague, йому можуть знадобитися explicit examples.

Те саме стосується plans. Plan, який не змінюється разом зі scope, dependencies або risks, стає описом старих assumptions. Monitoring знаходить deviation; control свідомо змінює plan або саму роботу.

Documentation quality не вимірюється кількістю сторінок. Вона вимірюється тим, наскільки добре artifacts зберігають useful knowledge і підтримують decisions.

## Summary

- Test documentation охоплює planning, analysis, design, implementation, execution, reporting і completion; test cases — лише один вид testware.
- Policy, strategy, plan, approach і schedule відповідають на різні planning questions, хоча організації можуть називати їх по-різному.
- Test plan визначає, як конкретний test effort досягне objectives, і є baseline для coordination, monitoring та control.
- Корисний plan охоплює context, basis, scope, objectives, assumptions, stakeholders, risks, approach, testware, environments/data, criteria, metrics, communication, resources і schedule.
- Entry і completion criteria мають виражати decision-relevant conditions, а не ritual percentages.
- Progress reports порівнюють reality з plan; control змінює plan; completion reports підсумовують evidence, deviations і residual risk.
- Test cases, checklists і exploratory charters мають різний баланс prescription, maintenance і executor freedom.
- Data та environment context критичні для reproducibility.
- Strong defect report розділяє observation, reproduction, expectation, evidence і impact.
- Severity описує impact; priority — urgency відносно іншої роботи.
- Root-cause thinking відрізняє visible symptom від underlying technical і systemic causes.

## Sources

- [ISO/IEC/IEEE 29119-2:2021 — Test processes](https://www.iso.org/standard/79428.html)
- [ISO/IEC/IEEE 29119-3:2021 — Test documentation](https://www.iso.org/standard/79429.html)
- [ISTQB CTFL v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [IEEE 829-2008 — superseded test documentation standard](https://standards.ieee.org/ieee/829/3787/)
- [SWEBOK v4.0a](https://www.computer.org/education/bodies-of-knowledge/software-engineering/resources/)
