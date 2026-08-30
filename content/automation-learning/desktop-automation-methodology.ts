type DesktopLanguage = "en" | "uk";

const legacyHeadings = {
  en: {
    actual: "### Actual project block",
    what: "### What happens",
    why: "### Why this block exists",
    state: "### State before → after",
    breakage: "### What breaks if you remove or change it",
  },
  uk: {
    actual: "### Реальний блок проєкту",
    what: "### Що відбувається",
    why: "### Навіщо цей блок існує",
    state: "### Стан до → після",
    breakage: "### Що зламається, якщо прибрати або змінити",
  },
} as const;

const methodicalHeadings = {
  en: {
    concept: "### Concept",
    code: "### Code from the project",
    explanation: "### Detailed explanation",
    reasoning: "### Design reasoning",
  },
  uk: {
    concept: "### Концепція",
    code: "### Код із проєкту",
    explanation: "### Детальне пояснення",
    reasoning: "### Логіка рішення",
  },
} as const;

function between(markdown: string, start: string, end?: string) {
  const startIndex = markdown.indexOf(start);
  if (startIndex < 0) return "";

  const contentStart = startIndex + start.length;
  if (!end) return markdown.slice(contentStart).trim();

  const endIndex = markdown.indexOf(end, contentStart);
  if (endIndex < 0) return markdown.slice(contentStart).trim();
  return markdown.slice(contentStart, endIndex).trim();
}

function normalizeExecutionText(text: string, language: DesktopLanguage) {
  if (language === "uk") {
    return text
      .replace(/^До(?: [^:]+)?:\s*/u, "На початку ")
      .replace(/\bНа `yield`:\s*/gu, "Коли execution доходить до `yield`, ")
      .replace(/\bПісля(?: [^:]+)?:\s*/gu, "Після завершення цього кроку ");
  }

  return text
    .replace(/^Before(?: [^:]+)?:\s*/u, "Initially, ")
    .replace(/\bAt `yield`:\s*/gu, "When execution reaches `yield`, ")
    .replace(/\bAfter(?: [^:]+)?:\s*/gu, "Once this step completes, ");
}

export function buildDesktopMethodicalConcept(
  legacyConcept: string,
  language: DesktopLanguage,
) {
  const legacy = legacyHeadings[language];
  const copy = methodicalHeadings[language];

  const projectBlock = between(legacyConcept, legacy.actual, legacy.what);
  const what = between(legacyConcept, legacy.what, legacy.why);
  const why = between(legacyConcept, legacy.why, legacy.state);
  const state = normalizeExecutionText(
    between(legacyConcept, legacy.state, legacy.breakage),
    language,
  );
  const breakage = between(legacyConcept, legacy.breakage);

  // Keep the exact repository code, but teach it as ordinary learning material:
  // concept first, then the real implementation, then execution and engineering reasoning.
  return [
    copy.concept,
    why,
    copy.code,
    projectBlock,
    copy.explanation,
    what,
    state,
    copy.reasoning,
    breakage,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const desktopAutomationMethodicalIntros = {
  overview: {
    en: [
      "## Desktop automation through one real project",
      "",
      "This example is not a collection of unrelated code snippets. It is a guided study of one Windows desktop automation repository. The objective is to understand how an automated desktop test is built from the operating-system boundary upward: a test runner creates test state, launches a real application, discovers UI Automation elements, performs user-like actions, verifies both UI state and persisted data, cleans up its resources, and publishes evidence.",
      "",
      "### The execution model",
      "",
      "```diagram",
      "pytest / NUnit",
      "      ↓",
      "test setup and unique temporary file",
      "      ↓",
      "launch Notepad",
      "      ↓",
      "Windows UI Automation tree",
      "      ↓",
      "locate window → tab → editor",
      "      ↓",
      "input and synchronization",
      "      ↓",
      "UI assertion + saved-file assertion",
      "      ↓",
      "screenshots / Allure evidence",
      "      ↓",
      "cleanup",
      "```",
      "",
      "The repository implements the same desktop problem in two stacks: Python + pytest + pywinauto and C# + NUnit + FlaUI/UIA3. Studying both is useful because the syntax changes while the automation concepts remain the same. The final part moves the same tests into local PowerShell orchestration and GitHub Actions, where desktop automation adds an important constraint: tests need a Windows environment capable of interacting with a real graphical session.",
      "",
      "### How to study the example",
      "",
      "Read the lessons in execution order. For each code block, first understand the automation concept, then read the exact project code, then trace how execution reaches that code and what dependency or operating-system service it uses. Key points summarize the reusable idea; common pitfalls show the assumptions that usually make desktop tests fragile.",
    ].join("\n"),
    uk: [
      "## Desktop automation на прикладі реального проєкту",
      "",
      "Цей приклад — не набір незалежних code snippets. Це послідовний розбір одного Windows desktop automation repository. Мета — зрозуміти, як automated desktop test будується від межі з operating system угору: test runner створює test state, запускає реальний application, знаходить UI Automation elements, виконує user-like actions, перевіряє UI state і збережені дані, очищає ресурси та публікує evidence.",
      "",
      "### Модель виконання",
      "",
      "```diagram",
      "pytest / NUnit",
      "      ↓",
      "test setup і unique temporary file",
      "      ↓",
      "launch Notepad",
      "      ↓",
      "Windows UI Automation tree",
      "      ↓",
      "locate window → tab → editor",
      "      ↓",
      "input і synchronization",
      "      ↓",
      "UI assertion + saved-file assertion",
      "      ↓",
      "screenshots / Allure evidence",
      "      ↓",
      "cleanup",
      "```",
      "",
      "Repository реалізує ту саму desktop задачу у двох stacks: Python + pytest + pywinauto та C# + NUnit + FlaUI/UIA3. Це корисно для навчання, тому що syntax змінюється, а automation concepts залишаються тими самими. Фінальна частина переносить ті самі tests у local PowerShell orchestration і GitHub Actions, де з'являється важливе обмеження desktop automation: tests потребують Windows environment, здатного взаємодіяти з реальною graphical session.",
      "",
      "### Як проходити приклад",
      "",
      "Читайте lessons у порядку виконання. Для кожного code block спочатку зрозумійте automation concept, потім прочитайте точний project code, а далі простежте, як execution доходить до цього code і з якою dependency або operating-system service він працює. Key points фіксують reusable idea, а common pitfalls показують assumptions, через які desktop tests зазвичай стають fragile.",
    ].join("\n"),
  },
  python: {
    en: [
      "## Python implementation: pytest + pywinauto",
      "",
      "The Python implementation should be read as one lifecycle rather than as a list of helper functions. pytest owns test discovery and fixture execution. The fixture owns the temporary document and application lifecycle. pywinauto connects to the Windows UI Automation tree. Helper functions then solve four recurring desktop-automation problems: identifying the correct application state, locating the correct control, synchronizing with asynchronous UI/file-system changes, and collecting diagnostic evidence.",
      "",
      "```diagram",
      "pytest test function",
      "      ↑ receives window + temp path",
      "fixture setup",
      "      ↓",
      "Desktop(backend=\"uia\")",
      "      ↓",
      "window / tab / editor helpers",
      "      ↓",
      "keyboard + clipboard interaction",
      "      ↓",
      "poll until UI/file state is observable",
      "      ↓",
      "assertions",
      "      ↓",
      "fixture teardown",
      "```",
      "",
      "A central lesson here is that desktop automation is stateful. A process starting successfully does not mean the expected window is ready; a window existing does not mean the correct tab is active; a key press being sent does not mean the file has already been written. Reliable tests therefore identify state explicitly and wait for observable conditions instead of relying on fixed sleeps as the primary synchronization strategy.",
    ].join("\n"),
    uk: [
      "## Python implementation: pytest + pywinauto",
      "",
      "Python implementation треба читати як один lifecycle, а не як список helper functions. pytest відповідає за test discovery і fixture execution. Fixture володіє temporary document та application lifecycle. pywinauto підключається до Windows UI Automation tree. Далі helper functions вирішують чотири типові desktop-automation проблеми: визначити правильний application state, знайти правильний control, синхронізуватися з asynchronous UI/file-system changes і зібрати diagnostic evidence.",
      "",
      "```diagram",
      "pytest test function",
      "      ↑ receives window + temp path",
      "fixture setup",
      "      ↓",
      "Desktop(backend=\"uia\")",
      "      ↓",
      "window / tab / editor helpers",
      "      ↓",
      "keyboard + clipboard interaction",
      "      ↓",
      "poll until UI/file state is observable",
      "      ↓",
      "assertions",
      "      ↓",
      "fixture teardown",
      "```",
      "",
      "Ключова ідея: desktop automation є stateful. Успішний start process не означає, що потрібне window уже ready; існування window не означає, що active саме потрібний tab; відправлений key press не означає, що file уже записаний. Тому reliable tests явно ідентифікують state і чекають observable conditions замість того, щоб будувати synchronization переважно на fixed sleeps.",
    ].join("\n"),
  },
  dotnet: {
    en: [
      "## .NET implementation: NUnit + FlaUI/UIA3",
      "",
      "The .NET implementation demonstrates the same automation model with a more explicit framework layer. `NotepadTests` contains test intent: enter text, replace text, copy/paste, save and assert. `NotepadTestBase` contains reusable mechanics: create and delete test files, start Notepad, discover the correct window, locate the editor, operate the clipboard, synchronize, capture evidence and clean up.",
      "",
      "That separation is important. A test method should describe the scenario being verified; operating-system details belong in reusable framework code unless the OS behavior itself is the subject of the test. NUnit's `[SetUp]` and `[TearDown]` provide the lifecycle boundary, while FlaUI's `UIA3Automation` is the bridge into the same Windows UI Automation model used by the Python implementation.",
      "",
      "When comparing Python and C#, focus on equivalence rather than syntax: pytest fixture ↔ NUnit setup/teardown, pywinauto `Desktop(backend=\"uia\")` ↔ FlaUI `UIA3Automation`, polling helper ↔ retry/wait helper, and UI/file assertions ↔ the same two layers of verification.",
    ].join("\n"),
    uk: [
      "## .NET implementation: NUnit + FlaUI/UIA3",
      "",
      ".NET implementation показує ту саму automation model, але з більш явним framework layer. `NotepadTests` містить test intent: ввести text, замінити text, copy/paste, save і assert. `NotepadTestBase` містить reusable mechanics: створити й видалити test files, запустити Notepad, знайти правильне window, знайти editor, працювати з clipboard, виконати synchronization, зібрати evidence і зробити cleanup.",
      "",
      "Це розділення важливе. Test method має описувати scenario, який перевіряється; operating-system details краще тримати в reusable framework code, якщо OS behavior сам по собі не є subject of test. NUnit `[SetUp]` і `[TearDown]` задають lifecycle boundary, а FlaUI `UIA3Automation` є bridge до тієї самої Windows UI Automation model, яку використовує Python implementation.",
      "",
      "Порівнюючи Python і C#, дивіться не на syntax, а на equivalence: pytest fixture ↔ NUnit setup/teardown, pywinauto `Desktop(backend=\"uia\")` ↔ FlaUI `UIA3Automation`, polling helper ↔ retry/wait helper, UI/file assertions ↔ ті самі два layers verification.",
    ].join("\n"),
  },
  ci: {
    en: [
      "## Execution, CI, evidence and reporting",
      "",
      "Desktop automation does not end when a test method passes locally. The repository also defines how both stacks are installed, invoked, given artifact directories, aggregated into Allure results and executed on Windows in CI. This layer is part of the automation system because environment differences can change desktop behavior even when test code is unchanged.",
      "",
      "```diagram",
      "PowerShell / GitHub Actions",
      "      ↓",
      "prepare Python + .NET dependencies",
      "      ↓",
      "run pytest and dotnet test",
      "      ↓",
      "write screenshots + Allure result files",
      "      ↓",
      "preserve artifacts even on failure",
      "      ↓",
      "generate / deploy report where allowed",
      "```",
      "",
      "Read this section with two questions in mind: what must exist on the Windows runner before GUI interaction is possible, and what evidence must survive when the test fails? `if: always()`-style artifact/reporting steps matter precisely because failure diagnostics are most valuable when the normal test path did not complete.",
    ].join("\n"),
    uk: [
      "## Execution, CI, evidence і reporting",
      "",
      "Desktop automation не закінчується тоді, коли test method проходить локально. Repository також визначає, як встановлюються обидва stacks, як вони запускаються, куди пишуть artifacts, як об'єднуються Allure results і як tests виконуються на Windows у CI. Цей layer є частиною automation system, тому що environment differences можуть змінити desktop behavior навіть без змін у test code.",
      "",
      "```diagram",
      "PowerShell / GitHub Actions",
      "      ↓",
      "prepare Python + .NET dependencies",
      "      ↓",
      "run pytest and dotnet test",
      "      ↓",
      "write screenshots + Allure result files",
      "      ↓",
      "preserve artifacts even on failure",
      "      ↓",
      "generate / deploy report where allowed",
      "```",
      "",
      "Читайте цей section з двома питаннями: що має існувати на Windows runner до того, як GUI interaction взагалі стане можливою, і яке evidence повинно зберегтися, якщо test впаде? Steps на кшталт `if: always()` важливі саме тому, що failure diagnostics найбільш потрібні тоді, коли normal test path не завершився.",
    ].join("\n"),
  },
} as const;
