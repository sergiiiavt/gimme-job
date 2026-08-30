# Identity & Authorization

Identity та access control відповідають на два різні питання:

- **authentication** — ким є user, client або service;
- **authorization** — що цій authenticated identity дозволено робити.

System може успішно authenticate identity і все одно відхилити operation, якщо identity не має потрібного permission.

## Core concepts

| Concept | Значення |
| --- | --- |
| Principal | User, client, workload або service, identity якого представляється |
| Credential | Secret або proof для встановлення identity: password, key, certificate |
| Session | Server-side або signed state authenticated interaction |
| Token | Credential або assertion, що передається між components |
| Claim | Твердження про identity або token context |
| Scope | Delegated permission або access boundary token |
| Role | Named group permissions, наприклад `admin` або `viewer` |
| Permission | Concrete action, дозволена на resource |
| Policy | Rule, що вирішує, чи дозволений access |

Authentication створює trusted security context. Authorization оцінює цей context для конкретного resource та operation.

## HTTP Basic authentication

HTTP Basic authentication передає username і password у header `Authorization`.

~~~http
Authorization: Basic YWxpY2U6c2VjcmV0
~~~

Value після `Basic` — Base64-encoded `username:password`. Base64 — encoding, а не encryption, тому Basic authentication потребує TLS для захисту credentials in transit.

Основні властивості Basic authentication:

- credential зазвичай надсилається в кожному authenticated request;
- немає built-in token expiry або delegated scope model;
- password rotation напряму змінює credential;
- credentials не повинні потрапляти в logs або unsafe client-side storage.

## API keys

API key — application credential, виданий client або integration.

Поширений варіант — dedicated request header:

~~~http
X-API-Key: <key>
~~~

API keys часто використовують для service access, metering або client identification. Вони самі по собі не ідентифікують human user і не створюють fine-grained authorization model.

Надійний API-key system зазвичай потребує:

- unique key для кожного consumer/workload;
- protected server-side storage;
- rotation і revocation;
- least-privilege permissions;
- auditability;
- restrictions on usage, якщо це потрібно.

Long-lived secrets небажано передавати через query string, тому що URLs частіше потрапляють у logs, browser history, analytics та referrer data.

## Sessions та cookies

Традиційна browser authentication часто використовує server-managed session.

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

Cookie зазвичай містить opaque session identifier або, в окремих architectures, signed session data.

Важливі cookie attributes:

- `Secure` — надсилати лише через secure connections;
- `HttpOnly` — browser JavaScript не може прочитати cookie;
- `SameSite` — контролює cross-site cookie sending;
- `Domain` — обмежує host scope;
- `Path` — обмежує path scope;
- `Max-Age` або `Expires` — визначає lifetime.

Оскільки browser автоматично додає matching cookies, cookie-based authentication має окремо враховувати CSRF. CORS не замінює CSRF protection.

## Bearer tokens

Bearer token передається в `Authorization` header:

~~~http
Authorization: Bearer <access-token>
~~~

"Bearer" означає, що possession token достатньо для його використання, якщо не додано окремий sender-constraining mechanism. Той, хто отримає valid bearer token, може діяти з його privileges до expiry або revocation.

Bearer tokens потребують захисту in transit і at rest.

Bearer access token може бути:

- **opaque** — його meaning знає лише authorization/resource server;
- **structured** — містить readable claims, часто у форматі JWT.

Не кожен Bearer token є JWT.

## JSON Web Tokens

JSON Web Token (JWT) — compact URL-safe representation claims. JWT часто підписується через JWS і також може бути encrypted через JWE.

Typical signed JWT має три Base64url-encoded segments:

~~~text
header.payload.signature
~~~

Decoded header:

~~~json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key-2026-01"
}
~~~

Decoded claims:

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

| Claim | Значення |
| --- | --- |
| `iss` | Issuer |
| `sub` | Subject |
| `aud` | Intended audience |
| `exp` | Expiration time |
| `nbf` | Not valid before |
| `iat` | Issued at |
| `jti` | Token identifier |

JWT payload не є secret лише тому, що Base64url-encoded. Signed JWT захищає integrity/authenticity, але не encrypt-ить claims.

### JWT validation

Resource server має validate token відповідно до trust model. Типові checks:

- cryptographic signature або MAC;
- expected algorithm та key;
- trusted issuer (`iss`);
- intended audience (`aud`);
- expiration (`exp`);
- not-before (`nbf`), якщо present;
- token type/context, якщо system має кілька token kinds;
- required scopes або claims.

Validator не повинен просто decode claims і довіряти їм.

JWT Best Current Practices також вимагають explicit algorithm verification і захисту від algorithm/key confusion.

## OAuth 2.0

OAuth 2.0 — authorization framework, який дозволяє client отримати limited access до protected resources. Він розділяє кілька roles.

| Role | Responsibility |
| --- | --- |
| Resource owner | Entity, що може grant access, часто user |
| Client | Application, яка запитує access |
| Authorization server | Authenticates/authorizes та видає tokens |
| Resource server | API, який приймає access tokens |

Simplified flow:

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

OAuth сам по собі не визначає user identity. Його primary purpose — delegated authorization.

## Authorization Code flow з PKCE

Для browser-based, native та інших public clients Authorization Code + PKCE є central modern OAuth pattern.

High-level flow:

1. client генерує random `code_verifier`;
2. client формує `code_challenge`;
3. browser redirect-иться на authorization endpoint;
4. user проходить authentication та authorization;
5. authorization server повертає authorization code;
6. client обмінює code разом із original `code_verifier`;
7. authorization server validate-ить PKCE і видає tokens.

PKCE захищає authorization-code flow від interception і misuse stolen authorization code.

Current OAuth security guidance вимагає strict redirect-URI validation і broadly recommends PKCE. Resource Owner Password Credentials grant не повинен використовуватись згідно з OAuth 2.0 Security Best Current Practice.

## Client Credentials flow

Client Credentials використовується, коли confidential client діє від свого імені, а не від імені end user.

```diagram
Service A
  │ client authentication
  ▼
Authorization server
  │ access token
  ▼
Service A ─────► Service B API
```

Typical use cases — machine-to-machine integrations і background services.

Client credential та access token — різні credentials і можуть мати різні lifetime, scopes та rotation rules.

## Refresh tokens

Refresh token дозволяє client отримати новий access token без повторення повного user authorization flow.

Refresh tokens — high-value credentials, тому що можуть жити довше за access tokens. Lifecycle може включати:

- expiration;
- revocation;
- rotation;
- reuse detection;
- binding до client/session/device context.

Short-lived access tokens зменшують exposure window тільки якщо refresh-token handling також secure.

## OpenID Connect

OpenID Connect (OIDC) — identity layer поверх OAuth 2.0. Він додає standardized authentication та identity information.

OIDC вводить **ID Token**, зазвичай JWT, з claims про authenticated user та authentication event.

ID token і access token мають різні purposes:

| Token | Primary purpose | Intended consumer |
| --- | --- | --- |
| ID token | Повідомити client про authenticated user/session | Client application |
| Access token | Authorize access до protected resource | Resource server/API |

Client не повинен надсилати ID token в API замість access token, якщо specific contract прямо цього не визначає.

## Scopes

OAuth scopes описують delegated access, виданий token.

~~~text
orders:read orders:write profile
~~~

Scopes зазвичай є coarse-grained capabilities token. Resource server все одно має поєднувати scope evaluation з resource ownership, tenant boundaries та іншими authorization rules.

Token з `orders:write` не означає автоматично, що caller може змінити будь-який order у system.

## Roles та permissions

Role групує permissions.

~~~text
role: support-agent
permissions:
- customer:read
- ticket:read
- ticket:update
~~~

Roles спрощують administration, але authorization має зрештою evaluate allowed actions та resources, а не просто довіряти role name без policy semantics.

## RBAC

**Role-Based Access Control (RBAC)** видає permissions через roles.

```diagram
User → Role → Permissions → Resources
```

Приклад:

- `viewer` → read reports;
- `editor` → read і modify reports;
- `admin` → manage reports та configuration.

RBAC добре працює, коли organizational roles чітко мапляться на permissions.

## ABAC

**Attribute-Based Access Control (ABAC)** оцінює attributes principal, resource, action та environment.

~~~text
allow update when
  user.department == document.department
  AND user.clearance >= document.classification
  AND request.time within business-hours
~~~

ABAC може виражати складніші policies, ніж fixed roles, але додає policy complexity.

RBAC та ABAC не mutually exclusive; багато systems комбінують їх.

## Object-level authorization

Authorization має перевірятись для конкретного target object, а не лише endpoint.

~~~http
GET /accounts/42
Authorization: Bearer <token-for-user-7>
~~~

Server має визначити, чи може user 7 access account 42. Valid token і general `accounts:read` scope можуть бути недостатніми.

Це правило також застосовується до nested resources, file identifiers, batch operations та indirect object references.

## Multi-tenant authorization

Multi-tenant system має зберігати tenant boundaries.

Request context може включати:

- authenticated subject;
- current tenant;
- allowed tenant memberships;
- role або permissions у цьому tenant;
- target resource tenant.

Authorization має перевірити, що resource належить allowed tenant і operation дозволена в цьому tenant.

Tenant identifier, який надсилає client, не можна довіряти без server-side validation проти authenticated identity.

## Service-to-service identity

Machine identities можуть використовувати:

- OAuth Client Credentials;
- mutual TLS (mTLS);
- signed requests/HMAC;
- workload identity від cloud/orchestration platform;
- short-lived service tokens.

Service identity має бути достатньо unique для audit та revocation. Один shared secret для багатьох services ускладнює least privilege і incident containment.

## Mutual TLS

При mutual TLS і client, і server презентують certificates під час TLS handshake.

```diagram
Client certificate ──► Server
Client ◄── Server certificate
```

mTLS може створювати strong machine identity на transport layer. Application може map client certificate або certificate-derived identity до authorization policies.

mTLS не прибирає необхідність application-level authorization.

## Request signing

Деякі APIs authenticate requests через signature selected request components з shared secret або private key.

Signature input може включати:

- method;
- path;
- selected headers;
- body digest;
- timestamp;
- nonce.

Request signing може забезпечувати integrity та replay resistance, якщо canonicalization і verification contract чітко визначені.

## Token та credential lifecycle

Кожен credential має lifecycle.

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

Важливі properties:

- lifetime;
- rotation process;
- revocation mechanism;
- compromise response;
- audit trail;
- storage location;
- least-privilege scope.

Long-lived credentials простіші operationally, але збільшують exposure після compromise.

## 401 та 403

HTTP status semantics розрізняє authentication та authorization.

**401 Unauthorized** означає, що authentication credentials потрібні, відсутні або invalid. 401 часто повертається разом із `WWW-Authenticate`.

**403 Forbidden** означає, що server розуміє request, але відмовляє в authorization.

API може навмисно повертати 404 для окремих protected resources, щоб не reveal їх existence, але це application security decision, а не нове definition 403.

## Authentication versus authorization flow

Typical protected request:

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

Authentication failure відбувається до встановлення trusted principal. Authorization failure виникає після того, як system має достатньо trusted context для access decision.

## Server-side enforcement

Client-side UI restrictions не є authorization controls.

Hidden admin button, disabled field або відсутній menu item можуть покращувати UX, але server має independently enforce permission на кожній protected operation.

Той самий principle застосовується до:

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
