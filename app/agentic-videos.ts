/** The four videos shown on the AI agents & MCP page, in display order. */
export const agenticVideos = [
  {
    id: "claude-code",
    title: "Claude Code Desktop: from zero to a working web app",
    tocTitle: "Claude Code Desktop",
    channel: "RO БУДУЄ · Rodion Lozovoi",
    channelUrl: "https://www.youtube.com/@ro_dionys",
    videoId: "zW4SEqgFBJc",
  },
  {
    id: "claude-cowork",
    title: "Контент-завод з Claude Cowork, Notion та Skill Editor",
    tocTitle: "Claude Cowork + Notion",
    channel: "Штучка Інтелект",
    channelUrl: "https://www.youtube.com/@shtuchka-intelekt",
    videoId: "rSDKAjao_7Q",
  },
  {
    id: "claude-cowork-overview",
    title: "Як автоматизувати 80% роботи за €20? Повний огляд Claude Cowork",
    tocTitle: "Огляд Claude Cowork",
    channel: "RO БУДУЄ · Rodion Lozovoi",
    channelUrl: "https://www.youtube.com/@ro_dionys",
    videoId: "LZ79ZwTI6lU",
  },
  {
    id: "claude-prompting",
    title: "Інженер Claude показав, ЯК ПРАВИЛЬНО писати промти",
    tocTitle: "Промпти для Claude",
    channel: "Hillel IT School",
    channelUrl: "https://www.youtube.com/@HillelITSchool",
    videoId: "geoFJ6OXMKE",
  },
] as const;

/** Table-of-contents entries for the video page: short labels, independent from the full titles. */
export const agenticVideoHeadings = agenticVideos.map(({ id, tocTitle }) => ({ id, text: tocTitle }));
