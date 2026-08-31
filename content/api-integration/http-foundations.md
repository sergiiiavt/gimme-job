# HTTP, REST & CORS Foundations

HTTP is an application-layer protocol used to exchange messages between clients and servers. Web pages, REST APIs, file transfers, browser requests, service-to-service calls and many other systems use the same fundamental model: a client sends a request to a resource and the server returns a response.

HTTP/1.1, HTTP/2 and HTTP/3 differ in transport and wire encoding, but the application semantics described here remain largely the same. Transport-level details and HTTP version mechanics are covered in Networking.

## HTTP and HTTPS

An HTTP exchange has two sides:

```diagram
Client
  │
  │ HTTP request
  ▼
Server
  │
  │ HTTP response
  ▼
Client
```

**HTTP** defines the semantics of requests and responses. **HTTPS** is HTTP carried over TLS. TLS provides transport encryption, integrity protection and server authentication through certificates. It does not replace application-level authentication or authorization.

A request identifies a target resource and expresses an operation through an HTTP method. A response reports the result through a status code and may return a representation of the resource or an error document.

## URLs, resources and request targets

A typical URL can be decomposed into several parts:

https://api.example.com:8443/v1/users/42?include=roles#details

| Part | Value | Meaning |
| --- | --- | --- |
| Scheme | https | Protocol scheme |
| Host | api.example.com | Server name |
| Port | 8443 | Network port; omitted when the default is used |
| Path | /v1/users/42 | Resource path |
| Query | include=roles | Optional request parameters |
| Fragment | details | Client-side fragment; not sent in the HTTP request |

The path and query are both part of the request target, but they normally serve different purposes.

| Location | Typical role | Example |
| --- | --- | --- |
| Path | Identifies a resource or hierarchy | /users/42/orders |
| Query | Filters, sorting, pagination, optional controls | ?status=open&page=2 |
| Header | Message metadata and protocol controls | Accept, Authorization, If-Match |
| Body | Structured data or bytes | JSON, form data, file content |

Resource-oriented APIs normally use stable nouns for resources and relationships:

- /users
- /users/42
- /users/42/orders
- /orders/123/items

## HTTP messages

An HTTP request contains a method, request target, headers and optional content (commonly called a request body).

~~~http
POST /api/users?sendWelcome=true HTTP/1.1
Host: api.example.com
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json

{"name":"Alice","email":"alice@example.com"}
~~~

The corresponding response contains a status code, headers and optional content.

~~~http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/users/42

{"id":42,"name":"Alice","email":"alice@example.com"}
~~~

Message content can contain JSON, XML, text, form fields, multipart parts, images, documents or arbitrary binary data. The `Content-Type` header describes the media type of that content.

**Request parameters and request content are different locations.** A value in `/users/42`, `?page=2`, `Authorization: ...` and a JSON body all travel in the same request, but they have different protocol roles.

## HTTP methods and their semantics

HTTP methods describe the intended semantics of an operation. They are not merely aliases for database CRUD operations. Method semantics also affect safety, idempotency, caching, retry behavior and whether request content has a defined purpose.

| Method | Main semantics | Request content | Safe | Idempotent |
| --- | --- | --- | ---: | ---: |
| GET | Retrieve a representation of a resource | Normally none; HTTP defines no general semantics for GET content | Yes | Yes |
| HEAD | Same semantics as GET, but response has no content | Normally none; HTTP defines no general semantics for HEAD content | Yes | Yes |
| POST | Submit data for resource-specific processing; commonly creates a subordinate resource | Commonly present, but not required by HTTP | No | No guarantee |
| PUT | Create or replace the state of the target resource | Normally the desired representation/state | No | Yes |
| PATCH | Apply a partial modification | Normally a patch/change document | No | No guarantee |
| DELETE | Remove the association between the target URI and its current functionality | Normally none; HTTP defines no general semantics for DELETE content | No | Yes |
| OPTIONS | Describe communication options for a resource; also used by CORS preflight | Allowed, but HTTP defines no general use for it | Yes | Yes |
| CONNECT | Establish a tunnel through an intermediary | Special-purpose method; not ordinary REST request content | No | No |
| TRACE | Diagnostic loop-back of the received request | **Must not contain request content** | Yes | Yes |

### Request content is method-specific

A message can technically be framed with content independently of most method names, but that does **not** mean the content has useful or interoperable semantics for every method. The method definition determines what the content means.

This is why the shortcut “GET cannot have a body; POST has a body” is misleading:

- a GET request can be framed with content, but RFC 9110 gives that content no generally defined semantics and advises clients not to send it unless the origin server has explicitly established a supported purpose;
- POST commonly carries content, but an empty POST is still possible when an API contract defines a meaningful operation without request data;
- PUT and PATCH normally carry the state or change being applied;
- DELETE content has no generally defined semantics and should normally be avoided unless the client and origin server explicitly agree on its meaning;
- OPTIONS can carry content, but HTTP does not define a general use for it;
- TRACE explicitly forbids request content.

Frameworks, gateways, proxies and API tooling can impose stricter rules than HTTP itself. An API contract can therefore reject a request body even where HTTP framing would technically allow one.

### GET and HEAD

GET asks the server to transfer a current representation of the target resource. Filtering, sorting and pagination are normally expressed through the URI query rather than request content.

~~~http
GET /orders?status=open&page=2 HTTP/1.1
Accept: application/json
~~~

HEAD has the same request semantics as GET, but the server must not send response content. It is useful when a client needs headers or metadata such as `Content-Length`, `ETag` or `Last-Modified` without transferring the representation itself.

~~~http
HEAD /files/report.pdf HTTP/1.1
~~~

### POST

POST asks the target resource to process the representation or information supplied by the client according to resource-specific semantics. Common uses include creating a subordinate resource, submitting a form, starting an operation or invoking a command-style endpoint.

~~~http
POST /orders HTTP/1.1
Content-Type: application/json

{"productId":42,"quantity":2}
~~~

A successful creation commonly returns `201 Created` and `Location`, but POST is broader than “create”.

### PUT and PATCH

PUT and PATCH both change resource state, but their semantics differ.

**PUT** describes the state that should replace the current representation of the target resource. It is idempotent.

~~~http
PUT /users/42
Content-Type: application/json

{"name":"Alice","email":"alice@example.com","active":true}
~~~

**PATCH** carries a partial change document or operation. Its idempotency depends on the patch format and the operation being expressed.

~~~http
PATCH /users/42
Content-Type: application/merge-patch+json

{"active":false}
~~~

A frequent API-design mistake is to call every update PUT while accepting only arbitrary partial fields. If the endpoint intentionally applies partial changes, PATCH usually communicates that contract more accurately.

### DELETE

DELETE requests removal of the association between the target URI and its current functionality. A successful DELETE does not require that underlying data be physically erased; archival, soft deletion or other implementation behavior can exist behind the resource interface.

DELETE is idempotent in intended effect. The first request can return `204 No Content` and a repeat can return `404 Not Found`; the final intended state is still that the resource is no longer available through that target URI.

### OPTIONS, CONNECT and TRACE

OPTIONS asks for communication options associated with a resource or server. Browsers use OPTIONS for CORS preflight, but OPTIONS is not “the CORS method” exclusively.

CONNECT establishes a tunnel, commonly through a proxy. It has special request-target and connection semantics and is not a normal resource CRUD operation.

TRACE is a diagnostic loop-back method. Clients must not send request content in TRACE and should not send sensitive fields that could be reflected back.

### Safe methods

A method is **safe** when the client is not requesting a change to application state. GET and HEAD are safe even though the server may still produce logs, metrics or other incidental side effects.

A safe method should not be used to perform a destructive business operation. An endpoint such as `GET /users/42/delete` contradicts GET semantics.

### Idempotent methods

A method is **idempotent** when repeating the same request has the same intended effect as sending it once.

Idempotency does not require identical responses. For example, the first DELETE request can return `204 No Content` while a repeated DELETE returns `404 Not Found`.

POST is not idempotent by HTTP definition, but an API can introduce an application-level idempotency mechanism. Payment and order APIs often accept an `Idempotency-Key` so a retried POST does not create duplicate business operations.

### CRUD and HTTP

CRUD is a data-operation model. HTTP methods often map to CRUD, but the mapping is not the definition of HTTP or REST.

| CRUD operation | Common HTTP mapping | Notes |
| --- | --- | --- |
| Create | POST, sometimes PUT | PUT can create a resource when the client already knows the target URI |
| Read | GET | GET should not request destructive state changes |
| Update | PUT or PATCH | PUT replaces target state; PATCH applies a partial change |
| Delete | DELETE | DELETE is idempotent in intended effect |

## REST and resource-oriented HTTP APIs

HTTP is a protocol. **REST is an architectural style** defined by constraints on how distributed systems interact.

The classic REST constraints are:

- **client-server separation** — client and server responsibilities are separated;
- **statelessness** — each request contains the information required to process it;
- **cacheability** — responses define whether and how they can be reused;
- **uniform interface** — resources and representations are manipulated through consistent semantics;
- **layered system** — intermediaries such as gateways and proxies can exist without changing the client contract;
- **code on demand** — optional ability for a server to send executable code to a client.

A strict REST model also includes hypermedia as part of the uniform interface. In practice, many APIs described as REST APIs follow resource-oriented HTTP conventions without implementing every REST constraint.

Typical resource-oriented operations look like this:

~~~http
GET /users/42
GET /users/42/orders
POST /orders
PATCH /orders/123
DELETE /orders/123
~~~

REST does not mean “JSON over HTTP,” and CRUD alone does not make an API RESTful.

## Headers and content negotiation

Headers carry metadata and protocol controls. Request headers describe client capabilities, credentials, conditions and context. Response headers describe the returned representation, caching policy, authentication challenges, cookies and other response behavior.

### Common request headers

| Header | Meaning |
| --- | --- |
| Accept | Media types the client can accept in the response |
| Content-Type | Media type of the request content |
| Authorization | Credentials carried using an HTTP authentication scheme |
| Cookie | Matching cookies sent by the user agent |
| Origin | Origin that initiated a browser cross-origin request |
| User-Agent | Client software metadata |
| Accept-Language | Preferred response languages |
| Accept-Encoding | Supported response content encodings such as gzip or br |
| If-None-Match | Conditional request using an ETag validator |
| If-Match | Conditional write using an ETag validator |
| If-Modified-Since | Conditional request using a modification timestamp |
| Range | Requests part of a representation |
| Cache-Control | Request-side cache directives |
| traceparent | Standard distributed-tracing context |

### Common response headers

| Header | Meaning |
| --- | --- |
| Content-Type | Media type of the response content |
| Content-Encoding | Encoding or compression applied to the content |
| Content-Length | Declared content length when present |
| Location | URI associated with a created resource or redirect |
| Set-Cookie | Creates or updates user-agent cookies |
| Cache-Control | Cache policy for the response |
| ETag | Entity tag used as a cache or concurrency validator |
| Last-Modified | Timestamp validator for conditional requests |
| Vary | Request headers that affect cached response selection |
| Allow | Methods supported by a target resource |
| WWW-Authenticate | Authentication challenge, commonly used with 401 |
| Retry-After | Time before a client should retry after selected responses |
| Content-Disposition | Inline or attachment handling and optional filename |
| Access-Control-Allow-Origin | CORS origin permission |
| Access-Control-Allow-Methods | Methods allowed by CORS policy |
| Access-Control-Allow-Headers | Request headers allowed by CORS policy |
| Access-Control-Expose-Headers | Response headers exposed to browser JavaScript |

### Accept and Content-Type

These headers describe different things.

- **Content-Type** describes the content that is present in the current message.
- **Accept** describes which response media types the client is willing to receive.

A client can therefore send JSON and also request JSON in the response:

~~~http
Content-Type: application/json
Accept: application/json
~~~

If a server cannot process the request media type, `415 Unsupported Media Type` is appropriate. If it cannot produce a representation acceptable to the client, `406 Not Acceptable` can be used.

## HTTP status codes

A status code communicates the result of processing an HTTP request. The first digit defines the broad class.

| Class | Meaning |
| --- | --- |
| 1xx | Informational or provisional response |
| 2xx | Successful processing |
| 3xx | Redirection or cache-related result |
| 4xx | The request cannot be fulfilled as sent |
| 5xx | Server or upstream failure |

### 1xx informational responses

| Code | Meaning |
| --- | --- |
| 100 Continue | The client may continue sending the request body |
| 101 Switching Protocols | The protocol is being switched as requested |
| 102 Processing | WebDAV processing indication |
| 103 Early Hints | Preliminary headers can be used before the final response |

### 2xx successful responses

| Code | Meaning |
| --- | --- |
| 200 OK | The request completed successfully |
| 201 Created | A new resource was created |
| 202 Accepted | The request was accepted for asynchronous processing |
| 203 Non-Authoritative Information | Returned metadata differs from the origin server metadata |
| 204 No Content | Successful response with no response content |
| 205 Reset Content | Client should reset the document view |
| 206 Partial Content | A byte range or partial representation is returned |
| 207 Multi-Status | WebDAV response containing multiple resource statuses |
| 208 Already Reported | WebDAV member already reported earlier in the response |
| 226 IM Used | Response represents one or more instance manipulations |

### 3xx redirection and caching responses

| Code | Meaning |
| --- | --- |
| 300 Multiple Choices | Multiple representations or targets are available |
| 301 Moved Permanently | Resource has a permanent new URI |
| 302 Found | Temporary redirect with historical method-handling behavior |
| 303 See Other | Client should retrieve another URI, normally with GET |
| 304 Not Modified | Cached representation is still valid |
| 305 Use Proxy | Deprecated historical status |
| 306 Unused | Reserved historical code |
| 307 Temporary Redirect | Temporary redirect that preserves method and body |
| 308 Permanent Redirect | Permanent redirect that preserves method and body |

### 4xx request and client-side errors

| Code | Meaning |
| --- | --- |
| 400 Bad Request | Request syntax, framing or general request data is invalid |
| 401 Unauthorized | Authentication is required or the provided credentials are invalid |
| 402 Payment Required | Reserved for payment-related use |
| 403 Forbidden | Server understands the request but refuses authorization |
| 404 Not Found | Target resource or route is not available |
| 405 Method Not Allowed | Method is not supported for the target resource |
| 406 Not Acceptable | No acceptable response representation can be produced |
| 407 Proxy Authentication Required | Authentication is required by a proxy |
| 408 Request Timeout | Server timed out waiting for the request |
| 409 Conflict | Request conflicts with current resource state |
| 410 Gone | Resource was intentionally removed and is no longer available |
| 411 Length Required | Content length is required for this request |
| 412 Precondition Failed | A request precondition evaluated to false |
| 413 Content Too Large | Request content exceeds the accepted size |
| 414 URI Too Long | Request URI exceeds server limits |
| 415 Unsupported Media Type | Request body media type is unsupported |
| 416 Range Not Satisfiable | Requested byte range cannot be fulfilled |
| 417 Expectation Failed | Request expectation cannot be met |
| 418 I'm a teapot | Historical joke status defined by RFC 2324 |
| 421 Misdirected Request | Request was sent to a server unable to produce the response for that authority |
| 422 Unprocessable Content | Syntax is understood but the content cannot be processed semantically |
| 423 Locked | WebDAV resource is locked |
| 424 Failed Dependency | WebDAV operation failed because another operation failed |
| 425 Too Early | Server is unwilling to risk processing a potentially replayed request |
| 426 Upgrade Required | Client must switch to another protocol |
| 428 Precondition Required | Server requires a conditional request |
| 429 Too Many Requests | Rate limit has been exceeded |
| 431 Request Header Fields Too Large | Request headers exceed acceptable limits |
| 451 Unavailable For Legal Reasons | Resource is unavailable for legal reasons |

### 5xx server and upstream errors

| Code | Meaning |
| --- | --- |
| 500 Internal Server Error | Generic unexpected server failure |
| 501 Not Implemented | Server does not support the requested functionality |
| 502 Bad Gateway | Gateway or proxy received an invalid upstream response |
| 503 Service Unavailable | Service is temporarily unable to handle the request |
| 504 Gateway Timeout | Gateway or proxy timed out waiting for an upstream service |
| 505 HTTP Version Not Supported | Server does not support the request's HTTP version |
| 506 Variant Also Negotiates | Server has an internal content-negotiation configuration error |
| 507 Insufficient Storage | WebDAV server lacks storage to complete the request |
| 508 Loop Detected | WebDAV server detected an infinite loop |
| 510 Not Extended | Further extensions are required to fulfill the request |
| 511 Network Authentication Required | Client must authenticate to gain network access |

### Important status-code distinctions

**200 vs 201 vs 202 vs 204**

- 200 means successful processing with a normal response representation.
- 201 means creation of a new resource.
- 202 means work was accepted but has not necessarily completed.
- 204 means successful processing without response content.

**400 vs 422**

400 is a general bad-request status and commonly represents malformed or invalid request syntax/framing. 422 is used when the representation is syntactically understood but its semantic content cannot be processed.

**401 vs 403**

401 concerns authentication. 403 concerns authorization after the server understands the identity or access context. Some systems intentionally return 404 instead of 403 to avoid disclosing that a protected resource exists.

**409 vs 412**

409 represents a conflict with current resource state. 412 specifically means a conditional request such as `If-Match` or `If-Unmodified-Since` failed its precondition.

**502 vs 503 vs 504**

502 means an intermediary received an invalid upstream response. 503 means a service is temporarily unavailable. 504 means an intermediary waited too long for an upstream response.

## Request bodies, forms and files

HTTP message content can carry different media types. The format is identified by `Content-Type`.

### JSON

~~~http
POST /orders
Content-Type: application/json

{"productId":42,"quantity":2}
~~~

JSON is common for structured API data but is not built into HTTP itself.

### Form URL encoding

`application/x-www-form-urlencoded` represents form fields as encoded name-value pairs.

~~~http
POST /login
Content-Type: application/x-www-form-urlencoded

username=alice&password=example
~~~

### Raw binary content

A request can contain file bytes directly when the body represents one resource.

~~~http
PUT /documents/123/content
Content-Type: application/pdf

<PDF bytes>
~~~

### multipart/form-data

Multipart content divides one HTTP message body into multiple parts. Each part has its own headers and content. This allows ordinary fields, structured metadata and files to travel in one request.

~~~http
POST /documents
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

The boundary separates parts but the HTTP request still has one body.

### Base64 inside textual formats

Binary data can be Base64-encoded and embedded in JSON or another textual format. Base64 increases the encoded size by roughly one third before other protocol overhead, so raw or multipart transfer is normally more efficient when the contract allows it.

### Direct-to-storage uploads

Large-file systems often avoid routing all file bytes through the application server:

```diagram
Client
  │ request upload authorization
  ▼
Application API
  │ short-lived signed upload URL
  ▼
Client ───────────────► Object storage
        file bytes
```

The application authorizes the upload and returns a short-lived pre-signed URL. The client then transfers the file directly to object storage, while the application records metadata and completion state separately.

## Cookies and browser state

A cookie is a small piece of state managed by the user agent and associated with HTTP requests. Cookies are **not inherently an authentication mechanism**. Applications can use them for session identifiers, preferences, feature state, tracking identifiers or other application-defined values.

### Cookie lifecycle

A server asks the browser to store a cookie with `Set-Cookie`:

~~~http
HTTP/1.1 200 OK
Set-Cookie: session=abc123; Path=/; Secure; HttpOnly; SameSite=Lax
~~~

The user agent stores the cookie according to its cookie rules. On a later matching request it automatically sends the cookie in the `Cookie` request header:

~~~http
GET /account HTTP/1.1
Cookie: session=abc123
~~~

```diagram
Server response
  │ Set-Cookie
  ▼
Browser cookie store
  │ matching domain/path/security rules
  ▼
Later request
  │ Cookie
  ▼
Server
```

The browser does not normally send cookie attributes such as `Secure`, `HttpOnly`, `SameSite`, `Path` or expiration back in the `Cookie` header. It sends the applicable name-value pairs.

### Cookie scope and lifetime

Important cookie attributes include:

| Attribute | Effect |
| --- | --- |
| Secure | Send the cookie only over secure connections |
| HttpOnly | Prevent browser JavaScript from reading the cookie through normal script APIs |
| SameSite | Controls whether the cookie is sent in cross-site contexts |
| Domain | Defines the host/domain scope; omitting it creates a host-only cookie |
| Path | Restricts which request paths match the cookie |
| Max-Age / Expires | Defines a persistent lifetime; without them the cookie is normally a session cookie |

A **session cookie** normally lasts for the browser session, subject to browser session-restore behavior. A **persistent cookie** has an explicit lifetime. HTTP cookie rules define behavior, but they do not require a particular physical storage implementation: a browser may keep cookie state in memory, persistent storage or a combination.

Cross-site and third-party cookie behavior is also affected by browser privacy policy in addition to the HTTP cookie attributes.

### Cookie versus server-side session

A cookie and a session are not the same object.

A common architecture is:

```diagram
Cookie: session=abc123
        │
        ▼
Server session store
abc123 → userId=42, roles=..., expiry=...
```

The browser stores only the session identifier while the application keeps the actual session state on the server. Other architectures use signed or encrypted cookie-based session data. The cookie mechanism itself does not prescribe which model the application uses.

For authentication design, session security, tokens, OAuth, JWT, roles and access policies, continue to [Identity & authorization](?topic=identity-and-authorization).

### Inspecting cookies in Chrome DevTools

To inspect cookie state rather than guessing from application behavior:

1. Open **DevTools → Application → Storage → Cookies** and select the site origin.
2. Inspect the cookie name, value, domain, path, expiration, `HttpOnly`, `Secure` and `SameSite` properties.
3. In **Network**, select an individual request and inspect its **Cookies** tab or request/response headers to see which cookies were actually sent and which `Set-Cookie` values were received.
4. When debugging a missing cookie, check domain/path matching, expiry, `Secure`, `SameSite`, cross-site context and whether the response's `Set-Cookie` was accepted by the browser.

Cookie-based authentication introduces CSRF considerations because the browser can attach matching cookies automatically. CSRF protection and CORS solve different problems: CSRF addresses unwanted authenticated actions, while CORS controls browser JavaScript access to cross-origin responses.

## Caching and conditional requests

HTTP caching allows browsers, other clients, proxies, gateways and CDNs to reuse stored responses when the cache policy permits it. Caching can reduce latency, bandwidth and origin-server load.

### Where HTTP responses can be cached

```diagram
Browser / client private cache
          │
          ▼
Proxy or shared organizational cache
          │
          ▼
CDN / edge cache
          │
          ▼
Origin server
```

A cache can therefore exist in more than one place. `private` and `public` directives help define which kinds of caches may store a response. HTTP defines cache behavior, not the exact physical storage location. A browser can use memory, disk or implementation-specific storage.

### Freshness and revalidation

A useful mental model is:

```diagram
Request
  │
  ▼
Cached response exists?
  │ no ───────────────► Origin → 200 + representation
  │ yes
  ▼
Still fresh?
  │ yes ──────────────► Reuse cached response
  │ no
  ▼
Revalidate with validator
  │
  ├─ 304 Not Modified ─► Reuse cached representation
  └─ 200 OK ───────────► Store/use new representation
```

A fresh response can be reused without contacting the origin. A stale response often needs validation before reuse unless another directive permits stale use.

### Cache-Control directives

Common directives have importantly different meanings:

| Directive | Meaning |
| --- | --- |
| max-age=N | Response can normally be reused while its age is less than N seconds |
| s-maxage=N | Freshness lifetime for shared caches; overrides max-age there |
| public | Response may be stored by shared caches even when it otherwise might not be |
| private | Response is intended for a private cache and must not be stored by a shared cache |
| no-cache | The response may be stored, but it must be validated before reuse |
| no-store | A cache must not store the response under the rules defined by HTTP caching |
| must-revalidate | Once stale, the response must not be reused without successful validation unless the specification permits an exception |

The common misconception is **`no-cache` does not mean “do not store.”** It means “do not reuse without validation.” `no-store` is the directive that prohibits storing the response in an HTTP cache.

### ETag and Last-Modified validators

`ETag` is an opaque validator representing a version of a selected representation. `Last-Modified` is a timestamp validator.

A response can provide an ETag:

~~~http
HTTP/1.1 200 OK
ETag: "v7"
Cache-Control: no-cache
Content-Type: application/json

{"id":42,"name":"Alice"}
~~~

The client can later revalidate it:

~~~http
GET /users/42
If-None-Match: "v7"
~~~

If the selected representation has not changed, the server can return:

~~~http
HTTP/1.1 304 Not Modified
ETag: "v7"
~~~

A `304 Not Modified` response does not resend the normal representation content; the client reuses the stored representation and updates cache metadata as required.

`Last-Modified` works similarly with `If-Modified-Since`, though ETags can provide more precise version validation.

### Conditional writes and optimistic concurrency

ETags are also useful outside caching. They can prevent lost updates. A client reads version `v7` and later sends an update only if that version is still current:

~~~http
PATCH /users/42
If-Match: "v7"
Content-Type: application/json

{"displayName":"Alice B"}
~~~

If the resource has already changed, the server can return `412 Precondition Failed` rather than overwrite newer data.

### Vary and cache keys

`Vary` tells caches which request headers influence response selection. For example, `Vary: Accept-Encoding` means compressed and uncompressed representations must be cached separately. `Vary: Origin` is important when CORS responses differ by request origin.

### Inspecting HTTP caching in Chrome DevTools

Use the **Network** panel for the browser HTTP cache:

1. Reload the page and inspect the request's **Status**, **Size/Transferred**, request headers and response headers.
2. Look for `Cache-Control`, `ETag`, `Last-Modified`, `Age`, `Expires`, `Vary`, `If-None-Match`, `If-Modified-Since` and `304 Not Modified` where applicable.
3. Chrome can indicate that a response came from memory cache or disk cache in the Network log instead of transferring the representation from the network.
4. Use **Disable cache** while DevTools is open when you need to compare behavior without normal browser HTTP-cache reuse.
5. A `304` is not “an empty successful response from the API”; it means the stored representation was validated and can be reused.

**Application → Cache Storage is not the ordinary browser HTTP cache.** Cache Storage is exposed through the Cache API and is commonly used by service workers. Chrome's own DevTools documentation explicitly directs HTTP-cache debugging to the Network log instead.

## Authentication and authorization in HTTP

HTTP needs enough authentication context here to explain protocol fields and status codes, but the authentication systems themselves belong in the dedicated identity chapter.

**Authentication** establishes who a user, client or service is. **Authorization** determines what that identity is allowed to do.

HTTP defines a challenge/credentials framework. For example:

~~~http
GET /account HTTP/1.1
Authorization: Bearer <token>
~~~

A server that requires authentication can challenge the client:

~~~http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer
~~~

`401 Unauthorized` concerns missing or unacceptable authentication credentials. `403 Forbidden` means the server understands the request but refuses to authorize it. Applications can also carry credentials through mechanisms layered on HTTP, including session cookies and API-specific headers.

For Basic authentication, API keys, session authentication, Bearer tokens, JWT, OAuth 2.0, OpenID Connect, scopes, RBAC, ABAC, mTLS and service identities, see [Identity & authorization](?topic=identity-and-authorization).

## CORS and the same-origin policy

**CORS (Cross-Origin Resource Sharing)** is an HTTP-header mechanism used by browsers to control whether JavaScript from one origin may access a response from another origin.

An origin consists of **scheme + host + port**.

| Page | API | Same origin? |
| --- | --- | ---: |
| https://app.example.com | https://app.example.com/api | Yes |
| https://app.example.com | https://api.example.com | No; host differs |
| https://app.example.com | http://app.example.com | No; scheme differs |
| https://app.example.com | https://app.example.com:8443 | No; port differs |

The URL path does not participate in origin comparison.

### Browser enforcement

The same-origin policy is enforced by browsers. General HTTP clients such as curl, Postman and server-to-server code do not implement browser CORS restrictions.

This means a request can reach the API and even receive HTTP 200, while browser JavaScript is still prevented from accessing the response because the CORS policy does not allow it.

### Simple cross-origin requests

Some cross-origin requests can be sent without a preflight when they use only CORS-safelisted methods, headers and content types. The server still needs to return an appropriate `Access-Control-Allow-Origin` header before browser JavaScript can use the response.

### Preflight requests

Requests using non-safelisted methods, headers or content types generally require an OPTIONS preflight before the browser sends the actual request.

~~~http
OPTIONS /api/orders HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization,content-type
~~~

A server can respond:

~~~http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Headers: Authorization,Content-Type
Access-Control-Max-Age: 600
Vary: Origin
~~~

The `Access-Control-Allow-*` fields describe which cross-origin operations the browser may permit.

### Credentialed cross-origin requests

When a cross-origin request includes credentials such as cookies, the response must explicitly allow credentials and must identify an allowed origin.

~~~http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
~~~

`Access-Control-Allow-Origin: *` cannot grant credentialed browser access.

### Exposed response headers

Browser JavaScript can read only CORS-safelisted response headers by default. Other headers can be exposed explicitly:

~~~http
Access-Control-Expose-Headers: X-Request-Id, ETag
~~~

CORS is not an authentication or authorization mechanism. It restricts browser JavaScript behavior; it does not prevent non-browser clients from sending requests to the API.

## Errors, retries and rate limiting

HTTP status codes and headers can express temporary failure and retry behavior.

**429 Too Many Requests** indicates that the client exceeded a rate limit. **503 Service Unavailable** indicates temporary service unavailability. Either response can include `Retry-After`.

~~~http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
~~~

Automatic retries are safest for idempotent methods such as GET, PUT and DELETE. Retrying a non-idempotent POST can duplicate a business operation unless the API provides an idempotency mechanism.

Gateway errors identify different failure modes:

- **502 Bad Gateway** — invalid response from an upstream dependency;
- **503 Service Unavailable** — service temporarily cannot handle the request;
- **504 Gateway Timeout** — intermediary timed out while waiting for an upstream dependency.

Application APIs often return a structured error body in addition to the HTTP status code. The exact schema is application-specific, but a useful error representation commonly includes a stable machine-readable error code, human-readable detail and correlation or trace information.

## Sources

- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [RFC 9111 — HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
- [RFC 6265 — HTTP State Management Mechanism](https://www.rfc-editor.org/rfc/rfc6265.html)
- [RFC 5789 — PATCH Method for HTTP](https://www.rfc-editor.org/rfc/rfc5789.html)
- [RFC 7578 — multipart/form-data](https://www.rfc-editor.org/rfc/rfc7578.html)
- [RFC 6454 — The Web Origin Concept](https://www.rfc-editor.org/rfc/rfc6454.html)
- [MDN — HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP)
- [MDN — HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
- [MDN — Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- [Chrome DevTools — View and edit cookies](https://developer.chrome.com/docs/devtools/application/cookies/)
- [Chrome DevTools — Network features reference](https://developer.chrome.com/docs/devtools/network/reference/)
- [Chrome DevTools — Cache Storage versus HTTP cache](https://developer.chrome.com/docs/devtools/storage/cache)
- [MDN — CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
