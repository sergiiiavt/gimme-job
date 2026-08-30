# API Contracts & Schemas

API contract описує interface, на який consumer може покладатися під час взаємодії із service. Contract ширший за schema. Schema описує структуру data; contract також включає operations, parameters, status codes, headers, authentication requirements, media types і behavioral expectations.

Повноцінний contract відповідає на такі питання:

- які operations існують;
- як адресуються resources або operations;
- які inputs приймаються;
- які outputs можуть повертатися;
- які errors визначені;
- які authentication та authorization rules застосовуються;
- на які compatibility guarantees можуть розраховувати consumers.

## Contract layers

HTTP API contract зазвичай має кілька рівнів.

| Layer | Приклади |
| --- | --- |
| Endpoint | `/users/{userId}`, `/orders` |
| HTTP semantics | GET, POST, PATCH, status codes |
| Parameters | path, query, header і cookie parameters |
| Request body | JSON, XML, multipart, binary content |
| Response body | representations і error documents |
| Headers | Content-Type, Location, ETag, Retry-After |
| Authentication | Bearer token, API key, OAuth scopes |
| Data schema | types, required fields, enums, constraints |
| Behavioral rules | idempotency, pagination, concurrency, async processing |
| Compatibility | versioning, deprecation, additive і breaking changes |

Machine-readable specification може описати значну частину contract, але не всі business invariants або distributed-system behavior.

## OpenAPI

OpenAPI Specification (OAS) — language-independent формат опису HTTP APIs. OpenAPI document може бути JSON або YAML і використовуватись documentation, code-generation, validation та testing tools.

Основні частини OpenAPI document:

- `openapi` — version specification;
- `info` — metadata API;
- `servers` — locations servers;
- `paths` — operations, згруповані за path;
- `components` — reusable schemas, parameters, responses, headers і security schemes;
- `security` — authentication requirements.

Мінімальний document може виглядати так:

~~~yaml
openapi: 3.2.0
info:
  title: Users API
  version: 1.0.0
servers:
  - url: https://api.example.com
paths:
  /users/{userId}:
    get:
      operationId: getUser
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: User found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "404":
          description: User not found
components:
  schemas:
    User:
      type: object
      required: [id, name]
      properties:
        id:
          type: string
        name:
          type: string
~~~

## Paths та operations

`paths` мапить URI templates на HTTP operations.

~~~yaml
paths:
  /orders/{orderId}:
    get:
      operationId: getOrder
    patch:
      operationId: updateOrder
    delete:
      operationId: deleteOrder
~~~

Path `/orders/{orderId}` — це template. Concrete request URI містить реальне value, наприклад `/orders/42`.

OpenAPI operation може визначати:

- parameters;
- request bodies;
- responses;
- security requirements;
- tags;
- summaries та descriptions;
- callbacks і links;
- operation-specific servers.

## Parameters

OpenAPI розрізняє чотири locations parameters:

| Location | Приклад | Типова роль |
| --- | --- | --- |
| path | `/users/{id}` | Resource identity |
| query | `?page=2&status=open` | Filtering, pagination, optional controls |
| header | `If-Match: "v7"` | Metadata і protocol/application conditions |
| cookie | `session=...` | Cookie-carried values |

Path parameter завжди required, тому що без нього неможливо сформувати concrete path.

~~~yaml
parameters:
  - name: page
    in: query
    required: false
    schema:
      type: integer
      minimum: 1
      default: 1
~~~

Parameter serialization також є частиною contract. Arrays і objects можуть представлятися по-різному залежно від location та OpenAPI `style`/`explode` rules.

## Request bodies

Request body описується окремо від parameters.

~~~yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        $ref: "#/components/schemas/CreateOrder"
~~~

`content` map дозволяє одній operation підтримувати кілька media types.

~~~yaml
content:
  application/json:
    schema:
      $ref: "#/components/schemas/DocumentMetadata"
  application/xml:
    schema:
      $ref: "#/components/schemas/DocumentMetadata"
~~~

Для file uploads contract може описувати binary body або `multipart/form-data` parts.

## Responses

Responses описуються за HTTP status codes або response ranges/default rules, які підтримує specification.

~~~yaml
responses:
  "201":
    description: Order created
    headers:
      Location:
        schema:
          type: string
          format: uri-reference
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/Order"
  "422":
    description: Validation failed
    content:
      application/problem+json:
        schema:
          $ref: "#/components/schemas/Problem"
~~~

Response contract може одночасно описувати status, headers і body.

## Reusable components та references

`components` містить reusable contract elements.

~~~yaml
components:
  schemas:
    Money:
      type: object
      required: [amount, currency]
      properties:
        amount:
          type: number
        currency:
          type: string
          pattern: "^[A-Z]{3}$"
~~~

`$ref` посилається на іншу schema або component замість дублювання.

~~~yaml
schema:
  $ref: "#/components/schemas/Money"
~~~

References можуть бути local або external. External references додають dependency: tooling має правильно resolve referenced document та його base URI.

## JSON Schema

JSON Schema — specification для опису та validation структури JSON data. Поточна published version — Draft 2020-12.

Schema може визначати types і structural constraints:

~~~json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/schemas/user.json",
  "type": "object",
  "required": ["id", "email"],
  "properties": {
    "id": { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "age": { "type": "integer", "minimum": 0 },
    "status": { "enum": ["active", "disabled"] }
  },
  "additionalProperties": false
}
~~~

Важливі JSON Schema concepts:

- `$schema` — оголошує schema dialect;
- `$id` — задає identifier/base URI;
- `$ref` — reference на іншу schema;
- `type` — допустимий JSON type або types;
- `properties` — schemas для object properties;
- `required` — property names, які мають існувати;
- `additionalProperties` та `unevaluatedProperties` — контроль properties, не описаних іншими rules;
- `items` та `prefixItems` — schemas elements arrays;
- `minimum`, `maximum`, `minLength`, `maxLength`, `pattern` — value constraints;
- `enum` та `const` — fixed allowed values;
- `allOf`, `anyOf`, `oneOf`, `not` — schema composition.

## Required, optional, nullable та absent

Це різні concepts.

~~~json
{
  "type": "object",
  "required": ["name"],
  "properties": {
    "name": { "type": "string" },
    "middleName": { "type": ["string", "null"] }
  }
}
~~~

- `name` має бути присутнім і бути string.
- `middleName` може бути absent, тому що його немає в `required`.
- якщо `middleName` присутній, його value може бути string або JSON `null`.

Отже, "optional" означає, що member може бути відсутнім. "Nullable" означає, що `null` є одним із допустимих values.

OpenAPI 3.1+ використовує JSON Schema-style type semantics. OpenAPI 3.0 мав окремий `nullable` keyword, тому schema behavior треба трактувати відповідно до version OpenAPI document.

## Types, formats та semantic meaning

Schema type обмежує JSON representation. `format` зазвичай додає semantic information, наприклад `date-time`, `uuid`, `email`, `uri` або `ipv4`.

Format handling не однаковий у всіх validators. Contract не повинен покладатися лише на annotation, якщо business rule вимагає строгішої validation.

Наприклад:

~~~json
{ "type": "string", "format": "date" }
~~~

Це може описати representation date, але не business rule типу "date має бути working day і не більше ніж 30 днів у майбутньому".

## Enums та closed sets

Enum визначає finite set allowed values.

~~~json
{
  "type": "string",
  "enum": ["pending", "approved", "rejected"]
}
~~~

Enums впливають на compatibility. Додавання нового response enum value може зламати consumer, який вважає initial set exhaustive, навіть якщо response schema формально стала ширшою.

Тому API contract потребує compatibility rules, а не лише schema validity.

## Composition

Schema composition описує alternatives та combinations.

### allOf

Усі referenced schemas мають застосовуватись.

~~~json
{
  "allOf": [
    { "$ref": "base-user.json" },
    {
      "type": "object",
      "properties": {
        "role": { "type": "string" }
      }
    }
  ]
}
~~~

### anyOf

Має match-итись щонайменше одна subschema.

### oneOf

Має match-итись рівно одна subschema.

### not

Instance не повинен match supplied schema.

Composition корисний, але сильно overlapping `oneOf` branches ускладнюють contract і для людей, і для tooling.

## Examples та defaults

Example ілюструє value; він не означає, що тільки це value є valid.

Default — semantic annotation value, яке може бути assumed або supplied при відсутності value. Default не дорівнює `required`, і validators не зобов'язані автоматично вставляти defaults у data.

Contract має чітко розрізняти:

- validation constraints;
- examples;
- default behavior;
- server-side business rules.

## Error contracts

Errors також є частиною API contract.

~~~json
{
  "type": "https://api.example.com/problems/invalid-order",
  "title": "Invalid order",
  "status": 422,
  "detail": "Quantity must be greater than zero",
  "instance": "/orders/8f4f..."
}
~~~

Non-2xx responses не повинні автоматично трактуватись як unstructured strings. Error status codes, media types, fields та stable machine-readable identifiers — consumer-facing behavior.

## Contract compatibility

Change може бути schema-valid і водночас ламати existing consumers.

Типові breaking changes:

- видалення operation;
- зміна HTTP method або path;
- додавання required request parameter;
- додавання required request body field;
- видалення response field, на яке покладаються consumers;
- зміна field type;
- звуження accepted input range;
- зміна authentication requirements;
- зміна status-code semantics;
- rename enum value;
- зміна pagination або idempotency behavior.

Changes, які часто є additive:

- новий endpoint;
- optional request field;
- optional response field;
- optional response header.

Навіть additive changes потребують documented compatibility model. Strict consumers, generated clients та exhaustive enum handling можуть зробити формально safe change incompatible.

## Backward та forward compatibility

**Backward compatibility** означає, що newer provider залишається usable existing consumers відповідно до supported contract.

**Forward compatibility** означає, що consumer може tolerate compatible data або behavior, які з'являться у newer provider.

Compatibility залежить від direction. Наприклад, новий optional request field розширює accepted input, а перетворення optional field на required звужує contract.

## API versioning

У HTTP APIs немає одного universal versioning mechanism. Поширені strategies:

- path versioning: `/v2/orders`;
- media-type/content-negotiation versioning;
- custom request headers;
- query parameters.

Versioning не замінює compatibility management. Version має бути meaningful contract boundary, а не спосіб уникати disciplined change control.

## Deprecation та lifecycle

Mature contract має lifecycle:

```diagram
Design
  ↓
Publish
  ↓
Consume
  ↓
Evolve compatibly
  ↓
Deprecate
  ↓
Retire
```

Deprecation має пояснювати, що замінюється, коли support зміниться і як consumers можуть migrate. OpenAPI operations та schemas можуть містити deprecation metadata, але operational retirement policy залишається рішенням API lifecycle.

## Schema validation та business validation

Schema validation відповідає на питання:

- чи value є string або number;
- чи property required;
- чи string у допустимому length range;
- чи enum містить value;
- чи object має unexpected fields.

Business validation відповідає на питання:

- чи існує referenced customer;
- чи дозволений order state transition;
- чи має user permission змінити object;
- чи достатній account balance;
- чи допустима requested date для business process.

Valid schema не означає valid business operation.

## Sources

- [OpenAPI Specification 3.2.0](https://spec.openapis.org/oas/v3.2.0.html)
- [OpenAPI Specification — published versions](https://spec.openapis.org/oas/)
- [JSON Schema — Specification](https://json-schema.org/specification)
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)
- [RFC 3986 — Uniform Resource Identifier (URI): Generic Syntax](https://www.rfc-editor.org/rfc/rfc3986.html)
- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
