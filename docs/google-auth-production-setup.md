# Google authentication and Gmail authorization — production setup

GimmeJob uses one Google web OAuth client for two separate user actions:

1. **Sign in to GimmeJob** — requests only `openid email profile`.
2. **Connect Gmail** — requested later from an already authenticated account and adds `https://www.googleapis.com/auth/gmail.metadata` with offline access.

The Gmail permission is intentionally not requested during ordinary sign-in.

## 1. Google Cloud project

Create or select the Google Cloud project used by GimmeJob and configure the OAuth consent screen / Google Auth Platform branding for `gimme-job.com`.

Enable the Gmail API before testing **Connect Gmail**.

For development/testing, keep the OAuth app in testing mode and add the required Google accounts as test users. Do not move a public Gmail integration to production until the applicable Google verification requirements are understood and satisfied.

## 2. Create a Web application OAuth client

Create an OAuth 2.0 client with application type **Web application**.

Production redirect URI:

```text
https://gimme-job.com/auth/google/callback
```

The server derives the callback from the request origin, so production users should enter through the canonical `https://gimme-job.com` domain. Do not use a desktop OAuth client for the hosted application.

## 3. GitHub repository secrets

Add these repository secrets:

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GMAIL_TOKEN_ENCRYPTION_KEY
```

`GMAIL_TOKEN_ENCRYPTION_KEY` must be base64-encoded **32 random bytes**. One way to generate it locally is:

```bash
python -c "import base64,secrets; print(base64.b64encode(secrets.token_bytes(32)).decode())"
```

Do not paste the generated key into issues, commits, PR comments, or chat. Store it only as a secret.

## 4. Keep the feature flag off for the credential deploy

Repository variable:

```text
MULTI_USER_ENABLED=false
```

Merge/deploy the auth code first with the flag off. The deploy workflow can then place the Google credentials into Cloudflare without changing the existing password-based production behavior.

## 5. Enable multi-user auth

After all three Google secrets are present, change the repository variable to:

```text
MULTI_USER_ENABLED=true
```

Run the production workflow again.

The deployment script refuses to enable multi-user auth when any required Google credential is missing or when the Gmail encryption key does not decode to 32 bytes.

## 6. Expected production flow

Anonymous user:

```text
Public site
  -> Sign in with Google
  -> /workspace/login
  -> /auth/google/start
  -> Google
  -> /auth/google/callback
  -> D1 user + server-side session
  -> Personal view
```

Authenticated user connecting Gmail:

```text
Account menu
  -> Connect Gmail
  -> Google consent for gmail.metadata
  -> /auth/google/callback
  -> encrypted refresh token in D1, scoped to user_id
```

Disconnecting Gmail performs a best-effort Google OAuth token revocation and always removes the encrypted local Gmail credential.

## 7. Security properties

- OAuth authorization-code flow with PKCE and one-time state stored in D1.
- OAuth state also bound to an `HttpOnly; Secure; SameSite=Lax` cookie.
- GimmeJob sessions use random opaque tokens; only their SHA-256 hashes are stored in D1.
- Gmail refresh tokens are encrypted with AES-GCM before storage.
- Identity headers reaching the application are stripped and recreated only by the Cloudflare Worker authentication boundary.
- Tenant-owned application data is keyed by `user_id`.
- Logout removes the server-side session and clears the browser cookie.
- Gmail disconnect removes the local token even if remote revocation is unavailable.

## 8. Important Gmail production constraint

`gmail.metadata` is a Google Workspace **restricted** scope. A public application requesting it is subject to Google's restricted-scope verification rules. If restricted Gmail data is stored or transmitted through the application's servers, Google may require an independent security assessment.

This does not block testing with approved test users, but it must be handled before broad public Gmail access is launched.
