import assert from "node:assert/strict";
import test from "node:test";
import {
  isWebSocketPlaygroundRequest,
  proxyWebSocketPlayground,
  WEBSOCKET_PLAYGROUND_PATH,
} from "../worker/websocket-playground-proxy.ts";

test("recognizes only the same-origin WebSocket playground path", () => {
  assert.equal(
    isWebSocketPlaygroundRequest(new Request(`https://gimme-job.com${WEBSOCKET_PLAYGROUND_PATH}?room=qa`)),
    true,
  );
  assert.equal(
    isWebSocketPlaygroundRequest(new Request("https://gimme-job.com/playgrounds/websocket")),
    false,
  );
});

test("requires a WebSocket GET upgrade", async () => {
  const response = await proxyWebSocketPlayground(
    new Request(`https://gimme-job.com${WEBSOCKET_PLAYGROUND_PATH}?room=qa`),
  );

  assert.equal(response.status, 426);
  assert.equal(response.headers.get("upgrade"), "websocket");
});

test("proxies the handshake to the AI service without site credentials", async () => {
  let forwarded: Request | null = null;
  const source = new Request(`https://gimme-job.com${WEBSOCKET_PLAYGROUND_PATH}?room=qa-room`, {
    headers: {
      authorization: "Bearer browser-secret",
      connection: "Upgrade",
      cookie: "gimmejob_user_session=session-secret",
      "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
      "sec-websocket-version": "13",
      upgrade: "websocket",
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": "user-1",
    },
  });

  const response = await proxyWebSocketPlayground(source, async (request) => {
    forwarded = request;
    return new Response("proxied", { status: 200 });
  });

  assert.equal(response.status, 200);
  assert.ok(forwarded);
  assert.equal(forwarded.url, "https://ai.gimme-job.com/v1/playground/ws?room=qa-room");
  assert.equal(forwarded.headers.get("upgrade"), "websocket");
  assert.equal(forwarded.headers.get("sec-websocket-version"), "13");
  assert.equal(forwarded.headers.get("authorization"), null);
  assert.equal(forwarded.headers.get("cookie"), null);
  assert.equal(forwarded.headers.get("x-gimmejob-authenticated"), null);
  assert.equal(forwarded.headers.get("x-gimmejob-user-id"), null);
});
