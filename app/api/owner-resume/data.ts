// Server-only: do not import into client components or public learning content.
const linkedInUrl = "https://www.linkedin.com/in/serhii-yavtushkevych-ba1a2686/";

const skills = [
  "QA leadership: 12-person team, planning, prioritization, mentoring, onboarding, QA process improvement",
  "Test automation: Python, Pytest, Playwright, TypeScript, Selenium, Behave",
  "AI / LLM: AI tools in QA and automation, testing LLM-based solutions, RAG familiarity",
  "Backend / API: REST, HTTP, Postman, Bruno, client-server testing, Fiddler, WebSocket familiarity",
  "Databases / data: MSSQL, PostgreSQL, SQL, data validation, ETL familiarity",
  "CI/CD and engineering tools: Azure DevOps Pipelines, GitHub Actions, Jenkins, Azure, Docker, Git",
  "Test documentation: test cases, checklists, test plans, bug reports, reporting",
  "Logs / observability: Grafana, Azure Application Insights, troubleshooting and defect localization",
  "Mobile / desktop: Android/iOS testing, desktop testing, Appium familiarity",
  "Embedded / IoT familiarity: software-hardware interaction, MQTT, BLE",
  "Manual testing: Web and API, functional, regression, smoke, exploratory, and integration testing",
  "Test management / performance: Jira, TestRail, Azure DevOps, Zephyr, JMeter",
];

const experience = [
  {
    role: "Lead QA Engineer",
    company: "TIETO UKRAINE LTD",
    period: "April 2021 - Present",
    achievements: [
      "Lead a 12-person QA team, coordinating day-to-day work, priorities, mentoring, onboarding, and delivery control.",
      "Plan testing activities and release-related QA work, balancing scope, priorities, risks, and delivery needs.",
      "Build and continuously improve QA processes, test documentation, reporting, and team working practices.",
      "Built an automated testing framework and CI process to support repeatable quality checks and faster feedback.",
      "Collaborate with Product Owner, developers, and other stakeholders on product quality, defects, release readiness, and technical issues.",
      "Test LLM-based solutions and apply AI tools in QA analysis, test design, automation, and engineering workflows.",
    ],
  },
  {
    role: "Senior QA Automation Engineer",
    company: "GlobalLogic",
    period: "January 2019 - May 2021",
    achievements: [
      "Developed, maintained, and extended automated tests for web applications.",
      "Worked with Python, Selenium, Behave, Pytest, Playwright, and TypeScript across automation tasks.",
      "Performed API testing and database validation to verify backend behavior and data correctness.",
      "Integrated automated tests into CI/CD processes and supported release quality with repeatable automated checks.",
      "Maintained test documentation and collaborated with development teams on defect investigation and resolution.",
    ],
  },
  {
    role: "Senior / Lead QA Engineer",
    company: "GlobalLogic",
    period: "January 2014 - June 2019",
    privateLocation: true,
    achievements: [
      "Led testing activities and coordinated QA work across the team while helping establish and improve QA processes.",
      "Performed functional and integration testing for web and API-based systems, including requirements analysis and test design.",
      "Created and maintained test cases, checklists, test plans, bug reports, and defect-tracking workflows.",
      "Validated data in databases, localized defects, investigated failures, and supported troubleshooting across system components.",
      "Worked closely with developers, analysts, managers, and other stakeholders to clarify requirements and improve product quality.",
    ],
  },
];

const additional = [
  "Experience coaching, mentoring, and onboarding QA engineers.",
  "Hands-on experience acting as Scrum Master and supporting Scrum team practices.",
  "Practical use of AI/LLM tools in testing, analysis, automation, and day-to-day engineering work.",
  "Broad experience combining manual testing, automation, API/data validation, troubleshooting, and QA leadership.",
];

export const ownerResume = {
  name: "SERHII YAVTUSHKEVYCH",
  headline: "QA Team Lead · Senior QA Engineer · QA Automation Engineer",
  linkedInUrl,
  english: "English: Upper-Intermediate",
  certification: "ISTQB Foundation Level",
  profile: "QA Team Lead / Senior QA Engineer with 12+ years of experience across Web and API testing, functional and integration testing, and 4+ years of hands-on test automation. Experienced in leading a 12-person QA team, planning testing and release activities, improving QA processes, mentoring engineers, and working directly with product and engineering stakeholders. Strong practical background in REST API testing, SQL and database validation with MSSQL and PostgreSQL, test documentation, logs and observability, troubleshooting, automation framework development, and CI processes. Additional experience includes mobile and desktop testing, Appium familiarity, embedded/IoT concepts such as MQTT and BLE, and practical use of AI/LLM tools including testing LLM-based solutions and familiarity with RAG.",
  degree: "Master's Degree, Computer Science",
  university: "National Technical University of Ukraine “Igor Sikorsky Kyiv Polytechnic Institute”",
  educationPeriod: "2008 - 2014",
  educationCertification: "ISTQB Certified Software Tester - Foundation Level",
  skills,
  experience,
  additional,
};
