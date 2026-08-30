### URI, URL and URN

**URI (Uniform Resource Identifier)** is the general standards term for a sequence of characters that identifies a resource. A URI can identify a resource by location, by name, or by another scheme-specific mechanism.

**URL (Uniform Resource Locator)** is the familiar location-oriented use of a URI: it identifies a resource through a scheme and access location, for example `https://api.example.com/users/42`.

**URN (Uniform Resource Name)** uses the `urn:` URI scheme for persistent, location-independent names, for example `urn:isbn:9780131103627`.

The terms are related rather than three independent syntaxes. In modern standards, **URI** is the broad generic concept; HTTP commonly works with `http` and `https` URIs, which are normally called URLs in everyday use.

| Term | Example | Main idea |
| --- | --- | --- |
| URI | `https://api.example.com/users/42` | General resource identifier |
| URL | `https://api.example.com/users/42` | URI used as a network location |
| URN | `urn:isbn:9780131103627` | URI using the `urn` naming scheme |

### Generic URI components

RFC 3986 defines the generic hierarchical form as:

~~~text
scheme://authority/path?query#fragment
~~~

A more complete example is:

~~~text
https://api.example.com:8443/v1/users/42?include=roles#details
\___/   \__________________/ \___________/ \___________/ \_____/
scheme        authority           path          query      fragment
~~~

The **authority** can itself contain host information and an optional port. URI syntax also permits user-info, but embedding credentials in URLs is unsafe and should not be used for API secrets.

For HTTP APIs, the common pieces are:

- **scheme** — normally `http` or `https`;
- **host** — DNS name or IP literal identifying the server authority;
- **port** — explicit network port when a non-default or intentionally explicit port is used;
- **path** — hierarchical resource path;
- **query** — additional request data associated with the target;
- **fragment** — client-side identifier inside a representation; it is not sent as part of the HTTP request target.

### Absolute URIs and relative references

An **absolute URI** contains a scheme:

~~~text
https://api.example.com/v1/orders/42
~~~

A **relative reference** is resolved against a base URI:

~~~text
../orders/42
?status=open
#details
~~~

Given the base URI:

~~~text
https://api.example.com/v1/users/
~~~

`../orders/42` resolves to:

~~~text
https://api.example.com/v1/orders/42
~~~

Relative references are common in browsers, HTML, OpenAPI references and other documents even when API requests eventually use a fully resolved target.

### Path segments and API path parameters

A URI path is a sequence of path segments separated by `/`.

~~~text
/users/42/orders/7
~~~

In API documentation, a notation such as:

~~~text
/users/{userId}/orders/{orderId}
~~~

is a **URI template or route template**, not the literal URI sent over the network. A concrete request substitutes values:

~~~text
/users/42/orders/7
~~~

`userId` and `orderId` are therefore API/router concepts called **path parameters**. At the URI syntax level, the network request contains ordinary path segments.

Path identity is application-defined. `/users/42` and `/users/042` are different URI paths unless the server explicitly defines them as equivalent.

### Query strings and query parameters

The URI syntax defines one **query component** after `?`:

~~~text
/orders?status=open&page=2&sort=createdAt
~~~

Interpreting that query as name-value pairs such as `status=open` and `page=2` is an application/framework convention. Common APIs use `&` to separate parameters and `=` to separate names from values, but RFC 3986 does not define a universal query-parameter data model.

This matters for arrays and repeated values. APIs may define forms such as:

~~~text
?tag=api&tag=http
?tag=api,http
?filter[status]=open
~~~

These are different serialization contracts and must be defined by the API.

### Fragment identifiers

A fragment begins with `#`:

~~~text
https://docs.example.com/api#authentication
~~~

The fragment identifies a secondary part of the referenced representation for the client. Browsers use fragments for page anchors and client-side routing.

The fragment is **not included in the HTTP request target**. For the URL above, the server receives the resource request without `#authentication`.

### Percent-encoding

URI syntax reserves some characters for structural meaning. Bytes that cannot appear directly, or characters that would otherwise conflict with syntax, can be represented using **percent-encoding**:

~~~text
space → %20
/     → %2F when encoded as data rather than used as a path separator
%     → %25 when the percent character itself is data
~~~

For example:

~~~text
/search?q=hello%20world
~~~

Percent-encoding is not the same as encryption. It only represents data safely inside URI syntax.

`+` is also not a universal URI encoding for a space. The `+` → space rule comes from `application/x-www-form-urlencoded` conventions and is context-dependent.

Encoding must be applied at the correct component level. Encoding an entire already-structured URL can accidentally encode separators such as `?`, `&` or `/` and change its meaning.

### Reserved and unreserved characters

RFC 3986 distinguishes **unreserved** characters from **reserved** characters.

Unreserved characters are letters, digits and:

~~~text
- . _ ~
~~~

Reserved characters have possible delimiter meaning:

~~~text
: / ? # [ ] @ ! $ & ' ( ) * + , ; =
~~~

Whether a reserved character should be encoded depends on whether it is being used as syntax or as data inside a component.

### Case sensitivity and normalization

URI comparison is not simply "lowercase everything".

- scheme names such as `https` are case-insensitive;
- DNS host names are case-insensitive;
- path and query semantics are generally controlled by the server/application and can be case-sensitive;
- percent-encoded representations can sometimes be normalized, but careless normalization can change application or signature semantics;
- default ports can sometimes be omitted (`443` for HTTPS, `80` for HTTP), but systems should not invent equivalence rules that their contract does not define.

For example, these hosts identify the same DNS name:

~~~text
https://API.EXAMPLE.COM/
https://api.example.com/
~~~

But these paths must not be assumed equivalent:

~~~text
/Users/42
/users/42
~~~

### HTTP request target

A complete URL identifies where a resource lives, but an HTTP request does not always transmit the complete URL in the request line.

A normal HTTP/1.1 request sent directly to an origin server commonly uses **origin-form**:

~~~http
GET /v1/users/42?include=roles HTTP/1.1
Host: api.example.com
~~~

The request target is `/v1/users/42?include=roles`; the host authority is carried by the `Host` header. Other request-target forms exist for proxies, `CONNECT`, and server-wide `OPTIONS` requests.

The important distinction is:

```diagram
Full URL / URI
  ├─ scheme
  ├─ authority
  ├─ path
  ├─ query
  └─ fragment

HTTP request target
  └─ normally path + optional query for direct origin requests
```

The fragment is never part of the HTTP request target.

### URI templates

APIs and specifications often describe families of URIs using templates:

~~~text
/users/{userId}
/orders/{orderId}/items{?page,limit}
~~~

The braces describe variables in a template. They are not literal path characters in a resolved request URI. OpenAPI path templates use this concept for path parameters, while the more general URI Template syntax is standardized separately in RFC 6570.

### Addressing and resource identity

A resource and its representation are not necessarily the same thing. One resource URI can return different representations depending on headers such as `Accept` or `Accept-Language`, while query parameters can identify a different filtered view or resource according to the API contract.

The URI tells the system **what is being identified**. HTTP methods and headers then describe **what operation is requested and under what conditions**.
