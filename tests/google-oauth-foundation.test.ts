import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSessionCookie,
  decryptRefreshToken,
  encryptRefreshToken,
  handleAuthSession,
  handleGoogleOAuthCallback,
  handleGoogleOAuthStart,
  handleLogout,
  normalizeNextPath,
  pkceChallenge,
  readUserSession,
  sha256Base64Url,
  type MultiUserAuthEnv,
} from "../app/auth/google-oauth.ts";

type UserRow = {
  id: string;
  googleSub: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
};

type SessionRow = {
  userId: string;
  expiresAt: string;
};

type AttemptRow = {
  mode: string;
  userId: string | null;
  codeVerifier: string;
  nextPath: string;
  expiresAt: string;
};

type GmailRow = {
  userId: string;
  googleSub: string;
  email: string;
  refreshTokenEncrypted: string;
  scopes: string;
  status: string;
};

class FakeStatement {
  private bindings: unknown[] = [];
  private readonly db: FakeDb;
  private readonly sql: string;

  constructor(db: FakeDb, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  bind(...values: unknown[]): FakeStatement {
    this.bindings = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return this.db.first(this.sql, this.bindings) as T | null;
  }

  async run(): Promise<{ success: true }> {
    this.db.run(this.sql, this.bindings);
    return { success: true };
  }
}

class FakeDb {
  readonly users = new Map<string, UserRow>();
  readonly userByGoogleSub = new Map<string, string>();
  readonly sessions = new Map<string, SessionRow>();
  readonly attempts = new Map<string, AttemptRow>();
  readonly gmail = new Map<string, GmailRow>();

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this, sql);
  }

  first(sql: string, values: unknown[]): Record<string, unknown> | null {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.includes("FROM user_sessions s") && normalized.includes("INNER JOIN users u")) {
      const session = this.sessions.get(String(values[0]));
      if (!session) return null;
      const user = this.users.get(session.userId);
      if (!user) return null;
      return {
        user_id: user.id,
        expires_at: session.expiresAt,
        google_sub: user.googleSub,
        email: user.email,
        name: user.name,
        picture_url: user.pictureUrl,
      };
    }
    if (normalized.startsWith("SELECT mode, user_id, code_verifier")) {
      const row = this.attempts.get(String(values[0]));
      if (!row) return null;
      return {
        mode: row.mode,
        user_id: row.userId,
        code_verifier: row.codeVerifier,
        next_path: row.nextPath,
        expires_at: row.expiresAt,
      };
    }
    if (normalized.startsWith("SELECT id FROM users WHERE google_sub")) {
      const id = this.userByGoogleSub.get(String(values[0]));
      return id ? { id } : null;
    }
    if (normalized.startsWith("SELECT status, email FROM gmail_connections")) {
      const row = this.gmail.get(String(values[0]));
      return row ? { status: row.status, email: row.email } : null;
    }
    throw new Error(`Unhandled first SQL: ${normalized}`);
  }

  run(sql: string, values: unknown[]): void {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.startsWith("INSERT INTO user_sessions")) {
      this.sessions.set(String(values[0]), {
        userId: String(values[1]),
        expiresAt: String(values[2]),
      });
      return;
    }
    if (normalized.startsWith("DELETE FROM user_sessions WHERE token_hash")) {
      this.sessions.delete(String(values[0]));
      return;
    }
    if (normalized.startsWith("DELETE FROM oauth_attempts WHERE expires_at")) {
      const cutoff = String(values[0]);
      for (const [key, row] of this.attempts) {
        if (row.expiresAt <= cutoff) this.attempts.delete(key);
      }
      return;
    }
    if (normalized.startsWith("INSERT INTO oauth_attempts")) {
      this.attempts.set(String(values[0]), {
        mode: String(values[1]),
        userId: values[2] === null ? null : String(values[2]),
        codeVerifier: String(values[3]),
        nextPath: String(values[4]),
        expiresAt: String(values[5]),
      });
      return;
    }
    if (normalized.startsWith("DELETE FROM oauth_attempts WHERE state_hash")) {
      this.attempts.delete(String(values[0]));
      return;
    }
    if (normalized.startsWith("UPDATE users SET")) {
      const id = String(values[5]);
      const current = this.users.get(id);
      if (!current) throw new Error("Missing fake user for update.");
      current.email = String(values[0]);
      current.name = values[1] === null ? null : String(values[1]);
      current.pictureUrl = values[2] === null ? null : String(values[2]);
      return;
    }
    if (normalized.startsWith("INSERT INTO users")) {
      const row: UserRow = {
        id: String(values[0]),
        googleSub: String(values[1]),
        email: String(values[2]),
        name: values[3] === null ? null : String(values[3]),
        pictureUrl: values[4] === null ? null : String(values[4]),
      };
      this.users.set(row.id, row);
      this.userByGoogleSub.set(row.googleSub, row.id);
      return;
    }
    if (normalized.startsWith("INSERT INTO gmail_connections")) {
      const row: GmailRow = {
        userId: String(values[0]),
        googleSub: String(values[1]),
        email: String(values[2]),
        refreshTokenEncrypted: String(values[3]),
        scopes: String(values[4]),
        status: "ACTIVE",
      };
      this.gmail.set(row.userId, row);
      return;
    }
    throw new Error(`Unhandled run SQL: ${normalized}`);
  }
}

function env(db: FakeDb, extra: Partial<MultiUserAuthEnv> = {}): MultiUserAuthEnv {
  return {
    DB: db as unknown as D1Database,
    MULTI_USER_ENABLED: "true",
    GOOGLE_OAUTH_CLIENT_ID: "client-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
    GMAIL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    ...extra,
  };
}

function cookie(response: Response, name: string): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${name}=([^;,]+)`));
  assert.ok(match?.[1], `Expected ${name} in ${setCookie}`);
  return `${name}=${match[1]}`;
}

function stateFromStart(response: Response): string {
  const location = response.headers.get("location");
  assert.ok(location);
  const state = new URL(location).searchParams.get("state");
  assert.ok(state);
  return state;
}

async function login(db: FakeDb, fetchImpl: typeof fetch): Promise<{ sessionCookie: string; userId: string }> {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const start = await handleGoogleOAuthStart(
      new Request("https://gimme-job.com/auth/google/start?next=/workspace/learn"),
      env(db),
    );
    assert.equal(start.status, 303);
    const state = stateFromStart(start);
    const stateCookie = cookie(start, "gimmejob_oauth_state");
    const callback = await handleGoogleOAuthCallback(
      new Request(`https://gimme-job.com/auth/google/callback?code=login-code&state=${encodeURIComponent(state)}`, {
        headers: { cookie: stateCookie },
      }),
      env(db),
    );
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("location"), "/workspace/learn");
    assert.equal(db.users.size, 1);
    assert.equal(db.sessions.size, 1);
    return {
      sessionCookie: cookie(callback, "gimmejob_user_session"),
      userId: [...db.users.keys()][0]!,
    };
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function googleFetch(options: { sub?: string; email?: string; refreshToken?: string } = {}): typeof fetch {
  const sub = options.sub ?? "google-sub-1";
  const email = options.email ?? "person@example.com";
  const refreshToken = options.refreshToken ?? "refresh-secret";
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("oauth2.googleapis.com/token")) {
      return Response.json({
        access_token: "access-token",
        refresh_token: refreshToken,
        expires_in: 3600,
        scope: "openid email profile https://www.googleapis.com/auth/gmail.metadata",
      });
    }
    if (url.includes("openidconnect.googleapis.com/v1/userinfo")) {
      return Response.json({ sub, email, email_verified: true, name: "Person", picture: "https://example.com/p.png" });
    }
    if (url.includes("gmail.googleapis.com/gmail/v1/users/me/profile")) {
      return Response.json({ emailAddress: email, historyId: "12345" });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
}

test("normalizes workspace return paths", () => {
  assert.equal(normalizeNextPath("/workspace/learn?section=python"), "/workspace/learn?section=python");
  assert.equal(normalizeNextPath("https://evil.example/"), "/workspace");
  assert.equal(normalizeNextPath("//evil.example"), "/workspace");
  assert.equal(normalizeNextPath("/public"), "/workspace");
  assert.equal(normalizeNextPath(null), "/workspace");
});

test("PKCE challenge matches RFC 7636 example", async () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  assert.equal(await pkceChallenge(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("refresh token encryption round-trips and rejects bad keys", async () => {
  const key = Buffer.alloc(32, 3).toString("base64");
  const encrypted = await encryptRefreshToken("top-secret-refresh-token", key);
  assert.match(encrypted, /^v1\./);
  assert.ok(!encrypted.includes("top-secret"));
  assert.equal(await decryptRefreshToken(encrypted, key), "top-secret-refresh-token");
  await assert.rejects(() => encryptRefreshToken("x", Buffer.alloc(8).toString("base64")), /32 bytes/);
  await assert.rejects(() => decryptRefreshToken("v2.bad.value", key), /Unsupported/);
});

test("feature is disabled by default and methods are restricted", async () => {
  const db = new FakeDb();
  const disabled = env(db, { MULTI_USER_ENABLED: undefined });
  assert.equal((await handleGoogleOAuthStart(new Request("https://gimme-job.com/auth/google/start"), disabled)).status, 404);
  const session = await handleAuthSession(new Request("https://gimme-job.com/auth/session"), disabled);
  assert.deepEqual(await session.json(), { enabled: false, authenticated: false });
  assert.equal((await handleGoogleOAuthStart(new Request("https://gimme-job.com/auth/google/start", { method: "POST" }), env(db))).status, 405);
  assert.equal((await handleAuthSession(new Request("https://gimme-job.com/auth/session", { method: "POST" }), env(db))).status, 405);
  assert.equal((await handleLogout(new Request("https://gimme-job.com/auth/logout"), env(db))).status, 405);
});

test("Google login creates user and opaque server session", async () => {
  const db = new FakeDb();
  const { sessionCookie, userId } = await login(db, googleFetch());
  const status = await handleAuthSession(
    new Request("https://gimme-job.com/auth/session", { headers: { cookie: sessionCookie } }),
    env(db),
  );
  const payload = await status.json() as Record<string, unknown>;
  assert.equal(payload.authenticated, true);
  assert.equal((payload.user as Record<string, unknown>).email, "person@example.com");
  assert.equal((payload.gmail as Record<string, unknown>).connected, false);
  assert.ok(userId.startsWith("usr_"));
  const storedHash = [...db.sessions.keys()][0]!;
  assert.ok(!sessionCookie.includes(storedHash));
});

test("expired sessions are removed", async () => {
  const db = new FakeDb();
  db.users.set("u1", { id: "u1", googleSub: "s1", email: "a@example.com", name: null, pictureUrl: null });
  const rawToken = "expired-token";
  const hash = await sha256Base64Url(rawToken);
  db.sessions.set(hash, { userId: "u1", expiresAt: new Date(Date.now() - 60_000).toISOString() });
  const user = await readUserSession(
    new Request("https://gimme-job.com/", { headers: { cookie: `gimmejob_user_session=${rawToken}` } }),
    env(db),
  );
  assert.equal(user, null);
  assert.equal(db.sessions.has(hash), false);
});

test("Gmail connection uses incremental metadata scope and stores encrypted refresh token", async () => {
  const db = new FakeDb();
  const { sessionCookie, userId } = await login(db, googleFetch());
  const previousFetch = globalThis.fetch;
  globalThis.fetch = googleFetch();
  try {
    const start = await handleGoogleOAuthStart(
      new Request("https://gimme-job.com/auth/google/start?mode=gmail&next=/workspace", {
        headers: { cookie: sessionCookie },
      }),
      env(db),
    );
    assert.equal(start.status, 303);
    const authorization = new URL(start.headers.get("location")!);
    assert.match(authorization.searchParams.get("scope") ?? "", /gmail\.metadata/);
    assert.equal(authorization.searchParams.get("access_type"), "offline");
    assert.equal(authorization.searchParams.get("prompt"), "consent");
    const state = authorization.searchParams.get("state")!;
    const callbackCookie = `${sessionCookie}; ${cookie(start, "gimmejob_oauth_state")}`;
    const callback = await handleGoogleOAuthCallback(
      new Request(`https://gimme-job.com/auth/google/callback?code=gmail-code&state=${encodeURIComponent(state)}`, {
        headers: { cookie: callbackCookie },
      }),
      env(db),
    );
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("location"), "/workspace?gmail=connected");
    const connection = db.gmail.get(userId);
    assert.ok(connection);
    assert.notEqual(connection.refreshTokenEncrypted, "refresh-secret");
    assert.equal(
      await decryptRefreshToken(connection.refreshTokenEncrypted, env(db).GMAIL_TOKEN_ENCRYPTION_KEY!),
      "refresh-secret",
    );

    const status = await handleAuthSession(
      new Request("https://gimme-job.com/auth/session", { headers: { cookie: sessionCookie } }),
      env(db),
    );
    const payload = await status.json() as Record<string, unknown>;
    assert.equal((payload.gmail as Record<string, unknown>).connected, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("Gmail connection rejects a different Google account", async () => {
  const db = new FakeDb();
  const { sessionCookie } = await login(db, googleFetch());
  const start = await handleGoogleOAuthStart(
    new Request("https://gimme-job.com/auth/google/start?mode=gmail", { headers: { cookie: sessionCookie } }),
    env(db),
  );
  const state = stateFromStart(start);
  const previousFetch = globalThis.fetch;
  globalThis.fetch = googleFetch({ sub: "other-google-sub", email: "other@example.com" });
  try {
    const callback = await handleGoogleOAuthCallback(
      new Request(`https://gimme-job.com/auth/google/callback?code=gmail-code&state=${encodeURIComponent(state)}`, {
        headers: { cookie: `${sessionCookie}; ${cookie(start, "gimmejob_oauth_state")}` },
      }),
      env(db),
    );
    assert.equal(callback.status, 409);
    assert.equal(db.gmail.size, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("OAuth callback rejects missing, mismatched, and expired state", async () => {
  const db = new FakeDb();
  const missing = await handleGoogleOAuthCallback(
    new Request("https://gimme-job.com/auth/google/callback?code=x&state=x", { headers: { cookie: "gimmejob_oauth_state=y" } }),
    env(db),
  );
  assert.equal(missing.status, 400);

  const start = await handleGoogleOAuthStart(new Request("https://gimme-job.com/auth/google/start"), env(db));
  const state = stateFromStart(start);
  const hash = await sha256Base64Url(state);
  const attempt = db.attempts.get(hash)!;
  attempt.expiresAt = new Date(Date.now() - 1000).toISOString();
  const expired = await handleGoogleOAuthCallback(
    new Request(`https://gimme-job.com/auth/google/callback?code=x&state=${encodeURIComponent(state)}`, {
      headers: { cookie: cookie(start, "gimmejob_oauth_state") },
    }),
    env(db),
  );
  assert.equal(expired.status, 400);
});

test("logout removes server session and clears cookie", async () => {
  const db = new FakeDb();
  const { sessionCookie } = await login(db, googleFetch());
  assert.equal(db.sessions.size, 1);
  const response = await handleLogout(
    new Request("https://gimme-job.com/auth/logout", { method: "POST", headers: { cookie: sessionCookie } }),
    env(db),
  );
  assert.equal(response.status, 303);
  assert.equal(db.sessions.size, 0);
  assert.match(response.headers.get("set-cookie") ?? "", /gimmejob_user_session=;/);
  assert.match(clearSessionCookie(), /Max-Age=0/);
});
