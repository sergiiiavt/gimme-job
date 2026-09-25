import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("root layout boots the saved design before page content", async () => {
  const layout = await read("app/layout.tsx");

  assert.match(layout, /data-design="new"/);
  assert.match(layout, /gimmejob-design/);
  assert.match(layout, /localStorage\.getItem/);
  assert.match(layout, /new-design\.css/);
  assert.doesNotMatch(layout, /className="design-mode-switcher"/);
});

test("design switcher lives at the bottom of the scrollable primary navigation", async () => {
  const [navigation, switcher, css] = await Promise.all([
    read("app/site-navigation.tsx"),
    read("app/design-mode-switcher.tsx"),
    read("app/new-design.css"),
  ]);

  const groups = navigation.indexOf("navigationGroups.map");
  const slot = navigation.indexOf('className="kb-design-switcher-slot"');

  assert.ok(groups >= 0);
  assert.ok(slot > groups);
  assert.match(navigation, /<DesignModeSwitcher\/>/);
  assert.match(switcher, /data-design-option="old"/);
  assert.match(switcher, /data-design-option="new"/);
  assert.match(switcher, /localStorage\.setItem/);
  assert.match(switcher, /aria-pressed/);
  assert.match(css, /\.kb-design-switcher-slot/);
  assert.match(css, /\.design-mode-switcher button[\s\S]*font-size:\s*8\.5px/);
  assert.doesNotMatch(css, /\.design-mode-switcher[\s\S]{0,240}position:\s*fixed/);
});

test("new design avoids blanket control sizing and geometry overrides", async () => {
  const css = await read("app/new-design.css");

  assert.match(css, /html\[data-design="new"\] \.vacancy-table-head/);
  assert.match(css, /html\[data-design="new"\] \.iq-lang-toggle button/);
  assert.match(css, /html\[data-design="new"\] \.about-tech-overview-heading h1/);
  assert.match(css, /prefers-reduced-motion/);

  assert.doesNotMatch(css, /html\[data-design="new"\] button,\s*\nhtml\[data-design="new"\] input/);
  assert.doesNotMatch(css, /html\[data-design="new"\] \.kb-main\s*\{[^}]*margin-left/s);
  assert.doesNotMatch(css, /html\[data-design="new"\] \.kb-navigation\s*\{[^}]*width:/s);
});

test("page families own their new-design density rules", async () => {
  const paths = [
    "app/qa-fundamentals-page.module.css",
    "app/playgrounds/databases/database-playground.module.css",
    "app/playgrounds/websocket/websocket-playground.module.css",
    "app/ai-assistant/learning-path-advisor.module.css",
    "app/ai-assistant/execution-trace.module.css",
    "app/quick-reference-page.module.css",
    "app/interview-question-deep-link.module.css",
    "app/about-site-enhancements.module.css",
    "app/games/games.module.css",
    "app/agentic-learning-page.module.css",
    "app/learning-document-ui.module.css",
    "app/istqb-ai-mock-exam.module.css",
    "app/istqb-ai-official-sample-companion.module.css",
    "app/learning-video.module.css",
    "app/executable-python-block.module.css",
  ];

  for (const path of paths) {
    const source = await read(path);
    assert.match(source, /:global\(html\[data-design="new"\]\)/, path);
  }
});
