type Json = Record<string, unknown>;

type RpcSuccess<T> = {
  jsonrpc: "2.0";
  id: string | number | null;
  result: T;
};

type RpcFailure = {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
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

const DEFAULT_MCP_URL = "https://gimme-job.com/mcp";
const DEFAULT_PROTOCOL_VERSION = "2026-07-28";

export class GimmeJobMcpClient {
  readonly url: string;
  private readonly token: string;
  private readonly userEmail: string;
  private readonly fetchImpl: typeof fetch;
  private nextId = 1;
  private initialized = false;

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

  private headers(): Record<string, string> {
    return {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(this.token ? { "x-gimmejob-mcp-token": this.token } : {}),
      ...(this.userEmail ? { "x-gimmejob-mcp-user-email": this.userEmail } : {}),
    };
  }

  private async post(body: Json, expectResponse = true): Promise<unknown> {
    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`GimmeJob MCP request failed (${response.status}): ${text || response.statusText}`);
    }
    if (!expectResponse || response.status === 202 || response.status === 204) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new Error(`GimmeJob MCP returned unsupported content type: ${contentType || "unknown"}.`);
    }
    return response.json();
  }

  private async request<T>(method: string, params?: Json): Promise<T> {
    const id = this.nextId++;
    const payload: Json = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params ? { params } : {}),
    };
    const response = await this.post(payload) as RpcSuccess<T> | RpcFailure;
    if (!response || typeof response !== "object") throw new Error("GimmeJob MCP returned an invalid JSON-RPC response.");
    if ("error" in response) throw new Error(`GimmeJob MCP error ${response.error.code}: ${response.error.message}`);
    return response.result;
  }

  private async notify(method: string, params?: Json): Promise<void> {
    await this.post({
      jsonrpc: "2.0",
      method,
      ...(params ? { params } : {}),
    }, false);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.request("initialize", {
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "gimmejob-local-client", version: "0.1.0" },
    });
    await this.notify("notifications/initialized");
    this.initialized = true;
  }

  async listTools(): Promise<McpTool[]> {
    await this.initialize();
    const result = await this.request<{ tools: McpTool[] }>("tools/list");
    return result.tools;
  }

  async callTool(name: string, args: Json = {}): Promise<McpToolCallResult> {
    await this.initialize();
    const result = await this.request<McpToolCallResult>("tools/call", { name, arguments: args });
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
