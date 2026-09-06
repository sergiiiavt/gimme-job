import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/playgrounds/websocket/websocket-playground.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/playgrounds/websocket/websocket-playground.module.css", import.meta.url), "utf8");

test("WebSocket playground uses the same outer geometry as the Games playfield", () => {
  assert.match(styles, /max-width: 1580px;/);
  assert.match(styles, /padding: 36px 34px 22px;/);
  assert.match(styles, /:global\(\.kb-main\):has\(> \.page\)[\s\S]*margin-left: 220px;/);
  assert.match(styles, /\.workspace[\s\S]*grid-template-columns:/);
});

test("WebSocket guide and chat fill the desktop viewport together and use tabbed guide content", () => {
  assert.match(styles, /\.chat,\s*\.guide\s*\{\s*height: calc\(100vh - 58px\);\s*min-height: 620px;/);
  assert.doesNotMatch(styles, /height: min\(720px/);
  assert.match(source, /role="tablist"/);
  assert.match(source, />Test & inspect<\/button>/);
  assert.match(source, />Hints & links<\/button>/);
  assert.match(source, /guideTab === "test"/);
  assert.match(source, /id="websocket-guide-hints" role="tabpanel"/);
});

test("WebSocket playground includes a practical testing guide", () => {
  assert.match(source, /Use the chat as a real test target/);
  assert.match(source, /DevTools → Network → WS/);
  assert.match(source, /Messages \/ Frames/);
  assert.match(source, /Queue reference/);
  assert.match(source, /slow consumers, fan-out cost/);
});

test("WebSocket playground supports compressed image messages", () => {
  assert.match(source, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(source, /aria-label="Add image"/);
  assert.match(source, /canvas\.toDataURL\("image\/webp"/);
  assert.match(source, /kind: "image"/);
  assert.match(source, /<NextImage/);
  assert.match(source, /image size\/type limits/);
});

test("WebSocket playground links to the full learning and interview material", () => {
  assert.match(source, /href="\/learn\/api\?topic=websocket"/);
  assert.match(source, /href="\/learn\/networking\?topic=protocols-and-transports"/);
  assert.match(source, /href="\/interview\/web-api\?question=websocket-how-would-you-test"/);
  assert.match(source, /href="\/interview\/web-api\?question=websocket-security-auth-origin-scale"/);
});
