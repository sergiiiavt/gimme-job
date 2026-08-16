<!-- concepts: product-project-risk, likelihood-impact, risk-based-testing, coverage-meaning, prioritization, completion-criteria, estimation, residual-risk -->

# Ризик, покриття та пріоритизація

Оскільки вичерпне тестування неможливе, будь-який тестовий effort розподіляє увагу. Risk-based testing робить цей розподіл явним: витрачати більше зусиль на отримання доказів там, де failure більш імовірна або має серйозніші наслідки, зберігаючи водночас достатню широту, щоб помічати неочікувані зміни.

## Product risk і project risk

**Product risk** стосується небажаних результатів у продукті: неправильних розрахунків, втрати даних, небезпечної поведінки, security exposure, недоступності сервісу, regulatory failure або поганої usability.

**Project risk** стосується здатності ефективно поставити або протестувати продукт: відсутніх середовищ, запізнілих залежностей, браку навичок, нестабільних builds, недоступних даних або нереалістичних строків.

Ці ризики взаємодіють. Відсутність реалістичного environment — project risk, який може залишити high-impact product risk недостатньо протестованим.

## Ймовірність і вплив

Проста модель розглядає risk exposure як поєднання likelihood та impact.

```diagram
Risk exposure ≈ likelihood × impact

висока likelihood + високий impact → досліджувати глибоко й рано
висока likelihood + низький impact → корисне, але пропорційне покриття
низька likelihood + високий impact → часто все одно потрібні сильні докази
низька likelihood + низький impact → легше покриття може бути раціональним
```

Формула не є точним прогнозом. Це інструмент для обговорення. Команда також має враховувати detectability, exposure, частоту використання, юридичні зобов’язання, reversibility і доступні mitigations.

## Risk-based testing

Risk-based testing використовує інформацію про ризик, щоб впливати на test scope, priority, depth, techniques, independence і timing.

Наприклад, розрахунок підсумкової суми платежу може отримати boundary і decision-table coverage на service level, невелику UI wiring check, contract tests для payment provider і production monitoring. Косметичний екран налаштувань може отримати exploratory та regression coverage, але не ту саму глибину.

Risk-based testing **не** означає ігнорувати все, що не входить до top risks. Невідомі дефекти існують. Сильні стратегії поєднують сфокусовану глибину з широкою safety net.

## Що означає coverage

Coverage описує, яка частина визначеної моделі була перевірена. Моделлю можуть бути:

- вимоги;
- risk items;
- equivalence partitions;
- boundaries;
- decision-table rules;
- states і transitions;
- code statements або branches;
- платформи чи конфігурації;
- user journeys.

Coverage number має сенс лише тоді, коли зрозумілий denominator.

«80% coverage» — неповна інформація. Вісімдесят відсотків statements, requirements, browsers, risk items або decision rules — дуже різні твердження.

> **Поширена помилка:** використовувати coverage як proxy для якості продукту. Coverage говорить, яка частина обраної моделі отримала докази. Воно не доводить, що модель була повною або тести були сильними.

## Пріоритизація тестування

Пріоритизація визначає, що потрібно запускати або досліджувати першим, коли час обмежений. Корисні фактори:

1. risk і business impact;
2. недавні code або configuration changes;
3. історична концентрація дефектів;
4. usage frequency;
5. criticality залежностей;
6. швидкість і diagnostic value тесту;
7. чи заблокує failure подальше тестування.

Саме тому smoke tests зазвичай швидкі й широкі: їх мета — знайти blockers до початку дорогого глибокого тестування.

## Entry, exit і completion criteria

Команди використовують кілька пов’язаних термінів для умов, що визначають, коли тестування може починатися або коли вже достатньо доказів для завершення фази чи прийняття рішення.

Приклади корисних criteria:

- потрібні environment і data доступні;
- критичні interfaces deployed;
- для узгоджених high-risk scenarios є докази;
- немає невирішеного дефекту вище погодженого impact threshold без явного acceptance;
- запланований coverage досягнуто або deviations задокументовані;
- residual risks повідомлені decision owner.

Criteria мають підтримувати рішення, а не створювати хибну впевненість. «100% tests passed» може бути беззмістовним, якщо були обрані неправильні тести.

## Техніки оцінювання тестування

Test estimation прогнозує effort, duration або capacity needs в умовах невизначеності. Типові inputs: scope size, complexity, risk, test levels, environment setup, data preparation, automation work, retesting, regression, coordination та historical performance.

CTFL v4.0.1 описує кілька конкретних estimation techniques.

### Extrapolation з historical data

Якщо є порівнювана попередня робота, команда може оцінювати майбутнє тестування на основі минулих iterations, releases або схожих features.

```diagram
Попередня порівнювана робота
      ↓
Observed effort / throughput
      ↓
Корекція на нові scope, complexity і risk
      ↓
Forecast для нової роботи
```

Це працює лише тоді, коли comparison справді валідний. Копіювання старої цифри без урахування нового environment, dependency або risk створює false precision.

### Wideband Delphi і Planning Poker

Wideband Delphi використовує незалежні expert estimates, їх порівняння та обговорення, після чого експерти оцінюють повторно до наближення до consensus. Planning Poker — поширений Agile-варіант Wideband Delphi.

Головна цінність не в картках, а в тому, що різні assumptions стають видимими до прийняття однієї цифри.

### Three-point estimation

Three-point estimation використовує:

- **a** — optimistic estimate;
- **m** — most likely estimate;
- **b** — pessimistic estimate.

Поширена weighted estimate:

```text
E = (a + 4m + b) / 6
SD = (b - a) / 6
```

Наприклад, якщо `a = 6`, `m = 9`, `b = 18` person-hours:

```text
E = (6 + 4×9 + 18) / 6 = 10 hours
SD = (18 - 6) / 6 = 2 hours
```

Тобто оцінку корисніше комунікувати як приблизно **10 ± 2 person-hours**, а не створювати враження, що «10 годин» — точне значення.

### Estimates мають показувати assumptions

Порівняйте:

> «Тестування займе п’ять днів.»

з:

> «П’ять днів за умови, що staging environment і seed data доступні в понеділок, payment provider sandbox стабільний і жоден critical defect не вимагатиме повного regression rerun.»

Друге формулювання значно корисніше, тому що робить невизначеність видимою.

## Residual risk

Тестування зменшує невизначеність, але не усуває ризик. **Residual risk** — ризик, що залишається після запланованих controls, testing і fixes.

Тому release decisions не слід формулювати як оголошення QA, що продукт «безпечний» або «без багів». Корисне release statement повідомляє:

- які докази існують;
- які важливі області не були покриті;
- які дефекти залишаються;
- відомі обмеження environment;
- очікувані наслідки, якщо залишкові ризики реалізуються;
- доступні mitigations, rollback або monitoring.

```diagram
Початковий ризик
   ↓
prevention + reviews + testing + fixes + mitigations
   ↓
Residual risk
   ↓
Business / product decision з явним ownership
```

## Практичний приклад

Припустимо, реліз одночасно змінює стилі login і payment retry logic.

Styling change торкається багатьох файлів, але має обмежений business impact. Payment change торкається лише кількох рядків, але може спричинити duplicate charges. Кількість змінених файлів — поганий proxy для test priority.

Risk-based response може пріоритизувати:

1. idempotency і duplicate-charge scenarios;
2. payment-provider timeout і retry behaviour;
3. confirmation виправленого дефекту;
4. regression навколо order state і refunds;
5. broad login smoke checks;
6. visual та compatibility checks для styling change.

Ризик змінює порядок і глибину отримання доказів.

## Підсумок

- Product risks стосуються небажаних результатів продукту; project risks загрожують здатності ефективно поставити або протестувати його.
- Likelihood і impact — корисні стартові виміри, а не точна математика.
- Risk-based testing визначає глибину й пріоритет, зберігаючи широке спостереження.
- Coverage завжди є coverage визначеної моделі, а не універсальним відсотком якості.
- Completion criteria мають підтримувати рішення, а не створювати ритуальні gates.
- Estimation може використовувати historical extrapolation, Wideband Delphi/Planning Poker та three-point estimation.
- Estimates мають показувати assumptions і uncertainty.
- Residual risk має бути частиною release communication і мати явного decision owner.
