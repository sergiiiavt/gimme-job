type ForwardedEmailMessage = {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly rawSize: number;
  setReject(reason: string): void;
};

type EmailForwardingEnv = { DB?: D1Database };

const EMAIL_DOMAIN = "gimme-job.com";
const BASE_LOCAL_PART = "jobs";
const MAX_SUBJECT_LENGTH = 1000;
const MAX_MESSAGE_ID_LENGTH = 1000;

function cleanHeader(value: string | null, maxLength: number): string {
  return (value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
}

function aliasToken(recipient: string): string | null {
  const normalized = recipient.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || normalized.slice(at + 1) !== EMAIL_DOMAIN) return null;
  const local = normalized.slice(0, at);
  const prefix = `${BASE_LOCAL_PART}+`;
  if (!local.startsWith(prefix)) return null;
  const token = local.slice(prefix.length);
  return /^[a-z0-9_-]{12,64}$/.test(token) ? token : null;
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parsedDate(value: string | null): string {
  if (value) {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  return new Date().toISOString();
}

export async function handleForwardedEmail(message: ForwardedEmailMessage, env: EmailForwardingEnv): Promise<void> {
  if (!env.DB) {
    message.setReject("GimmeJob email storage is unavailable");
    return;
  }

  const token = aliasToken(message.to);
  if (!token) {
    message.setReject("Unknown GimmeJob forwarding address");
    return;
  }

  const alias = await env.DB.prepare(`SELECT user_id FROM email_ingest_aliases
    WHERE token = ? AND active = 1 LIMIT 1`)
    .bind(token)
    .first<{ user_id?: string }>();
  if (!alias?.user_id) {
    message.setReject("Unknown GimmeJob forwarding address");
    return;
  }

  const subject = cleanHeader(message.headers.get("subject"), MAX_SUBJECT_LENGTH) || "(no subject)";
  const sourceMessageId = cleanHeader(message.headers.get("message-id"), MAX_MESSAGE_ID_LENGTH);
  const receivedAt = parsedDate(message.headers.get("date"));
  const senderEmail = message.from.trim().toLowerCase().slice(0, 320) || null;
  const providerMessageId = sourceMessageId || await sha256Base64Url([
    message.from,
    message.to,
    subject,
    receivedAt,
    String(message.rawSize),
  ].join("|"));
  const now = new Date().toISOString();

  await env.DB.prepare(`INSERT INTO user_email_events (
    id, user_id, provider, provider_message_id, thread_id, received_at,
    sender_name, sender_email, subject, classification, summary, company,
    job_title, recruiter_name, job_id, created_at, updated_at
  ) VALUES (?, ?, 'email_forwarding', ?, NULL, ?, NULL, ?, ?, 'UNCLASSIFIED', NULL, NULL, NULL, NULL, NULL, ?, ?)
  ON CONFLICT(user_id, provider, provider_message_id) DO UPDATE SET
    received_at = excluded.received_at,
    sender_email = excluded.sender_email,
    subject = excluded.subject,
    updated_at = excluded.updated_at`)
    .bind(
      `evt_${crypto.randomUUID()}`,
      alias.user_id,
      providerMessageId,
      receivedAt,
      senderEmail,
      subject,
      now,
      now,
    )
    .run();
}

export function forwardingAddress(token: string): string {
  return `${BASE_LOCAL_PART}+${token}@${EMAIL_DOMAIN}`;
}
