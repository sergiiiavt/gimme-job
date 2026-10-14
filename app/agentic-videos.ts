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

/** Future learning chapters: navigation placeholders, not published course content. */
export const agenticPlannedTopics = [
  {
    id: "tools-and-actions",
    title: "Tools and actions",
    description: "Typed tools, validation, permissions, retries, and safe external actions.",
  },
  {
    id: "state-and-memory",
    title: "State and memory",
    description: "Session state, durable memory, retrieval, and boundaries between user and agent data.",
  },
  {
    id: "approval-workflows",
    title: "Approval workflows",
    description: "Human confirmation before applications, messages, or any consequential action.",
  },
  {
    id: "agent-evaluation",
    title: "Agent evaluation",
    description: "Task success, trajectory checks, tool correctness, regression suites, and observability.",
  },
  {
    id: "mcp-experiments",
    title: "MCP experiments",
    description: "Small integrations for job sources, Gmail, GitHub, and structured knowledge.",
  },
  {
    id: "pet-projects",
    title: "Pet projects",
    description: "A portfolio backlog of narrow, testable agents instead of one uncontrolled system.",
  },
] as const;
