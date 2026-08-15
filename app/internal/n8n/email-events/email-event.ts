export const EMAIL_CLASSIFICATIONS = [
  "UNCLASSIFIED",
  "RECRUITER",
  "INTERVIEW",
  "REJECTION",
  "TEST_TASK",
  "OFFER",
  "OTHER",
] as const;

export type EmailClassification = (typeof EMAIL_CLASSIFICATIONS)[number];

export type NormalizedEmailEvent = {
  id: string;
  provider: "gmail";
  providerMessageId: string;
  threadId: string | null;
  receivedAt: string;
  senderName: string | null;
  senderEmail: string | null;
  subject: string;
  classification: EmailClassification;
  summary: string | null;
  company: string | null;
  jobTitle: string | null;
  recruiterName: string | null;
  jobId: string | null;
};

export class EmailEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailEventValidationError";
  }
}

const RAW_BODY_FIELDS = ["body", "html", "text", "textHtml", "textPlain", "raw", "snippet"] as const;
const MAX_ID_LENGTH = 512;
const MAX_EMAIL_LENGTH = 320;
const MAX_SUBJECT_LENGTH = 1_000;
const MAX_NAME_LENGTH = 300;
const MAX_SUMMARY_LENGTH = 2_000;

function objectPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EmailEventValidationError("Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function requiredString(payload: Record<string, unknown>, key: string, maxLength: number): string {
  const value = payload[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new EmailEventValidationError(`${key} is required.`);
  }
  const clean = value.trim();
  if (clean.length > maxLength) {
    throw new EmailEventValidationError(`${key} is too long.`);
  }
  return clean;
}

function optionalString(
  payload: Record<string, unknown>,
  key: string,
  maxLength: number,
  options: { lowerCase?: boolean } = {},
): string | null {
  const value = payload[key];
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new EmailEventValidationError(`${key} must be a string.`);
  }
  let clean = value.trim();
  if (!clean) return null;
  if (clean.length > maxLength) {
    throw new EmailEventValidationError(`${key} is too long.`);
  }
  if (options.lowerCase) clean = clean.toLowerCase();
  return clean;
}

function subject(payload: Record<string, unknown>): string {
  const value = payload.subject;
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") {
    throw new EmailEventValidationError("subject must be a string.");
  }
  const clean = value.trim();
  if (clean.length > MAX_SUBJECT_LENGTH) {
    throw new EmailEventValidationError("subject is too long.");
  }
  return clean;
}

function receivedAt(payload: Record<string, unknown>): string {
  const value = requiredString(payload, "receivedAt", 100);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new EmailEventValidationError("receivedAt must be a valid date/time.");
  }
  return parsed.toISOString();
}

function classification(payload: Record<string, unknown>): EmailClassification {
  const value = payload.classification;
  if (value === null || value === undefined || value === "") return "UNCLASSIFIED";
  if (typeof value !== "string") {
    throw new EmailEventValidationError("classification must be a string.");
  }
  const normalized = value.trim().toUpperCase();
  if (!EMAIL_CLASSIFICATIONS.includes(normalized as EmailClassification)) {
    throw new EmailEventValidationError(`Unsupported classification: ${value}.`);
  }
  return normalized as EmailClassification;
}

function rejectRawEmailBody(payload: Record<string, unknown>): void {
  for (const field of RAW_BODY_FIELDS) {
    const value = payload[field];
    if (value !== undefined && value !== null && value !== "") {
      throw new EmailEventValidationError(
        `${field} is not accepted. GimmeJob stores structured email metadata, not raw email bodies.`,
      );
    }
  }
}

export function bearerToken(authorization: string | null): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

export function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

export function normalizeEmailEvent(input: unknown): NormalizedEmailEvent {
  const payload = objectPayload(input);
  rejectRawEmailBody(payload);

  const providerMessageId = requiredString(payload, "providerMessageId", MAX_ID_LENGTH);
  const senderEmail = optionalString(payload, "senderEmail", MAX_EMAIL_LENGTH, { lowerCase: true });

  if (senderEmail && (!senderEmail.includes("@") || senderEmail.startsWith("@") || senderEmail.endsWith("@"))) {
    throw new EmailEventValidationError("senderEmail must be a valid email address.");
  }

  return {
    id: `gmail:${providerMessageId}`,
    provider: "gmail",
    providerMessageId,
    threadId: optionalString(payload, "threadId", MAX_ID_LENGTH),
    receivedAt: receivedAt(payload),
    senderName: optionalString(payload, "senderName", MAX_NAME_LENGTH),
    senderEmail,
    subject: subject(payload),
    classification: classification(payload),
    summary: optionalString(payload, "summary", MAX_SUMMARY_LENGTH),
    company: optionalString(payload, "company", MAX_NAME_LENGTH),
    jobTitle: optionalString(payload, "jobTitle", MAX_NAME_LENGTH),
    recruiterName: optionalString(payload, "recruiterName", MAX_NAME_LENGTH),
    jobId: optionalString(payload, "jobId", MAX_ID_LENGTH),
  };
}
