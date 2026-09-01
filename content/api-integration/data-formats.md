# Data formats & serialization

APIs exchange bytes, but those bytes usually represent structured data. The format tells the client and server how to interpret that data.

## JSON

JSON is a text data-interchange format. It is not the same thing as an object from Python, JavaScript, C# or another programming language.

JSON can contain six kinds of values:

| JSON value | Example |
| --- | --- |
| string | `"Alice"` |
| number | `42`, `3.14` |
| boolean | `true`, `false` |
| null | `null` |
| object | `{"name":"Alice"}` |
| array | `[1,2,3]` |

A complete JSON document does not have to be an object. An array, string, number, boolean or `null` can also be the top-level value.

~~~json
{
  "name": "Alice",
  "age": 35,
  "active": true,
  "skills": ["Python", "C#"],
  "address": null
}
~~~

JSON has no native date or datetime type. A value such as `"2026-09-01T12:00:00Z"` is still a JSON string; the API contract defines that the string represents a date and time.

JSON also does not define separate integer, float or decimal value types. It has the single JSON `number` type; application schemas and programming languages can apply more specific numeric rules.

## XML

XML is another text format for structured data. Its structure is built from elements, attributes and text.

~~~xml
<user id="42">
  <name>Alice</name>
  <active>true</active>
</user>
~~~

XML is case-sensitive and elements must be correctly nested and closed. Unlike JSON, XML does not itself provide JSON-style object, array, number or boolean value categories. A schema such as XSD can define data types and structural rules.

SOAP uses XML, but SOAP, WSDL, XSD and XML namespaces are covered separately in **SOAP & XML APIs**.

## Serialization and deserialization

**Serialization** converts an application value or object into a transferable representation such as JSON or XML. **Deserialization** parses that representation back into values used by the application.

For example, an HTTP response may contain JSON bytes. A Python client can deserialize them into a `dict`; a C# client can deserialize the same JSON into a class instance. The JSON itself is neither a Python dictionary nor a C# object.

## Media types

HTTP uses `Content-Type` to describe the format of message content and `Accept` to tell the server which response formats the client can process.

| Content | Common media type |
| --- | --- |
| JSON | `application/json` |
| XML | `application/xml` |
| Plain text | `text/plain` |
| HTML form fields | `application/x-www-form-urlencoded` |
| Multipart form / file upload | `multipart/form-data` |
| Arbitrary binary data | `application/octet-stream` |

The HTTP details of `Content-Type`, `Accept`, request bodies and file upload remain in **HTTP & REST APIs**.

## Missing, null and empty are different

These states can mean different things in an API contract:

~~~json
{"name": null}
~~~

~~~json
{"name": ""}
~~~

~~~json
{}
~~~

The first explicitly sends `null`, the second sends an empty string, and the third omits `name` completely. Whether they are valid or equivalent is defined by the API contract or schema.

## Sources

- RFC 8259 — The JavaScript Object Notation (JSON) Data Interchange Format
- RFC 7303 — XML Media Types
- RFC 9110 — HTTP Semantics
