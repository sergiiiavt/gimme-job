interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  error?: string;
  meta: {
    changes?: number;
    [key: string]: unknown;
  };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<unknown>;
  dump(): Promise<ArrayBuffer>;
}

interface HTMLRewriterElement {
  setAttribute(name: string, value: string): void;
}

interface HTMLRewriterInstance {
  on(selector: string, handlers: { element(element: HTMLRewriterElement): void }): HTMLRewriterInstance;
  transform(response: Response): Response;
}

// Provided by workerd; absent when the built Worker is exercised from Node tests.
declare const HTMLRewriter: (new () => HTMLRewriterInstance) | undefined;

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

declare module "cloudflare:workers" {
  export const env: unknown;
  export function waitUntil(promise: Promise<unknown>): void;
}

interface ImportMeta {
  readonly env: {
    readonly DEV?: boolean;
    readonly [key: string]: string | boolean | undefined;
  };
}
