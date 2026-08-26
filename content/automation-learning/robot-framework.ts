export const robotFrameworkModule = {
  id: "robot-framework",
  label: "Robot Framework",
  labelUk: "Robot Framework",
  level: "Intermediate",
  description: "Keyword-driven automation with Robot Framework: core syntax, reusable resources, Browser and Requests libraries, Python extensions, reporting and CI.",
  descriptionUk: "Keyword-driven автоматизація з Robot Framework: базовий синтаксис, reusable resources, бібліотеки Browser і Requests, Python-розширення, звітність та CI.",
  sourceIds: [
    "robot-framework-user-guide",
    "robot-framework-guides",
    "robot-framework-browser",
    "robot-framework-requests",
    "robot-framework-python-library",
    "robot-framework-ci",
  ],
};

export const robotFrameworkSources = [
  {
    id: "robot-framework-user-guide",
    title: "Robot Framework User Guide",
    url: "https://robotframework.org/robotframework/latest/RobotFrameworkUserGuide.html",
    publisher: "Robot Framework Foundation",
    kind: "Official documentation",
    role: "Core syntax, suites, keywords, variables, tags, execution and output files",
  },
  {
    id: "robot-framework-guides",
    title: "Robot Framework Guides",
    url: "https://docs.robotframework.org/docs",
    publisher: "Robot Framework Foundation",
    kind: "Official guides",
    role: "Getting started, project structure, libraries, examples, Docker and CI guidance",
  },
  {
    id: "robot-framework-browser",
    title: "Robot Framework Browser",
    url: "https://robotframework-browser.org/docs/",
    publisher: "Robot Framework Browser contributors",
    kind: "Official documentation",
    role: "Playwright-backed web automation, browser/context/page lifecycle, locators, assertions and waiting",
  },
  {
    id: "robot-framework-requests",
    title: "Robot Framework RequestsLibrary",
    url: "https://docs.robotframework.org/docs/different_libraries/requests",
    publisher: "Robot Framework Foundation",
    kind: "Official guide",
    role: "HTTP API testing through RequestsLibrary",
  },
  {
    id: "robot-framework-python-library",
    title: "Robot Framework Python libraries",
    url: "https://docs.robotframework.org/docs/extending_robot_framework/custom-libraries/python_library",
    publisher: "Robot Framework Foundation",
    kind: "Official guide",
    role: "Creating custom Robot Framework keywords and libraries in Python",
  },
  {
    id: "robot-framework-ci",
    title: "Robot Framework in GitHub Actions",
    url: "https://docs.robotframework.org/docs/using_rf_in_ci_systems/ci/github-actions",
    publisher: "Robot Framework Foundation",
    kind: "Official guide",
    role: "Running Robot Framework in CI and preserving reports as workflow artifacts",
  },
];

export const robotFrameworkLessons = [
  {
    id: "ta-lesson-robot-framework-core",
    moduleId: "robot-framework",
    level: "Intermediate",
    order: 44,
    title: "Robot Framework mental model and first suite",
    titleUk: "Ментальна модель Robot Framework і перший suite",
    summary: "Treat Robot Framework as a readable orchestration layer: tests call keywords, while libraries and resources contain implementation details.",
    summaryUk: "Сприймайте Robot Framework як читабельний orchestration layer: тести викликають keywords, а libraries і resources містять деталі реалізації.",
    concept: "Robot Framework is a keyword-driven automation framework. A `.robot` file describes suites and test cases in a tabular text format; each test is a sequence of keyword calls. Keywords may come from Robot Framework itself, installed libraries such as Browser or RequestsLibrary, reusable resource files, or your own Python libraries. The useful mental model is test case -> user keyword -> library keyword -> system under test. Keep the test case focused on intent. When it starts filling with selectors, HTTP plumbing or complex branching, move that behavior down into a resource keyword or Python library. Install Robot Framework inside the same virtual environment as the rest of the automation project and use the `robot` command to execute a suite or directory.",
    conceptUk: "Robot Framework — keyword-driven framework для автоматизації. Файл `.robot` описує suites і test cases у табличному текстовому форматі; кожен тест є послідовністю викликів keywords. Keywords можуть надходити із самого Robot Framework, встановлених libraries на кшталт Browser або RequestsLibrary, reusable resource-файлів або ваших Python libraries. Корисна ментальна модель: test case -> user keyword -> library keyword -> system under test. Test case має залишатися на рівні наміру. Коли в ньому з'являються selectors, HTTP plumbing або складний branching, переносіть це нижче — у resource keyword або Python library. Встановлюйте Robot Framework у тому самому virtual environment, що й інші залежності automation-проєкту, і запускайте suites командою `robot`.",
    keyPoints: [
      "`.robot` files orchestrate keywords and should express test intent rather than implementation mechanics",
      "Libraries provide technical keywords; resources and custom libraries provide the project's domain vocabulary",
      "Run `robot` from the virtual environment that owns the project's dependencies",
    ],
    keyPointsUk: [
      "`.robot` файли оркеструють keywords і мають виражати намір тесту, а не механіку реалізації",
      "Libraries дають технічні keywords; resources і custom libraries формують доменний словник проєкту",
      "Запускайте `robot` із virtual environment, де встановлені залежності проєкту",
    ],
    code: `*** Settings ***
Documentation    Checkout smoke coverage

*** Test Cases ***
Guest can open checkout
    Log    Starting checkout smoke test
    Should Be Equal    \${ENV}    staging`,
    codeCaption: "A minimal suite is readable because the test case is a list of keyword calls rather than low-level implementation code.",
    codeCaptionUk: "Мінімальний suite читається легко, бо test case є списком keyword calls, а не низькорівневим implementation code.",
    pitfalls: [
      "Writing long procedural scripts directly inside test cases, which defeats the readability and reuse Robot Framework is good at",
    ],
    pitfallsUk: [
      "Писати довгі процедурні сценарії прямо всередині test cases, втрачаючи читабельність і повторне використання Robot Framework",
    ],
    exercise: "Create a suite with two test cases and one user keyword. Run the whole directory, then run only that suite from the command line.",
    exerciseUk: "Створіть suite з двома test cases і одним user keyword. Запустіть увесь каталог, а потім лише цей suite з командного рядка.",
    tags: ["robot-framework", "keywords", "test-automation"],
    sourceIds: ["robot-framework-user-guide", "robot-framework-guides"],
  },
  {
    id: "ta-lesson-robot-framework-resources",
    moduleId: "robot-framework",
    level: "Intermediate",
    order: 45,
    title: "Variables, resources and maintainable keywords",
    titleUk: "Variables, resources та підтримувані keywords",
    summary: "Keep variable scope narrow and build a domain vocabulary in `.resource` files so suites express intent instead of mechanics.",
    summaryUk: "Тримайте variable scope вузьким і будуйте доменний словник у `.resource` файлах, щоб suites виражали намір, а не механіку.",
    concept: "Robot Framework supports scalar (`${NAME}`), list (`@{ITEMS}`) and dictionary (`&{USER}`) variables. Variables can come from variable sections, return values, keyword arguments, the `VAR` statement, variable files or command-line options. The important design choice is scope: prefer explicit arguments and return values over suite/global state, because hidden shared state creates order dependence and makes parallel execution harder. Resource files are the main mechanism for sharing user keywords and variables between suites. Organize them by domain or responsibility instead of collecting everything in one `common.resource`. A user keyword earns its place when it captures domain intent, hides volatile technical details, or coordinates several lower-level operations into one stable action.",
    conceptUk: "Robot Framework підтримує scalar (`${NAME}`), list (`@{ITEMS}`) і dictionary (`&{USER}`) variables. Variables можуть надходити із variable sections, return values, аргументів keywords, statement `VAR`, variable files або параметрів командного рядка. Головне архітектурне рішення — scope: віддавайте перевагу явним аргументам і return values замість suite/global state, бо прихований shared state створює залежність від порядку й ускладнює parallel execution. Resource-файли — основний механізм спільного використання user keywords і variables між suites. Організовуйте їх за доменом або відповідальністю замість складання всього в один `common.resource`. User keyword виправданий, коли він фіксує доменний намір, приховує мінливі технічні деталі або координує кілька нижчих операцій у стабільну дію.",
    keyPoints: [
      "Prefer explicit keyword arguments and return values over broad suite/global variable scope",
      "Use `.resource` files for reusable keywords and variables; keep test cases in suite files",
      "Organize resources by domain and create keywords around intent, not one-to-one aliases for library calls",
    ],
    keyPointsUk: [
      "Віддавайте перевагу явним аргументам keywords і return values замість широкого suite/global variable scope",
      "Використовуйте `.resource` файли для reusable keywords і variables, а test cases залишайте у suite-файлах",
      "Організовуйте resources за доменом і створюйте keywords навколо наміру, а не aliases один-в-один для library calls",
    ],
    code: `# resources/auth.resource
*** Settings ***
Library    Browser

*** Keywords ***
User Logs In
    [Arguments]    \${email}    \${password}
    Fill Text    [data-testid="email"]       \${email}
    Fill Text    [data-testid="password"]    \${password}
    Click        [data-testid="sign-in"]`,
    codeCaption: "Resource files keep volatile automation mechanics below the business-readable test layer.",
    codeCaptionUk: "Resource-файли тримають мінливу automation-механіку нижче business-readable тестового рівня.",
    pitfalls: [
      "Using suite variables as a hidden communication channel between tests or creating one giant common resource file",
    ],
    pitfallsUk: [
      "Використовувати suite variables як прихований канал між тестами або створювати один гігантський common resource file",
    ],
    exercise: "Move five reusable keywords from a suite into domain-focused resource files and replace hidden suite state with explicit arguments where possible.",
    exerciseUk: "Винесіть п'ять reusable keywords із suite у domain-focused resource-файли й замініть прихований suite state явними аргументами, де це можливо.",
    tags: ["robot-framework", "resources", "variables", "architecture"],
    sourceIds: ["robot-framework-user-guide", "robot-framework-guides"],
  },
  {
    id: "ta-lesson-robot-framework-libraries",
    moduleId: "robot-framework",
    level: "Intermediate",
    order: 46,
    title: "Browser and API automation libraries",
    titleUk: "Browser та API automation libraries",
    summary: "Use Browser Library for Playwright-backed web automation and RequestsLibrary for service-level HTTP checks; choose the cheapest layer for each risk.",
    summaryUk: "Використовуйте Browser Library для Playwright-backed web-автоматизації, а RequestsLibrary — для service-level HTTP перевірок; обирайте найдешевший рівень для кожного ризику.",
    concept: "Robot Framework Browser drives Playwright and gives Robot suites a modern Chromium, Firefox and WebKit automation model. Prefer role, text and stable test-id locators over brittle CSS tied to presentation, and rely on Browser's waiting/assertion behavior instead of arbitrary sleeps. Use browser contexts for session isolation. For HTTP APIs, RequestsLibrary wraps Python Requests and is appropriate for direct service-level checks, setup/cleanup helpers and hybrid flows where the API prepares state and the UI verifies the user-facing result. Keep repeated authentication, base URLs and payload construction in domain keywords rather than copying raw request mechanics into every test. The layer choice is the same as in any automation framework: verify a rule at the cheapest reliable layer that can actually observe the risk.",
    conceptUk: "Robot Framework Browser керує Playwright і дає Robot suites сучасну модель автоматизації Chromium, Firefox і WebKit. Віддавайте перевагу role, text і стабільним test-id locators замість крихкого CSS, прив'язаного до presentation, і покладайтеся на waiting/assertion behavior Browser замість довільних sleeps. Для session isolation використовуйте browser contexts. Для HTTP API RequestsLibrary обгортає Python Requests і підходить для прямих service-level перевірок, setup/cleanup helpers та hybrid flows, де API готує стан, а UI перевіряє user-facing результат. Повторювані authentication, base URLs і побудову payload тримайте в domain keywords, а не копіюйте raw request mechanics у кожен тест. Вибір рівня такий самий, як у будь-якому automation framework: перевіряйте правило на найдешевшому надійному рівні, який справді бачить відповідний ризик.",
    keyPoints: [
      "Browser Library is Playwright-backed and supports Chromium, Firefox and WebKit",
      "Prefer semantic/test-id locators and built-in waiting over layout-coupled selectors or explicit sleeps",
      "Use RequestsLibrary for direct API verification and cheap API-based setup for UI scenarios",
    ],
    keyPointsUk: [
      "Browser Library базується на Playwright і підтримує Chromium, Firefox та WebKit",
      "Віддавайте перевагу semantic/test-id locators і вбудованому waiting замість layout-coupled selectors або explicit sleeps",
      "Використовуйте RequestsLibrary для прямих API-перевірок і дешевого API-based setup для UI scenarios",
    ],
    code: `*** Settings ***
Library    Browser
Library    RequestsLibrary

*** Test Cases ***
Existing order appears in UI
    \${response}=    GET    https://api.example.test/orders/42    expected_status=200
    New Page    https://example.test/orders/42
    Get Text    role=heading[level=1]    contains    Order 42`,
    codeCaption: "Robot Framework can combine service-level setup or verification with a small UI assertion without forcing the whole scenario through the browser.",
    codeCaptionUk: "Robot Framework може поєднати service-level setup або verification з невеликою UI assertion, не проводячи весь сценарій через browser.",
    pitfalls: [
      "Copying Selenium-era sleeps and fragile DOM-path selectors into Browser Library, or forcing every API rule through the UI",
    ],
    pitfallsUk: [
      "Переносити в Browser Library Selenium-era sleeps і крихкі DOM-path selectors або примушувати кожне API rule проходити через UI",
    ],
    exercise: "Automate one login flow with Browser Library without explicit sleeps, then use RequestsLibrary to prepare one piece of state that the UI test only needs to verify.",
    exerciseUk: "Автоматизуйте один login flow через Browser Library без explicit sleeps, а потім використайте RequestsLibrary для підготовки стану, який UI test має лише перевірити.",
    tags: ["robot-framework", "browser-library", "requestslibrary", "playwright", "api-testing"],
    sourceIds: ["robot-framework-browser", "robot-framework-requests"],
  },
  {
    id: "ta-lesson-robot-framework-python",
    moduleId: "robot-framework",
    level: "Intermediate",
    order: 47,
    title: "Custom Python libraries for complex logic",
    titleUk: "Custom Python libraries для складної логіки",
    summary: "Move computation, integrations and complex control flow into typed Python keywords when Robot syntax stops being the clearest place for the logic.",
    summaryUk: "Переносьте обчислення, integrations і складний control flow у типізовані Python keywords, коли Robot syntax перестає бути найзрозумілішим місцем для цієї логіки.",
    concept: "Robot Framework is extensible through Python libraries. This is the escape hatch that keeps keyword-driven tests from becoming a maze of nested `IF`, loops and data transformations. Use Robot syntax for orchestration and business-readable flows; use Python for parsing, non-trivial algorithms, external SDKs, richer types and reusable integration code. A static library can be a Python module or class, and decorators such as `@keyword` control what is exposed to Robot Framework. Keep custom libraries cohesive and unit-test their complex Python logic directly. Do not hide every assertion inside helper code: the test should still make the important verification intent visible unless the custom keyword itself represents a deliberate domain assertion.",
    conceptUk: "Robot Framework розширюється через Python libraries. Це escape hatch, який не дає keyword-driven тестам перетворитися на лабіринт із вкладених `IF`, loops і data transformations. Використовуйте Robot syntax для orchestration і business-readable flows; Python — для parsing, нетривіальних algorithms, зовнішніх SDK, багатших types і reusable integration code. Static library може бути Python module або class, а decorators на кшталт `@keyword` контролюють, що саме експонується в Robot Framework. Тримайте custom libraries зв'язними й тестуйте їх складну Python-логіку прямими unit tests. Не ховайте кожну assertion всередині helper code: важливий verification intent має залишатися видимим у тесті, якщо custom keyword сам по собі не є свідомою domain assertion.",
    keyPoints: [
      "Use Python for logic that becomes awkward or opaque in Robot syntax; keep Robot files focused on orchestration",
      "Custom libraries can be modules or classes and can expose controlled keyword names with decorators",
      "Unit-test complex Python library code directly instead of relying only on end-to-end Robot execution",
    ],
    keyPointsUk: [
      "Використовуйте Python для логіки, яка стає незручною або непрозорою в Robot syntax; Robot-файли залишайте для orchestration",
      "Custom libraries можуть бути modules або classes та експонувати контрольовані keyword names через decorators",
      "Складний Python library code тестуйте напряму unit tests, а не покладайтеся лише на end-to-end Robot execution",
    ],
    code: `from robot.api.deco import keyword

class OrderLibrary:
    @keyword("Calculate Expected Total")
    def calculate_expected_total(self, prices: list[float]) -> float:
        return round(sum(prices), 2)`,
    codeCaption: "A small Python library keeps calculation and integration code out of Robot syntax while exposing a readable domain keyword.",
    codeCaptionUk: "Невелика Python library виносить calculation та integration code з Robot syntax, але експонує читабельний domain keyword.",
    pitfalls: [
      "Implementing large algorithms in Robot syntax just because the framework technically supports loops and conditionals",
    ],
    pitfallsUk: [
      "Реалізовувати великі algorithms у Robot syntax лише тому, що framework технічно підтримує loops і conditionals",
    ],
    exercise: "Pick one keyword with heavy parsing or branching, move its implementation to a Python library, and add a direct Python unit test for the extracted logic.",
    exerciseUk: "Візьміть один keyword із важким parsing або branching, перенесіть реалізацію в Python library і додайте прямий Python unit test для винесеної логіки.",
    tags: ["robot-framework", "python", "custom-library"],
    sourceIds: ["robot-framework-python-library", "robot-framework-guides"],
  },
  {
    id: "ta-lesson-robot-framework-ci",
    moduleId: "robot-framework",
    level: "Intermediate",
    order: 48,
    title: "Tags, execution artifacts and CI",
    titleUk: "Tags, execution artifacts та CI",
    summary: "Use tags to select meaningful suites, preserve Robot's machine-readable and HTML outputs as CI artifacts, and make failures diagnosable from the original run.",
    summaryUk: "Використовуйте tags для осмисленого selection, зберігайте machine-readable та HTML outputs Robot Framework як CI artifacts і робіть failures діагностованими з оригінального run.",
    concept: "Robot Framework supports selection by suite, test name and tags. Use tags for meaningful execution groups such as `smoke`, `regression`, `api` or `critical`, not as decorative metadata. A merge gate should run a small high-signal set while broader regression can run on schedule or before release. By default Robot Framework produces `output.xml`, `log.html` and `report.html`: the XML is the machine-readable execution record, the log is the detailed keyword-level investigation view, and the report is the high-level summary. Preserve these from CI so a failed job can be investigated without immediately rerunning it. Reruns can be useful diagnostically, but a pipeline that silently reruns failures until they turn green hides flakiness and destroys trust.",
    conceptUk: "Robot Framework підтримує selection за suite, test name і tags. Використовуйте tags для осмислених execution groups на кшталт `smoke`, `regression`, `api` або `critical`, а не як декоративну metadata. Merge gate має запускати невеликий high-signal набір, а ширший regression можна виконувати за розкладом або перед release. За замовчуванням Robot Framework створює `output.xml`, `log.html` і `report.html`: XML є machine-readable execution record, log — детальним keyword-level view для розслідування, report — high-level summary. Зберігайте їх із CI, щоб failed job можна було аналізувати без негайного rerun. Reruns корисні для діагностики, але pipeline, який мовчки перезапускає failures, доки вони не стануть green, приховує flakiness і руйнує довіру.",
    keyPoints: [
      "Use tags as execution semantics such as smoke/regression/API rather than decorative metadata",
      "Keep `output.xml`, `log.html` and `report.html` as CI artifacts so failures can be diagnosed from the original run",
      "Separate a fast merge gate from broader scheduled coverage and treat repeated reruns as a flakiness signal",
    ],
    keyPointsUk: [
      "Використовуйте tags як execution semantics — smoke/regression/API — а не як декоративну metadata",
      "Зберігайте `output.xml`, `log.html` і `report.html` як CI artifacts, щоб аналізувати failures з оригінального run",
      "Відокремлюйте швидкий merge gate від ширшого scheduled coverage і сприймайте повторні reruns як сигнал flakiness",
    ],
    code: `robot --include smoke --outputdir results tests/
robot --exclude slow --outputdir results tests/
rebot results/output.xml`,
    codeCaption: "Keep the original result bundle; it is more useful for diagnosis than a rerun that changes the evidence.",
    codeCaptionUk: "Зберігайте original result bundle: для діагностики він корисніший за rerun, який змінює evidence.",
    pitfalls: [
      "Automatically rerunning every failed test until the build turns green, which hides non-determinism instead of fixing it",
    ],
    pitfallsUk: [
      "Автоматично перезапускати кожен failed test, доки build не стане green, приховуючи nondeterminism замість його виправлення",
    ],
    exercise: "Add `smoke` and `regression` tags to a sample suite, run each selection separately, and configure CI to preserve the complete Robot results directory even on failure.",
    exerciseUk: "Додайте tags `smoke` і `regression` до sample suite, запустіть кожну selection окремо й налаштуйте CI так, щоб повний каталог Robot results зберігався навіть при failure.",
    tags: ["robot-framework", "ci", "reporting", "tags"],
    sourceIds: ["robot-framework-user-guide", "robot-framework-ci"],
  },
];

export default robotFrameworkModule;
