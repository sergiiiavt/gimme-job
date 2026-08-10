/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  APP_PASSWORD?: string;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const BASIC_AUTH_USERNAME = "gimmejob";

function isTrustedDevelopmentOrSitesHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "terminal.local" ||
    hostname.endsWith(".chatgpt.site")
  );
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

function readBasicCredentials(request: Request): { username: string; password: string } | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return null;

  try {
    const decoded = atob(authorization.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function requireExternalPassword(request: Request, env: Env): Response | null {
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (isTrustedDevelopmentOrSitesHost(hostname)) return null;

  if (!env.APP_PASSWORD) {
    return new Response("GimmeJob is not configured for external access.", {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  const credentials = readBasicCredentials(request);
  if (
    credentials &&
    constantTimeEqual(credentials.username, BASIC_AUTH_USERNAME) &&
    constantTimeEqual(credentials.password, env.APP_PASSWORD)
  ) {
    return null;
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "www-authenticate": 'Basic realm="GimmeJob", charset="UTF-8"',
    },
  });
}

function isPrivateRequest(request: Request, url: URL): boolean {
  if (url.pathname === "/workspace" || url.pathname.startsWith("/workspace/")) return true;
  if (!url.pathname.startsWith("/api/")) return false;

  const isRead = request.method === "GET" || request.method === "HEAD";
  const isPublicApi = url.pathname === "/api/health" || url.pathname === "/api/public/jobs";
  return !(isRead && isPublicApi);
}

function robotsResponse(url: URL): Response {
  return new Response([
    "User-agent: *",
    "Allow: /",
    "Disallow: /workspace",
    "Disallow: /api/",
    `Sitemap: ${url.origin}/sitemap.xml`,
    "",
  ].join("\n"), {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

function sitemapResponse(url: URL): Response {
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${url.origin}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n</urlset>\n`;
  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "application/xml; charset=utf-8",
    },
  });
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const privateRequest = isPrivateRequest(request, url);
    if (privateRequest) {
      const accessResponse = requireExternalPassword(request, env);
      if (accessResponse) return accessResponse;
    }

    if (url.pathname === "/robots.txt") return robotsResponse(url);
    if (url.pathname === "/sitemap.xml") return sitemapResponse(url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    if (!privateRequest) return response;

    const privateResponse = new Response(response.body, response);
    privateResponse.headers.set("cache-control", "no-store");
    privateResponse.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    return privateResponse;
  },
};

export default worker;
