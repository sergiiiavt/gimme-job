import markdown from "./http-foundations.md?raw";
import markdownUk from "./http-foundations.uk.md?raw";
import uriAddressing from "./http-uri-addressing.md?raw";
import uriAddressingUk from "./http-uri-addressing.uk.md?raw";

const HTTP_MESSAGES_HEADING = "\n## HTTP messages\n";

const addUriAddressing = (base: string, addressing: string) =>
  base.replace(
    HTTP_MESSAGES_HEADING,
    `\n${addressing.trim()}\n${HTTP_MESSAGES_HEADING}`,
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
    addUriAddressing(markdownUk, uriAddressingUk),
    "# Основи HTTP, REST та CORS",
    "# HTTP та REST APIs",
  ),
};

export default httpFoundations;
