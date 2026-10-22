import markdown from "./http-foundations.md?raw";
import markdownUk from "./http-foundations.uk.md?raw";
import uriAddressing from "./http-uri-addressing.md?raw";
import uriAddressingUk from "./http-uri-addressing.uk.md?raw";

const HTTP_MESSAGES_HEADING = "\n## HTTP messages\n";

const HTTP_MESSAGES_HEADING_UK = "\n## Повідомлення HTTP\n";

const addUriAddressing = (base: string, addressing: string, heading = HTTP_MESSAGES_HEADING) =>
  base.replace(
    heading,
    `\n${addressing.trim()}\n${heading}`,
  );

const renameChapter = (base: string, currentTitle: string, nextTitle: string) =>
  base.replace(currentTitle, nextTitle);

export const httpFoundations = {
  markdown: renameChapter(
    addUriAddressing(markdown, uriAddressing),
    "# HTTP, REST & CORS Foundations",
    "# HTTP & REST APIs",
  ),
  markdownUk: renameChapter(
    addUriAddressing(markdownUk, uriAddressingUk, HTTP_MESSAGES_HEADING_UK),
    "# Основи HTTP, REST та CORS",
    "# HTTP та REST API",
  ),
};

export default httpFoundations;
