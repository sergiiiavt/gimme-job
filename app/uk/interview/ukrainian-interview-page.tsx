import Link from "next/link";
import interviewCatalog from "@/content/interview/catalog";
import pythonInterviewCatalog from "@/content/python-interview/catalog";
import { INTERVIEW_DOMAIN_ROUTES } from "@/content/interview/domain-routes";
import { UKRAINIAN_INTERVIEW_DOMAIN_ROUTES, UK_PYTHON_INTERVIEW } from "@/content/interview/ukrainian-routes";
import styles from "./ukrainian-interview-page.module.css";

type InterviewCodeExample = {
  title: string;
  titleUk?: string;
  language: string;
  code: string;
  explanation: string;
  explanationUk?: string;
  expectedResult?: string;
  expectedResultUk?: string;
};

type InterviewQuestion = {
  id: string;
  level: string;
  prevalence: string;
  category: string;
  kind?: string;
  question: string;
  questionUk?: string;
  shortAnswer: string;
  shortAnswerUk?: string;
  strongAnswerSignals: string[];
  strongAnswerSignalsUk?: string[];
  example?: string;
  exampleUk?: string;
  codeExamples?: InterviewCodeExample[];
  sourceIds: string[];
  tags?: string[];
};

type InterviewSource = {
  id: string;
  title: string;
  url: string;
  publisher?: string;
  role?: string;
};

const CATEGORY_UK: Record<string, string> = {
  Fundamentals: "Основи тестування",
  "Test design": "Тест-дизайн",
  "Documentation and defects": "Документація та дефекти",
  "Web, API and data": "Web, API та дані",
  Mobile: "Mobile",
  "Embedded and IoT": "Embedded та IoT",
  "Automation and CI": "Автоматизація та CI",
  Programming: "Програмування",
  Infrastructure: "Інфраструктура",
  "Performance and resilience": "Performance та стійкість",
  "Security and accessibility": "Безпека та accessibility",
  "Agile and delivery": "Agile та delivery",
  "Metrics and estimation": "Метрики та оцінювання",
  "Strategy and risk": "Стратегія та ризики",
  Leadership: "Лідерство",
  "Practical tasks": "Практичні завдання",
  "AI, ML and LLM": "AI, ML та LLM",
  "Databases, SQL and BI": "Бази даних, SQL та BI",
  "Observability and production": "Observability та production",
  "Regulated domains": "Регульовані домени",
};

const PYTHON_RELATED_LINKS = [
  { label: "Programming reference", href: "/reference/programming" },
  { label: "Test automation learning", href: "/learn/automation" },
  { label: "QA Automation interview", href: "/uk/interview/automation" },
] as const;

function localizedCategory(category: string) {
  return CATEGORY_UK[category] ?? category;
}

function normalizeQuestionText(question: InterviewQuestion) {
  return {
    question: question.questionUk ?? question.question,
    answer: question.shortAnswerUk ?? question.shortAnswer,
    signals: question.strongAnswerSignalsUk ?? question.strongAnswerSignals,
    example: question.exampleUk ?? question.example,
  };
}

function QuestionCard({ question, sources, open = false }: { question: InterviewQuestion; sources: Map<string, InterviewSource>; open?: boolean }) {
  const text = normalizeQuestionText(question);
  const questionSources = question.sourceIds.map((id) => sources.get(id)).filter((source): source is InterviewSource => Boolean(source));

  return (
    <details className={styles.question} id={`question-${question.id}`} open={open}>
      <summary>
        <div className={styles.questionMeta}>
          <span>{localizedCategory(question.category)}</span>
          <span>{question.level}</span>
          <span>{question.prevalence}</span>
          {question.kind ? <span>{question.kind}</span> : null}
        </div>
        <h2>{text.question}</h2>
      </summary>
      <div className={styles.answer}>
        <section>
          <h3>Відповідь</h3>
          <p>{text.answer}</p>
        </section>

        {text.signals.length ? (
          <section>
            <h3>Сильна відповідь включає</h3>
            <ul>{text.signals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
          </section>
        ) : null}

        {question.codeExamples?.length ? (
          <section>
            <h3>Практичні приклади</h3>
            <div className={styles.codeExamples}>
              {question.codeExamples.map((example, index) => (
                <article className={styles.codeExample} key={`${question.id}-code-${index}`}>
                  <strong>{example.titleUk ?? example.title}</strong>
                  <pre><code>{example.code}</code></pre>
                  <p>{example.explanationUk ?? example.explanation}</p>
                  {(example.expectedResultUk ?? example.expectedResult) ? (
                    <p><b>Очікуваний результат:</b> {example.expectedResultUk ?? example.expectedResult}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : text.example ? (
          <section>
            <h3>Практичний приклад</h3>
            <p>{text.example}</p>
          </section>
        ) : null}

        {question.tags?.length ? (
          <div className={styles.tags}>{question.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        ) : null}

        {questionSources.length ? (
          <section className={styles.sources}>
            <h3>Джерела</h3>
            {questionSources.map((source) => (
              <a href={source.url} key={source.id} rel="noreferrer" target="_blank">
                <strong>{source.title}</strong>
                <span>{[source.publisher, source.role].filter(Boolean).join(" · ")}</span>
              </a>
            ))}
          </section>
        ) : null}
      </div>
    </details>
  );
}

export default function UkrainianInterviewPage({
  description,
  domainId,
  englishPath,
  label,
  path,
  python = false,
  questionId,
  title,
}: {
  description: string;
  domainId?: string;
  englishPath: string;
  label: string;
  path: string;
  python?: boolean;
  questionId?: string;
  title: string;
}) {
  const baseQuestions = (python ? pythonInterviewCatalog.questions : interviewCatalog.questions) as InterviewQuestion[];
  const sourceList = (python ? pythonInterviewCatalog.sources : interviewCatalog.sources) as InterviewSource[];
  const sources = new Map(sourceList.map((source) => [source.id, source]));

  let questions = baseQuestions;
  if (!python) {
    const domains = interviewCatalog.domains as Array<{ id: string; category?: string }>;
    const selectedDomain = domains.find((item) => item.id === domainId);
    const categoryToDomain = interviewCatalog.categoryToDomain as Record<string, string>;
    questions = selectedDomain?.category
      ? baseQuestions.filter((question) => categoryToDomain[question.category] === selectedDomain.category)
      : [];
  }

  const selectedQuestion = questionId ? questions.find((question) => question.id === questionId) : undefined;
  const visibleQuestions = questionId ? (selectedQuestion ? [selectedQuestion] : []) : questions;
  const relatedLinks = python
    ? PYTHON_RELATED_LINKS
    : INTERVIEW_DOMAIN_ROUTES.find((route) => route.id === domainId)?.relatedLinks ?? [];

  return (
    <main className={styles.page} lang="uk">
      <div className={styles.topbar}>
        <Link className={styles.brand} href="/">GimmeJob</Link>
        <nav aria-label="Мова сторінки" className={styles.languages}>
          <Link href={englishPath} hrefLang="en" lang="en">EN</Link>
          <span aria-current="page">UA</span>
        </nav>
      </div>

      <div className={styles.content}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href="/uk/interview">Питання для співбесіди</Link>
          {path !== "/uk/interview" ? <><span aria-hidden="true">/</span><span aria-current="page">{label}</span></> : null}
        </nav>

        <header className={styles.hero}>
          <p>Українська версія</p>
          <h1>{title}</h1>
          <span>{description}</span>
          <div className={styles.stats}>
            <strong>{questions.length}</strong>
            <span>{questions.length === 1 ? "питання" : "питань"}</span>
          </div>
        </header>

        <nav aria-label="Домени питань для співбесіди" className={styles.domains}>
          {UKRAINIAN_INTERVIEW_DOMAIN_ROUTES.map((route) => (
            <Link
              aria-current={!python && route.id === domainId ? "page" : undefined}
              className={!python && route.id === domainId ? styles.activeDomain : undefined}
              href={route.path}
              key={route.id}
            >
              {route.ukLabel}
            </Link>
          ))}
          <Link aria-current={python ? "page" : undefined} className={python ? styles.activeDomain : undefined} href={UK_PYTHON_INTERVIEW.path}>Python</Link>
        </nav>

        {relatedLinks.length ? (
          <nav aria-label="Пов’язані навчальні матеріали" className={styles.related}>
            <span>Пов’язані матеріали</span>
            {relatedLinks.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
          </nav>
        ) : null}

        {questionId && !selectedQuestion ? (
          <section className={styles.empty}>
            <h2>Питання не знайдено</h2>
            <p>У цьому розділі немає опублікованого питання з ID <code>{questionId}</code>.</p>
            <Link href={path}>← Повернутися до всіх питань</Link>
          </section>
        ) : (
          <section aria-label="Питання та відповіді" className={styles.list}>
            {questionId ? <Link className={styles.back} href={path}>← Повернутися до всіх питань</Link> : null}
            {visibleQuestions.map((question) => <QuestionCard key={question.id} open={Boolean(questionId)} question={question} sources={sources}/>)}
          </section>
        )}
      </div>
    </main>
  );
}
