<!-- concepts: requirement-testability, requirement-set-quality, requirement-relations, acceptance-criteria, test-condition-case-data, traceability, equivalence-partitioning, boundary-value-analysis, decision-table, state-transition, scenario-testing, white-box-coverage -->

# Вимоги та дизайн тестів

Хороше тестування починається ще до появи детальних тест-кейсів. Test design перетворює вимоги, ризики, моделі та іншу тестову основу на продуманий набір перевірок, який дає потрібні докази й ефективно знаходить важливі проблеми.

## Хороші вимоги: окрема вимога і набір вимог

Вимога може бути чіткою й тестованою сама по собі, але все одно бути неправильною в контексті інших вимог. Тому review має два рівні.

```diagram
Окрема вимога
→ Чи достатньо добре сформульована ця конкретна вимога?

Набір вимог
→ Чи працюють усі вимоги разом як одна узгоджена специфікація?
```

Обидва рівні важливі. Якщо перевіряти лише формулювання окремих вимог, можна пропустити суперечності, дублювання та прогалини між ними.

## Характеристики хорошої окремої вимоги

Корисні характеристики вимоги — не академічні ярлики. Кожна з них дає тестувальнику конкретне запитання для review.

| Характеристика | Що означає | Запитання тестувальника |
| --- | --- | --- |
| **Чітка й однозначна** | Має одне передбачене трактування. | Чи можуть дві розумні люди зрозуміти її по-різному? |
| **Перевірювана / тестована** | Існує спостережуваний доказ, який показує виконання або невиконання. | Що саме зробить цю вимогу pass або fail? |
| **Повна** | Містить інформацію, потрібну для розуміння очікуваної поведінки. | Чи не бракує умов, входів, результатів, помилок або меж? |
| **Здійсненна** | Реалістично реалізується в межах технологій і проєктних обмежень. | Чи можливо це з доступними технологіями, interfaces, часом і ресурсами? |
| **Необхідна** | Підтримує реальну потребу користувача, бізнесу, регулятора або системи. | Що втратимо, якщо цю вимогу видалити? |
| **Атомарна / singular** | Виражає одне головне зобов’язання або правило. | Чи може одна частина вимоги пройти, а інша — впасти? |
| **Узгоджена** | Не суперечить термінам, правилам та пов’язаним вимогам. | Чи існує інша вимога, яка каже щось несумісне? |
| **Простежувана (traceable)** | Можна встановити її походження і downstream наслідки. | Звідки ця вимога взялася і що від неї залежить? |
| **Незалежна від реалізації, де це доречно** | Описує потрібний результат без зайвого нав’язування технічного рішення. | Вона описує *що* потрібно отримати чи випадково диктує *як* це реалізувати? |

> **Важливо:** implementation-independent — не абсолютне правило. Архітектурні, security, regulatory, protocol або platform requirements можуть цілком обґрунтовано обмежувати реалізацію. Проблема — у зайвій технічній деталі, замаскованій під бізнес-вимогу.

### Слабкі й сильніші приклади

| Слабка вимога | Що не так | Сильніша вимога |
| --- | --- | --- |
| «Dashboard має завантажуватися швидко.» | «Швидко» не має вимірюваного значення. | «За визначеного нормального навантаження 95% автентифікованих запитів dashboard мають завершуватися не довше ніж за 1,5 секунди.» |
| «Паролі мають бути безпечними.» | «Безпечні» не задає однозначного правила. | «Пароль має містити щонайменше 12 символів; значення з налаштованого списку скомпрометованих паролів мають відхилятися.» |
| «Користувач редагує профіль і система надсилає notification.» | Дві поведінки об’єднані в одну вимогу. | Розділити зміну профілю та notification і явно визначити зв’язок між ними. |
| «Використовувати Redis, щоб сторінка була швидшою.» | Одразу нав’язує solution, не визначивши потрібний результат. | Спочатку визначити latency/capacity target; технологію обмежувати окремо лише за реальної архітектурної причини. |

Сильне review не обмежується запитанням «чи можу я написати test case?»:

```diagram
Чи точно я розумію, що вимагається?
        ↓
Чи можу спостерігати результат?
        ↓
Чи визначені preconditions, inputs і boundaries?
        ↓
Чи визначені failure / exception behaviours, де вони потрібні?
        ↓
Чи вимога необхідна і здійсненна?
        ↓
Чи узгоджується вона з іншими вимогами?
        ↓
Чи можу простежити її походження та downstream evidence?
```

> **Ключова думка:** знайти неоднозначну, суперечливу або неперевірювану вимогу — це вже тестова робота. Для цього не потрібне виконуване ПЗ.

## Характеристики хорошого набору вимог

Якість окремих вимог недостатня. Набір індивідуально чітких вимог може утворювати погану специфікацію.

Під час review набору перевіряйте:

- **Повноту:** важливі поведінки, стани, interfaces, constraints і failure cases не пропущені.
- **Узгодженість:** вимоги не суперечать одна одній.
- **Відсутність дублювання:** одне правило не повторюється в кількох місцях із трохи різним змістом.
- **Єдину термінологію:** однакові actors, states, data і поняття мають однакове значення у всій специфікації.
- **Простежуваність:** parent, derived і dependent requirements можна пройти в обидва боки.
- **Коректну декомпозицію:** високорівнева потреба уточнюється нижчими вимогами без тихої втрати частини сенсу.
- **Модифікованість:** одне бізнес-правило має мати зрозуміле authoritative place, а не десятки конфліктних копій.
- **Покриття характеристик якості:** performance, security, reliability, compatibility, accessibility, safety та інші релевантні обмеження не повинні губитися за happy path функціональності.

### Приклад: окремо тестовані, разом суперечливі

```text
REQ-21: Guest users можуть завершити checkout без створення акаунта.

REQ-37: Кожен checkout вимагає authenticated customer account.
```

Кожне формулювання чітке. Кожне можна протестувати. Дефект існує **між вимогами**.

Саме тому «тестована вимога» і «якісний тестований набір вимог» — не те саме.

## Зв’язки requirement-to-requirement

Вимоги рідко існують як плаский список. Зазвичай вони утворюють мережу зв’язків.

| Зв’язок | Значення | Приклад |
| --- | --- | --- |
| **Derived from / refines** | Нижча вимога робить високорівневу потребу конкретнішою. | Потреба захистити акаунт уточнюється password, MFA і session requirements. |
| **Parent / child** | Широка вимога декомпозується на менші. | «Підтримати checkout» → payment, address, tax, confirmation requirements. |
| **Depends on / prerequisite** | Одна вимога має сенс лише за виконання іншої. | Refund processing залежить від completed payment. |
| **Constrains** | Одна вимога обмежує допустиму поведінку іншої. | Security rule обмежує, як можуть показуватися customer data. |
| **Interacts with** | Дві вимоги впливають на той самий state/data/workflow і мають перевірятися разом. | Cancellation взаємодіє з payment settlement та inventory reservation. |
| **Conflicts with** | Дві вимоги не можуть бути одночасно істинними за тих самих умов. | Guest checkout дозволений vs authentication обов’язкова для кожного checkout. |
| **Overlaps / duplicates** | Дві вимоги описують те саме або майже те саме правило. | Password length визначено по-різному у двох security sections. |

Практична структура може виглядати так:

```diagram
Потреба користувача / стейкхолдера
          ↓
Бізнес-вимога
          ↓
Системна вимога
          ↓
Software / feature requirement
          ↓
Acceptance criteria
          ↓
Test conditions
          ↓
Test cases
          ↓
Results / defects / evidence
```

Це не універсальна ієрархія для кожної організації. Важливий принцип — мати відновлювані зв’язки між рівнями та бачити залежності й конфлікти між вимогами одного рівня.

## Acceptance criteria

Acceptance criteria описують умови, які мають бути виконані, щоб feature, story або capability вважалася прийнятною. Вони мають пояснювати бізнес-правила та спостережувані результати, а не просто повторювати реалізацію.

Хороші acceptance criteria можуть бути частиною test basis, але вони не є повною тестовою стратегією. Тестувальник усе одно враховує межі, негативні шляхи, взаємодії, характеристики якості та ризики, які acceptance criteria можуть не згадувати.

## Від test basis до test cases

Чіткий ланцюг дизайну відділяє **намір покриття** від деталей виконання.

```diagram
Test basis
   ↓
Test conditions: для чого потрібні докази?
   ↓
Елементи покриття / модель
   ↓
Test cases: які входи, стани та очікувані результати це покриють?
   ↓
Test data і процедури
   ↓
Виконання та докази
```

**Test condition** — те, що потрібно дослідити: правило, стан, ризик, interface, характеристика якості або acceptance criterion. **Test case** визначає входи, передумови, очікувані результати та інші деталі конкретної перевірки. Test data надають конкретні значення та стан.

Якщо одразу починати з детальних кроків, легко приховати прогалини: увага переходить до механіки UI ще до визначення того, що саме необхідно покрити.

## Двонапрямна traceability

Traceability має працювати не лише як «requirement → test». Корисна простежуваність дозволяє пройти зв’язки **вниз і вгору**:

```diagram
Потреба / ризик
      ↕
Вимога
      ↕
Derived / dependent requirements
      ↕
Acceptance criteria
      ↕
Test condition
      ↕
Test case
      ↕
Result / defect / evidence
```

Це допомагає відповідати на запитання:

- Для яких вимог уже є докази?
- Які high-risk вимоги не мають тестів?
- Які тести треба переглянути після зміни вимоги?
- Які інші вимоги залежать від зміненої вимоги?
- З якого user/business need походить конкретна нижча вимога?
- Які failures впливають на які правила та ризики?

Traceability не потребує гігантської RTM. Реалізація може бути легкою, але зв’язки мають відновлюватися тоді, коли це потрібно для coverage або impact analysis.

## Техніки дизайну тестів: спільна карта

Перед тим як вибирати конкретні test cases, варто спочатку визначити, **який тип проблеми ми моделюємо**. Назви test-design techniques часто змішують із test levels, test types, automation, smoke/regression або positive/negative testing. Це різні виміри.

Практична спільна карта:

| Сімейство / підхід | Основні техніки або практики | Коли найкраще підходить |
| --- | --- | --- |
| **Black-box / specification-based** | Equivalence Partitioning, Boundary Value Analysis, Decision Table Testing, State Transition Testing | Виводимо тести з вимог, правил, inputs, outputs та спостережуваної поведінки. |
| **White-box / structure-based** | Statement coverage, Branch coverage | Виводимо тести з коду або іншої внутрішньої структури. |
| **Experience-based** | Error Guessing, Exploratory Testing, Checklist-based Testing | Використовуємо досвід тестувальника, знання продукту, defect history та heuristics. |
| **Collaboration-based approaches** | User-story collaboration, acceptance criteria, ATDD | Формуємо спільні приклади та очікування разом зі stakeholders до або під час реалізації. |
| **Додаткові / просунуті техніки** | Scenario/use-case testing, Pairwise/Combinatorial Testing, Cause-effect Modeling, Mutation Testing | Покриваємо workflows, combinations, логічні зв’язки або оцінюємо силу test suite. |

> **Не варто зводити все до одного плаского списку.** Manual vs automated, functional vs non-functional, smoke vs regression, test levels і positive vs negative testing описують інші виміри. Їх можна комбінувати з design technique, але це не рівноправні test-design techniques.

### Як вибрати техніку

Починайте з форми проблеми, а не з улюбленої техніки.

| Проблема тестування | Сильна стартова техніка |
| --- | --- |
| Великий input domain із групами, для яких очікується однакова поведінка | **Equivalence Partitioning** |
| Поведінка змінюється на межах, thresholds, довжинах, датах або quotas | **Boundary Value Analysis** |
| Результат залежить від комбінацій business conditions | **Decision Table Testing** |
| Поведінка залежить від поточного state або попередніх events | **State Transition Testing** |
| Треба перевірити реалістичний багатокроковий business/user flow | **Scenario / Use-case Testing** |
| Потрібен доказ щодо виконаної implementation structure | **White-box coverage** |
| Відомі типові дефекти або ймовірні failure modes не повністю описані специфікацією | **Error Guessing** |
| Специфікація неповна або важливо навчатися під час тестування | **Exploratory Testing** |
| Потрібен повторюваний набір domain heuristics для різних тестувальників | **Checklist-based Testing** |
| Багато configuration parameters створюють забагато combinations | **Pairwise / Combinatorial Testing** |
| Команді потрібні спільні конкретні приклади ще до реалізації | **ATDD / collaboration-based approaches** |

На практиці техніки часто комбінуються. Наприклад, checkout rule може вимагати EP для customer categories, BVA для monetary thresholds, decision table для discount conditions, state transitions для payment status і scenarios для повного purchase flow.

## Equivalence partitioning

Equivalence partitioning ділить великий простір входів або станів на групи, від яких очікується подібна поведінка. Замість перевірки кожного можливого значення тестувальник обирає представників змістовних partitions.

Припустимо, поле віку приймає цілі значення від 18 до 120.

| Partition | Приклад |
| --- | --- |
| Менше 18 | 17 |
| Валідні 18–120 | 35 |
| Більше 120 | 121 |
| Невалідний тип / формат | text, decimal, empty — залежно від контракту |

Техніка сильна лише тоді, коли partitions ґрунтуються на реальній поведінці або правилах. Довільне групування — не equivalence partitioning.

## Boundary value analysis

Дефекти часто виникають на межах, де змінюється поведінка. Boundary value analysis фокусується на цих точках переходу.

Для валідного цілочисельного інтервалу 18–120:

```diagram
невалідно       валідний діапазон                 невалідно
 ... 16  17 | 18  19 ................ 119  120 | 121  122 ...
             ↑                                 ↑
          нижня межа                        верхня межа
```

CTFL v4.0.1 розрізняє два поширені варіанти BVA:

- **2-value BVA:** перевірити boundary value і найближче значення в сусідньому partition. Для нижньої межі це 17 і 18; для верхньої — 120 і 121.
- **3-value BVA:** перевірити boundary і найближче значення з обох боків. Для нижньої межі це 17, 18 і 19; для верхньої — 119, 120 і 121.

Точні значення залежать від data type і business rule. Continuous measurement, date/time boundary або string-length limit потребують моделі, відповідної конкретному домену.

> **Поширена помилка:** механічно запам’ятовувати «boundary numbers», не визначивши, де реально змінюється поведінка. BVA починається з правила та його partitions, а не з фіксованої формули.

## Decision table testing

Decision tables корисні, коли результат залежить від комбінацій умов. Вони роблять приховані комбінації видимими.

Припустимо, free shipping надається, якщо клієнт premium **або** сума кошика не менше €50:

| Умова / дія | Rule 1 | Rule 2 | Rule 3 | Rule 4 |
| --- | --- | --- | --- | --- |
| Premium member? | Так | Так | Ні | Ні |
| Кошик ≥ €50? | Так | Ні | Так | Ні |
| Free shipping | Так | Так | Так | Ні |

Таблиця явно показує всі чотири комбінації. З неї можна вивести чотири сфокусовані тести, не починаючи одразу з UI-кроків.

```diagram
Спочатку rules
   ↓
Для кожного релевантного rule обрати конкретний input set
   ↓
Виконати через найдешевший корисний interface
   ↓
Перевірити очікувану action для цього rule
```

Якщо бізнес додасть правило «premium customers отримують free shipping лише в EU», таблиця одразу покаже, що до моделі додалася нова condition і комбінації потрібно переглянути.

## State transition testing

Деяка поведінка залежить не лише від поточного input, а й від **історії та стану**. State transition models описують дозволені стани, події та переходи.

Приклад: account блокується після п’яти послідовних неправильних PIN attempts.

```diagram
[Active]
   │ wrong PIN #1–#4
   └───────────────↺ [Active]
   │ wrong PIN #5
   ↓
[Locked]
   │ successful unlock procedure
   ↓
[Active]
```

Корисні test conditions:

- валідний transition: Active → Locked після п’ятої послідовної помилки;
- валідний recovery transition: Locked → Active після дозволеної unlock procedure;
- невалідний transition: correct PIN не має автентифікувати користувача, поки account залишається Locked;
- sequence rule: успішний login до п’ятої помилки може скидати consecutive-failure counter, якщо це визначено специфікацією.

Саме тому state models сильніші за ізольовані input/output cases для authentication flows, orders, subscriptions, devices та workflow engines.

## Scenario та use-case testing

Scenario-based testing проходить змістовні user або business flows через кілька взаємодій. Воно корисне, щоб перевірити, чи окремі правила складаються в цілісний результат.

Сильний сценарій — не просто «натиснути кожен екран». Він має мету та результат: наприклад, «наявний клієнт змінює адресу доставки після авторизації платежу, але до відправлення».

Сценарії доповнюють сфокусовані техніки. Boundaries і partitions ефективно перевіряють окремі правила; сценарії — взаємодію та безперервність workflow.

## Основи white-box coverage

White-box або structure-based techniques виводять тести з внутрішньої структури програмного забезпечення.

Два базові показники:

- **Statement coverage:** які виконувані statements були виконані?
- **Branch coverage:** які результати рішень або branches були виконані?

100% statement coverage не означає 100% branch coverage, і жоден із цих показників не доводить коректність. Coverage показує, яка структура виконувалась, але не те, чи були assertions змістовними або вимоги повними.

> **Поширена помилка:** використовувати code coverage як оцінку якості. Це сигнал покриття, який може показати неперевірену структуру; він не доводить, що виконувану поведінку протестовано добре.

## Experience-based techniques

Experience-based techniques використовують знання тестувальника, defect history, розуміння домену та постійне навчання. Вони особливо корисні, коли специфікація неповна або формальні моделі не охоплюють усі реалістичні failure modes.

### Error guessing

Error guessing цілеспрямовано перевіряє failures, які досвідчений тестувальник вважає ймовірними.

Для file-upload feature корисними припущеннями можуть бути:

- zero-byte або надзвичайно великий файл;
- правильне розширення з неочікуваним content;
- duplicate names або повторний upload request;
- перерваний network transfer;
- незвичні Unicode-символи у filename;
- заповнення storage quota під час операції.

Цінність дають досвід і докази, а не випадкові кліки. Defect history, production incidents і відомі слабкі місця технології роблять error guessing значно сильнішим.

### Exploratory testing

Exploratory testing поєднує **навчання, test design і execution**, а не повністю розділяє їх заздалегідь. Тестувальник формує hypothesis, проводить сфокусоване дослідження, спостерігає за продуктом і адаптує наступні перевірки на основі отриманих знань.

Корисна exploratory session усе одно має структуру: charter або mission, time box де це доречно, notes щодо coverage та observations, а також відтворювані defect evidence.

Приклад charter: «Дослідити поведінку checkout, коли payment успішний, але confirmation або inventory services відповідають із затримкою чи недоступні».

Exploratory testing не означає undocumented або unplanned testing. Це означає, що детальний test design розвивається в процесі навчання.

### Checklist-based testing

Checklist-based testing використовує повторюваний набір перевірок або heuristics, сформований зі standards, past defects, domain knowledge чи досвіду команди.

Для API endpoint checklist може нагадувати перевірити:

- authentication та authorization;
- required і optional fields;
- invalid types та malformed payloads;
- boundaries і size limits;
- idempotency або duplicate requests;
- error schema та status codes;
- logging і sensitive-data exposure.

Checklist має стимулювати мислення, а не перетворюватися на механічний script. Його потрібно оновлювати, коли змінюються продукт, ризики або defect patterns.

## Collaboration-based approaches

Collaboration-based approaches створюють спільні приклади й очікування між business, development і testing roles. Вони посилюють test design, зменшуючи неоднозначність ще до завершення реалізації.

Поширені практики:

- **User-story collaboration:** обговорювати story, risks, examples та open questions, а не вважати текст ticket достатньою специфікацією.
- **Acceptance criteria:** визначати спостережувані умови, за яких поведінка є прийнятною.
- **ATDD (Acceptance Test-Driven Development):** спільно виводити конкретні acceptance examples до реалізації та використовувати їх для спрямування development і testing.

Ці підходи не замінюють EP, BVA, decision tables або exploratory testing. Спільний acceptance example усе одно може потребувати boundary analysis, negative partitions, state coverage та experience-based exploration.

## Корисні техніки поза CTFL Foundation core

Є й інші корисні техніки, але їх не слід подавати так, наче всі вони входять до актуального Foundation-набору CTFL.

- **Pairwise / combinatorial testing** зменшує кількість configuration combinations, покриваючи вибрані взаємодії між parameter values.
- **Cause-effect modeling** допомагає перетворювати логічні зв’язки між conditions та outcomes на test conditions і часто веде до decision table.
- **Use-case/scenario testing** досліджує змістовні end-to-end interactions.
- **Mutation testing** оцінює ефективність test suite через контрольовані зміни коду; це вже більш просунутий engineering-рівень.

Водночас **positive testing**, **negative testing** і **exhaustive testing** не варто показувати як рівноправні формальні test-design techniques. Positive/negative описують намір прикладів; exhaustive testing загалом неможливе, окрім малих скінченних просторів.

## Поєднання технік

Хороший test design зазвичай поєднує кілька способів мислення. Для discount engine можна використати:

1. equivalence partitions для типів клієнтів і станів купона;
2. 2-value або 3-value BVA для monetary thresholds;
3. decision tables для взаємодіючих business rules;
4. state transitions для активації та завершення дії купона;
5. scenarios для реалістичних purchase journeys;
6. structural coverage для пошуку важливих implementation paths, пропущених specification-based tests;
7. error guessing та exploratory testing для failure modes, які специфікація не охоплює повністю;
8. pairwise coverage, коли взаємодіє багато environment або configuration parameters.

Результат сильніший, ніж повторення одного happy path на кількох рівнях.

## Підсумок

- Хороша **окрема вимога** має бути чіткою, перевірюваною, повною, здійсненною, необхідною, атомарною, узгодженою та простежуваною.
- Хороший **набір вимог** додатково потребує повноти, узгодженості, відсутності дублювань, правильної декомпозиції та зв’язків між вимогами.
- Requirement-to-requirement relationships допомагають бачити parent/child, derived, dependency, constraint, interaction, conflict і duplicate зв’язки.
- Двонапрямна traceability дозволяє пройти від потреби й вимоги до тесту та результату — і назад.
- Test conditions потрібно визначати до детальних кроків виконання.
- Тримайте одну спільну карту test design: **black-box/specification-based, white-box/structure-based, experience-based, collaboration-based approaches плюс вибрані advanced techniques**.
- Equivalence partitioning зменшує великі простори до змістовних представників.
- CTFL розрізняє 2-value і 3-value boundary value analysis.
- Decision tables моделюють комбінації; state transitions — поведінку, залежну від історії.
- Scenario testing і structural coverage додають інші типи доказів, а не замінюють black-box techniques.
- Error guessing, exploratory testing і checklist-based testing покривають важливе experience-based мислення, яке формальні моделі можуть пропустити.
- Pairwise і cause-effect є корисними розширеннями, тоді як positive/negative labels не є окремими формальними test-design techniques.

## Sources

- [ISO/IEC/IEEE 29148:2018 — Requirements engineering](https://www.iso.org/standard/72089.html)
- [ISTQB CTFL v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [ISO/IEC/IEEE 29119-2:2021 — Test processes](https://www.iso.org/standard/79428.html)
- [ISO/IEC/IEEE 29119-4:2021 — Test techniques](https://www.iso.org/standard/79431.html)
- [SWEBOK v4.0a](https://www.computer.org/education/bodies-of-knowledge/software-engineering/resources/)