import httpApiDeepDive from "../testing-tools/http-api-deep-dive.json";
import websocketGuide from "./websocket-guide";

export type ApiIntegrationTopicStatus = "under-construction" | "published";

export interface ApiIntegrationTopic {
  id: string;
  label: string;
  labelUk: string;
  description: string;
  descriptionUk: string;
  status: ApiIntegrationTopicStatus;
  markdown: string;
  markdownUk: string;
}

const underConstruction = (
  id: string,
  label: string,
  labelUk: string,
  description: string,
  descriptionUk: string,
): ApiIntegrationTopic => ({
  id,
  label,
  labelUk,
  description,
  descriptionUk,
  status: "under-construction",
  markdown: `## Under construction\n\n${description}\n\nThis topic is reserved in the learning path and will be expanded into a complete source-backed chapter.`,
  markdownUk: `## У розробці\n\n${descriptionUk}\n\nЦей топік залишається у learning path і буде розгорнутий у повний розділ із перевіреними джерелами.`,
});

function trainingOnlyCopy(markdown: string) {
  return markdown
    .replace("## REST API interview deep dive", "## HTTP, REST & CORS foundations")
    .replace("## REST API — поглиблений блок для співбесід", "## HTTP, REST та CORS — основи")
    .replace("**Interview distinctions:**", "**Key distinctions:**")
    .replace("### Interview-ready summary\n\nA strong answer should mention that WebSocket provides", "### Key takeaways\n\nWebSocket provides")
    .replace("### Коротка відповідь для співбесіди", "### Ключові висновки");
}

const fileTransferGuideEn = String.raw`### How files are transferred through a REST API

**REST is not a file-transfer protocol.** REST is an architectural style. In a typical REST API, the actual transfer happens over **HTTP**, and the file is carried as bytes in the HTTP request or response body.

Think about an upload as an ordinary HTTP request with four parts:

1. **Method and URL** — for example \`POST /documents\`.
2. **Headers** — describe authentication, the body format, size and other metadata.
3. **Empty line** — separates HTTP headers from the body in the HTTP/1.x textual representation.
4. **Body** — contains the actual file bytes, or a multipart structure containing the file and additional fields.

The important header is **Content-Type**. It tells the server how to interpret the body. A PDF can be sent as \`application/pdf\`, a PNG as \`image/png\`, arbitrary binary data as \`application/octet-stream\`, or several different fields and files together as \`multipart/form-data\`.

#### 1. Raw binary upload — the request body is the file

This is the simplest model. The HTTP body contains only the file bytes.

~~~http
POST /documents HTTP/1.1
Host: api.example.com
Authorization: Bearer <token>
Content-Type: application/pdf
Content-Length: 248931

<248931 bytes of the PDF file>
~~~

There is no JSON wrapper around the file. The server reads the request body as a byte stream and stores or processes it according to the endpoint contract.

This model is useful when the endpoint accepts **one file and little or no additional metadata**. Metadata such as a document type can be sent in headers, query parameters, or a separate API request.

A client may also use \`PUT\` when the URL identifies the exact file resource being created or replaced:

~~~http
PUT /documents/123/content HTTP/1.1
Content-Type: application/pdf

<binary file bytes>
~~~

The HTTP method does not change how the bytes travel; it changes the semantics of the operation.

#### 2. multipart/form-data — file plus metadata in one request

When a client needs to send a file **together with normal fields or JSON metadata**, the common solution is \`multipart/form-data\`.

The request still has **one HTTP body**, but that body is divided into parts by a unique **boundary**. Each part has its own small set of headers and its own content.

For example, a profile request can contain a text field and an image in the same HTTP request:

~~~http
POST /profiles HTTP/1.1
Host: api.example.com
Content-Type: multipart/form-data; boundary=Boundary42

--Boundary42
Content-Disposition: form-data; name="displayName"

Alice
--Boundary42
Content-Disposition: form-data; name="avatar"; filename="avatar.png"
Content-Type: image/png

<binary PNG bytes>
--Boundary42--
~~~

The server processes it approximately like this:

- find each section using the boundary;
- read \`Content-Disposition\` to identify the field name and optional filename;
- read the part's \`Content-Type\` when it is a file or structured value;
- expose ordinary fields as form values and file parts as byte streams/files to the application.

A multipart request can also contain a JSON metadata part:

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

<binary PDF bytes>
--Boundary42--
~~~

This is usually the clearest option when the operation logically creates one resource from **file + metadata**.

#### 3. Base64 inside JSON — possible, but usually inefficient

Binary data can be encoded as Base64 and placed inside JSON:

~~~json
{
  "filename": "avatar.png",
  "contentType": "image/png",
  "data": "iVBORw0KGgoAAAANSUhEUgAA..."
}
~~~

This is easy to model in a JSON-only API, but Base64 makes the payload roughly **33% larger** before other overhead and requires extra encode/decode work. It is usually a poor choice for large files. Use it only when the API contract or surrounding transport requires textual JSON data.

#### 4. Large files — upload directly to object storage

For large files, production systems often avoid sending all bytes through the application API server.

A common flow is:

1. Client calls the REST API: \`POST /uploads\`.
2. API authenticates the user and creates an upload record.
3. API returns a short-lived **pre-signed upload URL** for object storage such as S3 or R2.
4. Client uploads the file bytes directly to object storage, usually with \`PUT\`.
5. Client calls the API again, or storage emits an event, to mark the upload as complete and associate metadata with the stored object.

This keeps large byte streams away from application servers and makes upload capacity easier to scale.

#### What happens when a file is downloaded?

Download is the same idea in the opposite direction: the **HTTP response body contains the file bytes**.

~~~http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Length: 248931
Content-Disposition: attachment; filename="contract.pdf"

<248931 bytes of the PDF file>
~~~

\`Content-Type\` tells the client what the bytes represent. \`Content-Disposition: attachment\` tells a browser that the response should normally be downloaded and can provide a filename. Large downloads may be streamed, and APIs can support **Range** requests so a client can request only part of a file.

#### What should an API tester verify?

Test more than just "the upload returned 200":

- accepted and rejected MIME types;
- file extension versus actual file content;
- zero-byte files and minimum/maximum sizes;
- exact size-limit boundary and oversized files;
- one versus multiple files;
- filenames with spaces, Unicode, long names and duplicate names;
- malformed multipart boundaries and missing parts;
- interrupted or retried uploads;
- duplicate requests and idempotency expectations;
- authentication and authorization for upload and download;
- whether one user can access another user's file;
- checksum/integrity when supported;
- correct \`Content-Type\`, \`Content-Length\` and \`Content-Disposition\` on download;
- cleanup of partially uploaded or orphaned files;
- pre-signed URL expiration, permissions and reuse rules.

**Key idea:** a REST API does not magically convert a file into JSON. The file is normally transferred as **binary bytes in an HTTP body**. Use a raw body when the body is only the file, \`multipart/form-data\` when file and metadata must travel together, and direct object-storage upload for large-scale file transfer.`;

const fileTransferGuideUk = String.raw`### Як файли передаються через REST API

**REST — це не протокол передачі файлів.** REST — це архітектурний стиль. У типовому REST API реальна передача відбувається через **HTTP**, а сам файл їде як набір байтів у body HTTP request або HTTP response.

Upload можна уявляти як звичайний HTTP request із чотирьох частин:

1. **Method та URL** — наприклад \`POST /documents\`.
2. **Headers** — описують authentication, формат body, розмір та інші параметри.
3. **Порожній рядок** — у текстовому представленні HTTP/1.x відділяє headers від body.
4. **Body** — містить безпосередньо байти файлу або multipart-структуру, всередині якої є файл і додаткові поля.

Ключовий header — **Content-Type**. Він повідомляє server, як трактувати body. PDF можна передати як \`application/pdf\`, PNG як \`image/png\`, довільні binary data як \`application/octet-stream\`, а кілька різних полів і файлів разом — як \`multipart/form-data\`.

#### 1. Raw binary upload — весь request body є файлом

Це найпростіший варіант. У body HTTP request знаходяться тільки байти файлу.

~~~http
POST /documents HTTP/1.1
Host: api.example.com
Authorization: Bearer <token>
Content-Type: application/pdf
Content-Length: 248931

<248931 байтів PDF-файлу>
~~~

Навколо файлу немає JSON. Server читає request body як потік байтів і зберігає або обробляє його відповідно до API contract.

Такий варіант зручний, коли endpoint приймає **один файл і майже не потребує додаткової metadata**. Наприклад, тип документа можна передати окремим header, query parameter або іншим API request.

Також може використовуватись \`PUT\`, якщо URL уже однозначно визначає файл, який створюється або замінюється:

~~~http
PUT /documents/123/content HTTP/1.1
Content-Type: application/pdf

<binary bytes файлу>
~~~

HTTP method не змінює спосіб фізичної передачі байтів; він задає semantics операції.

#### 2. multipart/form-data — файл і metadata в одному request

Коли разом із файлом треба передати **звичайні поля або JSON metadata**, найпоширеніший варіант — \`multipart/form-data\`.

HTTP request усе одно має **один body**, але цей body розбивається на окремі частини за допомогою унікального **boundary**. Кожна частина має власні невеликі headers і власний content.

Наприклад, одним request можна передати ім'я користувача та avatar:

~~~http
POST /profiles HTTP/1.1
Host: api.example.com
Content-Type: multipart/form-data; boundary=Boundary42

--Boundary42
Content-Disposition: form-data; name="displayName"

Alice
--Boundary42
Content-Disposition: form-data; name="avatar"; filename="avatar.png"
Content-Type: image/png

<binary PNG bytes>
--Boundary42--
~~~

На server це приблизно розбирається так:

- boundary визначає, де починається і закінчується кожна частина;
- \`Content-Disposition\` визначає name поля та, для file part, filename;
- \`Content-Type\` конкретної частини повідомляє тип файлу або structured content;
- звичайні частини application отримує як form fields, а file parts — як byte stream/file object.

У multipart можна передати й окрему JSON metadata part:

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

<binary PDF bytes>
--Boundary42--
~~~

Це зазвичай найзрозуміліший варіант, коли одна API operation логічно створює resource з **file + metadata**.

#### 3. Base64 всередині JSON — можливо, але зазвичай неефективно

Binary data можна закодувати в Base64 і покласти в JSON:

~~~json
{
  "filename": "avatar.png",
  "contentType": "image/png",
  "data": "iVBORw0KGgoAAAANSUhEUgAA..."
}
~~~

Це зручно для API, який принципово працює тільки з JSON, але Base64 збільшує payload приблизно на **33%** ще до іншого overhead і потребує додаткового encoding/decoding. Для великих файлів це зазвичай погане рішення. Його варто використовувати лише тоді, коли цього вимагає API contract або transport.

#### 4. Великі файли — direct upload в object storage

Для великих файлів production systems часто не пропускають усі байти через application API server.

Типовий flow:

1. Client викликає REST API: \`POST /uploads\`.
2. API перевіряє user та створює upload record.
3. API повертає короткоживучий **pre-signed upload URL** для object storage, наприклад S3 або R2.
4. Client напряму завантажує file bytes в object storage, зазвичай через \`PUT\`.
5. Потім client ще раз викликає API, або storage надсилає event, щоб підтвердити upload і прив'язати metadata до object.

Так великі byte streams не навантажують application servers, а file upload значно легше масштабувати.

#### А як файл завантажується з server до client?

Download працює так само, тільки у зворотний бік: **HTTP response body містить байти файлу**.

~~~http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Length: 248931
Content-Disposition: attachment; filename="contract.pdf"

<248931 байтів PDF-файлу>
~~~

\`Content-Type\` говорить client, що це за bytes. \`Content-Disposition: attachment\` повідомляє browser, що content треба зазвичай скачати як файл, і може передати filename. Великі файли можуть stream-итись, а через **Range** request client може запросити тільки частину файлу.

#### Що саме тестувати QA?

Не достатньо перевірити лише "upload повернув 200":

- дозволені та заборонені MIME types;
- file extension проти реального content файлу;
- zero-byte files та мінімальний/максимальний size;
- точну boundary умову size limit і файл на 1 byte більше;
- один та кілька files;
- filenames із пробілами, Unicode, дуже довгими та duplicate names;
- malformed multipart boundary і відсутні required parts;
- interrupted upload і retry;
- duplicate requests та очікувану idempotency;
- authentication/authorization для upload і download;
- чи може один user прочитати file іншого user;
- checksum/integrity, якщо підтримується;
- правильні \`Content-Type\`, \`Content-Length\`, \`Content-Disposition\` при download;
- cleanup incomplete/orphaned uploads;
- expiration, permissions та повторне використання pre-signed URL.

**Головна ідея:** REST API не перетворює файл магічно на JSON. Зазвичай файл передається як **binary bytes у HTTP body**. Raw body підходить, коли body — тільки файл; \`multipart/form-data\` — коли разом мають їхати file + metadata; direct object-storage upload — коли треба нормально працювати з великими файлами та масштабуванням.`;

function replaceMarkdownSection(markdown: string, startHeading: string, nextHeading: string, replacement: string) {
  const startIndex = markdown.indexOf(startHeading);
  if (startIndex < 0) return markdown;
  const nextIndex = markdown.indexOf(`\n${nextHeading}`, startIndex + startHeading.length);
  if (nextIndex < 0) return markdown;
  return `${markdown.slice(0, startIndex)}${replacement}${markdown.slice(nextIndex)}`;
}

function improveFileTransferGuide(markdown: string, language: "en" | "uk") {
  const startHeading = language === "uk"
    ? "### Як передати файл і чи можна разом з іншими даними?"
    : "### File upload: can a file be sent together with data?";
  return replaceMarkdownSection(markdown, startHeading, "### CORS: what it is and how it arises", language === "uk" ? fileTransferGuideUk : fileTransferGuideEn);
}

function makeStatusCodeGroupsExpandable(markdown: string) {
  const heading = "### HTTP status codes";
  const nextHeading = "### HTTP methods";
  const headingIndex = markdown.indexOf(heading);
  if (headingIndex < 0) return markdown;

  const bodyStart = headingIndex + heading.length;
  const nextHeadingIndex = markdown.indexOf(`\n${nextHeading}`, bodyStart);
  if (nextHeadingIndex < 0) return markdown;

  const before = markdown.slice(0, bodyStart);
  const bodyLines = markdown.slice(bodyStart, nextHeadingIndex).trim().split("\n");
  const after = markdown.slice(nextHeadingIndex);
  const tableHeader = bodyLines.slice(0, 2);
  const groups: { summary: string; rows: string[] }[] = [];
  let trailingStart = bodyLines.length;
  let currentGroup: { summary: string; rows: string[] } | null = null;

  for (let index = 2; index < bodyLines.length; index += 1) {
    const line = bodyLines[index];
    const groupMatch = line.match(/^\| \*\*([1-5]xx\s+—\s+.+?)\*\* \|\|$/);
    if (groupMatch) {
      currentGroup = { summary: groupMatch[1], rows: [] };
      groups.push(currentGroup);
      continue;
    }

    if (line.startsWith("|")) {
      currentGroup?.rows.push(line);
      continue;
    }

    if (line.trim()) {
      trailingStart = index;
      break;
    }
  }

  if (groups.length !== 5) return markdown;

  const expandableGroups = groups
    .map((group) => `:::details ${group.summary}\n\n<!-- flush-table -->\n${tableHeader.join("\n")}\n${group.rows.join("\n")}\n\n:::`)
    .join("\n\n");
  const trailing = bodyLines.slice(trailingStart).join("\n").trim();
  const trailingBlock = trailing ? `\n\n${trailing}` : "";

  return `${before}\n\n${expandableGroups}${trailingBlock}${after}`;
}

const httpMarkdown = makeStatusCodeGroupsExpandable(improveFileTransferGuide(trainingOnlyCopy(httpApiDeepDive.markdown), "en"));
const httpMarkdownUk = makeStatusCodeGroupsExpandable(improveFileTransferGuide(trainingOnlyCopy(httpApiDeepDive.markdownUk), "uk"));
const websocketMarkdown = trainingOnlyCopy(websocketGuide.markdown);
const websocketMarkdownUk = trainingOnlyCopy(websocketGuide.markdownUk);

export const catalog = {
  title: "API & integration testing",
  titleUk: "API та інтеграційне тестування",
  description: "Protocols, contracts, authentication, data exchange, distributed state and failure handling between systems.",
  descriptionUk: "Протоколи, контракти, authentication, обмін даними, distributed state та обробка збоїв між системами.",
  topics: [
    underConstruction(
      "contracts-and-schemas",
      "Contracts and schemas",
      "Контракти та схеми",
      "OpenAPI, GraphQL, compatibility, consumer expectations and schema-based validation.",
      "OpenAPI, GraphQL, compatibility, очікування consumers та schema-based validation.",
    ),
    underConstruction(
      "identity-and-authorization",
      "Identity and authorization",
      "Identity та authorization",
      "Authentication, sessions, scopes, roles, tenants and server-side object access.",
      "Authentication, sessions, scopes, roles, tenants та server-side object access.",
    ),
    underConstruction(
      "messaging-and-events",
      "Messaging and events",
      "Messaging та events",
      "Queues, delivery semantics, ordering, duplication, retries and eventual consistency.",
      "Queues, delivery semantics, ordering, duplication, retries та eventual consistency.",
    ),
    underConstruction(
      "failure-behaviour",
      "Failure behaviour",
      "Поведінка при збоях",
      "Timeouts, partial responses, dependency degradation, rate limits and safe recovery.",
      "Timeouts, partial responses, dependency degradation, rate limits та safe recovery.",
    ),
    {
      id: "http-foundations",
      label: "HTTP, REST & CORS foundations",
      labelUk: "HTTP, REST та CORS — основи",
      description: "Training reference for HTTP and REST: methods, concrete status codes, headers, authentication, file upload, multipart data, CORS and debugging.",
      descriptionUk: "Навчальний довідник з HTTP та REST: methods, конкретні status codes, headers, authentication, file upload, multipart data, CORS та debugging.",
      status: "published" as const,
      markdown: httpMarkdown,
      markdownUk: httpMarkdownUk,
    },
    {
      id: "websocket",
      label: "WebSocket: build, test & debug",
      labelUk: "WebSocket: реалізація, тестування та debug",
      description: "A complete QA guide to WebSocket use cases, handshake and frames, client/server implementation, reconnects, heartbeats, authentication, security, performance and test automation.",
      descriptionUk: "Повний QA guide з WebSocket: use cases, handshake і frames, client/server implementation, reconnects, heartbeats, authentication, security, performance та test automation.",
      status: "published" as const,
      markdown: websocketMarkdown,
      markdownUk: websocketMarkdownUk,
    },
  ],
};

export default catalog;
