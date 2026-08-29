import automationCurriculum from "./catalog";

const reference = automationCurriculum.referenceImplementation;
const mainBranchUrl = (path: string) => `https://github.com/${reference.repo}/blob/main/${path}`;

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
  codeLanguage: string;
  code: string;
  links?: FrameworkLink[];
}

const sections: FrameworkSection[] = [
  {
    title: "1. Repository shape",
    titleUk: "1. Структура repository",
    body: "Read the framework from the outside inward: project setup, pytest composition, reusable framework layers, then tests. The directory shape already tells you where responsibilities are expected to live.",
    bodyUk: "Читайте framework ззовні всередину: project setup, pytest composition, reusable framework layers, а потім tests. Уже структура директорій показує, де мають жити різні responsibilities.",
    codeLanguage: "text",
    code: `qa-automation-python/
├── conftest.py
├── framework/
│   ├── api/
│   ├── data/
│   ├── http/
│   ├── mobile/
│   ├── utils/
│   └── web/
├── tests/
│   ├── framework/
│   ├── mobile/
│   ├── services/
│   └── web/
└── .github/workflows/ci.yml`,
    links: [
      { label: "Project overview and local setup", labelUk: "Огляд проєкту та local setup", path: "README.md" },
      { label: "Python package and dependencies", labelUk: "Python package та dependencies", path: "pyproject.toml" },
      { label: "Environment example", labelUk: "Приклад environment configuration", path: ".env.example" },
    ],
  },
  {
    title: "2. pytest wiring and lifecycle",
    titleUk: "2. pytest wiring і lifecycle",
    body: "The root `conftest.py` is the composition boundary for shared runtime options and lifecycle hooks. Layer-specific conftest files add only the fixtures required by web, service, or mobile tests.",
    bodyUk: "Кореневий `conftest.py` є composition boundary для shared runtime options і lifecycle hooks. Layer-specific conftest files додають лише fixtures, потрібні web, service або mobile tests.",
    codeLanguage: "python",
    code: `def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("qa-framework")
    group.addoption("--env", default=None)
    group.addoption("--no-sut", action="store_true")


def pytest_configure(config: pytest.Config) -> None:
    if env := config.getoption("--env"):
        os.environ["QA_ENV"] = env
    settings.artifacts_dir.mkdir(parents=True, exist_ok=True)
    if not _is_xdist_worker(config):
        _start_sut(config)`,
    links: [
      { label: "Shared pytest hooks and lifecycle", labelUk: "Shared pytest hooks і lifecycle", path: "conftest.py" },
      { label: "Web fixtures", path: "tests/web/conftest.py" },
      { label: "Service fixtures", path: "tests/services/conftest.py" },
      { label: "Mobile fixtures", path: "tests/mobile/conftest.py" },
    ],
  },
  {
    title: "3. Configuration architecture",
    titleUk: "3. Архітектура configuration",
    body: "Tests consume one typed settings object instead of reading environment variables directly. Defaults, YAML, `.env`, and real environment variables are merged in one place with explicit precedence.",
    bodyUk: "Tests використовують один typed settings object замість прямого читання environment variables. Defaults, YAML, `.env` і real environment variables об'єднуються в одному місці з явним precedence.",
    codeLanguage: "python",
    code: `class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="QA_",
        env_nested_delimiter="__",
        env_file=(ROOT / ".env"),
        extra="forbid",
    )

    env: Env = Env.LOCAL
    api: ApiSettings = ApiSettings()
    web: WebSettings = WebSettings()
    mobile: MobileSettings = MobileSettings()

    @classmethod
    def settings_customise_sources(cls, settings_cls, init_settings,
                                   env_settings, dotenv_settings,
                                   file_secret_settings):
        return (env_settings, dotenv_settings, init_settings, file_secret_settings)`,
    links: [
      { label: "Typed runtime configuration", labelUk: "Typed runtime configuration", path: "framework/config.py" },
      { label: "Local YAML configuration", labelUk: "Local YAML configuration", path: "config/local.yaml" },
      { label: "Configuration tests", labelUk: "Tests configuration layer", path: "tests/framework/test_config.py" },
    ],
  },
  {
    title: "4. Web automation layer",
    titleUk: "4. Web automation layer",
    body: "The web layer keeps browser mechanics in reusable page classes while tests express scenarios. Locators stay inside page objects and Playwright handles state-based waiting instead of fixed sleeps.",
    bodyUk: "Web layer тримає browser mechanics у reusable page classes, а tests описують scenarios. Locators залишаються всередині page objects, а Playwright використовує state-based waiting замість fixed sleeps.",
    codeLanguage: "python",
    code: `class BasePage:
    path: str = "/"
    ready_locator: str = "body"

    def open(self, **query: str) -> Self:
        target = self.url
        self.page.goto(target, wait_until="domcontentloaded")
        return self.wait_until_ready()

    def wait_until_ready(self) -> Self:
        expect(self.page.locator(self.ready_locator).first).to_be_visible()
        return self

    def testid(self, value: str) -> Locator:
        return self.page.get_by_test_id(value)`,
    links: [
      { label: "Reusable page mechanics", path: "framework/web/base_page.py" },
      { label: "Concrete page objects", path: "framework/web/pages.py" },
      { label: "Example web business flow", labelUk: "Приклад web business flow", path: "tests/web/test_shopping_flow.py" },
    ],
  },
  {
    title: "5. API and services layer",
    titleUk: "5. API та services layer",
    body: "Transport concerns live in one HTTP client: timeouts, retries, authentication, logging, and response-status checks. Domain API objects then describe business operations without duplicating transport mechanics.",
    bodyUk: "Transport concerns живуть в одному HTTP client: timeouts, retries, authentication, logging і response-status checks. Domain API objects описують business operations без дублювання transport mechanics.",
    codeLanguage: "python",
    code: `IDEMPOTENT_METHODS = {"GET", "HEAD", "OPTIONS", "PUT", "DELETE"}
RETRYABLE_STATUS = {429, 502, 503, 504}

class ApiClient:
    def request(self, method: str, url: str, *, expect=None, **kwargs):
        response = self._send_with_retries(method, url, **kwargs)
        if expect is not None:
            allowed = (expect,) if isinstance(expect, int) else expect
            if response.status_code not in allowed:
                raise ApiError(response, expect)
        return response`,
    links: [
      { label: "Instrumented HTTP client", path: "framework/http/client.py" },
      { label: "Service/domain API object", path: "framework/api/shop.py" },
      { label: "API models", path: "framework/api/models.py" },
      { label: "Service scenario", path: "tests/services/test_cart_flow.py" },
      { label: "Contract/property example", path: "tests/services/test_contract_and_properties.py" },
    ],
  },
  {
    title: "6. Mobile automation layer",
    titleUk: "6. Mobile automation layer",
    body: "Mobile session construction is isolated in a driver factory. Tests and screen objects do not need to know whether the session uses Android, iOS, a local Appium server, or a configured device cloud.",
    bodyUk: "Mobile session construction ізольований у driver factory. Tests і screen objects не повинні знати, чи session використовує Android, iOS, local Appium server або configured device cloud.",
    codeLanguage: "python",
    code: `def create_driver(*, platform=None, browser=None, app=None, build="local") -> WebDriver:
    m = settings.mobile
    platform = platform or m.platform
    browser = browser if browser is not None else m.mobile_browser
    app = app if app is not None else m.app_path

    builder = _android_options if platform is Platform.ANDROID else _ios_options
    options = _cloud_options(builder(browser=browser, app=app), build)
    driver = webdriver.Remote(command_executor=m.appium_url, options=options)
    driver.implicitly_wait(0)
    return driver`,
    links: [
      { label: "Appium driver/session factory", path: "framework/mobile/driver_factory.py" },
      { label: "Reusable screen mechanics", path: "framework/mobile/base_screen.py" },
      { label: "Concrete screen objects", path: "framework/mobile/screens.py" },
      { label: "Native application test", path: "tests/mobile/test_native_app.py" },
      { label: "Real-device mobile web test", path: "tests/mobile/test_mobile_web_real_device.py" },
    ],
  },
  {
    title: "7. Test data, assertions and reporting",
    titleUk: "7. Test data, assertions і reporting",
    body: "Cross-cutting helpers stay outside scenario code. Data factories create isolated records, assertion helpers cover cases where plain `assert` is insufficient, and reporting helpers keep Allure optional.",
    bodyUk: "Cross-cutting helpers винесені за межі scenario code. Data factories створюють isolated records, assertion helpers покривають випадки, де plain `assert` недостатньо, а reporting helpers залишають Allure optional.",
    codeLanguage: "python",
    code: `def unique_suffix() -> str:
    worker = os.getenv("PYTEST_XDIST_WORKER", "gw0")
    return f"{worker}-{uuid.uuid4().hex[:8]}"


def assert_status(response: Any, expected: int) -> None:
    assert response.status_code == expected


def attach_text(name: str, content: str) -> None:
    if _ALLURE:
        allure.attach(content, name=name, attachment_type=AttachmentType.TEXT)`,
    links: [
      { label: "Test data factories", path: "framework/data/factories.py" },
      { label: "Reusable assertions", path: "framework/utils/assertions.py" },
      { label: "Reporting helpers", path: "framework/utils/reporting.py" },
    ],
  },
  {
    title: "8. CI and execution model",
    titleUk: "8. CI та execution model",
    body: "The framework is complete only when the same suites run predictably outside a developer laptop. The workflow gates slower layers behind faster ones, preserves test results, and separates ordinary PR execution from expensive scheduled mobile work.",
    bodyUk: "Framework завершений лише тоді, коли ті самі suites передбачувано працюють не тільки на developer laptop. Workflow ставить slower layers після faster ones, зберігає test results і відділяє звичайний PR execution від дорогих scheduled mobile runs.",
    codeLanguage: "yaml",
    code: `jobs:
  lint:
    runs-on: ubuntu-latest

  services:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - name: Run API tests
        run: pytest tests/services -n auto --alluredir=allure-results

  web:
    needs: services
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]`,
    links: [
      { label: "GitHub Actions pipeline", path: ".github/workflows/ci.yml" },
      { label: "CI and reporting notes", labelUk: "CI і reporting notes", path: "docs/07-ci-reporting.md" },
      { label: "Automation strategy notes", path: "docs/09-strategy.md" },
    ],
  },
];

function frameworkLink(link: FrameworkLink, language: "en" | "uk") {
  const label = language === "uk" ? link.labelUk ?? link.label : link.label;
  return `- **${label}** — \`${link.path}\`: [open on main](${mainBranchUrl(link.path)})`;
}

function frameworkMarkdown(language: "en" | "uk") {
  const ukrainian = language === "uk";
  const lines = [
    `# ${ukrainian ? "Framework Reference" : "Framework Reference"}`,
    "",
    ukrainian
      ? "Це практичний reference до спільного automation framework. Кожен section показує короткий representative code block, пояснює responsibility цього layer і дає прямі links на відповідні files у main branch."
      : "This is a practical reference to the shared automation framework. Each section shows a short representative code block, explains the responsibility of that layer, and links directly to the relevant files on the main branch.",
    "",
    `${ukrainian ? "Reference repository" : "Reference repository"}: **${reference.repo}**. ${ukrainian ? "Усі file links нижче відкривають" : "Every file link below opens"} \`main\`.`,
  ];

  for (const section of sections) {
    lines.push(
      "",
      `## ${ukrainian ? section.titleUk : section.title}`,
      "",
      ukrainian ? section.bodyUk : section.body,
      "",
      `\`\`\`${section.codeLanguage}`,
      section.code,
      "```",
    );
    if (section.links?.length) lines.push("", ...section.links.map((link) => frameworkLink(link, language)));
  }

  return lines.join("\n");
}

const referenceFrameworkModule = {
  id: "reference-framework",
  label: "Framework Reference",
  labelUk: "Framework Reference",
  navLabel: "Framework Reference",
  navLabelUk: "Framework Reference",
  description: "Use the qa-automation-python repository as a compact reference for framework structure, pytest wiring, configuration, web, API, mobile, shared helpers and CI.",
  descriptionUk: "Використовуйте repository qa-automation-python як компактний reference для framework structure, pytest wiring, configuration, web, API, mobile, shared helpers та CI.",
  markdown: frameworkMarkdown("en"),
  markdownUk: frameworkMarkdown("uk"),
};

export default referenceFrameworkModule;
