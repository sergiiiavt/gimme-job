import { ownerResume } from "./data.ts";

// The Worker checks the authenticated legacy-workspace owner before forwarding.
// This second check prevents accidental exposure if the endpoint is routed differently.
export async function GET(request: Request): Promise<Response> {
  if (request.headers.get("x-gimmejob-authenticated") !== "1" ||
      request.headers.get("x-gimmejob-resume-owner") !== "1") {
    return new Response("Not found.", { status: 404, headers: { "cache-control": "no-store" } });
  }
  return Response.json(ownerResume, {
    headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow, noarchive", vary: "cookie" },
  });
}
