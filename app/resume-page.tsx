"use client";

import { useEffect, useState } from "react";

type SiteMode = "public" | "personal";

interface PrivateContact {
  email?: string;
  phone?: string;
  location?: string;
}

const linkedInUrl = "https://www.linkedin.com/in/serhii-yavtushkevych-ba1a2686/";

const skills = [
  "Manual testing: functional, regression, smoke, integration, exploratory",
  "Test automation: Python, Selenium, Behave, Pytest, Playwright, TypeScript",
  "API testing: Postman, web services testing",
  "Performance testing: JMeter",
  "SQL and database validation",
  "CI/CD and tools: Jenkins, Azure, Docker, Git",
  "Test management / bug tracking: TFS, Jira, Zephyr, TestRail, QC, TestLink",
  "Leadership, Scrum Master, coaching, communication with Product Owner",
  "Broad use of AI tools and experience testing LLM-based solutions",
];

const experience = [
  {
    role: "Lead QA Engineer",
    company: "TIETO UKRAINE LTD",
    period: "April 2021 - Present",
    achievements: [
      "Led a 12-person QA team, including task coordination and delivery control.",
      "Planned testing activities and managed priorities and scope of work.",
      "Mentored new employees and supported onboarding and team development.",
      "Communicated with the Product Owner and other stakeholders on product quality.",
      "Prepared reports, maintained test documentation, and improved QA processes.",
      "Participated in Scrum processes and acted as Scrum Master when needed.",
    ],
  },
  {
    role: "Senior QA Automation Engineer",
    company: "GlobalLogic",
    period: "January 2019 - May 2021",
    achievements: [
      "Developed and maintained automated tests for web applications.",
      "Worked with the Python stack, Selenium, Behave, Pytest, Playwright, and TypeScript.",
      "Integrated automated tests into CI/CD processes and supported release quality.",
      "Performed API testing, database data validation, and maintained test documentation.",
    ],
  },
  {
    role: "Lead QA Engineer",
    company: "GlobalLogic",
    period: "January 2014 - June 2019",
    privateLocation: true,
    achievements: [
      "Performed manual testing of software products, requirements analysis, and test design.",
      "Created test cases, checklists, test plans, and managed defect tracking.",
      "Coordinated QA activities and collaborated with development and management teams.",
    ],
  },
];

const additional = [
  "Experience creating and maintaining test documentation.",
  "Strong reporting and structured communication skills.",
  "Experience coaching and mentoring employees.",
  "Hands-on experience acting as Scrum Master.",
];

export default function ResumePage({ mode }: { mode: SiteMode }) {
  const [contact, setContact] = useState<PrivateContact | null>(null);
  const [contactState, setContactState] = useState<"idle" | "loading" | "ready" | "error">(mode === "personal" ? "loading" : "idle");

  useEffect(() => {
    if (mode !== "personal") return;
    let active = true;
    fetch("/api/settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("Private profile unavailable.");
        return response.json() as Promise<{ profile?: { contact?: PrivateContact } }>;
      })
      .then((result) => {
        if (!active) return;
        setContact(result.profile?.contact ?? null);
        setContactState("ready");
      })
      .catch(() => {
        if (active) setContactState("error");
      });
    return () => { active = false; };
  }, [mode]);

  return (
    <div className="kb-content resume-page">
      <article className="resume-sheet">
        <header className="resume-header">
          <span>{mode === "personal" ? "PERSONAL RESUME / PRIVATE CONTACT" : "PUBLIC RESUME / LINKEDIN ONLY"}</span>
          <h1>SERHII YAVTUSHKEVYCH</h1>
          <p>Lead QA Engineer <i/> Senior QA Engineer <i/> QA Automation Engineer</p>
          <div className="resume-contact" aria-live="polite">
            {mode === "personal" && contactState === "loading" && <span>Loading private contact…</span>}
            {mode === "personal" && contactState === "error" && <span>Private contact is temporarily unavailable.</span>}
            {mode === "personal" && contact?.location && <span>{contact.location}</span>}
            {mode === "personal" && contact?.phone && <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>{contact.phone}</a>}
            {mode === "personal" && contact?.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
            <a href={linkedInUrl} target="_blank" rel="noreferrer">LinkedIn ↗</a>
          </div>
          <div className="resume-credentials"><span>English: Upper-Intermediate</span><span>ISTQB Foundation Level</span></div>
        </header>

        <section className="resume-section">
          <h2>Profile</h2>
          <p>QA Lead / Test Engineer with 12+ years of experience in comprehensive software testing, primarily web applications and APIs. 4+ years of experience in test automation using Python, Selenium, Behave, Pytest, Playwright, and TypeScript. Led a QA team of 12 people: coordinated tasks, managed scope, mentored newcomers, maintained quality processes, and collaborated with stakeholders. Strengths include building QA processes, test documentation, API and database testing, reporting, Scrum practices, and team coaching. Hands-on experience applying AI tools in testing and automation tasks.</p>
        </section>

        <section className="resume-section">
          <h2>Key skills</h2>
          <ul className="resume-skill-grid">{skills.map((skill) => <li key={skill}>{skill}</li>)}</ul>
        </section>

        <section className="resume-section">
          <h2>Work experience</h2>
          <div className="resume-timeline">
            {experience.map((entry) => (
              <article key={`${entry.company}-${entry.role}-${entry.period}`}>
                <div><h3>{entry.role}</h3><span>{entry.company}</span><time>{entry.period}</time>{entry.privateLocation && mode === "personal" && contact?.location && <small>{contact.location}</small>}</div>
                <ul>{entry.achievements.map((achievement) => <li key={achievement}>{achievement}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="resume-section resume-education">
          <h2>Education and certifications</h2>
          <div><strong>Master&apos;s Degree, Computer Science</strong><span>National Technical University of Ukraine “Igor Sikorsky Kyiv Polytechnic Institute”</span><time>2008 - 2014</time></div>
          <p>ISTQB Certified Software Tester - Foundation Level</p>
        </section>

        <section className="resume-section">
          <h2>Additional information</h2>
          <ul className="resume-additional">{additional.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </article>
    </div>
  );
}
