import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("site shell keeps canonical section routing and sidebar layout hooks", async () => {
  const [uiSource, stylesSource] = await Promise.all([
    read("app/public-site.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(stylesSource, /\.kb-area-group-career/);
  assert.match(stylesSource, /\.kb-area-group-learning/);
  assert.match(stylesSource, /\.kb-area-group-misc/);
  assert.match(stylesSource, /\.kb-nav-intro/);
  assert.match(stylesSource, /\.kb-navigation \.kb-nav-list \.kb-nav-link \{[^}]*font-size: 12px/);
  assert.match(uiSource, /window\.location\.assign\(sectionNavigationHref\(next, effectiveMode\)\)/);
  assert.match(uiSource, /if \(section === "about"\) return <AboutSite mode=\{mode\}\/>/);
  assert.match(uiSource, /if \(section === "resume"\) return <ResumePage mode=\{mode\}\/>/);
  assert.match(uiSource, /const section = useMemo\(\(\) => resolveSection\(pathname, hash\), \[pathname, hash\]\)/);
  assert.match(uiSource, /embedded: \{[\s\S]*?title: "Embedded & IoT QA"/);
});
