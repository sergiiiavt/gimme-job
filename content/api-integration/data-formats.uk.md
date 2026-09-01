# Формати даних та serialization

API обмінюються bytes, але ці bytes зазвичай представляють структуровані дані. Формат визначає, як client і server мають ці дані інтерпретувати.

## JSON

JSON — це текстовий формат обміну даними. Це не те саме, що object у Python, JavaScript, C# чи іншій мові програмування.

JSON може містити шість типів значень:

| JSON value | Приклад |
| --- | --- |
| string | `"Alice"` |
| number | `42`, `3.14` |
| boolean | `true`, `false` |
| null | `null` |
| object | `{"name":"Alice"}` |
| array | `[1,2,3]` |

Повний JSON document не зобов'язаний бути object. Верхнім рівнем також може бути array, string, number, boolean або `null`.

~~~json
{
  "name": "Alice",
  "age": 35,
  "active": true,
  "skills": ["Python", "C#"],
  "address": null
}
~~~

JSON не має окремого native типу date або datetime. Значення `"2026-09-01T12:00:00Z"` для JSON залишається string; саме API contract визначає, що цей string представляє дату і час.

JSON також не визначає окремі integer, float або decimal типи. У JSON є один тип `number`; більш конкретні numeric rules задаються application schema або мовою програмування.

## XML

XML — ще один текстовий формат для структурованих даних. Його структура складається з elements, attributes і text.

~~~xml
<user id="42">
  <name>Alice</name>
  <active>true</active>
</user>
~~~

XML є case-sensitive, а elements мають бути правильно вкладені та закриті. На відміну від JSON, XML сам по собі не задає JSON-подібні категорії object, array, number або boolean. Schema, наприклад XSD, може визначати data types і structural rules.

SOAP використовує XML, але SOAP, WSDL, XSD та XML namespaces розглядаються окремо у **SOAP та XML APIs**.

## Serialization та deserialization

**Serialization** перетворює application value або object у представлення для передачі, наприклад JSON чи XML. **Deserialization** розбирає це представлення назад у values, з якими працює application.

Наприклад, HTTP response може містити JSON bytes. Python client може deserialize їх у `dict`, а C# client — у class instance. Сам JSON не є ні Python dictionary, ні C# object.

## Media types

HTTP використовує `Content-Type`, щоб описати формат message content, а `Accept` — щоб повідомити server, які response formats client може обробити.

| Content | Типовий media type |
| --- | --- |
| JSON | `application/json` |
| XML | `application/xml` |
| Plain text | `text/plain` |
| HTML form fields | `application/x-www-form-urlencoded` |
| Multipart form / file upload | `multipart/form-data` |
| Arbitrary binary data | `application/octet-stream` |

HTTP-деталі `Content-Type`, `Accept`, request bodies та file upload залишаються у **HTTP та REST APIs**.

## Missing, null та empty — різні стани

Ці стани можуть мати різне значення в API contract:

~~~json
{"name": null}
~~~

~~~json
{"name": ""}
~~~

~~~json
{}
~~~

У першому випадку явно передається `null`, у другому — empty string, у третьому поле `name` взагалі відсутнє. Чи є ці варіанти валідними або еквівалентними, визначає API contract або schema.

## Sources

- RFC 8259 — The JavaScript Object Notation (JSON) Data Interchange Format
- RFC 7303 — XML Media Types
- RFC 9110 — HTTP Semantics
