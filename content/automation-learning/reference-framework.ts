import automationCurriculum from "./catalog";

const reference = automationCurriculum.referenceImplementation;
const live = (path: string) => `https://github.com/${reference.repo}/blob/${reference.branch}/${path}`;
const reviewed = (path: string) => `https://github.com/${reference.repo}/blob/${reference.verifiedCommit}/${path}`;

interface FrameworkLink {
  label: string;
  labelUk?: string;
  path: string;
}

interface FrameworkSection {
  title: string;
  titleUk: string;
  body: string;
  bodyUk: string;
  links?: FrameworkLink[];
}

const sections: FrameworkSection[] = [
  {
    title: "1. Start with the repository shape",
    titleUk: "1. Почни зі структури репозиторію",
    body: "Read the repository from the outside inward: project metadata and setup first, pytest wiring second, framework layers third, tests last. This makes the dependency direction easier to see than opening random files.",
    bodyUk: "Читай репозиторій ззовні всередину: спочатку metadata та setup проєкту, потім pytest wiring, далі framework layers і лише після цього tests. Так dependency direction видно значно краще, ніж при випадковому відкриванні файлів.",
    links: [
      { label: "Project overview and local setup", labelUk: "Огляд проєкту та локальний setup", path: "README.md" },
      { label: "Python package and dependency declaration", labelUk: "Python package і dependency declaration", path: "pyproject.toml" },
      { label: "Generated/local files excluded from Git", labelUk: "Локальні/generated файли поза Git", path: ".gitignore" },
      { label: "Environment example", labelUk: "Приклад environment configuration", path: ".env.example" },
    ],
  },
  {
    title: "2. pytest wiring and lifecycle",
    titleUk: "2. pytest wiring і lifecycle",
    body: "The root `conftest.py` is the composition boundary for shared pytest configuration and fixtures. The layer-specific `conftest.py` files add web, service, or mobile concerns closer to the tests that need them.",
    bodyUk: "Кореневий `conftest.py` є composition boundary для спільної pytest configuration та fixtures. Layer-specific `conftest.py` додають web, service або mobile concerns ближче до tests, яким вони потрібні.",
    links: [
      { label: "Shared pytest fixtures and hooks", labelUk: "Спільні pytest fixtures і hooks", path: "conftest.py" },
      { label: "Web fixtures", path: "tests/web/conftest.py" },
      { label: "Service fixtures", path: "tests/services/conftest.py" },
      { label: "Mobile fixtures", path: "tests/mobile/conftest.py" },
      { label: "pytest learning notes", path: "docs/01-pytest-foundations.md" },
    ],
  },
  {
    title: "3. Configuration architecture",
    titleUk: "3. Архітектура configuration",
    body: "Configuration is kept outside individual tests. Runtime settings are loaded through framework code and environment/project configuration instead of being scattered through page objects or test functions.",
    bodyUk: "Configuration винесена за межі окремих tests. Runtime settings завантажуються через framework code та environment/project configuration, а не розкидані по page objects чи test functions.",
    links: [
      { label: "Typed/runtime configuration layer", labelUk: "Runtime configuration layer", path: "framework/config.py" },
      { label: "Local configuration example", labelUk: "Приклад local configuration", path: "config/local.yaml" },
      { label: "Configuration tests", labelUk: "Tests configuration layer", path: "tests/framework/test_config.py" },
      { label: "Architecture explanation", labelUk: "Пояснення архітектури", path: "docs/02-architecture.md" },
    ],
  },
  {
    title: "4. Web automation layer",
    titleUk: "4. Web automation layer",
    body: "The web layer separates reusable browser mechanics from concrete page behaviour, while the tests remain focused on scenarios and assertions.",
    bodyUk: "Web layer відокремлює reusable browser mechanics від конкретної поведінки pages, а tests залишаються сфокусованими на сценаріях та assertions.",
    links: [
      { label: "Reusable page mechanics", path: "framework/web/base_page.py" },
      { label: "Concrete page objects", path: "framework/web/pages.py" },
      { label: "Web test fixtures", path: "tests/web/conftest.py" },
      { label: "Example business flow", labelUk: "Приклад business flow", path: "tests/web/test_shopping_flow.py" },
      { label: "Web automation notes", path: "docs/04-web.md" },
    ],
  },
  {
    title: "5. API and services layer",
    titleUk: "5. API та services layer",
    body: "The service layer demonstrates the same separation: transport mechanics belong in the HTTP client, domain/service operations belong in API objects, and scenario expectations stay in tests.",
    bodyUk: "Service layer показує ту саму separation: transport mechanics належать HTTP client, domain/service operations — API objects, а scenario expectations — tests.",
    links: [
      { label: "Instrumented HTTP client", path: "framework/http/client.py" },
      { label: "Service/domain API object", path: "framework/api/shop.py" },
      { label: "API models", path: "framework/api/models.py" },
      { label: "Service scenario", path: "tests/services/test_cart_flow.py" },
      { label: "Contract/property example", path: "tests/services/test_contract_and_properties.py" },
      { label: "Services notes", path: "docs/03-services.md" },
    ],
  },
  {
    title: "6. Mobile automation layer",
    titleUk: "6. Mobile automation layer",
    body: "Mobile keeps device/session creation separate from screen abstractions and test scenarios. This is the mobile equivalent of browser management plus Page Objects.",
    bodyUk: "Mobile відділяє створення device/session від screen abstractions та test scenarios. Це mobile-еквівалент browser management плюс Page Objects.",
    links: [
      { label: "Appium driver/session factory", path: "framework/mobile/driver_factory.py" },
      { label: "Reusable screen mechanics", path: "framework/mobile/base_screen.py" },
      { label: "Concrete screen objects", path: "framework/mobile/screens.py" },
      { label: "Native application test", path: "tests/mobile/test_native_app.py" },
      { label: "Real-device mobile web test", path: "tests/mobile/test_mobile_web_real_device.py" },
      { label: "Mobile automation notes", path: "docs/05-mobile.md" },
    ],
  },
  {
    title: "7. Test data, assertions and reporting",
    titleUk: "7. Test data, assertions і reporting",
    body: "Cross-cutting helpers are kept out of test scenarios so that data generation, reusable assertions, and reporting can evolve independently.",
    bodyUk: "Cross-cutting helpers винесені з test scenarios, щоб data generation, reusable assertions і reporting могли еволюціонувати незалежно.",
    links: [
      { label: "Test data factories", path: "framework/data/factories.py" },
      { label: "Reusable assertions", path: "framework/utils/assertions.py" },
      { label: "Reporting helpers", path: "framework/utils/reporting.py" },
      { label: "Test data notes", path: "docs/06-test-data.md" },
      { label: "Flakiness notes", path: "docs/08-flakiness.md" },
    ],
  },
  {
    title: "8. CI and execution model",
    titleUk: "8. CI та execution model",
    body: "The framework is complete only when the same suite can run consistently outside a developer laptop. Follow the workflow from dependency installation through execution and artifacts.",
    bodyUk: "Framework є завершеним лише тоді, коли той самий suite стабільно працює не тільки на laptop розробника. Простеж workflow від dependency installation до execution та artifacts.",
    links: [
      { label: "GitHub Actions pipeline", path: ".github/workflows/ci.yml" },
      { label: "CI and reporting notes", labelUk: "CI і reporting notes", path: "docs/07-ci-reporting.md" },
      { label: "Automation strategy notes", path: "docs/09-strategy.md" },
    ],
  },
  {
    title: "How to use this track",
    titleUk: "Як використовувати цей track",
    body: "For each concept, first understand the generic rule in the earlier tracks, then inspect the linked implementation here. Ask three questions: **what responsibility does this file own, what is it intentionally not responsible for, and which layer depends on it?** That turns the repository into an architecture exercise rather than a collection of code snippets.",
    bodyUk: "Для кожної концепції спочатку зрозумій generic rule у попередніх tracks, а потім відкрий відповідну implementation тут. Постав три питання: **за яку відповідальність відповідає цей файл, за що він навмисно не відповідає, і який layer від нього залежить?** Так repository стає вправою з architecture, а не просто набором code snippets.",
  },
];

function frameworkLink(link: FrameworkLink, language: "en" | "uk") {
  const label = language === "uk" ? link.labelUk ?? link.label : link.label;
  return `- **${label}** — \`${link.path}\`: [live](${live(link.path)}) · [reviewed](${reviewed(link.path)})`;
}

function frameworkMarkdown(language: "en" | "uk") {
  const ukrainian = language === "uk";
  const lines = [
    `# ${ukrainian ? "Розбір reference framework" : "Reference framework walkthrough"}`,
    "",
    ukrainian
      ? "Ця частина навмисно відрізняється від теоретичних tracks. Вона не пояснює ті самі концепції вдруге. Замість цього вона мапить уже вивчені концепції на реальний репозиторій і показує, де живе кожна відповідальність."
      : "This area is deliberately different from the theory tracks. It does not teach the same concepts again. Instead, it maps the concepts you have already learned to a real repository and shows where each responsibility lives.",
    "",
    `${ukrainian ? "Reference repository" : "Reference repository"}: **${reference.repo}**. ${ukrainian ? "Посилання ведуть і на" : "The lesson links use both the live"} \`${reference.branch}\` ${ukrainian ? "і на reviewed snapshot" : "branch and the reviewed snapshot"} \`${reference.verifiedCommit.slice(0, 7)}\` (${reference.verifiedAt}).`,
  ];

  for (const section of sections) {
    lines.push("", `## ${ukrainian ? section.titleUk : section.title}`, "", ukrainian ? section.bodyUk : section.body);
    if (section.links?.length) lines.push("", ...section.links.map((link) => frameworkLink(link, language)));
  }

  return lines.join("\n");
}

const referenceFrameworkModule = {
  id: "reference-framework",
  label: "Reference framework walkthrough",
  labelUk: "Розбір reference framework",
  description: "Now inspect a real implementation of the concepts from the learning path, using the qa-automation-python repository as a guided architecture walkthrough.",
  descriptionUk: "Тепер розбери реальну реалізацію концепцій із learning path на прикладі репозиторію qa-automation-python як послідовний walkthrough архітектури.",
  markdown: frameworkMarkdown("en"),
  markdownUk: frameworkMarkdown("uk"),
};

export default referenceFrameworkModule;
