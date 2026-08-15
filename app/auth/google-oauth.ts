const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

const SESSION_COOKIE = "gimmejob_user_session";
const OAUTH_STATE_COOKIE = "gimmejob_oauth_state";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const OAUTH_ATTEMPT_SECONDS = 10 * 60;
const GMAIL_METADATA_SCOPE = "https://www.googleapis.com/auth/gmail.metadata";
const LOGIN_SCOPES = ["openid", "email", "profile"] as const;

export type OAuthMode = "login" | "gmail";

export type MultiUserAuthEnv = {
  DB?: D1Database;
  MULTI_USER_ENABLED?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GMAIL_TOKEN_ENCRYPTION_KEY?: string;
};

export type AuthenticatedUser = {
  id: string;
  googleSub: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

type OAuthAttempt = {
  mode: OAuthMode;
  userId: string | null;
  codeVerifier: string;
  nextPath: string;
  expiresAt: string;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return sha256Base64Url(verifier);
}

export function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [cookieName, ...valueParts] = part.trim().split("=");
    if (cookieName === name) return valueParts.join("=") || null;
  }
  return null;
}

function secureCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return secureCookie(SESSION_COOKIE, "", 0);
}

function clearOAuthStateCookie(): string {
  return secureCookie(OAUTH_STATE_COOKIE, "", 0);
}

export function normalizeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/workspace";
  const parsed = new URL(value, "https://gimmejob.invalid");
  if (parsed.origin !== "https://gimmejob.invalid") return "/workspace";
  if (parsed.pathname !== "/workspace" && !parsed.pathname.startsWith("/workspace/")) return "/workspace";
  return `${parsed.pathname}${parsed.search}`;
}

export function multiUserEnabled(env: MultiUserAuthEnv): boolean {
  return env.MULTI_USER_ENABLED?.trim().toLowerCase() === "true";
}

function required(value: string | undefined, name: string): string {
  const clean = value?.trim();
  if (!clean) throw new Error(`${name} is not configured.`);
  return clean;
}

function authConfig(env: MultiUserAuthEnv): { clientId: string; clientSecret: string; db: D1Database } {
  if (!env.DB) throw new Error("Cloud database is not available.");
  return {
    clientId: required(env.GOOGLE_OAUTH_CLIENT_ID, "GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: required(env.GOOGLE_OAUTH_CLIENT_SECRET, "GOOGLE_OAUTH_CLIENT_SECRET"),
    db: env.DB,
  };
}

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function disabledResponse(): Response {
  return json({ error: "Multi-user authentication is not enabled." }, 404);
}

function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({
    location,
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow, noarchive",
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}

export async function readUserSession(request: Request, env: MultiUserAuthEnv): Promise<AuthenticatedUser | null> {
  if (!env.DB) return null;
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Base64Url(token);
  const row = await env.DB.prepare(`SELECT
    s.user_id,
    s.expires_at,
    u.google_sub,
    u.email,
    u.name,
    u.picture_url
  FROM user_sessions s
  INNER JOIN users u ON u.id = s.user_id
  WHERE s.token_hash = ?
  LIMIT 1`).bind(tokenHash).first<Record<string, unknown>>();

  if (!row) return null;
  const expiresAt = String(row.expires_at ?? "");
  if (!expiresAt || Date.parse(expiresAt) <= Date.now()) {
    await env.DB.prepare("DELETE FROM user_sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }

  return {
    id: String(row.user_id),
    googleSub: String(row.google_sub),
    email: String(row.email),
    name: row.name === null || row.name === undefined ? null : String(row.name),
    pictureUrl: row.picture_url === null || row.picture_url === undefined ? null : String(row.picture_url),
  };
}

async function createUserSession(db: D1Database, userId: string): Promise<string> {
  const token = randomToken(32);
  const tokenHash = await sha256Base64Url(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString();
  await db.prepare(`INSERT INTO user_sessions (
    token_hash, user_id, expires_at, created_at, last_seen_at
  ) VALUES (?, ?, ?, ?, ?)`).bind(
    tokenHash,
    userId,
    expiresAt,
    now.toISOString(),
    now.toISOString(),
  ).run();
  return secureCookie(SESSION_COOKIE, token, SESSION_SECONDS);
}

export async function deleteUserSession(request: Request, env: MultiUserAuthEnv): Promise<void> {
  if (!env.DB) return;
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return;
  await env.DB.prepare("DELETE FROM user_sessions WHERE token_hash = ?")
    .bind(await sha256Base64Url(token))
    .run();
}

async function cleanupOAuthAttempts(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM oauth_attempts WHERE expires_at <= ?")
    .bind(new Date().toISOString())
    .run();
}

async function createOAuthAttempt(
  db: D1Database,
  mode: OAuthMode,
  userId: string | null,
  nextPath: string,
): Promise<{ state: string; verifier: string }> {
  const state = randomToken(32);
  const verifier = randomToken(48);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OAUTH_ATTEMPT_SECONDS * 1000).toISOString();
  await cleanupOAuthAttempts(db);
  await db.prepare(`INSERT INTO oauth_attempts (
    state_hash, mode, user_id, code_verifier, next_path, expires_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(
    await sha256Base64Url(state),
    mode,
    userId,
    verifier,
    nextPath,
    expiresAt,
    now.toISOString(),
  ).run();
  return { state, verifier };
}

async function consumeOAuthAttempt(db: D1Database, state: string): Promise<OAuthAttempt | null> {
  const stateHash = await sha256Base64Url(state);
  const row = await db.prepare(`SELECT mode, user_id, code_verifier, next_path, expires_at
    FROM oauth_attempts WHERE state_hash = ? LIMIT 1`).bind(stateHash).first<Record<string, unknown>>();
  await db.prepare("DELETE FROM oauth_attempts WHERE state_hash = ?").bind(stateHash).run();
  if (!row) return null;
  const expiresAt = String(row.expires_at ?? "");
  if (!expiresAt || Date.parse(expiresAt) <= Date.now()) return null;
  const mode = row.mode === "gmail" ? "gmail" : row.mode === "login" ? "login" : null;
  if (!mode) return null;
  return {
    mode,
    userId: row.user_id === null || row.user_id === undefined ? null : String(row.user_id),
    codeVerifier: String(row.code_verifier),
    nextPath: normalizeNextPath(String(row.next_path ?? "/workspace")),
    expiresAt,
  };
}

async function exchangeCode(
  code: string,
  verifier: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Google token exchange failed with HTTP ${response.status}.`);
  return response.json() as Promise<GoogleTokenResponse>;
}

async function googleUserInfo(accessToken: string): Promise<Required<Pick<GoogleUserInfo, "sub" | "email">> & GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Google userinfo failed with HTTP ${response.status}.`);
  const profile = await response.json() as GoogleUserInfo;
  if (!profile.sub || !profile.email || profile.email_verified !== true) {
    throw new Error("Google account does not provide a verified email address.");
  }
  return profile as Required<Pick<GoogleUserInfo, "sub" | "email">> & GoogleUserInfo;
}

function decodeEncryptionKey(value: string): Uint8Array {
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(value.trim()), (character) => character.charCodeAt(0));
  } catch {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY must be base64 encoded.");
  }
  if (bytes.byteLength !== 32) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return bytes;
}

export async function encryptRefreshToken(token: string, keyValue: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", decodeEncryptionKey(keyValue), "AES-GCM", false, ["encrypt"]);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(token),
  );
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptRefreshToken(value: string, keyValue: string): Promise<string> {
  const [version, ivValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !ciphertextValue) throw new Error("Unsupported encrypted token format.");
  const key = await crypto.subtle.importKey("raw", decodeEncryptionKey(keyValue), "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(ivValue) },
    key,
    base64UrlToBytes(ciphertextValue),
  );
  return new TextDecoder().decode(plaintext);
}

async function upsertUser(db: D1Database, profile: Required<Pick<GoogleUserInfo, "sub" | "email">> & GoogleUserInfo): Promise<string> {
  const existing = await db.prepare("SELECT id FROM users WHERE google_sub = ? LIMIT 1")
    .bind(profile.sub)
    .first<{ id: string }>();
  const now = new Date().toISOString();
  if (existing?.id) {
    await db.prepare(`UPDATE users SET email = ?, email_verified = 1, name = ?, picture_url = ?, updated_at = ? WHERE id = ?`)
      .bind(profile.email.toLowerCase(), profile.name ?? null, profile.picture ?? null, now, existing.id)
      .run();
    return existing.id;
  }
  const id = `usr_${crypto.randomUUID()}`;
  await db.prepare(`INSERT INTO users (
    id, google_sub, email, email_verified, name, picture_url, created_at, updated_at
  ) VALUES (?, ?, ?, 1, ?, ?, ?, ?)`).bind(
    id,
    profile.sub,
    profile.email.toLowerCase(),
    profile.name ?? null,
    profile.picture ?? null,
    now,
    now,
  ).run();
  return id;
}

async function gmailProfile(accessToken: string): Promise<{ emailAddress: string; historyId: string | null }> {
  const response = await fetch(GMAIL_PROFILE_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Gmail profile request failed with HTTP ${response.status}.`);
  const payload = await response.json() as { emailAddress?: string; historyId?: string };
  if (!payload.emailAddress) throw new Error("Gmail profile did not return an email address.");
  return { emailAddress: payload.emailAddress.toLowerCase(), historyId: payload.historyId ?? null };
}

async function saveGmailConnection(
  db: D1Database,
  user: AuthenticatedUser,
  tokens: GoogleTokenResponse,
  encryptionKey: string,
): Promise<void> {
  const accessToken = required(tokens.access_token, "Google access token");
  const refreshToken = required(tokens.refresh_token, "Google refresh token");
  const profile = await gmailProfile(accessToken);
  if (profile.emailAddress !== user.email.toLowerCase()) {
    throw new Error("Connect the same Google account that is signed in to GimmeJob.");
  }
  const now = new Date();
  const tokenExpiresAt = typeof tokens.expires_in === "number"
    ? new Date(now.getTime() + tokens.expires_in * 1000).toISOString()
    : null;
  await db.prepare(`INSERT INTO gmail_connections (
    user_id, google_sub, email, refresh_token_encrypted, scopes, token_expires_at,
    history_id, status, connected_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    google_sub = excluded.google_sub,
    email = excluded.email,
    refresh_token_encrypted = excluded.refresh_token_encrypted,
    scopes = excluded.scopes,
    token_expires_at = excluded.token_expires_at,
    history_id = excluded.history_id,
    status = 'ACTIVE',
    updated_at = excluded.updated_at`).bind(
    user.id,
    user.googleSub,
    profile.emailAddress,
    await encryptRefreshToken(refreshToken, encryptionKey),
    tokens.scope ?? GMAIL_METADATA_SCOPE,
    tokenExpiresAt,
    profile.historyId,
    now.toISOString(),
    now.toISOString(),
  ).run();
}

export async function handleGoogleOAuthStart(request: Request, env: MultiUserAuthEnv): Promise<Response> {
  if (!multiUserEnabled(env)) return disabledResponse();
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed.", { status: 405, headers: { allow: "GET, HEAD" } });
  }

  try {
    const { clientId, db } = authConfig(env);
    const url = new URL(request.url);
    const mode: OAuthMode = url.searchParams.get("mode") === "gmail" ? "gmail" : "login";
    const nextPath = normalizeNextPath(url.searchParams.get("next"));
    const user = mode === "gmail" ? await readUserSession(request, env) : null;
    if (mode === "gmail" && !user) return redirect(`/workspace/login?next=${encodeURIComponent(nextPath)}`);

    const { state, verifier } = await createOAuthAttempt(db, mode, user?.id ?? null, nextPath);
    const authorization = new URL(GOOGLE_AUTH_URL);
    authorization.searchParams.set("client_id", clientId);
    authorization.searchParams.set("redirect_uri", `${url.origin}/auth/google/callback`);
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("code_challenge", await pkceChallenge(verifier));
    authorization.searchParams.set("code_challenge_method", "S256");
    authorization.searchParams.set("scope", [...LOGIN_SCOPES, ...(mode === "gmail" ? [GMAIL_METADATA_SCOPE] : [])].join(" "));
    authorization.searchParams.set("include_granted_scopes", "true");
    if (mode === "gmail") {
      authorization.searchParams.set("access_type", "offline");
      authorization.searchParams.set("prompt", "consent");
      if (user?.email) authorization.searchParams.set("login_hint", user.email);
    } else {
      authorization.searchParams.set("prompt", "select_account");
    }

    return redirect(authorization.toString(), [secureCookie(OAUTH_STATE_COOKIE, state, OAUTH_ATTEMPT_SECONDS)]);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to start Google OAuth.", 503);
  }
}

export async function handleGoogleOAuthCallback(request: Request, env: MultiUserAuthEnv): Promise<Response> {
  if (!multiUserEnabled(env)) return disabledResponse();
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed.", { status: 405, headers: { allow: "GET, HEAD" } });
  }

  try {
    const { clientId, clientSecret, db } = authConfig(env);
    const url = new URL(request.url);
    const oauthError = url.searchParams.get("error");
    if (oauthError) return errorResponse(`Google OAuth was not completed: ${oauthError}.`, 400);
    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const stateCookie = readCookie(request, OAUTH_STATE_COOKIE) ?? "";
    if (!code || !state || !stateCookie || !constantTimeEqual(state, stateCookie)) {
      return errorResponse("Invalid OAuth callback state.", 400);
    }

    const attempt = await consumeOAuthAttempt(db, state);
    if (!attempt) return errorResponse("OAuth attempt is missing or expired.", 400);
    const tokens = await exchangeCode(
      code,
      attempt.codeVerifier,
      `${url.origin}/auth/google/callback`,
      clientId,
      clientSecret,
    );
    const accessToken = required(tokens.access_token, "Google access token");
    const profile = await googleUserInfo(accessToken);

    if (attempt.mode === "login") {
      const userId = await upsertUser(db, profile);
      const sessionCookie = await createUserSession(db, userId);
      return redirect(attempt.nextPath, [clearOAuthStateCookie(), sessionCookie]);
    }

    const user = await readUserSession(request, env);
    if (!user || !attempt.userId || user.id !== attempt.userId) {
      return errorResponse("GimmeJob session changed while Gmail was being connected.", 401);
    }
    if (profile.sub !== user.googleSub) {
      return errorResponse("Connect the same Google account that is signed in to GimmeJob.", 409);
    }
    const encryptionKey = required(env.GMAIL_TOKEN_ENCRYPTION_KEY, "GMAIL_TOKEN_ENCRYPTION_KEY");
    await saveGmailConnection(db, user, tokens, encryptionKey);
    const destination = new URL(attempt.nextPath, url.origin);
    destination.searchParams.set("gmail", "connected");
    return redirect(`${destination.pathname}${destination.search}`, [clearOAuthStateCookie()]);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Google OAuth failed.", 500);
  }
}

export async function handleAuthSession(request: Request, env: MultiUserAuthEnv): Promise<Response> {
  if (!multiUserEnabled(env)) return json({ enabled: false, authenticated: false });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed.", { status: 405, headers: { allow: "GET, HEAD" } });
  }
  const user = await readUserSession(request, env);
  if (!user) return json({ enabled: true, authenticated: false });
  const connection = env.DB
    ? await env.DB.prepare("SELECT status, email FROM gmail_connections WHERE user_id = ? LIMIT 1")
      .bind(user.id)
      .first<Record<string, unknown>>()
    : null;
  return json({
    enabled: true,
    authenticated: true,
    user: { id: user.id, email: user.email, name: user.name, pictureUrl: user.pictureUrl },
    gmail: connection ? { connected: connection.status === "ACTIVE", email: String(connection.email ?? "") } : { connected: false },
  });
}

export async function handleLogout(request: Request, env: MultiUserAuthEnv): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed.", { status: 405, headers: { allow: "POST" } });
  }
  await deleteUserSession(request, env);
  return redirect("/", [clearSessionCookie()]);
}
