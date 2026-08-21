import sqlPracticalTasks from "../data-learning/sql-practical-tasks.json";

const taskCards = new Map(sqlPracticalTasks.cards.map((card) => [card.id, card]));

type Level = "Junior" | "Middle" | "Senior" | "Lead";

type PracticalMeta = {
  taskId: string;
  id: string;
  level: Level;
  question: string;
  questionUk: string;
  shortAnswer: string;
  shortAnswerUk: string;
  strongAnswerSignals: string[];
  strongAnswerSignalsUk: string[];
  exampleUk: string;
  tags: string[];
  codeTitleUk: string;
  codeExplanationUk: string;
  expectedResult: string;
  expectedResultUk: string;
};

const practicalMeta: PracticalMeta[] = [
  {
    taskId: "task-return-all-duplicate-rows",
    id: "sql-return-all-duplicate-rows",
    level: "Junior",
    question: "Write SQL that returns every row participating in a duplicate business key, not only the duplicated key values.",
    questionUk: "Напишіть SQL, який повертає всі рядки, що входять у дубль бізнес-ключа, а не лише значення дубльованих ключів.",
    shortAnswer: "Use a window function such as COUNT(*) OVER (PARTITION BY business_key) to keep row-level detail while calculating how many rows share the key, then filter that count in an outer query. This is more useful than a plain GROUP BY when the interviewer wants the actual offending records and their primary keys.",
    shortAnswerUk: "Використайте COUNT(*) OVER (PARTITION BY business_key), щоб зберегти деталізацію кожного рядка й одночасно порахувати записи з тим самим ключем, а потім відфільтруйте цей count у зовнішньому запиті. Це корисніше за звичайний GROUP BY, коли потрібно побачити конкретні проблемні записи та їхні primary key.",
    strongAnswerSignals: ["uses a window function or joins back to grouped duplicate keys", "keeps the original rows and primary keys visible", "defines how NULL and normalized key values should be handled"],
    strongAnswerSignalsUk: ["використовує window function або приєднує назад згруповані дублікати", "залишає видимими початкові рядки та primary key", "визначає правила для NULL і нормалізації ключів"],
    exampleUk: "У таблиці users три записи можуть мати той самий нормалізований email. Потрібно повернути повні рядки з id та created_at, щоб QA перевірив дублікати до будь-якого cleanup.",
    tags: ["sql", "duplicates", "window-functions", "data-quality"],
    codeTitleUk: "Повернути всі рядки-дублікати",
    codeExplanationUk: "Віконний COUNT обчислюється для кожного email, але не згортає рядки. Зовнішній WHERE тому повертає кожен проблемний record разом із primary key та іншими колонками.",
    expectedResult: "Every row whose business key occurs more than once.",
    expectedResultUk: "Кожен рядок, бізнес-ключ якого зустрічається більше одного разу."
  },
  {
    taskId: "task-deduplicate-safely",
    id: "sql-deduplicate-keep-latest",
    level: "Middle",
    question: "How would you identify duplicate rows to remove while deterministically keeping the newest record?",
    questionUk: "Як знайти дублікати для видалення так, щоб детерміновано залишити найновіший запис?",
    shortAnswer: "Rank rows inside each duplicate business-key group with ROW_NUMBER ordered from newest to oldest and add a stable tie-breaker such as the primary key. Treat rn = 1 as the survivor and rn > 1 as removal candidates. Preview those IDs first and perform any DELETE inside a controlled transaction.",
    shortAnswerUk: "Пронумеруйте rows у кожній групі дубльованого бізнес-ключа через ROW_NUMBER, відсортувавши від найновішого до найстарішого, і додайте стабільний tie-breaker, наприклад primary key. rn = 1 буде survivor, а rn > 1 — кандидатами на видалення. Спочатку перегляньте ці ID, а DELETE виконуйте в контрольованій транзакції.",
    strongAnswerSignals: ["uses ROW_NUMBER with PARTITION BY the real business key", "uses deterministic ordering with a tie-breaker", "previews candidate primary keys before destructive DML"],
    strongAnswerSignalsUk: ["використовує ROW_NUMBER з PARTITION BY реального бізнес-ключа", "використовує детерміноване сортування з tie-breaker", "переглядає primary key кандидатів до деструктивного DML"],
    exampleUk: "Міграція випадково створила кілька rows для одного email. QA потрібен запит, який однозначно показує, який запис залишиться, а які ID є кандидатами на cleanup.",
    tags: ["sql", "duplicates", "window-functions", "dml"],
    codeTitleUk: "Preview кандидатів на видалення",
    codeExplanationUk: "ROW_NUMBER визначає одного survivor для кожної duplicate group. ORDER BY має містити стабільний tie-breaker, щоб однакові timestamp не робили вибір випадковим.",
    expectedResult: "Only primary keys that are safe candidates for review before deletion.",
    expectedResultUk: "Лише primary key, які є кандидатами на перевірку перед видаленням."
  },
  {
    taskId: "task-latest-row-per-entity",
    id: "sql-latest-row-per-group",
    level: "Middle",
    question: "Write SQL to return the latest order, status, or event for every entity.",
    questionUk: "Напишіть SQL, який повертає найновіше замовлення, статус або подію для кожної сутності.",
    shortAnswer: "Use ROW_NUMBER over a partition for each entity, order rows newest-first and keep row number one in an outer query. Include a deterministic secondary ordering column such as the primary key because MAX(timestamp) alone returns only the timestamp and can match several tied records.",
    shortAnswerUk: "Використайте ROW_NUMBER з partition для кожної сутності, відсортуйте rows від найновіших і залиште row number = 1 у зовнішньому query. Додайте детерміновану вторинну колонку sorting, наприклад primary key, оскільки MAX(timestamp) повертає лише timestamp і при ties може відповідати кільком records.",
    strongAnswerSignals: ["uses ROW_NUMBER with PARTITION BY entity key", "orders newest-first with a deterministic tie-breaker", "explains why MAX(timestamp) alone may not return one complete row"],
    strongAnswerSignalsUk: ["використовує ROW_NUMBER з PARTITION BY ключа сутності", "сортує від найновіших із детермінованим tie-breaker", "пояснює, чому MAX(timestamp) сам по собі не повертає один повний row"],
    exampleUk: "Для кожного customer потрібно повернути останній order з id, status, amount і timestamp навіть тоді, коли два orders мають однаковий зафіксований час.",
    tags: ["sql", "window-functions", "latest-row", "ranking"],
    codeTitleUk: "Останній row для кожної сутності",
    codeExplanationUk: "PARTITION BY починає ranking заново для кожної сутності. Найновіший row отримує rn = 1, а secondary key детерміновано розв'язує однакові timestamps.",
    expectedResult: "Exactly one newest row per entity that has data.",
    expectedResultUk: "Рівно один найновіший row для кожної сутності, яка має дані."
  },
  {
    taskId: "task-second-highest",
    id: "sql-second-highest-distinct-value",
    level: "Junior",
    question: "Write SQL to return the second-highest distinct salary, score, or amount.",
    questionUk: "Напишіть SQL, який повертає друге за величиною унікальне значення salary, score або amount.",
    shortAnswer: "Rank values in descending order with DENSE_RANK and select rank two. DENSE_RANK is appropriate when equal values represent the same distinct position. A MAX value below the overall MAX is another compact solution for exactly the second distinct value, but ranking generalizes more naturally.",
    shortAnswerUk: "Присвойте values ранги за спаданням через DENSE_RANK і виберіть rank = 2. DENSE_RANK підходить, коли однакові values займають одну й ту саму позицію. Для саме другого унікального value також можна взяти MAX, менший за загальний MAX, але ranking легше узагальнити.",
    strongAnswerSignals: ["treats equal values as the same rank", "uses DENSE_RANK or a correct nested MAX solution", "distinguishes distinct-value ranking from row numbering"],
    strongAnswerSignalsUk: ["трактує однакові values як один rank", "використовує DENSE_RANK або коректний nested MAX", "розрізняє ranking унікальних values і нумерацію rows"],
    exampleUk: "Таблиця employees містить salaries 5000, 5000, 4500 і 4000. Очікуване друге за величиною унікальне значення — 4500, а не ще одна копія 5000.",
    tags: ["sql", "ranking", "window-functions", "aggregation"],
    codeTitleUk: "Друге за величиною унікальне value",
    codeExplanationUk: "DENSE_RANK надає однаковим values той самий rank і не залишає gaps між різними values, тому rank = 2 означає саме друге distinct value.",
    expectedResult: "The second-highest distinct value when it exists.",
    expectedResultUk: "Друге за величиною distinct value, якщо воно існує."
  },
  {
    taskId: "task-top-n-per-group",
    id: "sql-top-n-per-group",
    level: "Middle",
    question: "Write SQL to return the top N rows inside each category, team, or customer group.",
    questionUk: "Напишіть SQL, який повертає Top N rows у кожній категорії, команді або customer group.",
    shortAnswer: "Use a ranking window function partitioned by the group key and ordered by the metric, then filter the generated rank in an outer query. ROW_NUMBER returns exactly N rows per group, while RANK or DENSE_RANK can include additional tied rows depending on the business rule.",
    shortAnswerUk: "Використайте ranking window function з PARTITION BY ключа group та ORDER BY потрібної metric, а потім відфільтруйте rank у зовнішньому query. ROW_NUMBER поверне рівно N rows на group, тоді як RANK або DENSE_RANK можуть включити додаткові rows при ties — залежно від business rule.",
    strongAnswerSignals: ["partitions ranking by group", "chooses ROW_NUMBER versus RANK or DENSE_RANK deliberately", "uses deterministic ordering when an exact row count is required"],
    strongAnswerSignalsUk: ["розбиває ranking за group через PARTITION BY", "усвідомлено обирає ROW_NUMBER проти RANK або DENSE_RANK", "використовує детерміноване sorting, коли потрібна точна кількість rows"],
    exampleUk: "Повернути три products з найбільшим revenue у кожній category. Якщо третє місце ділить кілька products, потрібно уточнити, чи мають усі ties потрапити в result.",
    tags: ["sql", "top-n", "window-functions", "ranking"],
    codeTitleUk: "Top N усередині кожної group",
    codeExplanationUk: "Window ranking створює незалежну послідовність для кожної group. ROW_NUMBER дає точну кількість rows, а RANK/DENSE_RANK потрібні, коли ties мають залишатися разом.",
    expectedResult: "Up to N rows per group, or more when the chosen rank function intentionally includes ties.",
    expectedResultUk: "До N rows на group або більше, якщо обрана rank function навмисно включає ties."
  },
  {
    taskId: "task-missing-related-rows",
    id: "sql-find-entities-without-related-rows",
    level: "Junior",
    question: "Write SQL to find parent entities that have no related child rows.",
    questionUk: "Напишіть SQL, який знаходить parent entities без жодного пов'язаного child row.",
    shortAnswer: "Use NOT EXISTS with a correlated subquery or a LEFT JOIN followed by a NULL check on a non-nullable child key. NOT EXISTS is often the clearest anti-join pattern and avoids the NULL semantics trap that can make NOT IN unexpectedly return no rows.",
    shortAnswerUk: "Використайте NOT EXISTS з correlated subquery або LEFT JOIN із перевіркою NULL у non-nullable child key. NOT EXISTS часто є найзрозумілішим anti-join pattern і не має NULL trap, через яку NOT IN може несподівано повернути порожній result.",
    strongAnswerSignals: ["uses NOT EXISTS or a correct LEFT JOIN anti-join", "avoids unsafe NOT IN behavior when NULL may occur", "checks a non-nullable joined child key in the LEFT JOIN form"],
    strongAnswerSignalsUk: ["використовує NOT EXISTS або коректний LEFT JOIN anti-join", "уникає небезпечної поведінки NOT IN, коли можливий NULL", "у LEFT JOIN перевіряє non-nullable child key"],
    exampleUk: "Знайти customers, які ніколи не створювали orders. Це відрізняється від orphan search, бо query починається з parent table і перевіряє відсутність children.",
    tags: ["sql", "joins", "not-exists", "relationships"],
    codeTitleUk: "Parent rows без related children",
    codeExplanationUk: "Correlated subquery шукає хоча б один matching child для кожного parent. NOT EXISTS залишає лише parent rows, для яких match відсутній.",
    expectedResult: "Every parent row with zero matching child rows.",
    expectedResultUk: "Кожен parent row із нульовою кількістю matching child rows."
  },
  {
    taskId: "task-compare-expected-actual",
    id: "sql-compare-expected-actual-datasets",
    level: "Middle",
    question: "How would you write SQL to compare an expected dataset with an actual dataset and show differences?",
    questionUk: "Як написати SQL для порівняння expected dataset з actual dataset і показати відмінності?",
    shortAnswer: "Compare both directions, because expected EXCEPT actual detects missing or changed rows while actual EXCEPT expected detects unexpected rows. EXCEPT uses set semantics in many databases, so duplicate multiplicity may need an additional grouped comparison. Engines without EXCEPT can use joins or NOT EXISTS.",
    shortAnswerUk: "Порівнюйте в обох напрямках: expected EXCEPT actual знаходить missing або changed rows, а actual EXCEPT expected — unexpected rows. У багатьох СУБД EXCEPT має set semantics, тому multiplicity дублікатів потрібно перевіряти окремо. СУБД без EXCEPT можуть використовувати JOIN або NOT EXISTS.",
    strongAnswerSignals: ["compares expected-to-actual and actual-to-expected directions", "recognizes distinct-set behavior and duplicate-count limitations", "adapts the comparison for database dialect and NULL semantics"],
    strongAnswerSignalsUk: ["порівнює expected→actual і actual→expected", "розуміє set semantics та обмеження duplicate counts", "адаптує comparison до dialect і NULL semantics"],
    exampleUk: "QA data test має tables expected і actual з id, status та amount. Result повинен показати як records, яких бракує в actual, так і records, що з'явилися там неочікувано.",
    tags: ["sql", "data-quality", "except", "reconciliation"],
    codeTitleUk: "Порівняти expected та actual data",
    codeExplanationUk: "EXCEPT знаходить rows із лівого result set, яких немає у правому. Для повного diff потрібно виконати comparison в обох напрямках; duplicate multiplicity перевіряється окремо.",
    expectedResult: "Zero differences when expected and actual distinct datasets match.",
    expectedResultUk: "Нуль differences, коли expected та actual distinct datasets збігаються."
  },
  {
    taskId: "task-running-total",
    id: "sql-running-total",
    level: "Middle",
    question: "Write SQL to calculate a running total without collapsing the original rows.",
    questionUk: "Напишіть SQL для розрахунку running total без згортання початкових rows.",
    shortAnswer: "Use SUM as a window aggregate with PARTITION BY when totals restart per entity and ORDER BY in the event sequence. Specify an explicit ROWS frame and deterministic ordering when multiple rows can share the same timestamp, otherwise peer rows may make cumulative results surprising.",
    shortAnswerUk: "Використайте SUM як window aggregate з PARTITION BY, якщо total починається заново для кожної entity, та ORDER BY у послідовності events. Вкажіть явний ROWS frame і детерміноване sorting, коли кілька rows можуть мати однаковий timestamp, інакше peer rows можуть дати неочікуваний cumulative result.",
    strongAnswerSignals: ["uses SUM as a window function rather than GROUP BY", "defines partition and deterministic event order", "understands the effect of the window frame"],
    strongAnswerSignalsUk: ["використовує SUM як window function, а не GROUP BY", "визначає partition і детермінований порядок events", "розуміє вплив window frame"],
    exampleUk: "Для кожного ledger row показати amount і balance, накопичений до цієї конкретної event, при цьому не втрачати жодну transaction з output.",
    tags: ["sql", "window-functions", "running-total", "aggregation"],
    codeTitleUk: "Running total для кожного row",
    codeExplanationUk: "SUM працює по ordered window від першого row partition до current row. Явний ROWS frame усуває сюрпризи peer-group, коли кілька rows мають однаковий sort value.",
    expectedResult: "Every source row plus its cumulative total at that point.",
    expectedResultUk: "Кожен source row разом із cumulative total на цей момент."
  },
  {
    taskId: "task-compare-previous-row",
    id: "sql-compare-previous-row",
    level: "Middle",
    question: "Write SQL to detect when a value changed compared with the previous event for the same entity.",
    questionUk: "Напишіть SQL, який знаходить зміну value порівняно з попередньою event тієї самої entity.",
    shortAnswer: "Use LAG to expose the previous value inside a partition ordered by event time and a stable tie-breaker, then compare the current value with that previous value in an outer query. Handle the first row and NULL as explicit business cases because a missing previous row and a genuine NULL can otherwise look identical.",
    shortAnswerUk: "Використайте LAG, щоб отримати previous value всередині partition, впорядкованого за event time та стабільним tie-breaker, а потім порівняйте current і previous values у зовнішньому query. First row і NULL потрібно трактувати явно, бо відсутність previous row та реальний NULL інакше можуть виглядати однаково.",
    strongAnswerSignals: ["uses LAG with the correct partition and order", "filters the computed previous value outside the window expression", "handles first-row and NULL semantics deliberately"],
    strongAnswerSignalsUk: ["використовує LAG з правильними partition і order", "фільтрує computed previous value поза window expression", "явно обробляє first row і NULL semantics"],
    exampleUk: "Маючи history статусів order, потрібно повернути лише events, де status справді змінився порівняно з безпосередньо попередньою event цього order.",
    tags: ["sql", "lag", "window-functions", "change-detection"],
    codeTitleUk: "Порівняти row з попереднім",
    codeExplanationUk: "LAG читає value з попереднього row у визначеному partition/order без self-join. First row повертає NULL, тому цей case потрібно відрізняти від business NULL.",
    expectedResult: "Only rows where the tracked value changed from the immediately preceding row.",
    expectedResultUk: "Лише rows, у яких tracked value змінився відносно безпосередньо попереднього row."
  },
  {
    taskId: "task-find-sequence-gaps",
    id: "sql-find-sequence-gaps",
    level: "Middle",
    question: "Write SQL to find gaps in an expected numeric sequence such as invoice numbers or event versions.",
    questionUk: "Напишіть SQL для пошуку gaps в очікуваній numeric sequence, наприклад invoice number або event version.",
    shortAnswer: "Order the sequence and use LAG to compare each value with its predecessor. When the current value is greater than previous + 1, the missing interval starts at previous + 1 and ends at current - 1. First confirm that continuity is actually a business invariant because many generated identifiers may legally have gaps.",
    shortAnswerUk: "Впорядкуйте sequence і використайте LAG, щоб порівняти кожне value з previous. Якщо current value більше за previous + 1, missing interval починається з previous + 1 і закінчується current - 1. Спочатку підтвердьте, що continuity справді є business invariant, бо багато generated identifiers законно можуть мати gaps.",
    strongAnswerSignals: ["uses ordered LAG or an equivalent gap-detection technique", "returns the missing interval rather than only flagging a row", "checks whether sequence continuity is a real requirement"],
    strongAnswerSignalsUk: ["використовує ordered LAG або еквівалентний gap-detection technique", "повертає missing interval, а не лише flag row", "перевіряє, чи sequence continuity є реальною requirement"],
    exampleUk: "Versions 101, 102, 105 і 106 означають, що 103–104 відсутні. Query має повернути missing range без генерації окремого row для кожного номера.",
    tags: ["sql", "lag", "sequence", "data-quality"],
    codeTitleUk: "Знайти gaps у sequence",
    codeExplanationUk: "Кожен sequence value порівнюється з predecessor. Різниця більше одиниці означає gap, а арифметика previous + 1 / current - 1 повертає його межі.",
    expectedResult: "One row per missing numeric interval.",
    expectedResultUk: "Один row для кожного missing numeric interval."
  },
  {
    taskId: "task-conditional-aggregation",
    id: "sql-conditional-aggregation",
    level: "Junior",
    question: "Write one SQL query that calculates several conditional counts such as passed, failed, and error results.",
    questionUk: "Напишіть один SQL query, який рахує кілька conditional counts, наприклад passed, failed та error.",
    shortAnswer: "Use conditional aggregation: turn each condition into 1 or 0 with CASE and then SUM those values, optionally grouping by build, suite, day or another dimension. This avoids separate queries for every status and makes it easy to reconcile the subtotal counts against the overall row count.",
    shortAnswerUk: "Використайте conditional aggregation: перетворіть кожну condition на 1 або 0 через CASE і підсумуйте values, за потреби додавши GROUP BY за build, suite, day чи іншою dimension. Це усуває окремі queries для кожного status і дозволяє звірити subtotal counts із загальною кількістю rows.",
    strongAnswerSignals: ["uses SUM with CASE or a dialect-equivalent filtered aggregate", "can add GROUP BY for per-build or per-team metrics", "reconciles conditional totals with the total population"],
    strongAnswerSignalsUk: ["використовує SUM з CASE або equivalent filtered aggregate", "може додати GROUP BY для metrics по build чи team", "звіряє conditional totals із загальною population"],
    exampleUk: "Table test_results містить один row на executed test. Потрібно отримати passed, failed та error counts для кожного build одним query.",
    tags: ["sql", "aggregation", "case", "qa-metrics"],
    codeTitleUk: "Кілька conditional counts одним query",
    codeExplanationUk: "Кожен CASE повертає 1 лише для matching rows, а SUM рахує їх. GROUP BY дозволяє повторити ті самі calculations незалежно для кожного build або іншої group.",
    expectedResult: "One row per group with total and per-condition counts.",
    expectedResultUk: "Один row на group із total та counts по кожній condition."
  },
  {
    taskId: "task-detect-join-multiplication",
    id: "sql-detect-join-multiplication",
    level: "Middle",
    question: "How would you use SQL to detect that a JOIN unexpectedly multiplied parent rows?",
    questionUk: "Як за допомогою SQL виявити, що JOIN неочікувано розмножив parent rows?",
    shortAnswer: "Compare the parent population before and after the join at the intended grain, and group the joined result by the parent primary key to find keys that appear more than once. Typical causes are a legitimate one-to-many relationship, an incomplete join predicate, duplicated dimension rows or joining at the wrong grain; DISTINCT may hide the symptom without fixing the logic.",
    shortAnswerUk: "Порівняйте parent population до та після JOIN на потрібному grain і згрупуйте joined result за parent primary key, щоб знайти keys, які з'явилися більше одного разу. Типові causes — legitimate one-to-many relationship, неповний join predicate, duplicated dimension rows або неправильний grain; DISTINCT може приховати symptom, але не виправляє logic.",
    strongAnswerSignals: ["checks row counts and parent-key multiplicity before and after the join", "distinguishes one-to-many behavior from an incomplete join condition", "does not use DISTINCT as the default repair"],
    strongAnswerSignalsUk: ["перевіряє row counts і parent-key multiplicity до та після JOIN", "відрізняє one-to-many behavior від неповного join condition", "не використовує DISTINCT як стандартний repair"],
    exampleUk: "Dashboard total подвоюється після JOIN orders з customer_addresses, бо деякі customers мають кілька address rows. Diagnostic query має показати, які orders були multiplied.",
    tags: ["sql", "joins", "cardinality", "data-quality"],
    codeTitleUk: "Знайти rows, розмножені JOIN",
    codeExplanationUk: "На expected grain має бути один output row на parent. GROUP BY parent key після JOIN показує keys із count > 1, які можуть завищувати SUM або COUNT.",
    expectedResult: "Parent keys whose joined cardinality is greater than one.",
    expectedResultUk: "Parent keys, для яких joined cardinality більша за один."
  },
  {
    taskId: "task-keyset-pagination",
    id: "sql-keyset-pagination",
    level: "Middle",
    question: "Write a stable next-page SQL query without relying on a large OFFSET.",
    questionUk: "Напишіть стабільний next-page SQL query без використання великого OFFSET.",
    shortAnswer: "Use keyset pagination: order by a stable unique tuple and request rows after the last tuple returned by the previous page. This avoids scanning an ever-growing offset and prevents many duplicate or skipped rows when new records are inserted between page requests. The ordering must be deterministic, usually timestamp plus primary key.",
    shortAnswerUk: "Використайте keyset pagination: sort за стабільним unique tuple і запитуйте rows після останнього tuple попередньої page. Це не потребує сканувати дедалі більший OFFSET і зменшує duplicate або skipped rows, коли між page requests додаються нові records. Ordering має бути детермінованим, зазвичай timestamp плюс primary key.",
    strongAnswerSignals: ["uses the last seen ordering key instead of OFFSET", "uses a unique deterministic ordering tuple", "explains stability and performance benefits under changing data"],
    strongAnswerSignalsUk: ["використовує last seen ordering key замість OFFSET", "використовує unique deterministic ordering tuple", "пояснює stability і performance benefits при changing data"],
    exampleUk: "Events sort by created_at DESC. Оскільки кілька events можуть мати однаковий timestamp, cursor має включати id як secondary key, щоб pages були stable.",
    tags: ["sql", "pagination", "performance", "ordering"],
    codeTitleUk: "Stable next page через keyset pagination",
    codeExplanationUk: "Previous page передає last seen sort tuple. WHERE використовує той самий tuple, що й ORDER BY, тому next page починається строго після останнього вже показаного row.",
    expectedResult: "The next bounded page after the supplied cursor in deterministic order.",
    expectedResultUk: "Наступна bounded page після переданого cursor у детермінованому order."
  },
  {
    taskId: "task-percent-of-total",
    id: "sql-percent-of-total",
    level: "Middle",
    question: "Write SQL to calculate each group's percentage of the overall total.",
    questionUk: "Напишіть SQL для розрахунку percentage кожної group від overall total.",
    shortAnswer: "Aggregate to the required group grain first, then divide each group total by a window SUM over the aggregated rows. Cast or multiply by a decimal value when the database would otherwise perform integer division, and define how zero totals and NULL amounts should be handled.",
    shortAnswerUk: "Спочатку aggregate data до потрібного group grain, а потім поділіть total кожної group на window SUM по aggregated rows. Використайте cast або decimal multiplier, якщо database інакше виконає integer division, і визначте behavior для zero total та NULL amounts.",
    strongAnswerSignals: ["aggregates to the intended grain before calculating the share", "uses a window total rather than a second independent query", "handles numeric type, zero-denominator and NULL behavior"],
    strongAnswerSignalsUk: ["спочатку агрегує до intended grain", "використовує window total замість другого independent query", "обробляє numeric type, zero denominator і NULL behavior"],
    exampleUk: "Revenue report має показати один row на product category, її revenue та percentage, який category становить від overall revenue за selected period.",
    tags: ["sql", "aggregation", "window-functions", "percentage"],
    codeTitleUk: "Percentage group від overall total",
    codeExplanationUk: "Спочатку query створює one row per group, після чого window SUM обчислює grand total по цих grouped rows. Decimal arithmetic і NULLIF захищають від integer division та division by zero.",
    expectedResult: "One row per group with its aggregate and share of the grand total.",
    expectedResultUk: "Один row на group з aggregate та її share від grand total."
  }
];

const questions = practicalMeta.map((meta) => {
  const card = taskCards.get(meta.taskId);
  if (!card) throw new Error(`Missing SQL practical task card: ${meta.taskId}`);
  const answer = card.entries[0];
  const reasoning = card.entries[1];
  if (!answer?.detail) throw new Error(`Missing SQL solution for task: ${meta.taskId}`);

  return {
    id: meta.id,
    level: meta.level,
    category: "Databases, SQL and BI",
    kind: "Practical",
    question: meta.question,
    shortAnswer: meta.shortAnswer,
    strongAnswerSignals: meta.strongAnswerSignals,
    questionUk: meta.questionUk,
    shortAnswerUk: meta.shortAnswerUk,
    strongAnswerSignalsUk: meta.strongAnswerSignalsUk,
    example: `${card.summary} ${reasoning?.meaning ?? answer.meaning}`,
    exampleUk: meta.exampleUk,
    tags: meta.tags,
    sourceIds: ["postgres-docs"],
    prevalence: "Common" as const,
    codeExamples: [{
      title: card.title.replace(/^Task · /, "Solution · "),
      titleUk: meta.codeTitleUk,
      language: "sql" as const,
      code: answer.detail,
      explanation: [answer.meaning, reasoning?.meaning].filter(Boolean).join(" "),
      explanationUk: meta.codeExplanationUk,
      expectedResult: meta.expectedResult,
      expectedResultUk: meta.expectedResultUk,
    }]
  };
});

export default { questions };
