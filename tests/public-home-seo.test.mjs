import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import config from "../next.config.ts";

const homePageUrl = new URL("../app/page.tsx", import.meta.url).href;
const shellComponents = new Set(["./public-site", "./about-site-enhancements", "./site-navigation"]);
const emptyShell = "data:text/javascript,export default function Shell() {} export function SiteSidebar() {}";

test("crawler metadata settings keep link previews and browser streaming", () => {
  assert.ok(config.htmlLimitedBots instanceof RegExp);
  for (const agent of ["Googlebot/2.1", "facebookexternalhit/1.1", "meta-externalagent/1.1", "Slackbot-LinkExpanding 1.0"]) {
    assert.equal(config.htmlLimitedBots.test(agent), true, agent);
  }
  assert.equal(config.htmlLimitedBots.test("Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36"), false);
});

test("the homepage component hoists its canonical link into the document head", async () => {
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (context.parentURL === homePageUrl) {
        if (shellComponents.has(specifier)) return { url: emptyShell, shortCircuit: true };
        if (specifier.startsWith("./")) return nextResolve(specifier + ".ts", context);
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url !== homePageUrl) return nextLoad(url, context);
      const filename = fileURLToPath(url);
      const { code } = transformSync(readFileSync(filename, "utf8"), {
        loader: "tsx",
        format: "esm",
        jsx: "automatic",
        sourcefile: filename,
        sourcemap: "inline",
        // Vite supplies these values in the production build.
        define: { "import.meta.env": "{}" },
      });
      return { format: "module", source: code, shortCircuit: true };
    },
  });
  try {
    const { default: Home } = await import(homePageUrl);
    const document = createElement("html", null,
      createElement("head"),
      createElement("body", null, createElement(Home)),
    );
    assert.match(renderToStaticMarkup(document), /<head><link rel="canonical" href="https:\/\/gimme-job\.com\/"\/><\/head>/);
  } finally {
    hooks.deregister();
  }
});
