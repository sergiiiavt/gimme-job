"use client";

import { useEffect, useState } from "react";

type SiteMode = "public" | "personal";

interface PrivateContact { email?: string; phone?: string; location?: string; }

interface ResumeData {
  name: string;
  headline: string;
  linkedInUrl: string;
  english: string;
  certification: string;
  profile: string;
  degree: string;
  university: string;
  educationPeriod: string;
  educationCertification: string;
  skills: string[];
  experience: Array<{ role: string; company: string; period: string; privateLocation?: boolean; achievements: string[] }>;
  additional: string[];
}

export default function ResumePage({ mode }: { mode: SiteMode }) {
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [resumeError, setResumeError] = useState(false);
  const [contact, setContact] = useState<PrivateContact | null>(null);
  const [contactState, setContactState] = useState<"idle" | "loading" | "ready" | "error">(mode === "personal" ? "loading" : "idle");

  useEffect(() => {
    let active = true;
    fetch("/api/owner-resume", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Resume unavailable.");
        return response.json() as Promise<ResumeData>;
      })
      .then((result) => { if (active) setResume(result); })
      .catch(() => { if (active) setResumeError(true); });
    return () => { active = false; };
  }, []);

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
        {resumeError && <p role="alert">Private resume is unavailable.</p>}
        {!resume && !resumeError && <p role="status">Loading resume…</p>}
        <header className="resume-header">
          <span>PRIVATE RESUME</span>
          <h1>{resume?.name}</h1>
          <p>{resume?.headline}</p>
          <div className="resume-contact" aria-live="polite">
            {mode === "personal" && contactState === "loading" && <span>Loading private contact…</span>}
            {mode === "personal" && contactState === "error" && <span>Private contact is temporarily unavailable.</span>}
            {mode === "personal" && contact?.location && <span>{contact.location}</span>}
            {mode === "personal" && contact?.phone && <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>{contact.phone}</a>}
            {mode === "personal" && contact?.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
            {resume?.linkedInUrl && <a href={resume.linkedInUrl} target="_blank" rel="noreferrer">LinkedIn ↗</a>}
          </div>
          <div className="resume-credentials"><span>{resume?.english}</span><span>{resume?.certification}</span></div>
        </header>

        <section className="resume-section">
          <h2>Profile</h2>
          <p>{resume?.profile}</p>
        </section>

        <section className="resume-section">
          <h2>Key skills</h2>
          <ul className="resume-skill-grid">{resume?.skills.map((skill) => <li key={skill}>{skill}</li>)}</ul>
        </section>

        <section className="resume-section">
          <h2>Work experience</h2>
          <div className="resume-timeline">
            {resume?.experience.map((entry) => (
              <article key={`${entry.company}-${entry.role}-${entry.period}`}>
                <div><h3>{entry.role}</h3><span>{entry.company}</span><time>{entry.period}</time>{entry.privateLocation && mode === "personal" && contact?.location && <small>{contact.location}</small>}</div>
                <ul>{entry.achievements.map((achievement) => <li key={achievement}>{achievement}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="resume-section resume-education">
          <h2>Education and certifications</h2>
          <div><strong>{resume?.degree}</strong><span>{resume?.university}</span><time>{resume?.educationPeriod}</time></div>
          <p>{resume?.educationCertification}</p>
        </section>

        <section className="resume-section">
          <h2>Additional information</h2>
          <ul className="resume-additional">{resume?.additional.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </article>
    </div>
  );
}
