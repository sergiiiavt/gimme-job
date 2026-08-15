import assert from "node:assert/strict";
import test from "node:test";
import { encryptRefreshToken, type MultiUserAuthEnv } from "../app/auth/google-oauth.ts";
import { handleGmailDisconnect } from "../app/auth/gmail-disconnect.ts";

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
  authenticated = true;
  connectionToken: string | null = null;
  deletedUserId: string | null = null;

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this, sql);
  }

  first(sql: string, values: unknown[]): Record<string, unknown> | null {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.includes("FROM user_sessions s") && normalized.includes("INNER JOIN users u")) {
      if (!this.authenticated) return null;
      return {
        user_id: "usr-1",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        google_sub: "google-sub-1",
        email: "user@example.com",
        name: "User",
        picture_url: null,
      };
    }
    if (normalized.startsWith("SELECT refresh_token_encrypted FROM gmail_connections")) {
      return this.connectionToken ? { refresh_token_encrypted: this.connectionToken } : null;
    }
    throw new Error(`Unhandled first SQL: ${normalized} / ${values.join(",")}`);
  }

  run(sql: string, values: unknown[]): void {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.startsWith("DELETE FROM gmail_connections WHERE user_id")) {
      this.deletedUserId = String(values[0]);
      this.connectionToken = null;
      return;
    }
    if (normalized.startsWith("DELETE FROM user_sessions WHERE token_hash")) return;
    throw new Error(`Unhandled run SQL: ${normalized}`);
  }
}

function environment(db: FakeDb, extra: Partial<MultiUserAuthEnv> = {}): MultiUserAuthEnv {
  return {
    DB: db as unknown as D1Database,
    MULTI_USER_ENABLED: "true",
    GMAIL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
    ...extra,
  };
}

function request(method = "POST") {
  return new Request("https://gimme-job.com/auth/gmail/disconnect?next=%2Fworkspace%2Flearn%3Fsection%3Dinterview", {
    method,
    headers: { cookie: "gimmejob_user_session=session-token" },
  });
}

test("Gmail disconnect is hidden while multi-user authentication is disabled", async () => {
  const response = await handleGmailDisconnect(request(), { MULTI_USER_ENABLED: "false" });
  assert.equal(response.status, 404);
});

test("Gmail disconnect only accepts POST", async () => {
  const response = await handleGmailDisconnect(request("GET"), environment(new FakeDb()));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});

test("Gmail disconnect requires an authenticated session", async () => {
  const db = new FakeDb();
  db.authenticated = false;
  const response = await handleGmailDisconnect(request(), environment(db));
  assert.equal(response.status, 401);
  assert.equal(db.deletedUserId, null);
});

test("Gmail disconnect revokes the provider token and removes the local credential", async () => {
  const db = new FakeDb();
  const key = Buffer.alloc(32, 9).toString("base64");
  db.connectionToken = await encryptRefreshToken("refresh-token-123", key);
  const previousFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: string }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), body: String(init?.body ?? "") });
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  try {
    const response = await handleGmailDisconnect(request(), environment(db, { GMAIL_TOKEN_ENCRYPTION_KEY: key }));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/workspace/learn?section=interview&gmail=revoked");
    assert.equal(db.deletedUserId, "usr-1");
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, "https://oauth2.googleapis.com/revoke");
    assert.match(requests[0]?.body ?? "", /token=refresh-token-123/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("local Gmail disconnect still succeeds if provider revocation fails", async () => {
  const db = new FakeDb();
  const key = Buffer.alloc(32, 9).toString("base64");
  db.connectionToken = await encryptRefreshToken("refresh-token-456", key);
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(null, { status: 400 })) as typeof fetch;

  try {
    const response = await handleGmailDisconnect(request(), environment(db, { GMAIL_TOKEN_ENCRYPTION_KEY: key }));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/workspace/learn?section=interview&gmail=disconnected");
    assert.equal(db.deletedUserId, "usr-1");
  } finally {
    globalThis.fetch = previousFetch;
  }
});
