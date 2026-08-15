export type OperationalReasonCode =
  | "source_failure"
  | "upstream_http_error"
  | "timeout"
  | "network_error"
  | "response_parse_error"
  | "response_validation_error"
  | "openai_fallback"
  | "database_unavailable"
  | "database_error"
  | "pdf_generation_error"
  | "configuration_error"
  | "empty_result"
  | "partial_detail_fetch_failure"
  | "truncated_result"
  | "unexpected_error";

export type OperationalEventName =
  | "job_sync"
  | "job_source_sync"
  | "job_source_detail_fetch"
  | "job_import"
  | "job_analysis"
  | "openai_analysis"
  | "resume_generation"
  | "openai_resume"
  | "observability_storage"
  | "observability_summary";

export type OperationalLogFields = {
  phase?: "start" | "complete" | "query" | "write";
  outcome?: "success" | "degraded" | "failure";

  operationId?: string;
  trigger?: string;
  stage?: string;

  source?: string;
  sourceKind?: string;

  provider?: "openai";
  model?: string;
  aiEnabled?: boolean;
  fallback?: "deterministic";

  durationMs?: number;
  aiDurationMs?: number;
  pdfDurationMs?: number;
  dbDurationMs?: number;

  itemsSeen?: number;
  itemsProcessed?: number;

  sourceCount?: number;
  sourceSuccessCount?: number;
  sourceFailureCount?: number;

  fallbackCount?: number;
  agentCount?: number;
  itemIndex?: number;

  limit?: number;
  truncated?: boolean;
  emptyResult?: boolean;
  slow?: boolean;

  detailFailureCount?: number;
  detailHttpFailureCount?: number;
  detailNetworkFailureCount?: number;

  target?: "event" | "snapshot";
  targetEvent?: string;

  reasonCode?: OperationalReasonCode;
  errorType?: string;
  errorSummary?: string;
  httpStatus?: number;
  retryable?: boolean;
  safeStack?: string;
};

type SafeErrorDetails = {
  reasonCode: OperationalReasonCode;
  errorType: string;
  errorSummary: string;
  httpStatus?: number;
  retryable: boolean;
  safeStack?: string;
};

const NON_NEGATIVE_NUMBER_FIELDS: Array<keyof OperationalLogFields> = [
  "durationMs",
  "aiDurationMs",
  "pdfDurationMs",
  "dbDurationMs",
  "itemsSeen",
  "itemsProcessed",
  "sourceCount",
  "sourceSuccessCount",
  "sourceFailureCount",
  "fallbackCount",
  "agentCount",
  "itemIndex",
  "limit",
  "detailFailureCount",
  "detailHttpFailureCount",
  "detailNetworkFailureCount",
];

const CORE_FIELDS = {
  schemaVersion: 1 as const,
  service: "gimmejob" as const,
  environment: "production" as const,
};

function sanitizeIdentifier(value: string, fallback: string): string {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return clean || fallback;
}

export function newOperationId(prefix: string): string {
  const safePrefix = sanitizeIdentifier(prefix, "op");
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  return `${safePrefix}_${token}`;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function sanitizeHttpStatus(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
  return value >= 100 && value <= 599 ? value : undefined;
}

function sanitizeFields(fields: OperationalLogFields): OperationalLogFields {
  const payload: OperationalLogFields = { ...fields };

  for (const field of NON_NEGATIVE_NUMBER_FIELDS) {
    const value = payload[field];
    if (value === undefined) continue;
    if (!isFiniteNonNegative(value)) {
      delete payload[field];
    }
  }

  if (payload.httpStatus !== undefined) {
    const status = sanitizeHttpStatus(payload.httpStatus);
    if (status === undefined) {
      delete payload.httpStatus;
    } else {
      payload.httpStatus = status;
    }
  }

  return payload;
}

function basePayload(event: OperationalEventName, fields: OperationalLogFields) {
  return {
    ...CORE_FIELDS,
    event,
    ...sanitizeFields(fields),
  };
}

export function operationalInfo(event: OperationalEventName, fields: OperationalLogFields = {}): void {
  console.log(basePayload(event, fields));
}

export function operationalWarn(event: OperationalEventName, fields: OperationalLogFields = {}): void {
  console.warn(basePayload(event, fields));
}

export function operationalError(event: OperationalEventName, fields: OperationalLogFields = {}): void {
  console.error(basePayload(event, fields));
}

function retryableHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function fallbackSummary(reason: OperationalReasonCode): string {
  switch (reason) {
    case "source_failure":
      return "Source synchronization failed.";
    case "database_error":
      return "Database operation failed.";
    case "database_unavailable":
      return "Cloud database is unavailable.";
    case "pdf_generation_error":
      return "Resume PDF generation failed.";
    case "configuration_error":
      return "Configuration is invalid.";
    case "openai_fallback":
      return "OpenAI fallback was used.";
    case "empty_result":
      return "No items were returned.";
    case "partial_detail_fetch_failure":
      return "Partial detail-page fetch failures occurred.";
    case "truncated_result":
      return "Result set was truncated.";
    default:
      return "Unexpected internal error.";
  }
}

function extractErrorType(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  if (error && typeof error === "object") return "Error";
  return typeof error;
}

function maybeSafeStack(error: unknown): string | undefined {
  if (!(error instanceof Error) || typeof error.stack !== "string") return undefined;
  const lines = error.stack.split(/\r?\n/);
  if (lines.length <= 1) return undefined;
  const withoutMessage = lines.slice(1, 9).join("\n").trim();
  if (!withoutMessage) return undefined;
  return withoutMessage.slice(0, 1600);
}

function classifyHttp(message: string): { status: number } | null {
  const match = /\bHTTP\s+(\d{3})\b/i.exec(message);
  if (!match) return null;
  const status = Number(match[1]);
  if (!Number.isInteger(status) || status < 100 || status > 599) return null;
  return { status };
}

export function safeErrorDetails(
  error: unknown,
  fallbackReason: OperationalReasonCode = "unexpected_error",
): SafeErrorDetails {
  const errorType = extractErrorType(error);
  const message = error instanceof Error ? error.message : "";
  const lowerMessage = message.toLowerCase();

  const http = classifyHttp(message);
  if (http) {
    return {
      reasonCode: "upstream_http_error",
      errorType,
      errorSummary: `Upstream request returned HTTP ${http.status}.`,
      httpStatus: http.status,
      retryable: retryableHttpStatus(http.status),
    };
  }

  if (
    errorType === "TimeoutError" ||
    errorType === "AbortError" ||
    /\btimeout\b|timed out|aborted by timeout/.test(lowerMessage)
  ) {
    return {
      reasonCode: "timeout",
      errorType,
      errorSummary: "Operation timed out.",
      retryable: true,
    };
  }

  if (error instanceof SyntaxError) {
    return {
      reasonCode: "response_parse_error",
      errorType,
      errorSummary: "Response parsing failed.",
      retryable: false,
    };
  }

  if (
    /invalid openai|openai returned no structured content|openai structured response/i.test(message)
  ) {
    return {
      reasonCode: "response_validation_error",
      errorType,
      errorSummary: "OpenAI structured response was invalid.",
      retryable: false,
    };
  }

  if (message === "Cloud database is not available.") {
    return {
      reasonCode: "database_unavailable",
      errorType,
      errorSummary: "Cloud database is unavailable.",
      retryable: true,
    };
  }

  if (
    errorType === "TypeError" ||
    /fetch failed|network|connection reset|econn|enotfound|socket/i.test(lowerMessage)
  ) {
    return {
      reasonCode: "network_error",
      errorType,
      errorSummary: "Network request failed.",
      retryable: true,
    };
  }

  const reasonCode = fallbackReason;
  const details: SafeErrorDetails = {
    reasonCode,
    errorType,
    errorSummary: fallbackSummary(reasonCode),
    retryable: reasonCode === "database_unavailable",
  };

  if (reasonCode === "unexpected_error") {
    details.safeStack = maybeSafeStack(error);
  }

  return details;
}
