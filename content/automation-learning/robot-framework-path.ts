import { robotFrameworkModule, robotFrameworkLessons } from "./robot-framework";
import { robotFrameworkAdditionalLessons } from "./robot-framework-additions";

// Keep the original module and lesson IDs stable: existing ?track=robot-framework&topic=robot-framework links still resolve.
const chapters = [
  {
    "id": "robot-framework",
    "label": "01 · Getting started",
    "labelUk": "01 · Початок",
    "level": "Beginner",
    "description": "Start here: installation, execution model, file syntax, variables and safe configuration.",
    "descriptionUk": "Почніть тут: встановлення, execution model, синтаксис, змінні й безпечна конфігурація.",
    "navLabel": "Getting started",
    "navLabelUk": "Початок"
  },
  {
    "id": "robot-keywords",
    "label": "02 · Keywords & control flow",
    "labelUk": "02 · Keywords та control flow",
    "level": "Beginner",
    "description": "Build readable keyword APIs; use returns, branches, failure handling and reliable setup/teardown.",
    "descriptionUk": "Створюйте читабельні keyword APIs; використовуйте return, розгалуження, обробку помилок та setup/teardown.",
    "navLabel": "Keywords & control flow",
    "navLabelUk": "Keywords та control flow",
    "introMarkdown": "### Learning sequence\n\nDefine keyword interfaces before nesting them. Work from simple values and returns to branches, exception handling and lifecycle. Each example focuses on one construct; import its dependencies when moving snippets into a project.",
    "introMarkdownUk": "### Послідовність навчання\n\nСпочатку визначте keyword interfaces. Рухайтеся від простих аргументів і return до умов, обробки помилок та lifecycle. Фрагменти демонструють окремі конструкції; переносьте їх у проєкт разом із залежностями."
  },
  {
    "id": "robot-project",
    "label": "03 · Structure & test data",
    "labelUk": "03 · Структура й тестові дані",
    "level": "Intermediate",
    "description": "Organize resource files and libraries, understand standard keywords, use templates and isolated data.",
    "descriptionUk": "Організуйте resource files й libraries, вивчіть стандартні keywords, templates та ізольовані дані.",
    "navLabel": "Structure & test data",
    "navLabelUk": "Структура й тестові дані",
    "introMarkdown": "### One source of truth\n\nSeparate suites (`tests/`), reusable domain behavior (`resources/`), adapters (`libraries/`) and environment configuration (`variables/`). Avoid suite-global mutable data. The offline reference project in chapter 07 demonstrates this separation.",
    "introMarkdownUk": "### Одне джерело істини\n\nРозділяйте suites (`tests/`), domain behavior (`resources/`), adapters (`libraries/`) та environment configuration (`variables/`). Уникайте suite-global mutable data. Офлайн-проєкт у розділі 07 демонструє це розділення."
  },
  {
    "id": "robot-web",
    "label": "04 · Web UI with Browser",
    "labelUk": "04 · Web UI з Browser",
    "level": "Intermediate",
    "description": "Install Browser Library correctly, apply Playwright-style isolation, locators, assertions and evidence.",
    "descriptionUk": "Правильно встановлюйте Browser Library, використовуйте isolation, locators, assertions та evidence.",
    "navLabel": "Web UI with Browser",
    "navLabelUk": "Web UI з Browser",
    "introMarkdown": "### Installation routes\n\nCurrent Browser Library supports a bundled Node runtime (`python -m pip install 'robotframework-browser[bb]'` then `rfbrowser install`) and the external Node.js route (`python -m pip install robotframework-browser` then `rfbrowser init`). These are alternatives, not consecutive steps. Use a fresh context for each test, stable locators and state-based assertions.",
    "introMarkdownUk": "### Варіанти встановлення\n\nBrowser Library підтримує bundled Node (`python -m pip install 'robotframework-browser[bb]'` і `rfbrowser install`) та окремий Node.js (`python -m pip install robotframework-browser` і `rfbrowser init`). Це альтернативи, не послідовні кроки. Для кожного тесту створюйте окремий context, використовуйте stable locators і state-based assertions."
  },
  {
    "id": "robot-api",
    "label": "05 · API & Python extensions",
    "labelUk": "05 · API та Python-розширення",
    "level": "Intermediate",
    "description": "Use RequestsLibrary and typed Python libraries for service checks, negative paths and custom domain keywords.",
    "descriptionUk": "Використовуйте RequestsLibrary і типізовані Python libraries для API-перевірок, негативних сценаріїв і domain keywords.",
    "navLabel": "API & Python extensions",
    "navLabelUk": "API та Python-розширення",
    "introMarkdown": "### The API contract\n\nCheck status, response shape, types, relevant business invariants and persistence. Do not share mutable HTTP sessions across unrelated tests. Treat the Python library boundary as an implementation detail, not a hiding place for assertions.",
    "introMarkdownUk": "### API-контракт\n\nПеревіряйте status, форму відповіді, типи, бізнес-інваріанти та persistence. Не діліть mutable HTTP sessions між незалежними тестами. Python library — це implementation detail, а не місце для прихованих assertions."
  },
  {
    "id": "robot-execution",
    "label": "06 · Running, CI & parallelism",
    "labelUk": "06 · Запуск, CI та паралельність",
    "level": "Advanced",
    "description": "Run repeatably, debug the first failure, use listener integrations, Rebot, Pabot and CI evidence.",
    "descriptionUk": "Повторюваний запуск, діагностика першої помилки, listeners, Rebot, Pabot та CI evidence.",
    "navLabel": "Running, CI & parallelism",
    "navLabelUk": "Запуск, CI та паралельність",
    "introMarkdown": "### A reproducible run\n\nPreserve failing exit codes and upload evidence on failure. Rebot post-processes results; it does not rerun a test. Introduce Pabot only when data and environment ownership are already deterministic.",
    "introMarkdownUk": "### Відтворюваний запуск\n\nНе приховуйте exit codes і зберігайте evidence після помилок. Rebot обробляє результати, але не перезапускає тест. Pabot варто додавати тільки після забезпечення ізоляції даних та середовища."
  },
  {
    "id": "robot-architecture",
    "label": "07 · Architecture & capstone",
    "labelUk": "07 · Архітектура та проєкт",
    "level": "Expert",
    "description": "Design a maintainable framework and implement an independent, executable example end to end.",
    "descriptionUk": "Спроєктуйте підтримуваний framework і виконайте незалежний наскрізний приклад.",
    "navLabel": "Architecture & capstone",
    "navLabelUk": "Архітектура та проєкт",
    "introMarkdown": "### Build instead of memorizing\n\nA complete sample lives under `examples/robot-framework/`. It runs entirely offline on Robot Framework core and standard Python. Follow test → resource keyword → Python library → result artifacts, then change a requirement and inspect a failing assertion.",
    "introMarkdownUk": "### Навчання через реалізацію\n\nПовний приклад міститься в `examples/robot-framework/`. Він працює офлайн на Robot Framework core та стандартному Python. Пройдіть шлях test → resource keyword → Python library → result artifacts, потім змініть вимогу й дослідіть помилку."
  }
];

export const robotFrameworkModules = chapters.map((chapter) => ({
  ...robotFrameworkModule,
  ...chapter,
  introMarkdown: chapter.introMarkdown ?? robotFrameworkModule.introMarkdown,
  introMarkdownUk: chapter.introMarkdownUk ?? robotFrameworkModule.introMarkdownUk,
}));

const lessonChapter: Record<string, string> = {
  "ta-lesson-robot-framework-core": "robot-framework",
  "ta-lesson-robot-framework-syntax": "robot-framework",
  "ta-lesson-robot-framework-variables": "robot-framework",
  "ta-lesson-robot-framework-keywords": "robot-keywords",
  "ta-lesson-robot-framework-control-flow": "robot-keywords",
  "ta-lesson-robot-framework-errors": "robot-keywords",
  "ta-lesson-robot-framework-lifecycle": "robot-keywords",
  "ta-lesson-robot-framework-resources": "robot-project",
  "ta-lesson-robot-framework-standard-libraries": "robot-project",
  "ta-lesson-robot-framework-data-driven": "robot-project",
  "ta-lesson-robot-framework-browser": "robot-web",
  "ta-lesson-robot-framework-browser-sync": "robot-web",
  "ta-lesson-robot-framework-api": "robot-api",
  "ta-lesson-robot-framework-python-libraries": "robot-api",
  "ta-lesson-robot-framework-extensions": "robot-execution",
  "ta-lesson-robot-framework-execution": "robot-execution",
  "ta-lesson-robot-framework-parallel": "robot-execution",
  "ta-lesson-robot-framework-ci": "robot-execution",
  "ta-lesson-robot-framework-architecture": "robot-architecture"
};

export const robotFrameworkCurriculumLessons = [
  ...robotFrameworkLessons.map((lesson) => {
    const moduleId = lessonChapter[lesson.id];
    if (!moduleId) throw new Error(`Robot Framework lesson is not assigned to a chapter: ${lesson.id}`);
    const level = robotFrameworkModules.find((chapter) => chapter.id === moduleId)?.level ?? lesson.level;
    return { ...lesson, moduleId, level };
  }),
  ...robotFrameworkAdditionalLessons,
];

export const robotFrameworkChapterIds = ["robot-framework","robot-keywords","robot-project","robot-web","robot-api","robot-execution","robot-architecture"];
