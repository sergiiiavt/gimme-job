import {
  constantTimeEqual,
  multiUserEnabled,
  normalizeNextPath,
  sha256Base64Url,
  type MultiUserAuthEnv,
} from "./google-oauth.ts";

export type PasswordAuthEnv = MultiUserAuthEnv & { APP_PASSWORD?: string };

const SESSION_COOKIE = "gimmejob_user_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const MIN_PASSWORD = 12;
const MAX_PASSWORD = 128;
const PBKDF2_ITERATIONS = 600_000;
const MAX_FAILURES = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function randomToken(bytes: number): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    256,
  );
  return base64Url(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${base64Url(salt)}$${await derivePassword(password, salt, PBKDF2_ITERATIONS)}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationText, saltText, expected] = encoded.split("$");
  const iterations = Number(iterationText);
  if (algorithm !== "pbkdf2-sha256" || !Number.isInteger(iterations) || iterations < 100_000 || !saltText || !expected) return false;
  try {
    return constantTimeEqual(await derivePassword(password, fromBase64Url(saltText), iterations), expected);
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

function page(mode: "login" | "register", nextPath: string, email = "", error = ""): Response {
  const register = mode === "register";
  const title = register ? "Create account" : "Sign in";
  const alternate = register
    ? `/workspace/login?next=${encodeURIComponent(nextPath)}`
    : `/workspace/register?next=${encodeURIComponent(nextPath)}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · GimmeJob</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f7f5;color:#26332d;font-family:Inter,system-ui,sans-serif;padding:24px}.card{width:min(100%,420px);background:white;border:1px solid #dde4de;border-radius:14px;padding:28px;box-shadow:0 16px 45px #1f312714}.brand{font-size:12px;font-weight:900;color:#315a43;letter-spacing:.04em}h1{font-size:24px;margin:18px 0 4px}.sub,.hint{color:#75817b;font-size:12px;line-height:1.45}.err{background:#fff1f0;border:1px solid #f1c7c4;color:#8a302a;border-radius:8px;padding:10px 12px;font-size:12px;margin-top:15px}label{display:grid;gap:7px;font-size:12px;font-weight:750;margin-top:15px}input{border:1px solid #ccd6ce;border-radius:8px;padding:11px 12px;font:inherit}button{width:100%;border:0;border-radius:8px;padding:11px;margin-top:20px;background:#315a43;color:white;font-weight:800;cursor:pointer}a{display:block;text-align:center;margin-top:17px;color:#496557;font-size:12px;text-decoration:none}.back{color:#7c8881;font-size:11px}</style></head><body><main class="card"><div class="brand">GIMMEJOB</div><h1>${title}</h1><p class="sub">${register ? "Create your personal workspace." : "Open your personal workspace."}</p>${error ? `<div class="err">${escapeHtml(error)}</div>` : ""}<form method="post" action="/workspace/${mode}"><input type="hidden" name="next" value="${escapeHtml(nextPath)}"><label>Email<input type="email" name="email" value="${escapeHtml(email)}" maxlength="254" autocomplete="email" required></label><label>Password<input type="password" name="password" minlength="${MIN_PASSWORD}" maxlength="${MAX_PASSWORD}" autocomplete="${register ? "new-password" : "current-password"}" required></label>${register ? `<label>Confirm password<input type="password" name="confirmPassword" minlength="${MIN_PASSWORD}" maxlength="${MAX_PASSWORD}" autocomplete="new-password" required></label><label>Existing private-site password <span class="hint">optional — use once to import the old workspace</span><input type="password" name="legacyPassword" autocomplete="current-password"></label>` : ""}<button>${title}</button></form><a href="${alternate}">${register ? "Already have an account? Sign in" : "New to GimmeJob? Create account"}</a><a class="back" href="/">← Public site</a></main></body></html>`;
  return new Response(html, {
    status: error ? 400 : 200,
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

function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

async function newSession(db: D1Database, userId: string): Promise<string> {
  const token = randomToken(32);
  const now = new Date();
  await db.prepare(`INSERT INTO user_sessions (token_hash, user_id, expires_at, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?)`)
    .bind(
      await sha256Base64Url(token), userId,
      new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString(),
      now.toISOString(), now.toISOString(),
    ).run();
  return sessionCookie(token);
}

function redirect(location: string, cookie: string): Response {
  return new Response(null, { status: 303, headers: { location, "set-cookie": cookie, "cache-control": "no-store" } });
}

async function throttleKey(request: Request, email: string): Promise<string> {
  return sha256Base64Url(`${email}|${request.headers.get("cf-connecting-ip") ?? "unknown"}`);
}

async function isBlocked(db: D1Database, key: string): Promise<boolean> {
  const row = await db.prepare("SELECT blocked_until FROM auth_login_limits WHERE key = ? LIMIT 1").bind(key).first<{ blocked_until?: string | null }>();
  return Boolean(row?.blocked_until && Date.parse(row.blocked_until) > Date.now());
}

async function failLogin(db: D1Database, key: string): Promise<void> {
  const now = new Date();
  const row = await db.prepare("SELECT failures, window_started_at FROM auth_login_limits WHERE key = ? LIMIT 1")
    .bind(key).first<{ failures?: number; window_started_at?: string }>();
  const started = row?.window_started_at ? Date.parse(row.window_started_at) : 0;
  const inWindow = started > 0 && now.getTime() - started < LOGIN_WINDOW_MS;
  const failures = inWindow ? Number(row?.failures ?? 0) + 1 : 1;
  const windowStarted = inWindow ? String(row?.window_started_at) : now.toISOString();
  const blockedUntil = failures >= MAX_FAILURES ? new Date(now.getTime() + BLOCK_MS).toISOString() : null;
  await db.prepare(`INSERT INTO auth_login_limits (key, failures, window_started_at, blocked_until, updated_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,
    window_started_at=excluded.window_started_at, blocked_until=excluded.blocked_until, updated_at=excluded.updated_at`)
    .bind(key, failures, windowStarted, blockedUntil, now.toISOString()).run();
}

export async function ensureForwardingAlias(db: D1Database, userId: string): Promise<string> {
  const current = await db.prepare("SELECT token FROM email_ingest_aliases WHERE user_id = ? AND active = 1 LIMIT 1")
    .bind(userId).first<{ token?: string }>();
  if (current?.token) return current.token;
  const token = randomToken(12).toLowerCase();
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO email_ingest_aliases (user_id, token, active, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?) ON CONFLICT(user_id) DO UPDATE SET token=excluded.token, active=1, updated_at=excluded.updated_at`)
    .bind(userId, token, now, now).run();
  return token;
}

async function claimLegacy(db: D1Database, userId: string): Promise<void> {
  const claimed = await db.prepare("SELECT user_id FROM legacy_workspace_claims WHERE id = 1 LIMIT 1").first<{ user_id?: string }>();
  if (claimed?.user_id && claimed.user_id !== userId) throw new Error("The old private workspace has already been claimed.");
  if (claimed?.user_id === userId) return;
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT INTO legacy_workspace_claims (id,user_id,claimed_at) VALUES (1,?,?)").bind(userId, now),
    db.prepare("INSERT OR REPLACE INTO user_settings SELECT ?,key,value_json,updated_at FROM settings").bind(userId),
    db.prepare("INSERT OR REPLACE INTO user_interview_progress SELECT ?,question_id,status,updated_at FROM interview_progress").bind(userId),
    db.prepare(`INSERT OR REPLACE INTO job_tracking SELECT ?,id,status,status_updated_at,feedback,feedback_at,updated_at FROM jobs
      WHERE status <> 'NEW' OR status_updated_at IS NOT NULL OR feedback IS NOT NULL OR feedback_at IS NOT NULL`).bind(userId),
    db.prepare("INSERT OR REPLACE INTO user_analyses SELECT ?,job_id,mode,score,verdict,payload_json,created_at,updated_at FROM analyses").bind(userId),
    db.prepare("INSERT OR REPLACE INTO user_resume_variants SELECT ?,job_id,id,markdown,pdf_base64,created_at,updated_at FROM resume_variants").bind(userId),
    db.prepare(`INSERT OR REPLACE INTO user_application_drafts SELECT ?,job_id,id,recipient,subject,body,status,approved_at,sent_at,provider_message_id,created_at,updated_at FROM application_drafts`).bind(userId),
    db.prepare(`INSERT OR REPLACE INTO user_email_events
      SELECT id,?,provider,provider_message_id,thread_id,received_at,sender_name,sender_email,subject,classification,summary,company,job_title,recruiter_name,job_id,created_at,updated_at FROM email_events`).bind(userId),
  ]);
}

async function createAccount(db: D1Database, email: string, password: string): Promise<string> {
  if (await db.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first()) throw new Error("An account with this email already exists.");
  const id = `usr_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO users (id,google_sub,email,email_verified,name,picture_url,password_hash,created_at,updated_at)
    VALUES (?,?,?,0,NULL,NULL,?,?,?)`)
    .bind(id, `local:${id}`, email, await hashPassword(password), now, now).run();
  await ensureForwardingAlias(db, id);
  return id;
}

export async function handlePasswordLogin(request: Request, env: PasswordAuthEnv): Promise<Response> {
  if (!multiUserEnabled(env) || !env.DB) return new Response("Not found.", { status: 404 });
  const url = new URL(request.url);
  const nextPath = normalizeNextPath(url.searchParams.get("next"));
  if (request.method === "GET" || request.method === "HEAD") return page("login", nextPath);
  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { allow: "GET, HEAD, POST" } });

  const form = await request.formData();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  const next = normalizeNextPath(String(form.get("next") ?? nextPath));
  if (!validEmail(email) || !password) return page("login", next, email, "Invalid email or password.");
  const key = await throttleKey(request, email);
  if (await isBlocked(env.DB, key)) return page("login", next, email, "Too many sign-in attempts. Try again in 15 minutes.");

  const user = await env.DB.prepare("SELECT id,password_hash FROM users WHERE email = ? LIMIT 1")
    .bind(email).first<{ id?: string; password_hash?: string | null }>();
  const valid = Boolean(user?.id && user.password_hash && await verifyPassword(password, user.password_hash));
  if (!valid || !user?.id) {
    await failLogin(env.DB, key);
    return page("login", next, email, "Invalid email or password.");
  }
  await env.DB.prepare("DELETE FROM auth_login_limits WHERE key = ?").bind(key).run();
  await ensureForwardingAlias(env.DB, user.id);
  return redirect(next, await newSession(env.DB, user.id));
}

export async function handlePasswordRegister(request: Request, env: PasswordAuthEnv): Promise<Response> {
  if (!multiUserEnabled(env) || !env.DB) return new Response("Not found.", { status: 404 });
  const url = new URL(request.url);
  const nextPath = normalizeNextPath(url.searchParams.get("next"));
  if (request.method === "GET" || request.method === "HEAD") return page("register", nextPath);
  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { allow: "GET, HEAD, POST" } });

  const form = await request.formData();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");
  const legacyPassword = String(form.get("legacyPassword") ?? "");
  const next = normalizeNextPath(String(form.get("next") ?? nextPath));
  if (!validEmail(email)) return page("register", next, email, "Enter a valid email address.");
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) return page("register", next, email, `Password must contain ${MIN_PASSWORD}-${MAX_PASSWORD} characters.`);
  if (password !== confirm) return page("register", next, email, "Passwords do not match.");
  if (legacyPassword && (!env.APP_PASSWORD || !constantTimeEqual(legacyPassword, env.APP_PASSWORD))) return page("register", next, email, "The existing private-site password is incorrect.");

  try {
    const userId = await createAccount(env.DB, email, password);
    if (legacyPassword) await claimLegacy(env.DB, userId);
    return redirect(next, await newSession(env.DB, userId));
  } catch (error) {
    return page("register", next, email, error instanceof Error ? error.message : "Unable to create account.");
  }
}
