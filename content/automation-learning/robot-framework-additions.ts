// Supplementary fully worked lessons; existing 19 lesson IDs are retained for deep links.
export const robotFrameworkAdditionalLessons = [
  {
    "id": "ta-lesson-robot-framework-isolation",
    "moduleId": "robot-project",
    "level": "Intermediate",
    "order": 63,
    "title": "Test isolation, fixtures and ownership",
    "titleUk": "Ізоляція тестів, fixtures та ownership",
    "summary": "Model setup, teardown, shared data and error recovery explicitly.",
    "summaryUk": "Явно спроєктуйте setup, teardown, спільні дані та відновлення після помилки.",
    "concept": "A test is independent when it can run alone, after another test, in a different order and in parallel without changing its expected result. Robot suite and test setups are lifecycle scopes, not a substitute for test data ownership.\n\n### Example: test-owned state\n\n```robotframework\n*** Settings ***\nResource    ../resources/inventory.resource\nTest Setup    Start With Inventory\nTest Teardown    Clean Up Inventory\n\n*** Test Cases ***\nOne Reservation\n    Reserve Product    notebook    2\n    Remaining Stock Should Be    notebook    3\n```\n\nHere `Start With Inventory` prepares exactly five units and `Clean Up Inventory` releases the local state. Both keywords live in a resource file and delegate technical storage logic to Python. See `examples/robot-framework/`.\n\nFor an API, create resources per test with unique identifiers and remove them in teardown. For Browser Library, use a fresh browser context per test. Suite-level shared state is suitable only when immutable or explicitly serialized. If setup fails, inspect teardown and the earliest failing dependency.",
    "conceptUk": "Тест незалежний, коли може запускатися окремо, після іншого тесту, в іншому порядку та паралельно без зміни очікуваного результату. Suite/test setup — це lifecycle scopes, а не заміна керування тестовими даними.\n\n### Приклад: стан належить тесту\n\n```robotframework\n*** Settings ***\nResource    ../resources/inventory.resource\nTest Setup    Start With Inventory\nTest Teardown    Clean Up Inventory\n\n*** Test Cases ***\nOne Reservation\n    Reserve Product    notebook    2\n    Remaining Stock Should Be    notebook    3\n```\n\n`Start With Inventory` створює п'ять одиниць, а `Clean Up Inventory` очищає локальний стан. Обидва keywords є в resource file й викликають Python library. Дивіться `examples/robot-framework/`.\n\nДля API створюйте ресурси з унікальними ідентифікаторами на кожен тест і видаляйте у teardown. Для Browser Library — новий context на тест. Suite-level state безпечний лише якщо immutable або синхронізований. Якщо setup зламався, аналізуйте teardown і першу помилку залежності.",
    "keyPoints": [
      "Reorder and rerun tests to expose implicit dependencies",
      "Keep setup and cleanup at the narrowest sufficient scope"
    ],
    "keyPointsUk": [
      "Змінюйте порядок запуску, щоб знайти неявні залежності",
      "Setup і cleanup мають мати найвужчий достатній scope"
    ],
    "pitfalls": [
      "Using a shared test account or record without a concurrency policy"
    ],
    "pitfallsUk": [
      "Спільний test account або record без правил паралельного доступу"
    ],
    "tags": [
      "robot-framework",
      "isolation"
    ],
    "sourceIds": [
      "robot-framework-user-guide",
      "robot-framework-guides"
    ]
  },
  {
    "id": "ta-lesson-robot-framework-browser-isolation",
    "moduleId": "robot-web",
    "level": "Intermediate",
    "order": 64,
    "title": "Browser contexts, cleanup and secret input",
    "titleUk": "Browser contexts, cleanup і безпечне введення",
    "summary": "Connect UI isolation, stable selectors and secret-handling rules.",
    "summaryUk": "Поєднайте UI-ізоляцію, стійкі локатори й безпечне введення секретів.",
    "concept": "A Browser context isolates cookies and storage, while a page is only a tab. Creating another page inside an existing context is **not** isolation. Ensure teardown closes the context even when assertions fail.\n\n### Context-per-test pattern (illustrative; requires Browser Library)\n\n```robotframework\n*** Settings ***\nLibrary    Browser\nTest Setup    Open Isolated Page\nTest Teardown    Close Context\n\n*** Keywords ***\nOpen Isolated Page\n    New Browser    chromium    headless=${True}\n    New Context\n    New Page    https://robotframework-browser.org\n\n*** Test Cases ***\nSite Is Reachable\n    Get Title    *=    Robot Framework Browser\n```\n\nFor real projects, a suite-owned browser process with one test-owned context is more efficient; ensure there is a browser available before `New Context` and close the correct context in teardown. `Fill Secret` does **not** accept an ordinary `${password}` variable; use a Robot `Secret` or the `$password`/`%PASSWORD` indirection. Avoid Playwright DEBUG traces containing credentials.\n\nUse retried getter assertions instead of `Sleep`; capture a screenshot before closing a failed context and restrict artifact access.",
    "conceptUk": "Browser context ізолює cookies та storage, а page — це лише вкладка. Нова сторінка в тому самому context **не** ізолює стан. Teardown має закривати context навіть після помилки.\n\n### Pattern: context на тест (потрібна Browser Library)\n\n```robotframework\n*** Settings ***\nLibrary    Browser\nTest Setup    Open Isolated Page\nTest Teardown    Close Context\n\n*** Keywords ***\nOpen Isolated Page\n    New Browser    chromium    headless=${True}\n    New Context\n    New Page    https://robotframework-browser.org\n\n*** Test Cases ***\nSite Is Reachable\n    Get Title    *=    Robot Framework Browser\n```\n\nУ реальному проєкті дешевше використовувати suite-owned browser і test-owned context. Перед `New Context` має існувати browser, а teardown повинен закривати правильний context. `Fill Secret` не приймає звичайну змінну `${password}`; використовуйте Robot `Secret` або `$password`/`%PASSWORD`. Playwright DEBUG traces можуть містити credentials.\n\nВикористовуйте retried assertions замість `Sleep`; робіть screenshot до закриття context і обмежуйте доступ до artifacts.",
    "keyPoints": [
      "A fresh page does not isolate browser storage",
      "Secret keywords and artifacts have different disclosure risks"
    ],
    "keyPointsUk": [
      "Нова page не ізолює browser storage",
      "Secret keywords і artifacts мають різні ризики витоку"
    ],
    "pitfalls": [
      "Creating a new browser for every step or reusing one logged-in context across tests"
    ],
    "pitfallsUk": [
      "Новий browser на кожен крок або повторне використання logged-in context між тестами"
    ],
    "tags": [
      "robot-framework",
      "browser-isolation"
    ],
    "sourceIds": [
      "robot-framework-browser",
      "robot-framework-user-guide"
    ]
  },
  {
    "id": "ta-lesson-robot-framework-api-contracts",
    "moduleId": "robot-api",
    "level": "Intermediate",
    "order": 65,
    "title": "API negative paths and contract-oriented checks",
    "titleUk": "Негативні API-сценарії та контрактні перевірки",
    "summary": "Go beyond status-code checks without overasserting incidental fields.",
    "summaryUk": "Перевіряйте більше, ніж HTTP status, не фіксуючи випадкові поля.",
    "concept": "An API test needs an explicit oracle: status class, required keys and types, domain invariants and side effects. A success status alone does not prove the business operation worked. Isolate created data and verify expected failures without swallowing transport errors.\n\n### Example with RequestsLibrary\n\n```robotframework\n*** Settings ***\nLibrary    RequestsLibrary\nLibrary    Collections\n\n*** Test Cases ***\nExisting Post Has Expected Shape\n    ${response}=    GET    https://jsonplaceholder.typicode.com/posts/1    expected_status=200\n    Dictionary Should Contain Key    ${response.json()}    userId\n    ${body}=    Set Variable    ${response.json()}\n    Should Be Equal As Integers    ${body}[id]    1\n```\n\nThis example needs Internet access and `robotframework-requests`. JSONPlaceholder is a public demonstration API, not a service under your control; production suites should use a controlled test environment and contract fixtures. A real negative-path test should assert the documented 4xx response body and unchanged persistent state, not merely accept every exception.\n\nFor strict schemas, call a typed Python validation library from a keyword. Reserve Pact for consumer-provider compatibility when a provider must verify consumer expectations.",
    "conceptUk": "API-тест потребує явного oracle: status class, required keys/типи, domain invariants і side effects. Один успішний HTTP status не доводить бізнес-результат. Дані мають бути ізольованими, а negative test не повинен поглинати transport errors.\n\n### Приклад RequestsLibrary\n\n```robotframework\n*** Settings ***\nLibrary    RequestsLibrary\nLibrary    Collections\n\n*** Test Cases ***\nExisting Post Has Expected Shape\n    ${response}=    GET    https://jsonplaceholder.typicode.com/posts/1    expected_status=200\n    Dictionary Should Contain Key    ${response.json()}    userId\n    ${body}=    Set Variable    ${response.json()}\n    Should Be Equal As Integers    ${body}[id]    1\n```\n\nДля запуску потрібні Internet та `robotframework-requests`. JSONPlaceholder — публічний демонстраційний API, не контрольований test environment. У production використовуйте власний тестовий сервіс і контрактні fixtures. У негативному тесті перевіряйте документовані 4xx response body та незмінений persistent state, а не просто будь-яку exception.\n\nДля строгих schema викликайте типізовану Python validation library. Pact потрібен для перевірки сумісності consumer/provider, а не лише shape одного response.",
    "keyPoints": [
      "Assert business invariants and types in addition to status",
      "Separate a service's contract from incidental response details"
    ],
    "keyPointsUk": [
      "Окрім status, перевіряйте бізнес-інваріанти й типи",
      "Відрізняйте контракт сервісу від випадкових полів"
    ],
    "pitfalls": [
      "Catching all request failures and treating network timeouts as a valid 4xx negative test"
    ],
    "pitfallsUk": [
      "Вважати network timeout правильним негативним сценарієм 4xx"
    ],
    "tags": [
      "robot-framework",
      "api-contracts"
    ],
    "sourceIds": [
      "robot-framework-requests",
      "robot-framework-python-library"
    ]
  },
  {
    "id": "ta-lesson-robot-framework-capstone",
    "moduleId": "robot-architecture",
    "level": "Expert",
    "order": 66,
    "title": "Offline capstone: build and run a layered suite",
    "titleUk": "Офлайн-проєкт: побудова багатошарового suite",
    "summary": "Exercise end-to-end architecture using a test-owned in-memory inventory.",
    "summaryUk": "Відпрацюйте архітектуру наскрізно на ізольованому in-memory inventory.",
    "concept": "The runnable reference under `examples/robot-framework/` deliberately uses no browser, server or credentials. Its layers are: tests (behavior/oracles), resource keywords (domain API), Python library (state and typed business rules), plus CLI-produced results.\n\n### Run from repository root\n\n```bash\npython -m venv .venv\nsource .venv/bin/activate  # Windows: .venv\\Scripts\\Activate.ps1\npython -m pip install -r examples/robot-framework/requirements.txt\npython -m robot --outputdir results examples/robot-framework/tests\n```\n\n### Read the suite first\n\n```robotframework\n*** Settings ***\nResource    ../resources/inventory.resource\nTest Setup    Start With Inventory\nTest Teardown    Clean Up Inventory\n\n*** Test Cases ***\nReserve Item Reduces Available Stock\n    Reserve Product    notebook    2\n    Remaining Stock Should Be    notebook    3\n```\n\nThen read `resources/inventory.resource` and `libraries/Inventory.py`. Break the expected stock number or remove `Reset Inventory` and observe the first informative failure in `log.html`. Run `python -m robot --test 'Rejects Reservation Beyond Stock' --outputdir results examples/robot-framework/tests/inventory.robot` to confirm selection.\n\nDefinition of done: all tests pass locally, reruns are deterministic, intentional failures fail, teardown clears state, and CI retains `output.xml` plus HTML reports.",
    "conceptUk": "Приклад `examples/robot-framework/` не потребує browser, server або credentials. Шари: tests (поведінка й oracle), resource keywords (domain API), Python library (стан і типізовані бізнес-правила), CLI-generated results.\n\n### Запуск із кореня репозиторію\n\n```bash\npython -m venv .venv\nsource .venv/bin/activate  # Windows: .venv\\Scripts\\Activate.ps1\npython -m pip install -r examples/robot-framework/requirements.txt\npython -m robot --outputdir results examples/robot-framework/tests\n```\n\n### Спочатку прочитайте suite\n\n```robotframework\n*** Settings ***\nResource    ../resources/inventory.resource\nTest Setup    Start With Inventory\nTest Teardown    Clean Up Inventory\n\n*** Test Cases ***\nReserve Item Reduces Available Stock\n    Reserve Product    notebook    2\n    Remaining Stock Should Be    notebook    3\n```\n\nДалі прочитайте `resources/inventory.resource` та `libraries/Inventory.py`. Змініть expected stock або видаліть `Reset Inventory`: знайдіть першу meaningful failure в `log.html`. Запустіть вибірковий тест: `python -m robot --test 'Rejects Reservation Beyond Stock' --outputdir results examples/robot-framework/tests/inventory.robot`.\n\nКритерії готовності: усі тести проходять, повторні запуски детерміновані, зламана перевірка падає, teardown очищає стан, а CI зберігає `output.xml` і HTML.",
    "keyPoints": [
      "Follow test → keyword → adapter → evidence",
      "Use intentional failures to verify test sensitivity"
    ],
    "keyPointsUk": [
      "Пройдіть від test до keyword, adapter й evidence",
      "Перевірте чутливість тестів навмисними помилками"
    ],
    "pitfalls": [
      "Calling a reference example complete without running it or examining its failure mode"
    ],
    "pitfallsUk": [
      "Називати приклад завершеним без запуску й перевірки failure modes"
    ],
    "tags": [
      "robot-framework",
      "capstone"
    ],
    "sourceIds": [
      "robot-framework-user-guide",
      "robot-framework-guides",
      "robot-framework-python-library"
    ]
  }
];
