const markdown = String.raw`This chapter builds the HTTP mental model first, then turns it into practical API-testing knowledge. The goal is not to memorize a protocol dictionary; it is to understand what a request means, what a response proves, and where to look when an API behaves incorrectly.

## 1. HTTP mental model: request → response

HTTP is an application-layer protocol based on messages. A client sends an **HTTP request** to a target resource; a server returns an **HTTP response**.

A request is conceptually made of:

1. **Method** — what the client intends to do, for example GET, POST or DELETE.
2. **Target** — the resource URI/path and optional query parameters.
3. **Headers** — metadata and control information such as Accept, Authorization or Content-Type.
4. **Body/content** — optional data sent to the server, for example JSON or file bytes.

A response is conceptually made of:

1. **Status code** — the outcome category and concrete result, for example 200, 404 or 503.
2. **Headers** — metadata/control information such as Content-Type, Location, ETag or Set-Cookie.
3. **Body/content** — optional representation or error payload.

~~~http
POST /api/users?sendWelcome=true HTTP/1.1
Host: api.example.com
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json

{"name":"Alice","email":"alice@example.com"}
~~~

~~~http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/users/42

{"id":42,"name":"Alice","email":"alice@example.com"}
~~~

The text above is an HTTP/1.1-style representation for learning. HTTP/2 and HTTP/3 encode messages differently on the wire, but the same core semantics — methods, target resources, fields, status codes and content — still apply.

**HTTPS** means HTTP communication protected with TLS. TLS protects transport confidentiality/integrity and authenticates the server certificate; it does not replace API authentication or authorization.

### URL anatomy

For https://api.example.com:8443/v1/users/42?include=roles#details:

- **scheme**: https
- **host**: api.example.com
- **port**: 8443
- **path**: /v1/users/42
- **query**: include=roles
- **fragment**: details — handled client-side and **not sent in the HTTP request**

For API testing, distinguish where data belongs:

| Place | Typical use | Example |
|---|---|---|
| Path | Identify a specific resource/hierarchy | /users/42/orders |
| Query | Filtering, sorting, pagination, optional controls | ?status=open&page=2 |
| Header | Metadata, auth, negotiation, conditions | Authorization, Accept, If-Match |
| Body | Structured command/resource data or bytes | JSON, form data, file |

## 2. HTTP methods: semantics before CRUD

HTTP methods describe request semantics. CRUD is a data-operation model. They often map to each other, but they are not the same thing.

| Method | Core meaning | Safe | Idempotent |
|---|---|---:|---:|
| GET | Retrieve a representation of a resource | Yes | Yes |
| HEAD | Same retrieval semantics as GET, without response content | Yes | Yes |
| POST | Submit data for resource-specific processing; often creates a subordinate resource | No | Not guaranteed |
| PUT | Create or replace the state of the target resource | No | Yes |
| PATCH | Apply a partial modification | No | Not guaranteed |
| DELETE | Remove the target resource | No | Yes |
| OPTIONS | Describe communication options; also used by CORS preflight | Yes | Yes |
| CONNECT | Establish a tunnel | No | No |
| TRACE | Diagnostic loop-back | Yes | Yes |

**Safe** means the client is not asking the server to change application state. Logging and metrics may still change internally.

**Idempotent** means repeating the same request has the same intended effect as performing it once. It does **not** mean every repeated response must have the same status code or body. For example, the first DELETE can return 204 and a later identical DELETE can return 404 while the final resource state remains the same.

POST is not idempotent by HTTP semantics, but an API can make a particular POST operation safely retryable using an application-level contract such as an **Idempotency-Key**.

### PUT vs PATCH

Use the method semantics, not the English word “update”:

- **PUT** describes the desired state of the target resource and is idempotent.
- **PATCH** carries instructions or a partial document describing changes; idempotency depends on the patch format/operation.

Example:

~~~http
PUT /users/42
Content-Type: application/json

{"name":"Alice","email":"alice@example.com","active":true}
~~~

~~~http
PATCH /users/42
Content-Type: application/merge-patch+json

{"active":false}
~~~

### CRUD is a useful mapping, not a REST definition

| CRUD | Common HTTP mapping | Important nuance |
|---|---|---|
| Create | POST, sometimes PUT | PUT can create when the client knows the target URI |
| Read | GET | GET must not be used to perform destructive actions |
| Update | PUT or PATCH | PUT and PATCH have different semantics |
| Delete | DELETE | Idempotent intended effect does not require identical repeated responses |

Bad API design example: GET /users/42/delete. A safe GET should not request a destructive state change.

## 3. REST: what it adds on top of HTTP

HTTP is a protocol. **REST is an architectural style.** A REST API normally uses HTTP, but REST is not another transport protocol and CRUD alone does not make an API RESTful.

The classic REST constraints are:

- **client-server separation**;
- **stateless requests** — each request carries the information needed to process it; the server does not depend on hidden conversational client state;
- **cacheability** — responses define whether/how they may be reused;
- **uniform interface** — resources are identified consistently and manipulated through representations with standardized semantics;
- **layered system** — clients do not need to know whether gateways/proxies/intermediaries exist behind the interface;
- **code on demand** — optional.

A strict REST model also includes hypermedia-driven application state. Many production APIs called “REST APIs” use resource-oriented HTTP conventions without implementing every REST constraint. For QA, test the **documented contract and HTTP semantics**, not the label alone.

Resource-oriented URLs usually use nouns:

- GET /users/42
- GET /users/42/orders
- POST /orders
- PATCH /orders/123
- DELETE /orders/123

## 4. Request and response headers

Headers change how a message should be interpreted or processed. They are not decoration.

### High-value request headers

| Header | Why it matters to QA |
|---|---|
| Accept | Which response media types the client can process |
| Content-Type | Media type of request content |
| Authorization | Credentials such as Bearer or Basic |
| Cookie | Browser/session state sent to the server |
| Origin | Origin initiating a browser cross-origin request; central to CORS |
| User-Agent | Client metadata when relevant to behavior |
| Accept-Language | Language/content negotiation |
| Accept-Encoding | Compression negotiation |
| If-None-Match | Cache revalidation using an ETag |
| If-Match | Optimistic concurrency/precondition using an ETag |
| Range | Ask for part of a representation |
| Cache-Control | Request-side cache directives |
| traceparent / correlation ID | Trace a request through distributed systems when supported |

### High-value response headers

| Header | Why it matters to QA |
|---|---|
| Content-Type | How the response body should be interpreted |
| Content-Encoding | Compression/encoding applied to transferred content |
| Content-Length | Declared content length where applicable |
| Location | Created resource URI or redirect target |
| Set-Cookie | Cookie creation/update and security attributes |
| Cache-Control | Cache policy |
| ETag / Last-Modified | Validators for caching/concurrency |
| Vary | Which request headers affect cached response selection |
| Allow | Allowed methods, especially after 405 |
| WWW-Authenticate | Authentication challenge, especially with 401 |
| Retry-After | Retry timing after statuses such as 429 or 503 |
| Content-Disposition | Inline vs attachment and suggested download filename |
| Access-Control-Allow-* | Browser CORS policy |

### Accept vs Content-Type

A common mistake is treating these headers as interchangeable:

- **Content-Type** describes the content that is actually in this message.
- **Accept** tells the server which response media types the client is willing to receive.

Example: a request can send JSON with Content-Type: application/json and ask for JSON back with Accept: application/json.

## 5. Status codes: interpret the exact result

First learn the classes:

- **1xx** — informational/provisional response;
- **2xx** — request succeeded at the HTTP/application contract level;
- **3xx** — redirection or cache-related outcome;
- **4xx** — request cannot be fulfilled as sent / client-side contract or authorization problem;
- **5xx** — server or upstream failure.

Then learn the codes that repeatedly matter in API testing:

| Code | Meaning | Typical QA question |
|---|---|---|
| 200 OK | Successful request | Is the returned representation correct? |
| 201 Created | Resource created | Is Location present when appropriate? Can the new resource be retrieved? |
| 202 Accepted | Accepted for asynchronous processing | How is completion/failure observed later? |
| 204 No Content | Success without response body | Is the body really absent? |
| 206 Partial Content | Range response | Are Content-Range and boundaries correct? |
| 301 / 308 | Permanent redirect | Should clients update the target? Does method preservation matter? |
| 302 / 303 / 307 | Redirect variants | Does the client preserve/switch method as expected? |
| 304 Not Modified | Cached representation remains valid | Were validators sent and cache semantics respected? |
| 400 Bad Request | Malformed/invalid request | Is the error contract useful and deterministic? |
| 401 Unauthorized | Authentication missing/invalid | Is WWW-Authenticate appropriate? |
| 403 Forbidden | Identity known but access denied | Is authorization enforced server-side? |
| 404 Not Found | Resource/route unavailable | Is resource existence intentionally hidden where needed? |
| 405 Method Not Allowed | Method unsupported for target | Does Allow list valid methods? |
| 409 Conflict | Request conflicts with current resource state | Is this a state/version/uniqueness conflict? |
| 412 Precondition Failed | Conditional request failed | Was If-Match/If-Unmodified-Since evaluated correctly? |
| 413 Content Too Large | Request body exceeds a limit | Are exact boundary sizes tested? |
| 415 Unsupported Media Type | Request media type unsupported | Is Content-Type wrong/missing? |
| 422 Unprocessable Content | Syntax understood, content semantically invalid | Is field-level validation clear? |
| 429 Too Many Requests | Rate limit exceeded | Is Retry-After/rate-limit metadata correct? |
| 500 Internal Server Error | Generic server failure | Is sensitive internal detail hidden? |
| 502 Bad Gateway | Invalid upstream response | Which dependency failed? |
| 503 Service Unavailable | Service temporarily unavailable | Is retry/backoff guidance correct? |
| 504 Gateway Timeout | Upstream timed out | Which hop exceeded its timeout? |

### High-value distinctions

- **400 vs 422:** 400 is appropriate for malformed/invalid request framing or syntax; 422 is commonly used when the representation is understood but fails semantic validation.
- **401 vs 403:** 401 is primarily authentication; 403 is authorization/permission.
- **404 vs 403:** some systems intentionally return 404 to avoid revealing that a protected resource exists.
- **409 vs 412:** 409 is a general current-state conflict; 412 directly means a request precondition such as If-Match evaluated false.
- **502 vs 503 vs 504:** 502 is a bad upstream response, 503 is temporary unavailability, 504 is an upstream timeout through a gateway/proxy.

### Full status-code reference

Keep rare codes available as reference, but do not prioritize memorizing them over the common codes above.

:::details 1xx — informational

<!-- flush-table -->
| Code | Meaning |
|---|---|
| 100 | Continue |
| 101 | Switching Protocols |
| 102 | Processing (WebDAV) |
| 103 | Early Hints |

:::

:::details 2xx — successful

<!-- flush-table -->
| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 202 | Accepted |
| 203 | Non-Authoritative Information |
| 204 | No Content |
| 205 | Reset Content |
| 206 | Partial Content |
| 207 | Multi-Status (WebDAV) |
| 208 | Already Reported (WebDAV) |
| 226 | IM Used |

:::

:::details 3xx — redirection/cache

<!-- flush-table -->
| Code | Meaning |
|---|---|
| 300 | Multiple Choices |
| 301 | Moved Permanently |
| 302 | Found |
| 303 | See Other |
| 304 | Not Modified |
| 305 | Use Proxy — deprecated |
| 306 | Unused/reserved historical code |
| 307 | Temporary Redirect — preserves method/body |
| 308 | Permanent Redirect — preserves method/body |

:::

:::details 4xx — request/client-side problem

<!-- flush-table -->
| Code | Meaning |
|---|---|
| 400 | Bad Request |
| 401 | Unauthorized |
| 402 | Payment Required |
| 403 | Forbidden |
| 404 | Not Found |
| 405 | Method Not Allowed |
| 406 | Not Acceptable |
| 407 | Proxy Authentication Required |
| 408 | Request Timeout |
| 409 | Conflict |
| 410 | Gone |
| 411 | Length Required |
| 412 | Precondition Failed |
| 413 | Content Too Large |
| 414 | URI Too Long |
| 415 | Unsupported Media Type |
| 416 | Range Not Satisfiable |
| 417 | Expectation Failed |
| 418 | I'm a teapot — historical/joke status, not normal business semantics |
| 421 | Misdirected Request |
| 422 | Unprocessable Content |
| 423 | Locked (WebDAV) |
| 424 | Failed Dependency (WebDAV) |
| 425 | Too Early |
| 426 | Upgrade Required |
| 428 | Precondition Required |
| 429 | Too Many Requests |
| 431 | Request Header Fields Too Large |
| 451 | Unavailable For Legal Reasons |

:::

:::details 5xx — server/upstream problem

<!-- flush-table -->
| Code | Meaning |
|---|---|
| 500 | Internal Server Error |
| 501 | Not Implemented |
| 502 | Bad Gateway |
| 503 | Service Unavailable |
| 504 | Gateway Timeout |
| 505 | HTTP Version Not Supported |
| 506 | Variant Also Negotiates |
| 507 | Insufficient Storage |
| 508 | Loop Detected |
| 510 | Not Extended |
| 511 | Network Authentication Required |

:::

## 6. Authentication, authorization and session state

**Authentication** answers “who is this client/user?” **Authorization** answers “what may this identity do?”

Common API mechanisms:

1. **HTTP Basic** — username/password encoded with Base64 in Authorization. Base64 is not encryption; TLS is required.
2. **Bearer token** — Authorization: Bearer <token>; the token can be opaque or a JWT.
3. **API key** — usually sent in a header. Query-string keys leak more easily through logs/history/referrers.
4. **OAuth 2.0 access token** — delegated authorization; commonly transported as a Bearer token.
5. **OpenID Connect** — identity layer built on OAuth 2.0, typically used for login/identity claims.
6. **Session cookie** — browser sends a cookie representing server-side or signed session state.
7. **HMAC/request signing** — selected request components are signed so the server can verify authenticity/integrity.
8. **Mutual TLS (mTLS)** — both sides authenticate with certificates.

Test at least: missing, malformed, expired and revoked credentials; wrong audience/scope; valid authentication with insufficient permission; horizontal access to another user's object; vertical role escalation; refresh/expiry behavior; replay rules where applicable.

**Cookie authentication adds CSRF considerations.** CORS and CSRF are related browser-security topics but solve different problems. CORS controls whether browser JavaScript may read/use a cross-origin response. CSRF protection prevents an attacker from causing an authenticated browser to perform unwanted state-changing actions.

## 7. Files and multipart requests

A file does not “become binary” when the user drops it into a browser. The file is already stored as bytes. The browser gets a File object that provides metadata and access to those bytes; when upload starts, the bytes are placed into the HTTP request content.

Flow: **file on disk (bytes) → browser File object → HTTP request body → server byte stream → storage/processing**.

### Raw file body

~~~http
PUT /documents/123/content HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/pdf

<PDF bytes>
~~~

Use this when the request content is essentially one file.

### multipart/form-data: file plus ordinary fields or JSON metadata

~~~http
POST /documents HTTP/1.1
Content-Type: multipart/form-data; boundary=Boundary42

--Boundary42
Content-Disposition: form-data; name="metadata"
Content-Type: application/json

{"title":"Contract","category":"legal"}
--Boundary42
Content-Disposition: form-data; name="file"; filename="contract.pdf"
Content-Type: application/pdf

<PDF bytes>
--Boundary42--
~~~

The request still has one body; the multipart boundary divides it into parts, each with its own headers/content.

### Base64 and direct-to-storage uploads

Base64 can place binary data inside JSON, but it increases payload size by roughly one third before other overhead and adds encode/decode work. Prefer raw/multipart transfer unless the contract requires textual JSON.

For large files, a common scalable flow is:

1. client asks the API for an upload;
2. API authorizes it and returns a short-lived pre-signed object-storage URL;
3. client uploads bytes directly to object storage;
4. API/event flow records completion and metadata.

### File-testing checklist

Cover MIME type and actual file signature, extension mismatch, zero bytes, exact size limits, multiple files, Unicode/long/duplicate filenames, malformed multipart boundaries, interruption/retry, duplicate request behavior, checksum/integrity, upload and download authorization, orphan cleanup, signed-URL expiry/reuse, Range behavior, Content-Type and Content-Disposition on download.

## 8. Caching and optimistic concurrency

Caching is observable API behavior, not only a performance concern.

Typical revalidation flow:

1. server returns ETag: "v7";
2. client later sends If-None-Match: "v7";
3. if unchanged, server can return 304 Not Modified without a new representation body.

For write concurrency, If-Match can prevent lost updates:

~~~http
PATCH /users/42
If-Match: "v7"
Content-Type: application/json

{"displayName":"Alice B"}
~~~

If the resource is now version v8, the server can reject the stale update with **412 Precondition Failed** instead of silently overwriting newer data.

Test Cache-Control, ETag/Last-Modified consistency, Vary, stale validators, intermediary caching, authenticated/private data caching, and concurrent updates.

## 9. CORS: browser cross-origin access

**CORS (Cross-Origin Resource Sharing)** is a browser-enforced mechanism that uses HTTP response headers to decide whether JavaScript from one origin may access a response from another origin.

An **origin = scheme + host + port**.

| Page | API | Same origin? |
|---|---|---:|
| https://app.example.com | https://app.example.com/api | Yes |
| https://app.example.com | https://api.example.com | No — host differs |
| https://app.example.com | http://app.example.com | No — scheme differs |
| https://app.example.com | https://app.example.com:8443 | No — port differs |

The path does not define the origin.

### Why Postman/curl can work while the browser fails

The browser enforces the same-origin policy and CORS for script access. Postman, curl and server-to-server HTTP clients do not enforce browser CORS rules.

A very important debugging distinction: **the network request can reach the server and the server can even return 200, but the browser can still refuse to expose that response to JavaScript because the CORS response headers are not acceptable.** Therefore “CORS error” does not automatically mean the API endpoint was unreachable or returned a failing HTTP status.

### Simple request vs preflight

Some cross-origin requests can be sent directly under the CORS “simple request” rules. Requests using non-safelisted methods, headers or content types generally require a **preflight**.

A typical preflight:

~~~http
OPTIONS /api/orders HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization,content-type
~~~

Server response:

~~~http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Headers: Authorization,Content-Type
Access-Control-Max-Age: 600
Vary: Origin
~~~

If preflight succeeds, the browser can send the actual request.

### Credentialed CORS

For cross-origin requests that include credentials such as cookies, the response must use an explicit allowed origin and **Access-Control-Allow-Credentials: true**. Access-Control-Allow-Origin: * cannot be used to grant credentialed access.

When the server dynamically returns a specific allowed origin, **Vary: Origin** is important so shared caches do not reuse the wrong CORS response for another origin.

### Common CORS failures

- missing or incorrect Access-Control-Allow-Origin;
- origin not in the allowlist;
- OPTIONS route returns 404/405/redirect/error;
- requested method is absent from Access-Control-Allow-Methods;
- requested header is absent from Access-Control-Allow-Headers;
- credentialed request without Access-Control-Allow-Credentials: true;
- wildcard origin used with credentials;
- required response header is not exposed to JavaScript with Access-Control-Expose-Headers;
- dynamic origin response cached without Vary: Origin.

**CORS is not API authentication.** It does not stop curl, Postman or another server from calling the endpoint. Authorization must be enforced by the API.

## 10. API debugging workflow

Use the same order every time:

1. **Target** — scheme, host, port, path, API version and query parameters.
2. **Method semantics** — is GET/POST/PUT/PATCH/DELETE correct for this contract?
3. **Request headers** — Content-Type, Accept, Authorization/cookies, Origin, conditional headers.
4. **Request body** — actual JSON/form/multipart/binary content, encoding and required fields.
5. **Exact status code** — do not stop at “4xx” or “5xx”.
6. **Response headers** — Location, Content-Type, ETag, Set-Cookie, Retry-After, CORS fields.
7. **Response body/error contract** — machine-readable code, message, field errors, trace ID.
8. **Timing** — DNS/connect/TLS/time-to-first-byte/download and upstream timeout behavior.
9. **Traceability** — correlation/trace ID and matching server/gateway logs.
10. **Cross-client comparison** — reproduce with curl/Postman to separate HTTP/API behavior from browser/CORS behavior.

Useful commands:

~~~bash
curl -i https://api.example.com/users/42
curl -i -X OPTIONS https://api.example.com/orders \
  -H "Origin: https://app.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"
~~~

## 11. Practical QA exercises

Use a real or local API and complete these tasks:

1. Send one GET and identify method, path, query, request headers, status, response headers and body.
2. Create a resource with POST, verify 201 vs 200 semantics, then retrieve the created resource.
3. Compare PUT and PATCH by repeating identical requests and observing final state and responses.
4. Trigger and explain 400, 401, 403, 404, 409/412, 415, 422 and 429 cases where the API supports them.
5. Upload a file as multipart/form-data with metadata; inspect the raw request boundary in DevTools or a proxy.
6. Reproduce a browser CORS failure, then call the same endpoint with curl/Postman and explain why results differ.
7. Use ETag + If-None-Match to obtain 304, or ETag + If-Match to demonstrate stale-write protection.
8. Capture one failing request and write a defect containing the complete request/response evidence needed for backend debugging.

## 12. What you should be able to explain without memorizing the whole RFC

After this chapter you should be able to explain:

- the anatomy of an HTTP request and response;
- path vs query vs header vs body;
- safe and idempotent method semantics;
- why CRUD is not the definition of REST;
- PUT vs PATCH and retry implications;
- the important status-code distinctions;
- Content-Type vs Accept;
- authentication vs authorization;
- how files and multipart requests actually travel;
- caching and ETag preconditions;
- why CORS exists, when preflight appears, and why Postman can work while a browser fails;
- a systematic API debugging workflow.

## Sources

- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [RFC 9111 — HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
- [RFC 5789 — PATCH Method for HTTP](https://www.rfc-editor.org/rfc/rfc5789.html)
- [RFC 7578 — multipart/form-data](https://www.rfc-editor.org/rfc/rfc7578.html)
- [MDN — HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods)
- [MDN — HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status)
- [MDN — CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
`;

const markdownUk = String.raw`Цей розділ спочатку будує правильну mental model HTTP, а вже потім перетворює її на практичні знання для API testing. Мета — не завчити словник протоколу, а розуміти, що означає request, що доводить response і де шукати проблему, коли API поводиться неправильно.

## 1. HTTP mental model: request → response

HTTP — application-layer protocol, побудований на обміні повідомленнями. Client надсилає **HTTP request** до target resource; server повертає **HTTP response**.

Request концептуально складається з:

1. **Method** — що client хоче зробити, наприклад GET, POST або DELETE.
2. **Target** — resource URI/path та optional query parameters.
3. **Headers** — metadata/control information: Accept, Authorization, Content-Type тощо.
4. **Body/content** — optional data, наприклад JSON або bytes файлу.

Response концептуально складається з:

1. **Status code** — конкретний результат, наприклад 200, 404 або 503.
2. **Headers** — metadata/control information: Content-Type, Location, ETag, Set-Cookie тощо.
3. **Body/content** — optional representation або error payload.

~~~http
POST /api/users?sendWelcome=true HTTP/1.1
Host: api.example.com
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json

{"name":"Alice","email":"alice@example.com"}
~~~

~~~http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/users/42

{"id":42,"name":"Alice","email":"alice@example.com"}
~~~

Це HTTP/1.1-style textual representation для навчання. HTTP/2 та HTTP/3 кодують messages на wire інакше, але core semantics — methods, target resources, fields, status codes та content — залишаються ті самі.

**HTTPS** — це HTTP communication, захищена TLS. TLS дає confidentiality/integrity transport і перевірку server certificate; він не замінює API authentication або authorization.

### Анатомія URL

Для https://api.example.com:8443/v1/users/42?include=roles#details:

- **scheme**: https
- **host**: api.example.com
- **port**: 8443
- **path**: /v1/users/42
- **query**: include=roles
- **fragment**: details — обробляється client-side і **не надсилається в HTTP request**

Для API testing важливо розрізняти, де живуть дані:

| Місце | Типове використання | Приклад |
|---|---|---|
| Path | Ідентифікувати resource/hierarchy | /users/42/orders |
| Query | Filtering, sorting, pagination, optional controls | ?status=open&page=2 |
| Header | Metadata, auth, negotiation, conditions | Authorization, Accept, If-Match |
| Body | Structured data/command або bytes | JSON, form data, file |

## 2. HTTP methods: спочатку semantics, потім CRUD

HTTP methods описують semantics request. CRUD — модель data operations. Вони часто мапляться один на одного, але це не одне й те саме.

| Method | Основний зміст | Safe | Idempotent |
|---|---|---:|---:|
| GET | Отримати representation resource | Так | Так |
| HEAD | Як GET, але без response content | Так | Так |
| POST | Передати дані для resource-specific processing; часто створює subordinate resource | Ні | Не гарантовано |
| PUT | Створити або замінити state target resource | Ні | Так |
| PATCH | Частково змінити resource | Ні | Не гарантовано |
| DELETE | Видалити target resource | Ні | Так |
| OPTIONS | Опис communication options; також CORS preflight | Так | Так |
| CONNECT | Створити tunnel | Ні | Ні |
| TRACE | Diagnostic loop-back | Так | Так |

**Safe** означає, що client не просить змінити application state. Внутрішні logs/metrics при цьому можуть змінюватись.

**Idempotent** означає, що кілька однакових requests мають той самий intended effect, що й один request. Це **не означає**, що кожен повтор повинен мати ідентичний status/body. Наприклад, перший DELETE може повернути 204, а наступний — 404, але кінцевий стан однаковий: resource відсутній.

POST не є idempotent за HTTP semantics, але конкретний POST endpoint може мати application-level contract для безпечного retry, наприклад **Idempotency-Key**.

### PUT vs PATCH

Дивись на semantics, а не просто на слово “update”:

- **PUT** задає desired state target resource і є idempotent.
- **PATCH** передає partial change/instructions; idempotency залежить від patch format та operation.

~~~http
PUT /users/42
Content-Type: application/json

{"name":"Alice","email":"alice@example.com","active":true}
~~~

~~~http
PATCH /users/42
Content-Type: application/merge-patch+json

{"active":false}
~~~

### CRUD — корисний mapping, але не визначення REST

| CRUD | Типовий HTTP mapping | Нюанс |
|---|---|---|
| Create | POST, іноді PUT | PUT може create, якщо client знає target URI |
| Read | GET | GET не повинен запускати destructive action |
| Update | PUT або PATCH | У них різна semantics |
| Delete | DELETE | Idempotent effect не вимагає однакових repeated responses |

Поганий API design: GET /users/42/delete. Safe GET не повинен просити destructive state change.

## 3. REST: що він додає поверх HTTP

HTTP — protocol. **REST — architectural style.** REST API зазвичай працює через HTTP, але REST не є окремим transport protocol, а CRUD сам по собі не робить API RESTful.

Класичні REST constraints:

- **client-server separation**;
- **stateless requests** — кожен request несе інформацію, потрібну для його processing;
- **cacheability**;
- **uniform interface** — consistent resource identification та standardized semantics;
- **layered system**;
- **code on demand** — optional.

Strict REST також включає hypermedia-driven application state. Багато production APIs називаються “REST APIs”, хоча фактично реалізують resource-oriented HTTP conventions без усіх REST constraints. Для QA перевіряй **реальний contract та HTTP semantics**, а не назву.

Resource-oriented URLs зазвичай використовують nouns:

- GET /users/42
- GET /users/42/orders
- POST /orders
- PATCH /orders/123
- DELETE /orders/123

## 4. Request і response headers

Headers змінюють те, як message треба трактувати або process-ити. Це не декоративні поля.

### Найважливіші request headers

| Header | Що перевіряти QA |
|---|---|
| Accept | Які response media types client готовий прийняти |
| Content-Type | Media type request content |
| Authorization | Credentials: Bearer, Basic тощо |
| Cookie | Browser/session state |
| Origin | Origin browser cross-origin request; ключовий для CORS |
| User-Agent | Client metadata, якщо behavior від неї залежить |
| Accept-Language | Language/content negotiation |
| Accept-Encoding | Compression negotiation |
| If-None-Match | Cache revalidation через ETag |
| If-Match | Optimistic concurrency/precondition через ETag |
| Range | Запросити частину representation |
| Cache-Control | Request-side cache directives |
| traceparent / correlation ID | Distributed tracing, якщо підтримується |

### Найважливіші response headers

| Header | Що перевіряти QA |
|---|---|
| Content-Type | Як трактувати response body |
| Content-Encoding | Compression/encoding transferred content |
| Content-Length | Declared content length, де застосовується |
| Location | URI created resource або redirect target |
| Set-Cookie | Cookie creation/update та security attributes |
| Cache-Control | Cache policy |
| ETag / Last-Modified | Validators для cache/concurrency |
| Vary | Які request headers впливають на cache selection |
| Allow | Allowed methods, особливо після 405 |
| WWW-Authenticate | Authentication challenge, особливо з 401 |
| Retry-After | Коли retry після 429/503 |
| Content-Disposition | Inline vs attachment та filename |
| Access-Control-Allow-* | Browser CORS policy |

### Accept vs Content-Type

Типова плутанина:

- **Content-Type** описує content, який реально знаходиться в цьому message.
- **Accept** каже server, які response media types client готовий прийняти.

## 5. Status codes: аналізуй конкретний результат

Спочатку класи:

- **1xx** — informational/provisional;
- **2xx** — success;
- **3xx** — redirect/cache-related result;
- **4xx** — request/client-side contract, auth або permission problem;
- **5xx** — server/upstream failure.

Найважливіші для API testing:

| Код | Значення | Що перевіряти QA |
|---|---|---|
| 200 OK | Успішний request | Чи правильний representation? |
| 201 Created | Resource створено | Чи коректний Location? Чи resource реально доступний? |
| 202 Accepted | Прийнято в async processing | Як потім перевірити completion/failure? |
| 204 No Content | Success без response body | Чи body дійсно відсутній? |
| 206 Partial Content | Range response | Чи правильні Content-Range/boundaries? |
| 301 / 308 | Permanent redirect | Чи має client оновити target? Чи зберігається method? |
| 302 / 303 / 307 | Redirect variants | Як поводиться method/body? |
| 304 Not Modified | Cached representation актуальний | Чи правильно працюють validators? |
| 400 Bad Request | Malformed/invalid request | Чи error contract зрозумілий? |
| 401 Unauthorized | Authentication missing/invalid | Чи коректний WWW-Authenticate? |
| 403 Forbidden | Identity відома, permission немає | Чи server реально enforce-ить authorization? |
| 404 Not Found | Resource/route unavailable | Чи не leak-иться existence protected resource? |
| 405 Method Not Allowed | Method не дозволений | Чи Allow містить valid methods? |
| 409 Conflict | Conflict із current state | Version/state/uniqueness conflict? |
| 412 Precondition Failed | Conditional request failed | Чи If-Match/If-Unmodified-Since оброблено правильно? |
| 413 Content Too Large | Body перевищує limit | Чи перевірено exact boundary? |
| 415 Unsupported Media Type | Непідтримуваний Content-Type | Wrong/missing media type? |
| 422 Unprocessable Content | Syntax зрозумілий, semantic validation не пройшла | Чи field errors конкретні? |
| 429 Too Many Requests | Rate limit | Retry-After/rate-limit metadata? |
| 500 Internal Server Error | Generic server failure | Чи не leak-яться internals? |
| 502 Bad Gateway | Invalid upstream response | Яка dependency зламалась? |
| 503 Service Unavailable | Temporary unavailable | Чи коректний retry/backoff? |
| 504 Gateway Timeout | Upstream timeout | Який hop перевищив timeout? |

### Ключові відмінності

- **400 vs 422:** 400 — malformed/invalid request framing/syntax; 422 часто використовується, коли representation зрозумілий, але semantic validation не проходить.
- **401 vs 403:** 401 — authentication; 403 — authorization/permission.
- **404 vs 403:** інколи API навмисно повертає 404, щоб не reveal-ити existence protected resource.
- **409 vs 412:** 409 — general current-state conflict; 412 — конкретно failed precondition, наприклад If-Match.
- **502 vs 503 vs 504:** 502 — bad upstream response; 503 — temporary unavailability; 504 — gateway/proxy не дочекався upstream.

### Повний довідник status codes

Rare codes треба мати під рукою, але не варто ставити їх memorization вище common API codes.

:::details 1xx — informational

<!-- flush-table -->
| Код | Значення |
|---|---|
| 100 | Continue |
| 101 | Switching Protocols |
| 102 | Processing (WebDAV) |
| 103 | Early Hints |

:::

:::details 2xx — successful

<!-- flush-table -->
| Код | Значення |
|---|---|
| 200 | OK |
| 201 | Created |
| 202 | Accepted |
| 203 | Non-Authoritative Information |
| 204 | No Content |
| 205 | Reset Content |
| 206 | Partial Content |
| 207 | Multi-Status (WebDAV) |
| 208 | Already Reported (WebDAV) |
| 226 | IM Used |

:::

:::details 3xx — redirection/cache

<!-- flush-table -->
| Код | Значення |
|---|---|
| 300 | Multiple Choices |
| 301 | Moved Permanently |
| 302 | Found |
| 303 | See Other |
| 304 | Not Modified |
| 305 | Use Proxy — deprecated |
| 306 | Unused/reserved historical code |
| 307 | Temporary Redirect — зберігає method/body |
| 308 | Permanent Redirect — зберігає method/body |

:::

:::details 4xx — request/client problem

<!-- flush-table -->
| Код | Значення |
|---|---|
| 400 | Bad Request |
| 401 | Unauthorized |
| 402 | Payment Required |
| 403 | Forbidden |
| 404 | Not Found |
| 405 | Method Not Allowed |
| 406 | Not Acceptable |
| 407 | Proxy Authentication Required |
| 408 | Request Timeout |
| 409 | Conflict |
| 410 | Gone |
| 411 | Length Required |
| 412 | Precondition Failed |
| 413 | Content Too Large |
| 414 | URI Too Long |
| 415 | Unsupported Media Type |
| 416 | Range Not Satisfiable |
| 417 | Expectation Failed |
| 418 | I'm a teapot — historical/joke status |
| 421 | Misdirected Request |
| 422 | Unprocessable Content |
| 423 | Locked (WebDAV) |
| 424 | Failed Dependency (WebDAV) |
| 425 | Too Early |
| 426 | Upgrade Required |
| 428 | Precondition Required |
| 429 | Too Many Requests |
| 431 | Request Header Fields Too Large |
| 451 | Unavailable For Legal Reasons |

:::

:::details 5xx — server/upstream problem

<!-- flush-table -->
| Код | Значення |
|---|---|
| 500 | Internal Server Error |
| 501 | Not Implemented |
| 502 | Bad Gateway |
| 503 | Service Unavailable |
| 504 | Gateway Timeout |
| 505 | HTTP Version Not Supported |
| 506 | Variant Also Negotiates |
| 507 | Insufficient Storage |
| 508 | Loop Detected |
| 510 | Not Extended |
| 511 | Network Authentication Required |

:::

## 6. Authentication, authorization та session state

**Authentication** відповідає “хто це?” **Authorization** — “що цій identity дозволено робити?”

Типові API mechanisms:

1. **HTTP Basic** — username/password у Base64 всередині Authorization. Base64 не encryption; потрібен TLS.
2. **Bearer token** — Authorization: Bearer <token>; token може бути opaque або JWT.
3. **API key** — зазвичай header; query-string key легше leak-иться в logs/history/referrers.
4. **OAuth 2.0 access token** — delegated authorization; часто передається як Bearer.
5. **OpenID Connect** — identity layer поверх OAuth 2.0.
6. **Session cookie** — cookie представляє server-side або signed session state.
7. **HMAC/request signing** — client підписує selected request components.
8. **Mutual TLS (mTLS)** — client і server authenticate-яться certificates.

Перевіряй: missing/malformed/expired/revoked credentials; wrong audience/scope; valid authentication без permission; horizontal access до чужого object; vertical role escalation; expiry/refresh; replay rules.

**Cookie authentication додає CSRF risk.** CORS і CSRF — різні механізми. CORS визначає, чи browser JavaScript може прочитати/use cross-origin response. CSRF protection не дозволяє attacker змусити authenticated browser виконати небажану state-changing дію.

## 7. Files і multipart requests

Файл не “стає binary”, коли user drag-and-drop-ить його в browser. На disk він уже збережений як bytes. Browser отримує File object з metadata та доступом до bytes; під час upload bytes потрапляють у HTTP request content.

Flow: **file on disk (bytes) → browser File object → HTTP request body → server byte stream → storage/processing**.

### Raw file body

~~~http
PUT /documents/123/content HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/pdf

<PDF bytes>
~~~

### multipart/form-data: file + fields/JSON metadata

~~~http
POST /documents HTTP/1.1
Content-Type: multipart/form-data; boundary=Boundary42

--Boundary42
Content-Disposition: form-data; name="metadata"
Content-Type: application/json

{"title":"Contract","category":"legal"}
--Boundary42
Content-Disposition: form-data; name="file"; filename="contract.pdf"
Content-Type: application/pdf

<PDF bytes>
--Boundary42--
~~~

Request все одно має один body; boundary ділить його на parts, кожна зі своїми headers/content.

### Base64 та direct-to-storage upload

Base64 може покласти binary data в JSON, але payload стає приблизно на третину більшим плюс encode/decode overhead. Raw/multipart зазвичай кращі, якщо JSON-only contract цього не вимагає.

Для large files типовий scalable flow:

1. client просить API створити upload;
2. API авторизує і повертає short-lived pre-signed object-storage URL;
3. client upload-ить bytes напряму в object storage;
4. API/event flow фіксує completion та metadata.

### File-testing checklist

Перевір MIME type та реальну file signature, extension mismatch, zero bytes, exact size limits, multiple files, Unicode/long/duplicate filenames, malformed multipart boundaries, interruption/retry, duplicate request behavior, checksum/integrity, upload/download authorization, orphan cleanup, signed-URL expiry/reuse, Range, Content-Type та Content-Disposition при download.

## 8. Caching та optimistic concurrency

Caching — це observable API behavior, а не тільки performance optimization.

Revalidation flow:

1. server повертає ETag: "v7";
2. client потім відправляє If-None-Match: "v7";
3. якщо resource не змінився, server може повернути 304 Not Modified без нового body.

Для write concurrency If-Match може зупинити lost update:

~~~http
PATCH /users/42
If-Match: "v7"
Content-Type: application/json

{"displayName":"Alice B"}
~~~

Якщо resource уже v8, server може повернути **412 Precondition Failed**, замість того щоб silently overwrite-нути новіші дані.

Перевір Cache-Control, ETag/Last-Modified consistency, Vary, stale validators, intermediary caching, authenticated/private data caching та concurrent updates.

## 9. CORS: browser cross-origin access

**CORS (Cross-Origin Resource Sharing)** — browser-enforced mechanism, який через HTTP response headers вирішує, чи JavaScript з одного origin може отримати доступ до response іншого origin.

**Origin = scheme + host + port**.

| Page | API | Same origin? |
|---|---|---:|
| https://app.example.com | https://app.example.com/api | Так |
| https://app.example.com | https://api.example.com | Ні — інший host |
| https://app.example.com | http://app.example.com | Ні — інший scheme |
| https://app.example.com | https://app.example.com:8443 | Ні — інший port |

Path не входить у визначення origin.

### Чому Postman/curl працює, а browser — ні

Browser enforce-ить same-origin policy та CORS для script access. Postman, curl і server-to-server clients browser CORS rules не enforce-ять.

Критично важливий debugging distinction: **network request може реально дійти до server, server може навіть повернути 200, але browser все одно не віддасть цей response JavaScript, якщо CORS headers не дозволяють access.** Тому “CORS error” не означає автоматично, що endpoint unreachable або повернув failure status.

### Simple request vs preflight

Частину cross-origin requests browser може відправити напряму як CORS “simple requests”. Якщо method, headers або Content-Type виходять за safelisted rules, зазвичай потрібен **preflight**.

~~~http
OPTIONS /api/orders HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization,content-type
~~~

~~~http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Headers: Authorization,Content-Type
Access-Control-Max-Age: 600
Vary: Origin
~~~

Якщо preflight успішний, browser може відправити actual request.

### Credentialed CORS

Для cross-origin request із credentials, наприклад cookies, response повинен використовувати explicit allowed origin та **Access-Control-Allow-Credentials: true**. Access-Control-Allow-Origin: * не може дати credentialed access.

Якщо server динамічно повертає конкретний allowed origin, **Vary: Origin** потрібен, щоб shared cache не віддав CORS response для іншого origin.

### Типові CORS failures

- missing/wrong Access-Control-Allow-Origin;
- origin не в allowlist;
- OPTIONS повертає 404/405/redirect/error;
- method немає в Access-Control-Allow-Methods;
- header немає в Access-Control-Allow-Headers;
- credentialed request без Access-Control-Allow-Credentials: true;
- wildcard origin + credentials;
- response header не exposed через Access-Control-Expose-Headers;
- dynamic origin response cache-иться без Vary: Origin.

**CORS — не API authentication.** Він не забороняє curl, Postman або іншому server викликати endpoint. Authorization має enforce-ити сам API.

## 10. API debugging workflow

Йди завжди в однаковому порядку:

1. **Target** — scheme, host, port, path, API version, query.
2. **Method semantics** — чи правильний GET/POST/PUT/PATCH/DELETE?
3. **Request headers** — Content-Type, Accept, auth/cookies, Origin, conditionals.
4. **Request body** — реальний JSON/form/multipart/binary structure та encoding.
5. **Exact status code** — не зупиняйся на “4xx” або “5xx”.
6. **Response headers** — Location, Content-Type, ETag, Set-Cookie, Retry-After, CORS.
7. **Response body/error contract** — code, message, field errors, trace ID.
8. **Timing** — DNS/connect/TLS/TTFB/download та upstream timeout behavior.
9. **Traceability** — correlation/trace ID та server/gateway logs.
10. **Cross-client comparison** — повторити через curl/Postman, щоб відділити HTTP/API behavior від browser/CORS.

~~~bash
curl -i https://api.example.com/users/42
curl -i -X OPTIONS https://api.example.com/orders \
  -H "Origin: https://app.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"
~~~

## 11. Практичні QA вправи

1. Відправ GET і знайди method, path, query, request headers, status, response headers та body.
2. Створи resource через POST, перевір 201 vs 200 semantics, потім retrieve created resource.
3. Порівняй PUT і PATCH, повторюючи однакові requests та перевіряючи final state.
4. Спровокуй та поясни 400, 401, 403, 404, 409/412, 415, 422, 429, якщо API дозволяє.
5. Upload file як multipart/form-data разом із metadata; подивись raw boundary у DevTools/proxy.
6. Відтвори browser CORS failure, потім виклич той самий endpoint через curl/Postman і поясни різницю.
7. Використай ETag + If-None-Match для 304 або ETag + If-Match для stale-write protection.
8. Візьми один failing request і склади defect з повним request/response evidence для backend debugging.

## 12. Що треба вміти пояснити без заучування всього RFC

Після цього розділу ти маєш вміти пояснити:

- anatomy HTTP request/response;
- path vs query vs header vs body;
- safe/idempotent method semantics;
- чому CRUD не є визначенням REST;
- PUT vs PATCH та retry implications;
- ключові status-code distinctions;
- Content-Type vs Accept;
- authentication vs authorization;
- як реально передаються files та multipart;
- caching та ETag preconditions;
- чому виникає CORS, коли є preflight і чому Postman може працювати, а browser — ні;
- системний API debugging workflow.

## Sources

- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [RFC 9111 — HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
- [RFC 5789 — PATCH Method for HTTP](https://www.rfc-editor.org/rfc/rfc5789.html)
- [RFC 7578 — multipart/form-data](https://www.rfc-editor.org/rfc/rfc7578.html)
- [MDN — HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods)
- [MDN — HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status)
- [MDN — CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
`;

const httpFoundations = { markdown, markdownUk };

export default httpFoundations;
