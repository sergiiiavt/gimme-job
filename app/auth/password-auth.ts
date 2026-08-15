import {
  constantTimeEqual,
  createUserSession,
  multiUserEnabled,
  normalizeNextPath,
  type MultiUserAuthEnv,
} from "./google-oauth.ts";

export type PasswordAuthEnv = MultiUserAuthEnv & { APP_PASSWORD?: string };

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const PBKDF2_ITERATIONS = 600_000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 8;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must contain at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Password must contain at most ${PASSWORD_MAX_LENGTH} characters.`;
  return null;
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const digest = await derivePassword(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(digest)}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationText, saltText, expectedText] = encoded.split("$");
  const iterations = Number(iterationText);
  if (algorithm !== "pbkdf2-sha256" || !Number.isInteger(iterations) || iterations < 100_000 || !saltText || !expectedText) {
    return false;
  }
  try {
    const actual = bytesToBase64Url(await derivePassword(password, base64UrlToBytes(saltText), iterations));
    return constantTimeEqual(actual, expectedText);
  } catch {
    return false;
  }
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function authPage(options: {
  mode: "login" | "register";
  nextPath: string;
  error?: string;
  email?: string;
}): Response {
  const isRegister = options.mode === "register";
  const title = isRegister ? "Create account" : "Sign in";
  const alternateHref = isRegister
    ? `/workspace/login?next=${encodeURIComponent(options.nextPath)}`
    : `/workspace/register?next=${encodeURIComponent(options.nextPath)}`;
  const alternateText = isRegister ? "Already have an account? Sign in" : "New to GimmeJob? Create account";
  const error = options.error ? `<div class="error" role="alert">${htmlEscape(options.error)}</div>` : "";
  const legacy = isRegister ? `
    <label>Existing private-site password <span>(optional)</span>
      <input name="legacyPassword" type="password" autocomplete="current-password" />
    </label>
    <p class="hint">Only use this once to move your old private GimmeJob workspace into this account.</p>` : "";
  const confirm = isRegister ? `
    <label>Confirm password
      <input name="confirmPassword" type="password" minlength="${PASSWORD_MIN_LENGTH}" maxlength="${PASSWORD_MAX_LENGTH}" autocomplete="new-password" required />
    </label>` : "";

  const body = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} · GimmeJob</title><style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#26332d;background:#f5f7f5}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(100%,420px);background:#fff;border:1px solid #dde4de;border-radius:14px;padding:28px;box-shadow:0 16px 45px rgba(31,49,39,.08)}
h1{font-size:24px;margin:0 0 6px}.sub{color:#718078;font-size:13px;margin:0 0 22px}label{display:grid;gap:7px;font-size:12px;font-weight:750;margin-top:14px}label span{font-weight:500;color:#87928c}input{width:100%;border:1px solid #ccd6ce;border-radius:8px;padding:11px 12px;font:inherit;outline:none}input:focus{border-color:#6d927e;box-shadow:0 0 0 3px rgba(80,124,99,.12)}button{width:100%;border:0;border-radius:8px;padding:11px 14px;margin-top:20px;background:#315a43;color:#fff;font-weight:800;cursor:pointer}.alt{display:block;margin-top:17px;text-align:center;color:#496557;font-size:12px;text-decoration:none}.error{background:#fff1f0;border:1px solid #f1c7c4;color:#8a302a;border-radius:8px;padding:10px 12px;font-size:12px;margin:14px 0}.hint{font-size:11px;line-height:1.45;color:#7c8881;margin:7px 0 0}.brand{font-size:12px;font-weight:900;letter-spacing:.04em;color:#315a43;margin-bottom:18px}.back{display:inline-block;margin-top:18px;color:#75827b;font-size:11px;text-decoration:none}
</style></head><body><main class="card"><div class="brand">GIMMEJOB</div><h1>${title}</h1><p class="sub">${isRegister ? "Create your personal workspace." : "Open your personal workspace."}</p>${error}<form method="post" action="/workspace/${isRegister ? "register" : "login"}">
<input type="hidden" name="next" value="${htmlEscape(options.nextPath)}"/>
<label>Email<input name="email" type="email" value="${htmlEscape(options.email ?? "")}" autocomplete="email" maxlength="254" required /></label>
<label>Password<input name="password" type="password" minlength="${PASSWORD_MIN_LENGTH}" maxlength="${PASSWORD_MAX_LENGTH}" autocomplete="${isRegister ? "new-password" : "current-password"}" required /></label>${confirm}${legacy}
<button type="submit">${title}</button></form><a class="alt" href="${alternateHref}">${alternateText}</a><a class="back" href="/">← Public site</a></main></body></html>`;

  return new Response(body, {
    status: options.error ? 400 : 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "same-origin",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function redirect(location: string, cookie?: string): Response {
  const headers = new Headers({
    location,
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow, noarchive",
  });
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}

async function loginThrottleKey(request: Request, email: string): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  return sha256(`${email}|${ip}`);
}

async function loginBlocked(db: D1Database, key: string): Promise<boolean> {
  const row = await db.prepare("SELECT blocked_until FROM auth_login_limits WHERE key = ? LIMIT 1")
    .bind(key)
    .first<{ blocked_until?: string | null }>();
  return Boolean(row?.blocked_until && Date.parse(row.blocked_until) > Date.now());
}

async function recordLoginFailure(db: D1Database, key: string): Promise<void> {
  const now = new Date();
  const row = await db.prepare("SELECT failures, window_started_at FROM auth_login_limits WHERE key = ? LIMIT 1")
    .bind(key)
    .first<{ failures?: number; window_started_at?: string }>();
  const windowStarted = row?.window_started_at ? Date.parse(row.window_started_at) : Number.NaN;
  const withinWindow = Number.isFinite(windowStarted) && now.getTime() - windowStarted < LOGIN_WINDOW_MS;
  const failures = withinWindow ? Number(row?.failures ?? 0) + 1 : 1;
  const startedAt = withinWindow ? String(row?.window_started_at) : now.toISOString();
  const blockedUntil = failures >= MAX_LOGIN_FAILURES
    ? new Date(now.getTime() + LOGIN_BLOCK_MS).toISOString()
    : null;
  await db.prepare(`INSERT INTO auth_login_limits (key, failures, window_started_at, blocked_until, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET failures = excluded.failures, window_started_at = excluded.window_started_at,
      blocked_until = excluded.blocked_until, updated_at = excluded.updated_at`)
    .bind(key, failures, startedAt, blockedUntil, now.toISOString())
    .run();
}

async function clearLoginFailures(db: D1Database, key: string): Promise<void> {
  await db.prepare("DELETE FROM auth_login_limits WHERE key = ?").bind(key).run();
}

async function createForwardingAlias(db: D1Database, userId: string): Promise<string> {
  const existing = await db.prepare("SELECT token FROM email_ingest_aliases WHERE user_id = ? AND active = 1 LIMIT 1")
    .bind(userId)
    .first<{ token?: string }>();
  if (existing?.token) return existing.token;

  const token = randomToken(12).toLowerCase();
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO email_ingest_aliases (user_id, token, active, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, active = 1, updated_at = excluded.updated_at`)
    .bind(userId, token, now, now)
    .run();
  return token;
}

async function claimLegacyWorkspace(db: D1Database, userId: string): Promise<void> {
  const claimed = await db.prepare("SELECT user_id FROM legacy_workspace_claims WHERE id = 1 LIMIT 1").first<{ user_id?: string }>();
  if (claimed?.user_id && claimed.user_id !== userId) throw new Error("The legacy workspace has already been claimed.");
  if (claimed?.user_id === userId) return;

  const now = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT INTO legacy_workspace_claims (id, user_id, claimed_at) VALUES (1, ?, ?)").bind(userId, now),
    db.prepare(`INSERT OR REPLACE INTO user_settings (user_id, key, value_json, updated_at)
      SELECT ?, key, value_json, updated_at FROM settings`).bind(userId),
    db.prepare(`INSERT OR REPLACE INTO user_interview_progress (user_id, question_id, status, updated_at)
      SELECT ?, question_id, status, updated_at FROM interview_progress`).bind(userId),
    db.prepare(`INSERT OR REPLACE INTO job_tracking (user_id, job_id, status, status_updated_at, feedback, feedback_at, updated_at)
      SELECT ?, id, status, status_updated_at, feedback, feedback_at, updated_at FROM jobs
      WHERE status <> 'NEW' OR status_updated_at IS NOT NULL OR feedback IS NOT NULL OR feedback_at IS NOT NULL`).bind(userId),
    db.prepare(`INSERT OR REPLACE INTO user_analyses (user_id, job_id, mode, score, verdict, payload_json, created_at, updated_at)
      SELECT ?, job_id, mode, score, verdict, payload_json, created_at, updated_at FROM analyses`).bind(userId),
    db.prepare(`INSERT OR REPLACE INTO user_resume_variants (user_id, job_id, id, markdown, pdf_base64, created_at, updated_at)
      SELECT ?, job_id, id, markdown, pdf_base64, created_at, updated_at FROM resume_variants`).bind(userId),
    db.prepare(`INSERT OR REPLACE INTO user_application_drafts (
      user_id, job_id, id, recipient, subject, body, status, approved_at, sent_at, provider_message_id, created_at, updated_at
    ) SELECT ?, job_id, id, recipient, subject, body, status, approved_at, sent_at, provider_message_id, created_at, updated_at
      FROM application_drafts`).bind(userId),
    db.prepare(`INSERT OR REPLACE INTO user_email_events (
      id, user_id, provider, provider_message_id, thread_id, received_at, sender_name, sender_email, subject,
      classification, summary, company, job_title, recruiter_name, job_id, created_at, updated_at
    ) SELECT id, ?, provider, provider_message_id, thread_id, received_at, sender_name, sender_email, subject,
      classification, summary, company, job_title, recruiter_name, job_id, created_at, updated_at FROM email_events`).bind(userId),
  ]);
}

async function createAccount(db: D1Database, email: string, password: string): Promise<{ id: string; aliasToken: string }> {
  const existing = await db.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first<{ id?: string }>();
  if (existing?.id) throw new Error("An account with this email already exists.");

  const id = `usr_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO users (
    id, google_sub, email, email_verified, name, picture_url, password_hash, created_at, updated_at
  ) VALUES (?, ?, ?, 0, NULL, NULL, ?, ?, ?)`).bind(
    id,
    `local:${id}`,
    email,
    await hashPassword(password),
    now,
    now,
  ).run();
  const aliasToken = await createForwardingAlias(db, id);
  return { id, aliasToken };
}

export async function ensureForwardingAlias(db: D1Database, userId: string): Promise<string> {
  return createForwardingAlias(db, userId);
}

export async function handlePasswordLogin(request: Request, env: PasswordAuthEnv): Promise<Response> {
  if (!multiUserEnabled(env) || !env.DB) return new Response("Not found.", { status: 404 });
  const url = new URL(request.url);
  const nextPath = normalizeNextPath(url.searchParams.get("next"));
  if (request.method === "GET" || request.method === "HEAD") return authPage({ mode: "login", nextPath });
  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { allow: "GET, HEAD, POST" } });

  const form = await request.formData();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  const submittedNext = normalizeNextPath(String(form.get("next") ?? nextPath));
  if (!validEmail(email) || !password) return authPage({ mode: "login", nextPath: submittedNext, email, error: "Invalid email or password." });

  const throttleKey = await loginThrottleKey(request, email);
  if (await loginBlocked(env.DB, throttleKey)) {
    return authPage({ mode: "login", nextPath: submittedNext, email, error: "Too many sign-in attempts. Try again in 15 minutes." });
  }

  const user = await env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ? LIMIT 1")
    .bind(email)
    .first<{ id?: string; password_hash?: string | null }>();
  const valid = user?.id && user.password_hash
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, "pbkdf2-sha256$600000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

  if (!user?.id || !valid) {
    await recordLoginFailure(env.DB, throttleKey);
    return authPage({ mode: "login", nextPath: submittedNext, email, error: "Invalid email or password." });
  }

  await clearLoginFailures(env.DB, throttleKey);
  await createForwardingAlias(env.DB, user.id);
  return redirect(submittedNext, await createUserSession(env.DB, user.id));
}

export async function handlePasswordRegister(request: Request, env: PasswordAuthEnv): Promise<Response> {
  if (!multiUserEnabled(env) || !env.DB) return new Response("Not found.", { status: 404 });
  const url = new URL(request.url);
  const nextPath = normalizeNextPath(url.searchParams.get("next"));
  if (request.method === "GET" || request.method === "HEAD") return authPage({ mode: "register", nextPath });
  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { allow: "GET, HEAD, POST" } });

  const form = await request.formData();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");
  const legacyPassword = String(form.get("legacyPassword") ?? "");
  const submittedNext = normalizeNextPath(String(form.get("next") ?? nextPath));

  if (!validEmail(email)) return authPage({ mode: "register", nextPath: submittedNext, email, error: "Enter a valid email address." });
  const validationError = passwordError(password);
  if (validationError) return authPage({ mode: "register", nextPath: submittedNext, email, error: validationError });
  if (password !== confirmPassword) return authPage({ mode: "register", nextPath: submittedNext, email, error: "Passwords do not match." });
  if (legacyPassword && (!env.APP_PASSWORD || !constantTimeEqual(legacyPassword, env.APP_PASSWORD))) {
    return authPage({ mode: "register", nextPath: submittedNext, email, error: "The existing private-site password is incorrect." });
  }

  try {
    const account = await createAccount(env.DB, email, password);
    if (legacyPassword) await claimLegacyWorkspace(env.DB, account.id);
    return redirect(submittedNext, await createUserSession(env.DB, account.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create account.";
    return authPage({ mode: "register", nextPath: submittedNext, email, error: message });
  }
}
