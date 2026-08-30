# API Contracts & Schemas

An API contract describes the interface that a consumer can rely on when communicating with a service. It is broader than a schema. A schema describes the structure of data; a contract also includes operations, parameters, status codes, headers, authentication requirements, media types and behavioral expectations.

A useful contract answers these questions:

- which operations exist;
- how resources or operations are addressed;
- which inputs are accepted;
- which outputs can be returned;
- which errors are defined;
- which authentication and authorization rules apply;
- which compatibility guarantees consumers can rely on.

## Contract layers

An HTTP API contract usually contains several layers.

| Layer | Examples |
| --- | --- |
| Endpoint | `/users/{userId}`, `/orders` |
| HTTP semantics | GET, POST, PATCH, status codes |
| Parameters | path, query, header and cookie parameters |
| Request body | JSON, XML, multipart, binary content |
| Response body | representations and error documents |
| Headers | Content-Type, Location, ETag, Retry-After |
| Authentication | Bearer token, API key, OAuth scopes |
| Data schema | types, required fields, enums, constraints |
| Behavioral rules | idempotency, pagination, concurrency, async processing |
| Compatibility | versioning, deprecation, additive and breaking changes |

A machine-readable specification can capture much of this contract, but it cannot express every business invariant or distributed-system behavior.

## OpenAPI

The OpenAPI Specification (OAS) is a language-independent description format for HTTP APIs. An OpenAPI document can be written as JSON or YAML and can be consumed by documentation, code-generation, validation and testing tools.

The main OpenAPI document contains objects such as:

- `openapi` — specification version;
- `info` — API metadata;
- `servers` — server locations;
- `paths` — operations grouped by path;
- `components` — reusable schemas, parameters, responses, headers and security schemes;
- `security` — authentication requirements.

A minimal document can look like this:

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

## Paths and operations

`paths` maps URI templates to HTTP operations.

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

The path `/orders/{orderId}` is a template. A concrete request URI contains a value such as `/orders/42`.

OpenAPI operations can define:

- parameters;
- request bodies;
- responses;
- security requirements;
- tags;
- summaries and descriptions;
- callbacks and links;
- operation-specific servers.

## Parameters

OpenAPI distinguishes four parameter locations:

| Location | Example | Typical purpose |
| --- | --- | --- |
| path | `/users/{id}` | Resource identity |
| query | `?page=2&status=open` | Filtering, pagination, optional controls |
| header | `If-Match: "v7"` | Metadata and protocol/application conditions |
| cookie | `session=...` | Cookie-carried values |

A path parameter must be required because the concrete path cannot be formed without it.

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

Parameter serialization also matters. Arrays and objects can be represented in different ways depending on the parameter location and the OpenAPI `style` and `explode` rules.

## Request bodies

A request body is described separately from parameters.

~~~yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        $ref: "#/components/schemas/CreateOrder"
~~~

The `content` map allows one operation to support multiple media types.

~~~yaml
content:
  application/json:
    schema:
      $ref: "#/components/schemas/DocumentMetadata"
  application/xml:
    schema:
      $ref: "#/components/schemas/DocumentMetadata"
~~~

For file uploads, the contract can describe binary bodies or `multipart/form-data` parts.

## Responses

Responses are keyed by HTTP status code or response ranges/default rules supported by the specification.

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

A response contract can therefore describe status, headers and body together.

## Reusable components and references

`components` stores reusable contract elements.

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

`$ref` points to another schema or component instead of repeating it.

~~~yaml
schema:
  $ref: "#/components/schemas/Money"
~~~

References can be local or external. External references introduce another dependency: tooling must resolve the referenced document and its base URI correctly.

## JSON Schema

JSON Schema is a specification for describing and validating the structure of JSON data. The current published JSON Schema version is Draft 2020-12.

A schema can define types and structural constraints:

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

Important JSON Schema concepts include:

- `$schema` — declares the schema dialect;
- `$id` — establishes an identifier/base URI;
- `$ref` — references another schema;
- `type` — allowed JSON type or types;
- `properties` — schemas for object properties;
- `required` — property names that must exist;
- `additionalProperties` and `unevaluatedProperties` — control properties not otherwise described;
- `items` and `prefixItems` — array item schemas;
- `minimum`, `maximum`, `minLength`, `maxLength`, `pattern` — value constraints;
- `enum` and `const` — allowed fixed values;
- `allOf`, `anyOf`, `oneOf`, `not` — schema composition.

## Required, optional, nullable and absent

These concepts are different.

Consider:

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

- `name` must be present and must be a string.
- `middleName` may be absent because it is not in `required`.
- when `middleName` is present, it may be either a string or JSON `null`.

"Optional" therefore means the member can be absent. "Nullable" means `null` is one of its allowed values.

OpenAPI 3.1 and later use JSON Schema-style type semantics. OpenAPI 3.0 used a separate `nullable` keyword, so schema behavior must be interpreted according to the OpenAPI version being processed.

## Types, formats and semantic meaning

A schema type constrains the JSON representation. A `format` usually adds semantic information such as `date-time`, `uuid`, `email`, `uri` or `ipv4`.

Format handling is not identical across all validators. A contract should not rely on an annotation alone when a business rule requires stricter validation.

For example, this schema can express that a value looks like a date:

~~~json
{ "type": "string", "format": "date" }
~~~

It cannot by itself express every business rule such as "the date must be a working day no more than 30 days in the future". Such rules remain part of application semantics.

## Enums and closed sets

An enum defines a finite set of accepted values.

~~~json
{
  "type": "string",
  "enum": ["pending", "approved", "rejected"]
}
~~~

Enums affect compatibility. Adding a new response enum value can break a consumer that assumes the original set is exhaustive, even though the response schema appears only to have become broader.

Contracts therefore need compatibility rules, not only schema validity.

## Composition

Schema composition describes alternatives and combinations.

### allOf

All referenced schemas must apply.

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

At least one subschema must match.

### oneOf

Exactly one subschema must match.

### not

The instance must not match the supplied schema.

Composition is useful, but heavily overlapping `oneOf` branches can make contracts difficult for both people and tooling to interpret.

## Examples and defaults

An example illustrates a value; it does not automatically constrain all valid values.

A default is a semantic annotation describing a value that may be assumed or supplied when a value is absent. A default is not equivalent to `required`, and validators do not universally insert defaults into data.

A contract should therefore distinguish clearly between:

- validation constraints;
- examples;
- default behavior;
- server-side business rules.

## Error contracts

Errors are part of the API contract.

A consistent error representation can define fields such as:

~~~json
{
  "type": "https://api.example.com/problems/invalid-order",
  "title": "Invalid order",
  "status": 422,
  "detail": "Quantity must be greater than zero",
  "instance": "/orders/8f4f..."
}
~~~

The schema should not treat every non-2xx response as an unstructured string. Error status codes, media types, fields and stable machine-readable identifiers are consumer-facing behavior.

## Contract compatibility

A change can be schema-valid and still break existing consumers.

Typical breaking changes include:

- removing an operation;
- changing an HTTP method or path;
- adding a required request parameter;
- adding a required request body field;
- removing a response field consumers rely on;
- changing a field type;
- narrowing an accepted input range;
- changing authentication requirements;
- changing status-code semantics;
- renaming an enum value;
- changing pagination or idempotency behavior.

Changes that are often additive include:

- adding a new endpoint;
- adding an optional request field;
- adding an optional response field;
- adding a new optional response header.

Even additive changes need a documented compatibility model. Strict consumers, generated clients and exhaustive enum handling can make apparently safe changes incompatible.

## Backward and forward compatibility

**Backward compatibility** means a newer provider remains usable by existing consumers according to the supported contract.

**Forward compatibility** means a consumer can tolerate compatible data or behavior introduced by a newer provider.

Compatibility depends on direction. For example, allowing a new optional request field broadens what the server accepts, while making a previously optional field required narrows the accepted input contract.

## API versioning

There is no single universal HTTP API versioning mechanism. Common strategies include:

- path versioning: `/v2/orders`;
- media-type/content-negotiation versioning;
- custom request headers;
- query parameters.

Versioning does not remove the need for compatibility management. A version should represent a meaningful contract boundary, not become a replacement for disciplined change control.

## Deprecation and lifecycle

A mature contract has a lifecycle:

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

Deprecation should identify what is being replaced, when support changes, and how consumers can migrate. OpenAPI operations and schemas can carry deprecation metadata, while the operational retirement policy remains an organizational/API lifecycle decision.

## Schema validation and business validation

Schema validation answers questions such as:

- is the value a string or number;
- is a property required;
- is the string within a length range;
- does an enum contain the value;
- does the object have unexpected fields.

Business validation answers questions such as:

- does the referenced customer exist;
- is the order state transition allowed;
- does the user have permission to change this object;
- is the account balance sufficient;
- is the requested date valid for this business process.

A valid schema therefore does not imply a valid business operation.

## Sources

- [OpenAPI Specification 3.2.0](https://spec.openapis.org/oas/v3.2.0.html)
- [OpenAPI Specification — published versions](https://spec.openapis.org/oas/)
- [JSON Schema — Specification](https://json-schema.org/specification)
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)
- [RFC 3986 — Uniform Resource Identifier (URI): Generic Syntax](https://www.rfc-editor.org/rfc/rfc3986.html)
- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
