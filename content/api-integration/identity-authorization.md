# Identity & Authorization

Identity and access control answer two different questions:

- **authentication** — who is the user, client or service;
- **authorization** — what that authenticated identity is allowed to do.

A system can authenticate an identity successfully and still reject the requested operation because the identity lacks permission.

## Core concepts

| Concept | Meaning |
| --- | --- |
| Principal | User, client, workload or service whose identity is being represented |
| Credential | Secret or proof used to establish identity, such as a password, key or certificate |
| Session | Server-side or signed state that represents an authenticated interaction over time |
| Token | Credential or assertion carried between components |
| Claim | Statement about an identity or token context |
| Scope | Delegated permission or access boundary associated with a token |
| Role | Named group of permissions, such as `admin` or `viewer` |
| Permission | Concrete action allowed on a resource |
| Policy | Rule that decides whether access is allowed |

Authentication establishes a security context. Authorization evaluates that context against the requested resource and operation.

## HTTP Basic authentication

HTTP Basic authentication carries a username and password in the `Authorization` header.

~~~http
Authorization: Basic YWxpY2U6c2VjcmV0
~~~

The value after `Basic` is Base64-encoded `username:password`. Base64 is encoding, not encryption, so Basic authentication requires TLS to protect credentials in transit.

Basic authentication is simple but has important properties:

- the credential is normally sent on every authenticated request;
- there is no built-in token expiry or delegated scope model;
- password rotation affects the credential directly;
- credentials must not be exposed through logs or client-side storage.

## API keys

An API key is an application credential issued to a client or integration.

A common form is a dedicated request header:

~~~http
X-API-Key: <key>
~~~

API keys are often used for service access, metering or client identification. They do not inherently identify a human user and they do not automatically provide fine-grained authorization.

A robust API-key system normally needs:

- unique keys per consumer or workload;
- server-side hashing or otherwise protected storage;
- rotation and revocation;
- least-privilege permissions;
- auditability;
- restrictions on where the key may be used when appropriate.

Putting long-lived secrets in query strings is generally undesirable because URLs are more likely to appear in logs, browser history, analytics and referrer data.

## Sessions and cookies

Traditional browser authentication often uses a server-managed session.

```diagram
Browser
  │ credentials
  ▼
Application
  │ authenticate
  │ create session
  ▼
Set-Cookie: session=<opaque-id>
  │
  ▼
Browser sends Cookie on later requests
```

The cookie normally contains an opaque session identifier or, in some architectures, signed session data.

Important cookie attributes include:

- `Secure` — send only over secure connections;
- `HttpOnly` — browser JavaScript cannot read the cookie;
- `SameSite` — controls when cookies are sent in cross-site contexts;
- `Domain` — limits host scope;
- `Path` — limits path scope;
- `Max-Age` or `Expires` — controls lifetime.

Because browsers automatically attach matching cookies, cookie-based authentication must consider CSRF separately from CORS.

## Bearer tokens

A Bearer token is presented in the `Authorization` header:

~~~http
Authorization: Bearer <access-token>
~~~

"Bearer" means possession of the token is sufficient to use it unless another sender-constraining mechanism is added. Anyone who obtains a valid bearer token may be able to act with its privileges until it expires or is revoked.

Bearer tokens therefore require protection in transit and at rest.

A bearer access token can be:

- **opaque** — meaningful only to the authorization/resource server;
- **structured** — contains readable claims, commonly using JWT.

The application should not assume that every Bearer token is a JWT.

## JSON Web Tokens

A JSON Web Token (JWT) is a compact, URL-safe representation of claims. JWTs are commonly signed using JWS and can also be encrypted using JWE.

A typical signed JWT has three Base64url-encoded segments:

~~~text
header.payload.signature
~~~

Example decoded header:

~~~json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key-2026-01"
}
~~~

Example decoded claims:

~~~json
{
  "iss": "https://auth.example.com",
  "sub": "user-42",
  "aud": "orders-api",
  "exp": 1788000000,
  "iat": 1787996400,
  "scope": "orders:read orders:write"
}
~~~

### Common registered JWT claims

| Claim | Meaning |
| --- | --- |
| `iss` | Issuer |
| `sub` | Subject |
| `aud` | Intended audience |
| `exp` | Expiration time |
| `nbf` | Not valid before |
| `iat` | Issued at |
| `jti` | Token identifier |

A JWT payload is not secret merely because it is Base64url-encoded. Signed JWTs protect integrity/authenticity; they do not encrypt the claims.

### JWT validation

A resource server should validate the token according to its trust model. Typical checks include:

- cryptographic signature or MAC;
- expected algorithm and key;
- trusted issuer (`iss`);
- intended audience (`aud`);
- expiration (`exp`);
- not-before (`nbf`) when present;
- token type/context when multiple token kinds exist;
- required scopes or claims.

The validator must not simply decode claims and trust them.

JWT Best Current Practices also emphasize explicit algorithm verification and avoiding unsafe algorithm/key confusion.

## OAuth 2.0

OAuth 2.0 is an authorization framework that allows a client to obtain limited access to protected resources. It separates several roles.

| Role | Responsibility |
| --- | --- |
| Resource owner | Entity that can grant access, often a user |
| Client | Application requesting access |
| Authorization server | Authenticates/authorizes and issues tokens |
| Resource server | API that accepts access tokens |

A simplified flow is:

```diagram
User / resource owner
        │
        ▼
Client ─────► Authorization server
  │             │
  │             └── access token
  ▼
Resource server / API
```

OAuth does not define user identity by itself. Its primary purpose is delegated authorization.

## Authorization Code flow with PKCE

For browser-based, native and other public clients, Authorization Code with PKCE is a central modern OAuth pattern.

High-level flow:

1. client creates a random `code_verifier`;
2. client derives a `code_challenge`;
3. browser is redirected to the authorization endpoint;
4. user authenticates and authorizes access;
5. authorization server returns an authorization code;
6. client exchanges the code together with the original `code_verifier`;
7. authorization server validates PKCE and issues tokens.

PKCE protects the authorization-code flow against interception and misuse of a stolen authorization code.

Modern OAuth security guidance requires strong redirect-URI validation and recommends PKCE broadly. The Resource Owner Password Credentials grant must not be used under current OAuth 2.0 Security Best Current Practice.

## Client Credentials flow

Client Credentials is used when a confidential client acts on its own behalf rather than on behalf of an end user.

```diagram
Service A
  │ client authentication
  ▼
Authorization server
  │ access token
  ▼
Service A ─────► Service B API
```

Typical use cases include machine-to-machine integrations and background services.

The client credential itself and the resulting token are different credentials and may have different lifetimes, scopes and rotation rules.

## Refresh tokens

A refresh token allows a client to obtain a new access token without repeating the full user authorization flow.

Refresh tokens are high-value credentials because they may outlive access tokens. Their lifecycle can include:

- expiration;
- revocation;
- rotation;
- reuse detection;
- binding to a client/session/device context.

Short-lived access tokens reduce the window of exposure, but only if refresh-token handling is also secure.

## OpenID Connect

OpenID Connect (OIDC) is an identity layer built on OAuth 2.0. It adds standardized authentication and identity information.

OIDC introduces an **ID Token**, normally a JWT, containing claims about the authenticated user and authentication event.

An ID token and an access token serve different purposes:

| Token | Primary purpose | Intended consumer |
| --- | --- | --- |
| ID token | Tell the client about the authenticated user/session | Client application |
| Access token | Authorize access to a protected resource | Resource server/API |

A client should not send an ID token to an API as a substitute for an access token unless a specific contract explicitly defines such behavior.

## Scopes

OAuth scopes describe delegated access granted to a token.

Example:

~~~text
orders:read orders:write profile
~~~

Scopes are usually coarse-grained capabilities associated with a token. A resource server still needs to combine scope evaluation with resource ownership, tenant boundaries and other authorization rules.

A token with `orders:write` does not automatically mean the caller may modify every order in the system.

## Roles and permissions

A role groups permissions.

Example:

~~~text
role: support-agent
permissions:
- customer:read
- ticket:read
- ticket:update
~~~

Roles simplify administration, but authorization should ultimately be evaluated in terms of allowed actions and resources rather than trusting a role name without policy semantics.

## RBAC

**Role-Based Access Control (RBAC)** grants permissions through roles.

```diagram
User → Role → Permissions → Resources
```

Example:

- `viewer` → read reports;
- `editor` → read and modify reports;
- `admin` → manage reports and configuration.

RBAC works well when organizational roles map cleanly to permissions.

## ABAC

**Attribute-Based Access Control (ABAC)** evaluates attributes about the principal, resource, action and environment.

Example policy:

~~~text
allow update when
  user.department == document.department
  AND user.clearance >= document.classification
  AND request.time within business-hours
~~~

ABAC can express richer policies than fixed roles but introduces more policy complexity.

RBAC and ABAC are not mutually exclusive; many systems combine them.

## Object-level authorization

Authorization must be checked against the specific target object, not only against the endpoint.

Example:

~~~http
GET /accounts/42
Authorization: Bearer <token-for-user-7>
~~~

The server must determine whether user 7 may access account 42. A valid token and a general `accounts:read` scope may be insufficient.

This rule also applies to nested resources, file identifiers, batch operations and indirect object references.

## Multi-tenant authorization

A multi-tenant system must preserve tenant boundaries.

A request context can include:

- authenticated subject;
- current tenant;
- allowed tenant memberships;
- role or permissions inside that tenant;
- target resource tenant.

Authorization should ensure that the resource belongs to an allowed tenant and that the operation is permitted within that tenant.

Tenant identifiers provided by the client must not be trusted without server-side validation against the authenticated identity.

## Service-to-service identity

Machine identities can use mechanisms such as:

- OAuth Client Credentials;
- mutual TLS (mTLS);
- signed requests/HMAC;
- workload identity issued by a cloud or orchestration platform;
- short-lived service tokens.

A service identity should be unique enough for audit and revocation. Reusing one shared secret across many services makes least privilege and incident containment difficult.

## Mutual TLS

With mutual TLS, both client and server present certificates during the TLS handshake.

```diagram
Client certificate ──► Server
Client ◄── Server certificate
```

mTLS can establish strong machine identity at the transport layer. Applications may map the client certificate or certificate-derived identity to authorization policies.

mTLS does not remove the need for application-level authorization.

## Request signing

Some APIs authenticate requests by signing selected request components with a shared secret or private key.

A signature input may include:

- method;
- path;
- selected headers;
- body digest;
- timestamp;
- nonce.

Request signing can provide integrity and replay resistance when implemented with a well-defined canonicalization and verification contract.

## Token and credential lifecycle

Every credential has a lifecycle.

```diagram
Issue
  ↓
Distribute
  ↓
Use
  ↓
Rotate / refresh
  ↓
Revoke / expire
  ↓
Remove
```

Important properties include:

- lifetime;
- rotation process;
- revocation mechanism;
- compromise response;
- audit trail;
- storage location;
- least-privilege scope.

Long-lived credentials increase operational simplicity but also increase exposure when compromised.

## 401 and 403

HTTP status semantics distinguish authentication from authorization.

**401 Unauthorized** means authentication credentials are required, missing or invalid for the request. A 401 response commonly includes `WWW-Authenticate`.

**403 Forbidden** means the server understands the request but refuses to authorize it.

An API may intentionally return 404 for some protected resources to avoid revealing whether they exist, but that is an application security decision rather than a redefinition of 403.

## Authentication versus authorization flow

A typical protected request can be reasoned about in this order:

```diagram
Request
  ↓
Extract credential
  ↓
Authenticate / validate token
  ↓
Build principal + claims context
  ↓
Evaluate policy for action + resource
  ↓
Allow or deny
```

Authentication failure stops before a trusted principal is established. Authorization failure occurs after the system has enough trusted context to evaluate access.

## Server-side enforcement

Client-side UI restrictions are not authorization controls.

Hiding an admin button, disabling a form field or omitting a menu item can improve UX, but the server must independently enforce the permission on every protected operation.

The same principle applies to:

- REST endpoints;
- GraphQL resolvers;
- WebSocket messages;
- file downloads;
- background jobs;
- event consumers;
- administrative tools.

## Sources

- [RFC 7617 — The Basic HTTP Authentication Scheme](https://www.rfc-editor.org/rfc/rfc7617.html)
- [RFC 6750 — OAuth 2.0 Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750.html)
- [RFC 6749 — The OAuth 2.0 Authorization Framework](https://www.rfc-editor.org/rfc/rfc6749.html)
- [RFC 7636 — Proof Key for Code Exchange (PKCE)](https://www.rfc-editor.org/rfc/rfc7636.html)
- [RFC 9700 — Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.html)
- [RFC 7519 — JSON Web Token (JWT)](https://www.rfc-editor.org/rfc/rfc7519.html)
- [RFC 8725 — JSON Web Token Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.html)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
