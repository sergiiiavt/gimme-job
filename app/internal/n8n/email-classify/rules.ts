import type { EmailAction, EmailClassification } from "../email-events/email-event.ts";

export const EMAIL_CLASSIFIER_VERSION = "automation-v2.0";

export type RuleEmail = {
  sender_name: string | null;
  sender_email: string | null;
  subject: string;
  text_excerpt: string | null;
};

export type RuleClassification = {
  classification: Exclude<EmailClassification, "UNCLASSIFIED" | "RECRUITER">;
  confidence: number;
  source: string;
  summary: string;
  company: string | null;
  jobTitle: string | null;
  recruiterName: string | null;
  action: EmailAction;
};

function searchText(event: RuleEmail): string {
  return [event.subject, event.text_excerpt].filter(Boolean).join("\n").toLowerCase();
}

function sender(event: RuleEmail): string {
  return (event.sender_email ?? "").trim().toLowerCase();
}

function senderDomain(event: RuleEmail): string {
  const value = sender(event);
  const at = value.lastIndexOf("@");
  return at >= 0 ? value.slice(at + 1) : value;
}

function result(
  classification: RuleClassification["classification"],
  confidence: number,
  rule: string,
  summary: string,
  options: Partial<Pick<RuleClassification, "company" | "jobTitle" | "recruiterName" | "action">> = {},
): RuleClassification {
  const defaultAction: Record<RuleClassification["classification"], EmailAction> = {
    APPLICATION_RECEIVED: "TRACK_APPLICATION",
    RECRUITER_OUTREACH: "REVIEW",
    INTERVIEW: "PREPARE_INTERVIEW",
    TEST_TASK: "COMPLETE_TEST_TASK",
    OFFER: "REVIEW_OFFER",
    REJECTION: "NO_ACTION",
    JOB_ALERT: "REVIEW_JOB_ALERT",
    SERVICE_MESSAGE: "NO_ACTION",
    NON_JOB: "NO_ACTION",
    OTHER: "REVIEW",
  };

  return {
    classification,
    confidence,
    source: `RULE:${rule}`,
    summary: summary.slice(0, 240),
    company: options.company ?? null,
    jobTitle: options.jobTitle ?? null,
    recruiterName: options.recruiterName ?? null,
    action: options.action ?? defaultAction[classification],
  };
}

export function preAiClassification(event: RuleEmail): RuleClassification | null {
  const from = sender(event);
  const domain = senderDomain(event);
  const subject = event.subject.toLowerCase();
  const searchable = searchText(event);

  if (from === "forwarding-noreply@google.com" && /forwarding confirmation/.test(subject)) {
    return result("SERVICE_MESSAGE", 1, "gmail-forwarding-confirmation", "Gmail forwarding confirmation");
  }

  const technicalSender =
    domain === "github.com" ||
    domain.endsWith(".github.com") ||
    domain === "sonarcloud.io" ||
    domain.endsWith(".sonarcloud.io") ||
    /github|sonarqube|sonarcloud/.test(from);
  const technicalSubject = /pull request|workflow run|github actions|quality gate|code scanning|security alert|repository/.test(subject);
  if (technicalSender && technicalSubject) {
    return result("SERVICE_MESSAGE", 0.99, "developer-notification", event.subject);
  }

  if (/verification|verify your (?:email|account)|security code|password reset|confirm your account/.test(subject) &&
      !/application|interview|job|vacanc|recruit|offer/.test(searchable)) {
    return result("SERVICE_MESSAGE", 0.97, "account-verification", event.subject);
  }

  const jobPlatform = /(^|\.)(linkedin\.com|robota\.ua|work\.ua|djinni\.co)$/.test(domain);
  const jobAlertSignal = /job alert|jobs for you|recommended jobs|recommended vacancies|vacancies for you|new jobs matching|vacancy digest|добірк[аи] ваканс|рекомендован[іа] ваканс/.test(searchable);
  if (jobAlertSignal && (jobPlatform || /automated|digest|alert|recommend/.test(searchable))) {
    let company: string | null = null;
    if (domain.includes("linkedin")) company = "LinkedIn";
    else if (domain.includes("robota.ua")) company = "robota.ua";
    else if (domain.includes("work.ua")) company = "Work.ua";
    else if (domain.includes("djinni")) company = "Djinni";
    return result("JOB_ALERT", 0.98, "job-alert", event.subject, { company });
  }

  const knownConsumerDomain = /(^|\.)(gog\.com|steam(?:powered|community)?\.com|epicgames\.com)$/.test(domain);
  const promotionSignal = /wishlist|discount|sale|special offer|promo(?:tion)?|% off|save \d+%|розпродаж|знижк/.test(searchable);
  if (knownConsumerDomain && promotionSignal) {
    return result("NON_JOB", 0.99, "consumer-promotion", event.subject, {
      company: domain.includes("gog.com") ? "GOG.com" : null,
    });
  }

  const newsletterSignal = /unsubscribe|manage preferences|view in browser/.test(searchable);
  if (newsletterSignal && promotionSignal && !/job|vacanc|career|recruit|interview|application|position|role/.test(searchable)) {
    return result("NON_JOB", 0.96, "non-job-newsletter", event.subject);
  }

  return null;
}

export function fallbackClassification(event: RuleEmail): RuleClassification | null {
  const searchable = searchText(event);

  if (/\b(unfortunately|not moving forward|other candidates|not selected|declined|rejection|reject(?:ed|ion)?)\b/.test(searchable)) {
    return result("REJECTION", 0.86, "fallback-rejection", event.subject);
  }
  if (/\b(job offer|employment offer|offer letter|offer of employment|compensation package)\b/.test(searchable)) {
    return result("OFFER", 0.85, "fallback-offer", event.subject);
  }
  if (/\b(test task|take[- ]home|technical assessment|coding challenge|home assignment|assessment task)\b/.test(searchable)) {
    return result("TEST_TASK", 0.82, "fallback-test-task", event.subject);
  }
  if (/\b(interview|screening call|technical call|technical round|hiring manager call|schedule a call)\b/.test(searchable)) {
    return result("INTERVIEW", 0.82, "fallback-interview", event.subject);
  }
  if (/\b(application (?:has been )?received|application submitted|thanks? for applying|thank you for applying|received your application)\b/.test(searchable)) {
    return result("APPLICATION_RECEIVED", 0.84, "fallback-application-received", event.subject);
  }

  return null;
}
