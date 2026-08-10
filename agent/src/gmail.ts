import { authenticate } from "@google-cloud/local-auth";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { google, type gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { JobInput } from "./domain.js";
import {
  canonicalizeUrl,
  extractEmail,
  inferCompany,
  inferRoleTitle,
  isRemoteText,
  safeIsoDate,
  stripHtml,
  unwrapTrackingUrl,
} from "./utils.js";
import type { JobSource } from "./sources/types.js";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

interface GoogleClientSecrets {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

function readClientSecrets(credentialsPath: string): NonNullable<GoogleClientSecrets["installed"]> {
  if (!existsSync(credentialsPath)) {
    throw new Error(
      `Google OAuth credentials not found: ${credentialsPath}. Create a Desktop OAuth client first.`,
    );
  }
  const parsed = JSON.parse(readFileSync(credentialsPath, "utf8")) as GoogleClientSecrets;
  const client = parsed.installed ?? parsed.web;
  if (!client) throw new Error("Invalid Google OAuth credentials JSON: missing installed/web key.");
  return client;
}

export async function authorizeGmail(
  credentialsPath: string,
  tokenPath: string,
  forceInteractive = false,
): Promise<OAuth2Client> {
  const clientConfig = readClientSecrets(credentialsPath);

  if (!forceInteractive && existsSync(tokenPath)) {
    const client = new google.auth.OAuth2(
      clientConfig.client_id,
      clientConfig.client_secret,
      clientConfig.redirect_uris[0],
    );
    client.setCredentials(JSON.parse(readFileSync(tokenPath, "utf8")) as object);
    return client;
  }

  const client = await authenticate({ keyfilePath: credentialsPath, scopes: GMAIL_SCOPES });
  writeFileSync(tokenPath, JSON.stringify(client.credentials, null, 2), { mode: 0o600 });
  chmodSync(tokenPath, 0o600);
  return client;
}

function header(payload: gmail_v1.Schema$MessagePart | undefined, name: string): string {
  const match = payload?.headers?.find(
    (entry) => entry.name?.toLowerCase() === name.toLowerCase(),
  );
  return match?.value ?? "";
}

function decodeBase64Url(value: string | null | undefined): string {
  if (!value) return "";
  return Buffer.from(value, "base64url").toString("utf8");
}

function bodyParts(part: gmail_v1.Schema$MessagePart | undefined): {
  plain: string[];
  html: string[];
} {
  const result = { plain: [] as string[], html: [] as string[] };
  if (!part) return result;
  const mime = part.mimeType?.toLowerCase() ?? "";
  const decoded = decodeBase64Url(part.body?.data);
  if (decoded && mime === "text/plain") result.plain.push(decoded);
  if (decoded && mime === "text/html") result.html.push(decoded);
  for (const child of part.parts ?? []) {
    const nested = bodyParts(child);
    result.plain.push(...nested.plain);
    result.html.push(...nested.html);
  }
  return result;
}

const IGNORED_LINK_TEXT = /^(view|open|details|apply|apply now|see more|learn more|переглянути|відгукнутися)$/i;
const IGNORED_URL = /(unsubscribe|email-preferences|notification-settings|privacy|terms|login|sign-in|help\/)/i;

function isLikelyJobUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (IGNORED_URL.test(`${url.pathname}${url.search}`)) return false;
    const knownHost = [
      "linkedin.com",
      "jobs.dou.ua",
      "djinni.co",
      "work.ua",
      "greenhouse.io",
      "lever.co",
      "ashbyhq.com",
      "workable.com",
      "smartrecruiters.com",
      "workdayjobs.com",
    ].some((domain) => host === domain || host.endsWith(`.${domain}`));
    return knownHost || /\b(job|jobs|career|careers|vacanc|position|opening|apply)\b/i.test(url.pathname);
  } catch {
    return false;
  }
}

interface ExtractedLink {
  url: string;
  label: string;
}

export function extractJobLinks(html: string, plain: string): ExtractedLink[] {
  const links = new Map<string, string>();
  const anchorPattern = /<a\b[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const rawUrl = match[2] ?? "";
    const label = stripHtml(match[3] ?? "");
    const url = unwrapTrackingUrl(rawUrl);
    if (isLikelyJobUrl(url)) links.set(url, label);
  }

  const textUrlPattern = /https?:\/\/[^\s<>"')\]]+/gi;
  for (const match of plain.matchAll(textUrlPattern)) {
    const url = unwrapTrackingUrl((match[0] ?? "").replace(/[.,;!?]+$/, ""));
    if (isLikelyJobUrl(url) && !links.has(url)) links.set(url, "");
  }

  return [...links.entries()].slice(0, 30).map(([url, label]) => ({ url, label }));
}

function sourceForUrl(urlValue: string): string {
  try {
    const host = new URL(urlValue).hostname.replace(/^www\./, "").toLowerCase();
    if (host.endsWith("linkedin.com")) return "gmail:linkedin";
    if (host.endsWith("jobs.dou.ua")) return "gmail:dou";
    if (host.endsWith("djinni.co")) return "gmail:djinni";
    if (host.endsWith("work.ua")) return "gmail:workua";
    return `gmail:${host}`;
  } catch {
    return "gmail:unknown";
  }
}

export class GmailJobSource implements JobSource {
  readonly name = "gmail:job-alerts";

  constructor(
    private readonly auth: OAuth2Client,
    private readonly query: string,
    private readonly maxResults: number,
  ) {}

  async collect(): Promise<JobInput[]> {
    const gmail = google.gmail({ version: "v1", auth: this.auth });
    const messageIds: string[] = [];
    let pageToken: string | undefined;

    while (messageIds.length < this.maxResults) {
      const params: gmail_v1.Params$Resource$Users$Messages$List = {
        userId: "me",
        q: this.query,
        maxResults: Math.min(100, this.maxResults - messageIds.length),
      };
      if (pageToken) params.pageToken = pageToken;
      const response = await gmail.users.messages.list(params);
      for (const message of response.data.messages ?? []) {
        if (message.id) messageIds.push(message.id);
      }
      pageToken = response.data.nextPageToken ?? undefined;
      if (!pageToken) break;
    }

    const jobs: JobInput[] = [];
    for (const messageId of messageIds) {
      const response = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });
      const payload = response.data.payload;
      const subject = header(payload, "subject") || "Job alert";
      const sender = header(payload, "reply-to") || header(payload, "from");
      const contactEmail = extractEmail(sender);
      const date = safeIsoDate(header(payload, "date")) ?? safeIsoDate(response.data.internalDate);
      const parts = bodyParts(payload);
      const html = parts.html.join("\n");
      const plain = parts.plain.join("\n") || stripHtml(html);
      const description = stripHtml(html || plain).slice(0, 30_000);
      const links = extractJobLinks(html, plain);

      for (const link of links) {
        const label = link.label.trim();
        const title = !label || IGNORED_LINK_TEXT.test(label) ? subject : label;
        const url = canonicalizeUrl(link.url);
        jobs.push({
          source: sourceForUrl(url),
          externalId: `${messageId}:${url}`,
          title: inferRoleTitle(title),
          company: inferCompany(title, inferCompany(subject)),
          location: "Unknown",
          remote: isRemoteText(`${subject}\n${description}`),
          url,
          applyUrl: url,
          description,
          salaryText: null,
          postedAt: date,
          contactEmail,
          raw: { messageId, subject, sender, url, label },
        });
      }
    }
    return jobs;
  }
}

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function isValidEmail(value: string): boolean {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value);
}

export function assertAllowedRecipient(recipient: string, allowedDomains: string[]): void {
  if (!isValidEmail(recipient)) throw new Error(`Invalid recipient email: ${recipient}`);
  if (allowedDomains.length === 0) return;
  const domain = recipient.split("@")[1]?.toLowerCase() ?? "";
  const allowed = allowedDomains.some(
    (candidate) => domain === candidate.toLowerCase() || domain.endsWith(`.${candidate.toLowerCase()}`),
  );
  if (!allowed) {
    throw new Error(`Recipient domain ${domain} is not in gmail.allowedSendDomains.`);
  }
}

export async function sendGmailMessage(
  auth: OAuth2Client,
  message: { to: string; subject: string; body: string },
): Promise<string> {
  const mime = [
    `To: ${cleanHeader(message.to)}`,
    `Subject: ${cleanHeader(message.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    message.body,
  ].join("\r\n");
  const raw = Buffer.from(mime, "utf8").toString("base64url");
  const gmail = google.gmail({ version: "v1", auth });
  const response = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  if (!response.data.id) throw new Error("Gmail did not return a message ID.");
  return response.data.id;
}
