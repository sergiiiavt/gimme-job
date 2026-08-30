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

export const httpFoundations = {
  markdown: addUriAddressing(markdown, uriAddressing),
  markdownUk: addUriAddressing(markdownUk, uriAddressingUk),
};

export default httpFoundations;
