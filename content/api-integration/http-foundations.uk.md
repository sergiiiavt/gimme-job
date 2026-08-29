# Основи HTTP, REST та CORS

HTTP — це application-layer protocol для обміну повідомленнями між clients і servers. Web pages, REST APIs, file transfers, browser requests, service-to-service calls та багато інших систем використовують одну фундаментальну модель: client надсилає request до resource, а server повертає response.

HTTP/1.1, HTTP/2 та HTTP/3 відрізняються transport mechanism і wire encoding, але application semantics, описані тут, залишаються переважно однаковими. Transport-level details та механіка HTTP versions покриті в Networking.

## HTTP та HTTPS

HTTP exchange має дві сторони:

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

**HTTP** визначає semantics requests і responses. **HTTPS** — це HTTP поверх TLS. TLS забезпечує encryption transport, integrity protection та server authentication через certificates. Він не замінює application-level authentication або authorization.

Request визначає target resource і виражає operation через HTTP method. Response повідомляє результат через status code та може повертати representation resource або error document.

## URLs, resources та request targets

Типовий URL можна розкласти на частини:

https://api.example.com:8443/v1/users/42?include=roles#details

| Частина | Значення | Значення |
| --- | --- | --- |
| Scheme | https | Protocol scheme |
| Host | api.example.com | Ім'я server |
| Port | 8443 | Network port; може бути omitted для default port |
| Path | /v1/users/42 | Resource path |
| Query | include=roles | Optional request parameters |
| Fragment | details | Client-side fragment; не надсилається в HTTP request |

Path і query входять до request target, але зазвичай мають різні ролі.

| Location | Типова роль | Приклад |
| --- | --- | --- |
| Path | Ідентифікує resource або hierarchy | /users/42/orders |
| Query | Filtering, sorting, pagination, optional controls | ?status=open&page=2 |
| Header | Message metadata та protocol controls | Accept, Authorization, If-Match |
| Body | Structured data або bytes | JSON, form data, file content |

Resource-oriented APIs зазвичай використовують стабільні nouns для resources і relationships:

- /users
- /users/42
- /users/42/orders
- /orders/123/items

## HTTP messages

HTTP request містить method, request target, headers та optional body.

~~~http
POST /api/users?sendWelcome=true HTTP/1.1
Host: api.example.com
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json

{"name":"Alice","email":"alice@example.com"}
~~~

Відповідний response містить status code, headers та optional body.

~~~http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/users/42

{"id":42,"name":"Alice","email":"alice@example.com"}
~~~

Message body може містити JSON, XML, text, form fields, multipart parts, images, documents або довільні binary data. Header Content-Type описує media type цього body.

## HTTP methods та їх semantics

HTTP methods описують intended semantics operation. Це не просто aliases для database CRUD operations.

| Method | Основна semantics | Safe | Idempotent |
| --- | --- | ---: | ---: |
| GET | Отримати representation resource | Так | Так |
| HEAD | Та сама semantics, що GET, але без response content | Так | Так |
| POST | Надіслати data для resource-specific processing; часто створює subordinate resource | Ні | Не гарантовано |
| PUT | Створити або повністю замінити state target resource | Ні | Так |
| PATCH | Застосувати partial modification | Ні | Не гарантовано |
| DELETE | Видалити target resource | Ні | Так |
| OPTIONS | Описати communication options resource; також використовується CORS preflight | Так | Так |
| CONNECT | Створити tunnel через intermediary | Ні | Ні |
| TRACE | Diagnostic loop-back отриманого request | Так | Так |

### Safe methods

Method є **safe**, коли client не запитує зміну application state. GET і HEAD є safe, хоча server все одно може створювати logs, metrics або інші incidental side effects.

Safe method не повинен використовуватися для destructive business operation. Endpoint на кшталт GET /users/42/delete суперечить semantics GET.

### Idempotent methods

Method є **idempotent**, якщо повторення того самого request має той самий intended effect, що й одноразове виконання.

Idempotency не означає однакові responses. Наприклад, перший DELETE може повернути 204 No Content, а повторний DELETE — 404 Not Found. Final intended state однаковий: resource не існує.

POST не є idempotent за HTTP definition, але API може додати application-level idempotency mechanism. Payment та order APIs часто приймають Idempotency-Key, щоб retry POST не створював duplicate business operations.

### PUT та PATCH

PUT і PATCH обидва змінюють resource state, але їх semantics різна.

**PUT** описує state, який має замінити current representation target resource. PUT є idempotent.

~~~http
PUT /users/42
Content-Type: application/json

{"name":"Alice","email":"alice@example.com","active":true}
~~~

**PATCH** передає partial change document або operation. Його idempotency залежить від patch format та конкретної operation.

~~~http
PATCH /users/42
Content-Type: application/merge-patch+json

{"active":false}
~~~

### CRUD та HTTP

CRUD — це data-operation model. HTTP methods часто мапляться на CRUD, але це не definition HTTP або REST.

| CRUD operation | Типовий HTTP mapping | Примітка |
| --- | --- | --- |
| Create | POST, інколи PUT | PUT може створити resource, якщо client уже знає target URI |
| Read | GET | GET не повинен запитувати destructive state changes |
| Update | PUT або PATCH | PUT замінює target state; PATCH застосовує partial change |
| Delete | DELETE | DELETE idempotent за intended effect |

## REST та resource-oriented HTTP APIs

HTTP — protocol. **REST — architectural style**, визначений constraints взаємодії distributed systems.

Класичні REST constraints:

- **client-server separation** — client і server responsibilities розділені;
- **statelessness** — кожен request містить інформацію, потрібну для його processing;
- **cacheability** — responses визначають, чи і як їх можна reuse;
- **uniform interface** — resources і representations обробляються через consistent semantics;
- **layered system** — intermediaries, наприклад gateways і proxies, можуть існувати без зміни client contract;
- **code on demand** — optional можливість server надсилати executable code client.

Strict REST model також включає hypermedia як частину uniform interface. На практиці багато APIs, які називають REST APIs, використовують resource-oriented HTTP conventions, але не реалізують усі REST constraints.

Типові resource-oriented operations:

~~~http
GET /users/42
GET /users/42/orders
POST /orders
PATCH /orders/123
DELETE /orders/123
~~~

REST не означає просто “JSON over HTTP”, а CRUD сам по собі не робить API RESTful.

## Headers та content negotiation

Headers передають metadata та protocol controls. Request headers описують client capabilities, credentials, conditions та context. Response headers описують returned representation, caching policy, authentication challenges, cookies та іншу response behavior.

### Поширені request headers

| Header | Значення |
| --- | --- |
| Accept | Media types, які client може прийняти в response |
| Content-Type | Media type request body |
| Authorization | Credentials, наприклад Basic або Bearer tokens |
| Cookie | Cookies, які client надсилає server |
| Origin | Origin, який ініціював browser cross-origin request |
| User-Agent | Metadata client software |
| Accept-Language | Preferred response languages |
| Accept-Encoding | Supported response encodings, наприклад gzip або br |
| If-None-Match | Conditional request з ETag validator |
| If-Match | Conditional write з ETag validator |
| If-Modified-Since | Conditional request з timestamp validator |
| Range | Запит частини representation |
| Cache-Control | Request-side cache directives |
| traceparent | Standard distributed-tracing context |

### Поширені response headers

| Header | Значення |
| --- | --- |
| Content-Type | Media type response body |
| Content-Encoding | Encoding або compression, застосовані до body |
| Content-Length | Declared content length, якщо він переданий |
| Location | URI created resource або redirect target |
| Set-Cookie | Створює або оновлює browser cookies |
| Cache-Control | Cache policy response |
| ETag | Entity tag для cache або concurrency validation |
| Last-Modified | Timestamp validator для conditional requests |
| Vary | Request headers, що впливають на cached response selection |
| Allow | Methods, supported target resource |
| WWW-Authenticate | Authentication challenge, часто разом із 401 |
| Retry-After | Час до наступної retry після окремих responses |
| Content-Disposition | Inline/attachment handling та optional filename |
| Access-Control-Allow-Origin | Дозволений origin у CORS |
| Access-Control-Allow-Methods | Methods, дозволені CORS policy |
| Access-Control-Allow-Headers | Request headers, дозволені CORS policy |
| Access-Control-Expose-Headers | Response headers, доступні browser JavaScript |

### Accept та Content-Type

Ці headers описують різні речі.

- **Content-Type** описує content, який фактично є в поточному message.
- **Accept** описує response media types, які client готовий прийняти.

Client може одночасно надсилати JSON і просити JSON у response:

~~~http
Content-Type: application/json
Accept: application/json
~~~

Якщо server не може обробити request media type, доречний 415 Unsupported Media Type. Якщо server не може сформувати representation, прийнятний для client, може використовуватись 406 Not Acceptable.

## HTTP status codes

Status code повідомляє результат processing HTTP request. Перша цифра визначає broad class.

| Class | Значення |
| --- | --- |
| 1xx | Informational або provisional response |
| 2xx | Successful processing |
| 3xx | Redirection або cache-related result |
| 4xx | Request не може бути виконаний у надісланому вигляді |
| 5xx | Server або upstream failure |

### 1xx informational responses

| Code | Значення |
| --- | --- |
| 100 Continue | Client може продовжити надсилання request body |
| 101 Switching Protocols | Protocol змінюється за request client |
| 102 Processing | WebDAV processing indication |
| 103 Early Hints | Preliminary headers можуть бути використані до final response |

### 2xx successful responses

| Code | Значення |
| --- | --- |
| 200 OK | Request успішно виконано |
| 201 Created | Створено новий resource |
| 202 Accepted | Request прийнято для asynchronous processing |
| 203 Non-Authoritative Information | Returned metadata відрізняється від origin server metadata |
| 204 No Content | Успішний response без response content |
| 205 Reset Content | Client має reset document view |
| 206 Partial Content | Повертається byte range або partial representation |
| 207 Multi-Status | WebDAV response з statuses кількох resources |
| 208 Already Reported | WebDAV member уже був reported раніше у response |
| 226 IM Used | Response представляє результат instance manipulations |

### 3xx redirection та caching responses

| Code | Значення |
| --- | --- |
| 300 Multiple Choices | Доступно кілька representations або targets |
| 301 Moved Permanently | Resource має permanent new URI |
| 302 Found | Temporary redirect з historical method-handling behavior |
| 303 See Other | Client має отримати інший URI, зазвичай через GET |
| 304 Not Modified | Cached representation залишається valid |
| 305 Use Proxy | Deprecated historical status |
| 306 Unused | Reserved historical code |
| 307 Temporary Redirect | Temporary redirect зі збереженням method і body |
| 308 Permanent Redirect | Permanent redirect зі збереженням method і body |

### 4xx request та client-side errors

| Code | Значення |
| --- | --- |
| 400 Bad Request | Request syntax, framing або general request data invalid |
| 401 Unauthorized | Потрібна authentication або credentials invalid |
| 402 Payment Required | Reserved для payment-related use |
| 403 Forbidden | Server розуміє request, але відмовляє в authorization |
| 404 Not Found | Target resource або route недоступний |
| 405 Method Not Allowed | Method не підтримується target resource |
| 406 Not Acceptable | Неможливо сформувати acceptable response representation |
| 407 Proxy Authentication Required | Proxy вимагає authentication |
| 408 Request Timeout | Server не дочекався завершення request |
| 409 Conflict | Request конфліктує з current resource state |
| 410 Gone | Resource навмисно видалений і більше недоступний |
| 411 Length Required | Для request потрібен content length |
| 412 Precondition Failed | Request precondition evaluated to false |
| 413 Content Too Large | Request content перевищує accepted size |
| 414 URI Too Long | Request URI перевищує server limits |
| 415 Unsupported Media Type | Media type request body не підтримується |
| 416 Range Not Satisfiable | Requested byte range неможливо виконати |
| 417 Expectation Failed | Request expectation не може бути виконана |
| 418 I'm a teapot | Historical joke status з RFC 2324 |
| 421 Misdirected Request | Request потрапив на server, який не може відповісти для цієї authority |
| 422 Unprocessable Content | Syntax зрозуміла, але semantic content неможливо process |
| 423 Locked | WebDAV resource locked |
| 424 Failed Dependency | WebDAV operation failed через failure іншої operation |
| 425 Too Early | Server не хоче processing potentially replayed request |
| 426 Upgrade Required | Client має перейти на інший protocol |
| 428 Precondition Required | Server вимагає conditional request |
| 429 Too Many Requests | Rate limit exceeded |
| 431 Request Header Fields Too Large | Request headers перевищують допустимі limits |
| 451 Unavailable For Legal Reasons | Resource unavailable через legal reasons |

### 5xx server та upstream errors

| Code | Значення |
| --- | --- |
| 500 Internal Server Error | Generic unexpected server failure |
| 501 Not Implemented | Server не підтримує requested functionality |
| 502 Bad Gateway | Gateway або proxy отримав invalid upstream response |
| 503 Service Unavailable | Service тимчасово не може обробити request |
| 504 Gateway Timeout | Gateway або proxy не дочекався upstream service |
| 505 HTTP Version Not Supported | Server не підтримує HTTP version request |
| 506 Variant Also Negotiates | Internal content-negotiation configuration error |
| 507 Insufficient Storage | WebDAV server не має достатньо storage |
| 508 Loop Detected | WebDAV server виявив infinite loop |
| 510 Not Extended | Для виконання request потрібні додаткові extensions |
| 511 Network Authentication Required | Client має authenticate для network access |

### Важливі відмінності status codes

**200 vs 201 vs 202 vs 204**

- 200 означає successful processing з normal response representation.
- 201 означає creation нового resource.
- 202 означає, що work accepted, але ще не обов'язково завершена.
- 204 означає successful processing без response content.

**400 vs 422**

400 — general bad-request status і часто означає malformed або invalid request syntax/framing. 422 використовується, коли representation syntactically understood, але semantic content не може бути processed.

**401 vs 403**

401 стосується authentication. 403 стосується authorization після того, як server розуміє identity або access context. Деякі systems навмисно повертають 404 замість 403, щоб не розкривати існування protected resource.

**409 vs 412**

409 означає conflict з current resource state. 412 конкретно означає, що conditional request, наприклад If-Match або If-Unmodified-Since, не пройшов precondition.

**502 vs 503 vs 504**

502 означає, що intermediary отримав invalid upstream response. 503 означає temporary unavailability service. 504 означає, що intermediary занадто довго чекав upstream response.

## Authentication, authorization та session state

**Authentication** встановлює, ким є user, client або service. **Authorization** визначає, що цій identity дозволено робити.

HTTP має standard authentication fields і також використовується для передачі багатьох application-specific credential mechanisms.

| Mechanism | Опис |
| --- | --- |
| HTTP Basic | Username/password Base64-encoded в Authorization; потрібен TLS, тому що Base64 не є encryption |
| Bearer token | Authorization: Bearer token; token може бути opaque або structured, наприклад JWT |
| API key | Application credential, зазвичай передається в dedicated header |
| OAuth 2.0 access token | Delegated authorization token, часто передається як Bearer token |
| OpenID Connect | Identity layer поверх OAuth 2.0 для authentication та identity claims |
| Session cookie | Browser cookie представляє server-side або signed session state |
| HMAC request signing | Вибрані request components cryptographically signed |
| Mutual TLS | Client і server обидва authenticate через certificates |

Successful authentication не означає unrestricted authorization. Authenticated user все одно може не мати доступу до resource іншого user, administrative operation або іншого tenant.

### Cookies та sessions

Servers створюють cookies через Set-Cookie. Browsers пізніше повертають відповідні cookies в header Cookie згідно з domain, path, expiration, SameSite та security rules.

Важливі cookie attributes:

- **Secure** — cookie надсилається лише через secure connections;
- **HttpOnly** — browser JavaScript не може читати cookie;
- **SameSite** — контролює cross-site cookie sending behavior;
- **Domain** і **Path** — визначають scope cookie;
- **Max-Age** або **Expires** — визначають lifetime.

Cookie-based authentication створює CSRF considerations, оскільки browser може автоматично додавати cookies до requests. CSRF protection і CORS вирішують різні problems: CSRF контролює unwanted authenticated actions, а CORS — доступ browser JavaScript до cross-origin responses.

## Request bodies, forms та files

HTTP message bodies можуть переносити різні media types. Формат body визначається через Content-Type.

### JSON

~~~http
POST /orders
Content-Type: application/json

{"productId":42,"quantity":2}
~~~

JSON часто використовується для structured API data, але не є частиною HTTP protocol як такого.

### Form URL encoding

application/x-www-form-urlencoded представляє form fields як encoded name-value pairs.

~~~http
POST /login
Content-Type: application/x-www-form-urlencoded

username=alice&password=example
~~~

### Raw binary content

Request може містити file bytes напряму, якщо body представляє один resource.

~~~http
PUT /documents/123/content
Content-Type: application/pdf

<PDF bytes>
~~~

### multipart/form-data

Multipart body ділить один HTTP body на кілька parts. Кожна part має власні headers і content. Це дозволяє передавати ordinary fields, structured metadata та files в одному request.

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

Boundary розділяє parts, але HTTP request все одно має один body.

### Base64 у textual formats

Binary data можна Base64-encode і помістити в JSON або інший textual format. Base64 збільшує encoded size приблизно на одну третину ще до іншого protocol overhead, тому raw або multipart transfer зазвичай ефективніший, якщо contract це дозволяє.

### Direct-to-storage uploads

Large-file systems часто не пропускають усі file bytes через application server:

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

Application authorizes upload і повертає short-lived pre-signed URL. Client передає file напряму в object storage, а application окремо зберігає metadata та completion state.

## Caching та conditional requests

HTTP caching дозволяє clients, browsers, gateways і shared caches reuse responses, якщо response policy це дозволяє.

**Cache-Control** визначає caching directives, наприклад max-age, no-cache, no-store, public і private.

**ETag** — opaque validator конкретної version resource. **Last-Modified** — timestamp validator.

Cache revalidation через ETag:

~~~http
HTTP/1.1 200 OK
ETag: "v7"
Cache-Control: max-age=0, must-revalidate
~~~

Пізніше client може надіслати:

~~~http
GET /users/42
If-None-Match: "v7"
~~~

Якщо representation не змінилася, server може повернути:

~~~http
HTTP/1.1 304 Not Modified
ETag: "v7"
~~~

### Conditional writes та optimistic concurrency

ETags також можуть запобігати lost updates. Client читає version v7 і пізніше надсилає update лише якщо ця version все ще current:

~~~http
PATCH /users/42
If-Match: "v7"
Content-Type: application/json

{"displayName":"Alice B"}
~~~

Якщо resource уже змінився до v8, server може повернути 412 Precondition Failed замість overwrite новіших data.

**Vary** повідомляє caches, які request headers впливають на response selection. Наприклад, Vary: Accept-Encoding означає, що compressed і uncompressed representations мають кешуватися окремо. Vary: Origin важливий, коли CORS responses відрізняються залежно від request origin.

## CORS та same-origin policy

**CORS (Cross-Origin Resource Sharing)** — HTTP-header mechanism, який browsers використовують для контролю того, чи може JavaScript з одного origin отримати доступ до response з іншого origin.

Origin складається з **scheme + host + port**.

| Page | API | Same origin? |
| --- | --- | ---: |
| https://app.example.com | https://app.example.com/api | Так |
| https://app.example.com | https://api.example.com | Ні; інший host |
| https://app.example.com | http://app.example.com | Ні; інший scheme |
| https://app.example.com | https://app.example.com:8443 | Ні; інший port |

URL path не бере участі в origin comparison.

### Browser enforcement

Same-origin policy enforced browsers. General HTTP clients, наприклад curl, Postman та server-to-server code, не застосовують browser CORS restrictions.

Тому request може дійти до API і навіть отримати HTTP 200, але browser JavaScript все одно не отримає доступ до response, якщо CORS policy цього не дозволяє.

### Simple cross-origin requests

Деякі cross-origin requests можуть бути відправлені без preflight, якщо використовують лише CORS-safelisted methods, headers та content types. Server все одно має повернути коректний Access-Control-Allow-Origin, щоб browser JavaScript міг використати response.

### Preflight requests

Requests з non-safelisted methods, headers або content types зазвичай вимагають OPTIONS preflight перед actual request.

~~~http
OPTIONS /api/orders HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization,content-type
~~~

Server може відповісти:

~~~http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Headers: Authorization,Content-Type
Access-Control-Max-Age: 600
Vary: Origin
~~~

Access-Control-Allow-* fields описують, які cross-origin operations browser може дозволити.

### Credentialed cross-origin requests

Коли cross-origin request містить credentials, наприклад cookies, response має явно дозволити credentials і вказати allowed origin.

~~~http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
~~~

Access-Control-Allow-Origin: * не може надати credentialed browser access.

### Exposed response headers

Browser JavaScript за замовчуванням може читати лише CORS-safelisted response headers. Інші headers можна expose explicitly:

~~~http
Access-Control-Expose-Headers: X-Request-Id, ETag
~~~

CORS не є authentication або authorization mechanism. Він обмежує browser JavaScript behavior, але не забороняє non-browser clients надсилати requests до API.

## Errors, retries та rate limiting

HTTP status codes і headers можуть виражати temporary failure та retry behavior.

**429 Too Many Requests** означає, що client перевищив rate limit. **503 Service Unavailable** означає temporary service unavailability. Обидва responses можуть містити Retry-After.

~~~http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
~~~

Automatic retries найбезпечніші для idempotent methods, наприклад GET, PUT та DELETE. Retry non-idempotent POST може duplicate business operation, якщо API не має idempotency mechanism.

Gateway errors означають різні failure modes:

- **502 Bad Gateway** — invalid response від upstream dependency;
- **503 Service Unavailable** — service тимчасово не може handle request;
- **504 Gateway Timeout** — intermediary не дочекався upstream dependency.

Application APIs часто повертають structured error body на додаток до HTTP status code. Exact schema application-specific, але useful error representation зазвичай має stable machine-readable error code, human-readable detail та correlation або trace information.

## Sources

- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [RFC 9111 — HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
- [RFC 5789 — PATCH Method for HTTP](https://www.rfc-editor.org/rfc/rfc5789.html)
- [RFC 7578 — multipart/form-data](https://www.rfc-editor.org/rfc/rfc7578.html)
- [RFC 6454 — The Web Origin Concept](https://www.rfc-editor.org/rfc/rfc6454.html)
- [MDN — HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP)
- [MDN — CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
