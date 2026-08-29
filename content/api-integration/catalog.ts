import httpApiDeepDive from "../testing-tools/http-api-deep-dive.json";
import { improveFileTransferGuide } from "./file-transfer-guide";
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

function normalizeLearningMarkdown(markdown: string) {
  return markdown
    .replaceAll("\\`", "`")
    .replace(/^####\s+/gm, "### ");
}

function clarifyBinaryFileMeaning(markdown: string, language: "en" | "uk") {
  const anchor = language === "uk"
    ? "**REST — це не протокол передачі файлів.** REST — це архітектурний стиль. У типовому REST API реальна передача відбувається через **HTTP**, а сам файл їде як набір байтів у body HTTP request або HTTP response."
    : "**REST is not a file-transfer protocol.** REST is an architectural style. In a typical REST API, the actual transfer happens over **HTTP**, and the file is carried as bytes in the HTTP request or response body.";
  if (!markdown.includes(anchor)) return markdown;

  const explanation = language === "uk"
    ? `${anchor}\n\n### Що насправді означає binary і коли файл ним стає?\n\n**Файл не стає binary у browser. Він уже є bytes ще до drag-and-drop.** На SSD/HDD файл зберігається як послідовність байтів. Кожен byte — це число від 0 до 255; на рівні bits це вісім значень 0/1. Наприклад, початок JPEG може виглядати як **FF D8 FF E0 ...** у hexadecimal notation. Це не окрема «binary версія» картинки — це і є дані картинки у форматі JPEG.\n\nКоли ти перетягуєш **photo.jpg** у поле upload, відбувається приблизно так:\n\n1. **До drag-and-drop:** photo.jpg вже лежить на диску як bytes.\n2. **Drag-and-drop:** browser не конвертує файл. Він отримує доступ до нього і створює JavaScript **File object** з metadata: name, size, type та доступом до content.\n3. **До натискання Upload:** bytes зазвичай ще нікуди по мережі не відправляються. UI просто тримає selected File object.\n4. **Upload starts:** browser читає bytes файлу з File object — одразу або частинами/stream.\n5. **HTTP request:** ці bytes потрапляють у request body. У raw upload вони майже напряму є body; у **multipart/form-data** browser додає навколо них boundary та headers конкретної part.\n6. **Server:** отримує той самий byte stream, читає його та може зберегти як файл, перевірити MIME/signature, передати в object storage або обробити.\n\nТобто flow такий: **file on disk (bytes) → File object → HTTP body → server bytes → stored file**.\n\n**Binary не означає «зашифрований» або «спеціально перетворений».** Це лише означає, що дані розглядаються як raw bytes, а не як текстові символи. Навіть **hello.txt** фізично теж складається з bytes; різниця в тому, що для text file ці bytes інтерпретуються через encoding, наприклад UTF-8. Для JPEG/PDF/ZIP bytes інтерпретуються за правилами відповідного binary format. File extension і **Content-Type** допомагають сказати, **як трактувати bytes**, але не створюють їх.`
    : `${anchor}\n\n### What does binary actually mean, and when does a file become binary?\n\n**A file does not become binary in the browser. It is already bytes before drag-and-drop.** On an SSD/HDD, a file is stored as a sequence of bytes. Each byte is a number from 0 to 255; at the bit level it is eight 0/1 values. For example, a JPEG may start with bytes shown as **FF D8 FF E0 ...** in hexadecimal notation. That is not a separate “binary version” of the image — those bytes are the JPEG data itself.\n\nWhen you drag **photo.jpg** into an upload field, the flow is roughly:\n\n1. **Before drag-and-drop:** photo.jpg already exists on disk as bytes.\n2. **Drag-and-drop:** the browser does not convert the file. It gets access to it and creates a JavaScript **File object** containing metadata such as name, size, type and access to the content.\n3. **Before Upload:** normally no file bytes have gone over the network yet. The UI simply holds the selected File object.\n4. **Upload starts:** the browser reads the file bytes from the File object, either at once or progressively as a stream.\n5. **HTTP request:** those bytes are placed into the request body. With a raw upload they are essentially the body; with **multipart/form-data** the browser surrounds them with multipart boundaries and part headers.\n6. **Server:** receives the byte stream and may store it, inspect its MIME/signature, forward it to object storage or process it.\n\nSo the flow is: **file on disk (bytes) → File object → HTTP body → server bytes → stored file**.\n\n**Binary does not mean “encrypted” or “specially converted”.** It only means the data is treated as raw bytes rather than as text characters. Even **hello.txt** is physically bytes; for a text file those bytes are interpreted using an encoding such as UTF-8. JPEG/PDF/ZIP bytes are interpreted according to their file format. The file extension and **Content-Type** help say **how to interpret the bytes**; they do not create the bytes.`;

  return markdown.replace(anchor, explanation);
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

const httpMarkdown = makeStatusCodeGroupsExpandable(
  normalizeLearningMarkdown(clarifyBinaryFileMeaning(improveFileTransferGuide(trainingOnlyCopy(httpApiDeepDive.markdown), "en"), "en")),
);
const httpMarkdownUk = makeStatusCodeGroupsExpandable(
  normalizeLearningMarkdown(clarifyBinaryFileMeaning(improveFileTransferGuide(trainingOnlyCopy(httpApiDeepDive.markdownUk), "uk"), "uk")),
);
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