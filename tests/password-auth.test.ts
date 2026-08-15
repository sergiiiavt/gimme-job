import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureForwardingAlias,
  handlePasswordLogin,
  handlePasswordRegister,
  hashPassword,
  verifyPassword,
} from "../app/auth/password-auth.ts";

type FakeOptions = {
  userId?: string | null;
  passwordHash?: string | null;
  aliasToken?: string | null;
  blockedUntil?: string | null;
  failures?: number;
  windowStartedAt?: string | null;
  claimedBy?: string | null;
};

function fakeDb(options: FakeOptions = {}) {
  const state = {
    insertedUser: false,
    insertedAlias: false,
    insertedSession: false,
    deletedLimits: false,
    failureWrites: 0,
    batchCalls: 0,
    statements: [] as string[],
  };
  const db = {
    prepare(sql: string) {
      const text = sql.replace(/\s+/g, " ").trim();
      state.statements.push(text);
      const statement = {
        values: [] as unknown[],
        bind(...values: unknown[]) { statement.values = values; return statement; },
        async first() {
          if (text.startsWith("SELECT blocked_until FROM auth_login_limits")) {
            return options.blockedUntil ? { blocked_until: options.blockedUntil } : null;
          }
          if (text.startsWith("SELECT failures, window_started_at FROM auth_login_limits")) {
            return options.failures === undefined ? null : {
              failures: options.failures,
              window_started_at: options.windowStartedAt ?? new Date().toISOString(),
            };
          }
          if (text.startsWith("SELECT id,password_hash FROM users")) {
            return options.userId ? { id: options.userId, password_hash: options.passwordHash ?? null } : null;
          }
          if (text.startsWith("SELECT id FROM users WHERE email")) {
            return options.userId ? { id: options.userId } : null;
          }
          if (text.startsWith("SELECT token FROM email_ingest_aliases")) {
            return options.aliasToken ? { token: options.aliasToken } : null;
          }
          if (text.startsWith("SELECT user_id FROM legacy_workspace_claims")) {
            return options.claimedBy ? { user_id: options.claimedBy } : null;
          }
          return null;
        },
        async run() {
          if (text.startsWith("INSERT INTO users")) state.insertedUser = true;
          if (text.startsWith("INSERT INTO email_ingest_aliases")) state.insertedAlias = true;
          if (text.startsWith("INSERT INTO user_sessions")) state.insertedSession = true;
          if (text.startsWith("DELETE FROM auth_login_limits")) state.deletedLimits = true;
          if (text.startsWith("INSERT INTO auth_login_limits")) state.failureWrites += 1;
          return { success: true };
        },
      };
      return statement;
    },
    async batch(statements: unknown[]) {
      state.batchCalls += 1;
      return statements.map(() => ({ success: true }));
    },
  };
  return { db: db as unknown as D1Database, state };
}

function postForm(url: string, values: Record<string, string>): Request {
  return new Request(url, { method: "POST", body: new URLSearchParams(values) });
}

test("password hashes are salted PBKDF2 values and verify correctly", async () => {
  const password = "correct horse battery staple";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.match(first, /^pbkdf2-sha256\$100000\$/);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong password", first), false);
  assert.equal(await verifyPassword(password, "not-a-password-hash"), false);
  assert.equal(await verifyPassword(password, "pbkdf2-sha256$99999$bad$bad"), false);
  assert.equal(await verifyPassword(password, "pbkdf2-sha256$600000$%%%$bad"), false);
});

test("password auth is hidden while multi-user mode is disabled and rejects unsupported methods", async () => {
  const disabled = await handlePasswordLogin(new Request("https://gimme-job.com/workspace/login"), { MULTI_USER_ENABLED: "false" });
  assert.equal(disabled.status, 404);
  const { db } = fakeDb();
  const unsupported = await handlePasswordRegister(new Request("https://gimme-job.com/workspace/register", { method: "DELETE" }), {
    MULTI_USER_ENABLED: "true", DB: db,
  });
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get("allow"), "GET, HEAD, POST");
});

test("password login GET renders a local sign-in form", async () => {
  const { db } = fakeDb();
  const response = await handlePasswordLogin(
    new Request("https://gimme-job.com/workspace/login?next=%2Fworkspace%2Flearn"),
    { MULTI_USER_ENABLED: "true", DB: db },
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Sign in/);
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.doesNotMatch(html, /Sign in with Google/);
});

test("registration validates email, password length, confirmation, and legacy password", async () => {
  const { db } = fakeDb();
  const env = { MULTI_USER_ENABLED: "true", DB: db, APP_PASSWORD: "existing-private-password" };

  const invalidEmail = await handlePasswordRegister(postForm("https://gimme-job.com/workspace/register", {
    email: "not-an-email", password: "valid-password-123", confirmPassword: "valid-password-123",
  }), env);
  assert.equal(invalidEmail.status, 400);
  assert.match(await invalidEmail.text(), /valid email address/);

  const shortPassword = await handlePasswordRegister(postForm("https://gimme-job.com/workspace/register", {
    email: "a@example.com", password: "short", confirmPassword: "short",
  }), env);
  assert.equal(shortPassword.status, 400);
  assert.match(await shortPassword.text(), /12-128 characters/);

  const mismatch = await handlePasswordRegister(postForm("https://gimme-job.com/workspace/register", {
    email: "a@example.com", password: "valid-password-123", confirmPassword: "different-password",
  }), env);
  assert.equal(mismatch.status, 400);
  assert.match(await mismatch.text(), /Passwords do not match/);

  const badLegacy = await handlePasswordRegister(postForm("https://gimme-job.com/workspace/register", {
    email: "a@example.com", password: "valid-password-123", confirmPassword: "valid-password-123", legacyPassword: "wrong",
  }), env);
  assert.equal(badLegacy.status, 400);
  assert.match(await badLegacy.text(), /existing private-site password is incorrect/);
});

test("registration creates a tenant account, forwarding alias, and opaque session", async () => {
  const { db, state } = fakeDb();
  const response = await handlePasswordRegister(postForm("https://gimme-job.com/workspace/register", {
    email: "  New.User@Example.com ",
    password: "valid-password-123",
    confirmPassword: "valid-password-123",
    next: "/workspace/learn?section=interview",
  }), { MULTI_USER_ENABLED: "true", DB: db });

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/workspace/learn?section=interview");
  assert.match(response.headers.get("set-cookie") ?? "", /^gimmejob_user_session=/);
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.equal(state.insertedUser, true);
  assert.equal(state.insertedAlias, true);
  assert.equal(state.insertedSession, true);
});

test("registration refuses duplicate accounts", async () => {
  const { db, state } = fakeDb({ userId: "existing-user" });
  const response = await handlePasswordRegister(postForm("https://gimme-job.com/workspace/register", {
    email: "existing@example.com", password: "valid-password-123", confirmPassword: "valid-password-123",
  }), { MULTI_USER_ENABLED: "true", DB: db });
  assert.equal(response.status, 400);
  assert.match(await response.text(), /already exists/);
  assert.equal(state.insertedUser, false);
});

test("legacy owner can claim the old single-user workspace once during registration", async () => {
  const { db, state } = fakeDb();
  const response = await handlePasswordRegister(postForm("https://gimme-job.com/workspace/register", {
    email: "owner@example.com",
    password: "valid-password-123",
    confirmPassword: "valid-password-123",
    legacyPassword: "existing-private-password",
  }), { MULTI_USER_ENABLED: "true", DB: db, APP_PASSWORD: "existing-private-password" });
  assert.equal(response.status, 303);
  assert.equal(state.batchCalls, 1);
  assert.equal(state.insertedSession, true);
});

test("successful login verifies password, clears throttle state, reuses alias, and creates session", async () => {
  const password = "valid-password-123";
  const passwordHash = await hashPassword(password);
  const { db, state } = fakeDb({ userId: "user-a", passwordHash, aliasToken: "existingalias12" });
  const response = await handlePasswordLogin(postForm("https://gimme-job.com/workspace/login", {
    email: "USER@EXAMPLE.COM", password, next: "/workspace",
  }), { MULTI_USER_ENABLED: "true", DB: db });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/workspace");
  assert.equal(state.deletedLimits, true);
  assert.equal(state.insertedAlias, false);
  assert.equal(state.insertedSession, true);
});

test("failed and blocked logins are throttled without creating sessions", async () => {
  const passwordHash = await hashPassword("valid-password-123");
  const failed = fakeDb({ userId: "user-a", passwordHash, failures: 2 });
  const bad = await handlePasswordLogin(postForm("https://gimme-job.com/workspace/login", {
    email: "user@example.com", password: "wrong-password-123",
  }), { MULTI_USER_ENABLED: "true", DB: failed.db });
  assert.equal(bad.status, 400);
  assert.match(await bad.text(), /Invalid email or password/);
  assert.equal(failed.state.failureWrites, 1);
  assert.equal(failed.state.insertedSession, false);

  const blocked = fakeDb({ blockedUntil: new Date(Date.now() + 60_000).toISOString() });
  const blockedResponse = await handlePasswordLogin(postForm("https://gimme-job.com/workspace/login", {
    email: "user@example.com", password: "anything-long-enough",
  }), { MULTI_USER_ENABLED: "true", DB: blocked.db });
  assert.equal(blockedResponse.status, 400);
  assert.match(await blockedResponse.text(), /Too many sign-in attempts/);
  assert.equal(blocked.state.failureWrites, 0);
});

test("ensureForwardingAlias reuses existing token or creates a private token", async () => {
  const existing = fakeDb({ aliasToken: "existingalias12" });
  assert.equal(await ensureForwardingAlias(existing.db, "user-a"), "existingalias12");
  assert.equal(existing.state.insertedAlias, false);

  const created = fakeDb();
  const token = await ensureForwardingAlias(created.db, "user-b");
  assert.match(token, /^[a-z0-9_-]{12,64}$/);
  assert.equal(created.state.insertedAlias, true);
});
