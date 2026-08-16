<!-- concepts: test-strategy-plan, test-case-checklist-charter, test-suite-data-environment, test-reporting, good-defect-report, severity-priority, defect-lifecycle, root-cause-symptom -->

# Тестова документація та дефекти

Документація корисна, коли вона зберігає рішення, робить роботу відтворюваною, підтримує traceability або передає докази. Вона є марною, коли існує лише тому, що шаблон вимагає певного документа.

## Test strategy і test plan

**Test strategy** описує високорівневий підхід до отримання доказів якості: ризики, рівні, типи, техніки, середовища, межі автоматизації та принципи прийняття рішень. **Test plan** застосовує цей підхід до конкретного scope, релізу, проєкту або тестового effort.

Організації використовують ці назви по-різному, тому практичні запитання важливіші за термін:

- Що тестується і що виключено?
- Які ризики найважливіші?
- Які докази потрібні?
- Які рівні, типи та техніки їх дадуть?
- Які середовища, інструменти, дані та люди потрібні?
- Як оцінюватимуться прогрес і завершення?

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

Test suite групує тести для певної мети: smoke, regression, component area, release gate або іншого рішення. Назва suite має передавати цю мету, а не перетворюватися на сховище всіх історичних тестів.

Інформація про test data та environment є частиною відтворюваності. Корисно фіксувати:

- стан account/persona;
- спосіб створення або reset даних;
- версію application/build;
- версії сервісів і залежностей;
- feature flags і конфігурацію;
- device/browser/OS, де це важливо;
- припущення щодо зовнішніх сервісів.

Без цього контексту «cannot reproduce» часто означає «ми більше не знаємо умов, за яких виникло спостереження».

## Test reporting

Reporting існує для підтримки рішень, а не для виробництва заспокійливих цифр. Корисний progress report може показувати:

- що було і не було перевірено;
- які high-risk області мають докази;
- важливі дефекти та blockers;
- обмеження середовища або даних;
- прогалини покриття;
- відхилення від плану;
- поточну залишкову невизначеність.

Completion report має відповідати на реальне запитання стейкхолдера: **що ми зараз знаємо про продукт і яка важлива невизначеність залишається?**

Percent passed може бути корисним операційно, але 99% passing tests не означають 99% якості продукту. Suite може містити багато малокорисних тестів і водночас пропускати критичний ризик.

## Що робить defect report дієвим

Хороший defect report зменшує зусилля, потрібні для відтворення, розуміння, пріоритизації та виправлення проблеми.

Зазвичай мінімально потрібні:

1. короткий title, що описує спостережувану проблему;
2. релевантні environment/build;
3. чіткі preconditions і data;
4. мінімальні reproduction steps або triggering sequence;
5. actual behaviour;
6. expected behaviour і basis для цього очікування;
7. корисні докази — logs, screenshots, traces або request/response details, коли доречно;
8. інформація про impact.

Найкращий report не обов’язково найдовший. Приберіть нерелевантні кроки й зафіксуйте найкоротший відтворюваний шлях.

### Від слабкого bug report до дієвого

Слабкий варіант:

> **Title:** Button does not work
>
> **Steps:** Open the site, log in, go to checkout, enter data, click the button.
>
> **Result:** Nothing happens.

Такий report змушує читача заново знаходити умову failure. Сильніший варіант фіксує саме спостереження і релевантний state:

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
Відтворюваний state і мінімальний trigger
      ↓
Actual vs expected behaviour
      ↓
Evidence, що допомагає investigation
      ↓
Impact, що допомагає triage
```

Не варто записувати в title припущений technical root cause, якщо його ще не доведено. «Payment API race condition» — hypothesis; «Checkout remains on Payment after successful authorization» — observation.

## Defect, failure та issue — не синоніми

Defect не обмежується кодом, написаним програмістом. Defects можуть існувати у requirements, design, code, configuration, data, infrastructure та інших work products. **Failure** — це спостережувана неправильна поведінка, коли відповідні умови активують defect. **Issue** зазвичай є workflow container і може представляти defect, question, task, incident або improvement.

Це важливо, тому що перший видимий symptom не обов’язково знаходиться там, де defect був внесений.

## Severity і priority

Ці виміри відповідають на різні запитання.

- **Severity:** наскільки серйозним є вплив дефекту на продукт, користувача, систему або бізнес?
- **Priority:** наскільки терміново організація має виправити його порівняно з іншою роботою?

| Приклад | Severity | Можливий priority |
| --- | --- | --- |
| Рідкісний crash в admin-only migration screen | High | Medium, якщо міграція буде через кілька місяців |
| Опечатка на homepage під час великої кампанії | Low | High, бо сьогодні її побачать мільйони користувачів |
| Payment charged twice | Critical | Critical |

Priority враховує timing, exposure, workaround, business commitments та інший контекст. Severity сам по собі не визначає графік виправлення. Жоден із цих вимірів не «належить QA» або «належить management» за визначенням; ownership залежить від організації, а рішення часто приймається під час triage.

## Життєвий цикл дефекту та triage

Дефект зазвичай проходить через стани reported, reviewed/triaged, assigned, fixed, verified і closed, а також варіанти rejected, duplicate, deferred або cannot reproduce.

Точний workflow відрізняється. Важливо, щоб кожен перехід мав зрозуміле значення.

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

Triage — не суперечка про те, хто «правий», QA чи development. Це спільне рішення щодо доказів, impact, ownership і наступної дії.

## Симптом, причина і root cause

Видима failure — це **симптом**, а не обов’язково причина.

```diagram
Користувач бачить duplicate order
       ↓
API обробив той самий request двічі
       ↓
Client повторив request після timeout
       ↓
Server endpoint не мав idempotency protection
```

Defect report може починатися із симптома. Investigation визначає технічну причину. Root-cause analysis запитує, чому система і процес дозволили цій умові виникнути або потрапити до користувача.

Корисна corrective action часто виходить за межі виправлення одного рядка коду. Вона може покращити requirements, design patterns, test coverage, observability або review practices, щоб той самий клас проблем став менш імовірним.

## Документація має еволюціонувати

Test artifacts — підтримувані активи. Коли requirements змінюються, застарілі cases потрібно оновлювати або видаляти. Коли regression test постійно захищає від escaped defect, початковий manual case може більше не потребувати тієї самої форми. Коли checklist стає надто нечітким, йому можуть знадобитися явні приклади.

Якість документації вимірюється не кількістю сторінок, а тим, наскільки ефективно артефакти зберігають корисні знання та підтримують рішення.

## Підсумок

- Strategy пояснює тестовий підхід; plans застосовують його до конкретного scope.
- Test cases, checklists і exploratory charters по-різному балансують prescription, maintenance і freedom виконавця.
- Контекст даних і середовища критичний для відтворюваності.
- Reporting має показувати докази, прогалини та невизначеність, а не лише pass percentage.
- Сильний defect report відділяє observation, reproduction, expectation, evidence та impact.
- Defects не обмежуються code, а failures є спостережуваними наслідками, а не «багами, виконаними тестувальником».
- Severity описує impact; priority — терміновість порівняно з іншою роботою.
- Defect triage — спільний процес оцінювання доказів і пріоритетів.
- Root-cause thinking відділяє видимий симптом від технічних і системних причин.
