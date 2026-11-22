type Json = Record<string, unknown>;

type RpcMessage = {
  jsonrpc: "2.0";
  id?: string | number;
  result?: Json;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

export type GimmeJobMcpClientOptions = {
  url?: string;
  token?: string;
  userEmail?: string;
  fetchImpl?: typeof fetch;
};

export type McpTool = {
  name: string;
  description?: string;
  inputSchema: Json;
};

export type McpToolCallResult = {
  content: Array<{ type: string; text?: string }>;
  structuredContent?: Json;
  isError?: boolean;
};

export type McpDiscoverResult = {
  supportedVersions: string[];
  capabilities: Json;
  instructions?: string;
  ttlMs: number;
  cacheScope: "public" | "private";
  _meta?: Json;
};

const DEFAULT_MCP_URL = "https://gimme-job.com/mcp";
export const MCP_PROTOCOL_VERSION = "2026-07-28";
const CLIENT_INFO = { name: "gimmejob-local-client", version: "0.2.0" };

/** A JSON-RPC error from the server: a protocol problem, not a tool that ran and failed. */
export class McpRpcError extends Error {
  readonly code: number;
  readonly data: unknown;
  readonly status: number;

  constructor(code: number, message: string, data: unknown, status: number) {
    super(`GimmeJob MCP error ${code}: ${message}`);
    this.name = "McpRpcError";
    this.code = code;
    this.data = data;
    this.status = status;
  }
}

/** Streamable HTTP sends header values that are not plain printable ASCII as `=?base64?<utf-8 bytes>?=`. */
function headerValue(value: string): string {
  if (/^[\x21-\x7E](?:[\x20-\x7E]*[\x21-\x7E])?$/.test(value)) return value;
  return `=?base64?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function parseJsonMessages(text: string): RpcMessage[] {
  try {
    const parsed = JSON.parse(text) as Partial<RpcMessage> | null;
    const isRpc = parsed?.jsonrpc === "2.0" && (parsed.error === undefined || typeof parsed.error?.code === "number");
    return isRpc ? [parsed as RpcMessage] : [];
  } catch {
    return [];
  }
}

/** Reads the JSON-RPC messages of a server-sent event stream; each event's data lines form one message. */
function parseEventStream(text: string): RpcMessage[] {
  return text.split(/\r?\n\r?\n/).flatMap((event) => {
    const data = event.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    return data ? parseJsonMessages(data) : [];
  });
}

async function readMessage(response: Response, id: number): Promise<RpcMessage> {
  const text = await response.text().catch(() => "");
  const contentType = response.headers.get("content-type") ?? "";
  const isStream = contentType.includes("text/event-stream");
  if (response.ok && !isStream && !contentType.includes("application/json")) {
    throw new Error(`GimmeJob MCP returned unsupported content type: ${contentType || "unknown"}.`);
  }
  const messages = isStream ? parseEventStream(text) : parseJsonMessages(text);
  const message = messages.find((candidate) => candidate.id === id)
    ?? messages.find((candidate) => candidate.id === undefined && candidate.error);
  if (message?.error) throw new McpRpcError(message.error.code, message.error.message, message.error.data, response.status);
  if (!response.ok) throw new Error(`GimmeJob MCP request failed (${response.status}): ${text.slice(0, 500) || response.statusText}`);
  if (!message?.result || typeof message.result !== "object") throw new Error("GimmeJob MCP returned an invalid JSON-RPC response.");
  return message;
}

/**
 * Client for the private GimmeJob MCP endpoint, MCP revision 2026-07-28.
 *
 * The protocol is stateless: there is no initialize handshake, every request carries the protocol
 * version and client capabilities in `params._meta`, and the Streamable HTTP headers repeat the
 * version, the method and, for tools/call, the tool name.
 */
export class GimmeJobMcpClient {
  readonly url: string;
  private readonly token: string;
  private readonly userEmail: string;
  private readonly fetchImpl: typeof fetch;
  private nextId = 1;

  constructor(options: GimmeJobMcpClientOptions = {}) {
    this.url = options.url ?? (process.env.GIMMEJOB_MCP_URL?.trim() || DEFAULT_MCP_URL);
    this.token = options.token
      ?? (process.env.GIMMEJOB_MCP_TOKEN?.trim()
        || process.env.MCP_SERVICE_TOKEN?.trim()
        || process.env.APP_PASSWORD?.trim()
        || "");
    this.userEmail = options.userEmail ?? (process.env.GIMMEJOB_MCP_USER_EMAIL?.trim() || "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private headers(method: string, toolName?: string): Record<string, string> {
    return {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": MCP_PROTOCOL_VERSION,
      "mcp-method": method,
      ...(toolName === undefined ? {} : { "mcp-name": headerValue(toolName) }),
      ...(this.token ? { "x-gimmejob-mcp-token": this.token } : {}),
      ...(this.userEmail ? { "x-gimmejob-mcp-user-email": this.userEmail } : {}),
    };
  }

  private async request<T>(method: string, params: Json = {}, toolName?: string): Promise<T> {
    const id = this.nextId++;
    const payload = {
      jsonrpc: "2.0",
      id,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
          "io.modelcontextprotocol/clientInfo": CLIENT_INFO,
        },
      },
    };
    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers: this.headers(method, toolName),
      body: JSON.stringify(payload),
    });
    const { result } = await readMessage(response, id);
    // An absent resultType comes from an older server and means "complete"; this client handles nothing else.
    if (result?.resultType !== undefined && result.resultType !== "complete") {
      const resultType = typeof result.resultType === "string" ? result.resultType : JSON.stringify(result.resultType);
      throw new Error(`GimmeJob MCP returned unsupported resultType: ${resultType}.`);
    }
    return result as T;
  }

  /** Optional probe: which revisions and capabilities the server supports, plus its instructions. */
  async discover(): Promise<McpDiscoverResult> {
    const result = await this.request<McpDiscoverResult>("server/discover");
    if (!Array.isArray(result.supportedVersions) || !result.supportedVersions.includes(MCP_PROTOCOL_VERSION)) {
      throw new Error(`GimmeJob MCP server does not support protocol ${MCP_PROTOCOL_VERSION}.`);
    }
    return result;
  }

  async listTools(): Promise<McpTool[]> {
    const result = await this.request<{ tools: McpTool[] }>("tools/list");
    return result.tools;
  }

  async callTool(name: string, args: Json = {}): Promise<McpToolCallResult> {
    const result = await this.request<McpToolCallResult>("tools/call", { name, arguments: args }, name);
    if (result.isError) {
      const message = result.content.find((item) => typeof item.text === "string")?.text ?? `Tool ${name} failed.`;
      throw new Error(message);
    }
    return result;
  }

  async searchJobs(input: {
    query: string;
    limit?: number;
    remote?: boolean;
    source?: string;
    status?: string;
  }): Promise<McpToolCallResult> {
    return this.callTool("search_jobs", input);
  }

  async getInterviewQuestions(input: {
    query?: string;
    limit?: number;
    category?: string;
    prevalence?: string;
  } = {}): Promise<McpToolCallResult> {
    return this.callTool("get_interview_questions", input);
  }

  async getLearningProgress(input: {
    query?: string;
    limit?: number;
  } = {}): Promise<McpToolCallResult> {
    return this.callTool("get_learning_progress", input);
  }

  async analyzeVacancy(input: {
    job_id: string;
    preparation_limit?: number;
  }): Promise<McpToolCallResult> {
    return this.callTool("analyze_vacancy", input);
  }
}

export function createGimmeJobMcpClient(options: GimmeJobMcpClientOptions = {}): GimmeJobMcpClient {
  return new GimmeJobMcpClient(options);
}
