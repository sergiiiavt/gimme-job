### URI, URL та URN

**URI (Uniform Resource Identifier)** — загальний standards term для sequence of characters, що ідентифікує resource. URI може ідентифікувати resource через location, name або інший scheme-specific mechanism.

**URL (Uniform Resource Locator)** — location-oriented використання URI: resource визначається через scheme та access location, наприклад `https://api.example.com/users/42`.

**URN (Uniform Resource Name)** використовує URI scheme `urn:` для persistent location-independent names, наприклад `urn:isbn:9780131103627`.

Ці terms пов'язані, а не є трьома незалежними syntaxes. У modern standards **URI** — broad generic concept; HTTP зазвичай працює з `http` та `https` URIs, які в everyday usage називають URLs.

| Term | Приклад | Основна ідея |
| --- | --- | --- |
| URI | `https://api.example.com/users/42` | General resource identifier |
| URL | `https://api.example.com/users/42` | URI як network location |
| URN | `urn:isbn:9780131103627` | URI з naming scheme `urn` |

### Generic URI components

RFC 3986 визначає generic hierarchical form:

~~~text
scheme://authority/path?query#fragment
~~~

Повний приклад:

~~~text
https://api.example.com:8443/v1/users/42?include=roles#details
\___/   \__________________/ \___________/ \___________/ \_____/
scheme        authority           path          query      fragment
~~~

**Authority** може містити host та optional port. URI syntax також дозволяє user-info, але credentials у URL є небезпечними і не повинні використовуватись для API secrets.

Для HTTP APIs основні parts:

- **scheme** — зазвичай `http` або `https`;
- **host** — DNS name або IP literal server authority;
- **port** — explicit network port;
- **path** — hierarchical resource path;
- **query** — додаткові data для target;
- **fragment** — client-side identifier усередині representation; він не передається в HTTP request target.

### Absolute URIs та relative references

**Absolute URI** містить scheme:

~~~text
https://api.example.com/v1/orders/42
~~~

**Relative reference** resolve-иться відносно base URI:

~~~text
../orders/42
?status=open
#details
~~~

Для base URI:

~~~text
https://api.example.com/v1/users/
~~~

`../orders/42` resolve-иться в:

~~~text
https://api.example.com/v1/orders/42
~~~

Relative references поширені в browsers, HTML, OpenAPI references та інших documents, навіть якщо final API request використовує fully resolved target.

### Path segments та API path parameters

URI path — sequence path segments, розділених `/`.

~~~text
/users/42/orders/7
~~~

В API documentation notation:

~~~text
/users/{userId}/orders/{orderId}
~~~

є **URI template або route template**, а не literal URI, який йде через network. Concrete request підставляє values:

~~~text
/users/42/orders/7
~~~

`userId` та `orderId` — API/router concepts, які називають **path parameters**. На рівні URI syntax network request містить звичайні path segments.

Path identity визначає application. `/users/42` та `/users/042` є різними URI paths, якщо server явно не визначив їх equivalent.

### Query strings та query parameters

URI syntax визначає один **query component** після `?`:

~~~text
/orders?status=open&page=2&sort=createdAt
~~~

Interpretation query як name-value pairs `status=open`, `page=2` — це application/framework convention. Common APIs використовують `&` для separation parameters і `=` між name та value, але RFC 3986 не задає universal query-parameter data model.

Це важливо для arrays та repeated values. APIs можуть визначати:

~~~text
?tag=api&tag=http
?tag=api,http
?filter[status]=open
~~~

Це різні serialization contracts і вони мають бути визначені API.

### Fragment identifiers

Fragment починається з `#`:

~~~text
https://docs.example.com/api#authentication
~~~

Fragment ідентифікує secondary part referenced representation для client. Browsers використовують fragments для page anchors та client-side routing.

Fragment **не входить у HTTP request target**. Для URL вище server отримає request без `#authentication`.

### Percent-encoding

URI syntax резервує частину characters для structural meaning. Bytes або characters, які не можуть бути передані directly або конфліктують із syntax, можуть бути представлені через **percent-encoding**:

~~~text
space → %20
/     → %2F коли slash є data, а не path separator
%     → %25 коли percent є data
~~~

Наприклад:

~~~text
/search?q=hello%20world
~~~

Percent-encoding не є encryption. Це лише representation data всередині URI syntax.

`+` також не є universal encoding space. Rule `+` → space походить з `application/x-www-form-urlencoded` conventions і залежить від context.

Encoding треба застосовувати на правильному component level. Якщо encode entire structured URL, можна випадково encode separators `?`, `&` або `/` і змінити meaning URI.

### Reserved та unreserved characters

RFC 3986 розрізняє **unreserved** і **reserved** characters.

Unreserved characters — letters, digits та:

~~~text
- . _ ~
~~~

Reserved characters можуть мати delimiter meaning:

~~~text
: / ? # [ ] @ ! $ & ' ( ) * + , ; =
~~~

Чи треба encode reserved character, залежить від того, чи він використовується як syntax або як data всередині component.

### Case sensitivity та normalization

URI comparison — це не просто "lowercase everything".

- scheme names, наприклад `https`, case-insensitive;
- DNS host names case-insensitive;
- path і query semantics контролюються server/application і можуть бути case-sensitive;
- percent-encoded representations іноді можна normalize, але careless normalization може змінити application або signature semantics;
- default ports іноді можна omit (`443` для HTTPS, `80` для HTTP), але system не має invent equivalence rules, яких немає в contract.

Ці hosts означають той самий DNS name:

~~~text
https://API.EXAMPLE.COM/
https://api.example.com/
~~~

Але ці paths не можна автоматично вважати equivalent:

~~~text
/Users/42
/users/42
~~~

### HTTP request target

Complete URL визначає location resource, але HTTP request не завжди передає complete URL у request line.

Normal HTTP/1.1 request прямо до origin server часто використовує **origin-form**:

~~~http
GET /v1/users/42?include=roles HTTP/1.1
Host: api.example.com
~~~

Request target — `/v1/users/42?include=roles`; host authority передається в `Host` header. Інші request-target forms існують для proxies, `CONNECT` та server-wide `OPTIONS` requests.

Основне distinction:

```diagram
Full URL / URI
  ├─ scheme
  ├─ authority
  ├─ path
  ├─ query
  └─ fragment

HTTP request target
  └─ зазвичай path + optional query для direct origin requests
```

Fragment ніколи не входить у HTTP request target.

### URI templates

APIs та specifications часто описують families URIs через templates:

~~~text
/users/{userId}
/orders/{orderId}/items{?page,limit}
~~~

Braces описують variables template. Це не literal path characters resolved request URI. OpenAPI path templates використовують цей concept для path parameters, а general URI Template syntax окремо standardized в RFC 6570.

### Addressing та resource identity

Resource і його representation не обов'язково одне й те саме. Один resource URI може повертати різні representations залежно від headers `Accept` або `Accept-Language`, а query parameters можуть ідентифікувати filtered view або інший resource відповідно до API contract.

URI визначає **що ідентифікується**. HTTP methods та headers далі визначають **яка operation запитується і за яких conditions**.
