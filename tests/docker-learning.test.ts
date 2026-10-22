import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { register as registerLoader } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const { default: catalog } = await import("../content/docker-learning/catalog.ts");
const { staticRagDocuments } = await import("../worker/rag.ts");
const headings = (markdown: string) => [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
const codeBlocks = (markdown: string) => [...markdown.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1]);
const slug = (heading: string) => heading.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

test("Docker curriculum publishes a complete ordered bilingual path with registered sources", () => {
  assert.ok(catalog.chapters.length >= 16);
  assert.equal(new Set(catalog.chapters.map((chapter) => chapter.id)).size, catalog.chapters.length);
  assert.deepEqual(catalog.chapters.map((chapter) => chapter.order), catalog.chapters.map((_, index) => index + 1));
  const sources = new Set(catalog.sources.map((source) => source.id));
  assert.equal(sources.size, catalog.sources.length);
  for (const source of catalog.sources) {
    assert.equal(new URL(source.url).protocol, "https:");
    assert.match(source.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
  for (const chapter of catalog.chapters) {
    assert.ok(chapter.labelUk && chapter.descriptionUk, `${chapter.id}: translated navigation`);
    assert.ok(chapter.sourceIds.length >= 3);
    for (const id of chapter.sourceIds) assert.ok(sources.has(id), `${chapter.id}: unknown source ${id}`);
    for (const markdown of [chapter.markdown, chapter.markdownUk]) {
      assert.ok(markdown.length >= 2500, `${chapter.id}: substantive chapter`);
      assert.ok(headings(markdown).length >= 8, `${chapter.id}: complete sections`);
      assert.doesNotMatch(markdown, /^## Sources$/m, "source registry is separate from linkable chapter content");
    }
    assert.equal(headings(chapter.markdown).length, headings(chapter.markdownUk).length, `${chapter.id}: stable section mapping across languages`);
    assert.deepEqual(codeBlocks(chapter.markdown), codeBlocks(chapter.markdownUk), `${chapter.id}: translations preserve executable examples`);
    assert.equal(new Set(headings(chapter.markdown).map(slug)).size, headings(chapter.markdown).length);
    assert.match(chapter.markdown, /## .*Checkpoint|## .*checkpoint/);
    assert.match(chapter.markdownUk, /## Контрольне запитання|## Підсумкове завдання/);
  }
});

test("every Docker chapter and section is discoverable through the canonical RAG registry", () => {
  const documents = staticRagDocuments().filter((document) => document.metadata.catalog === "docker");
  for (const chapter of catalog.chapters) {
    const entries = documents.filter((document) => document.metadata.topic === chapter.id);
    assert.ok(entries.some((document) => !document.metadata.section), `${chapter.id}: topic document`);
    for (const heading of headings(chapter.markdown)) {
      const section = entries.find((document) => document.metadata.section === slug(heading));
      assert.ok(section, `${chapter.id}: discoverable section ${heading}`);
      assert.equal(section.metadata.route, "/learn/docker");
      assert.ok(section.text.length > heading.length);
    }
    assert.equal(entries.length, headings(chapter.markdown).length + 1, `${chapter.id}: no phantom section links`);
  }
});

test("Docker capstone checks real application behavior without requiring a local daemon", () => {
  const result = spawnSync("python3", ["-m", "unittest", "discover", "-s", "examples/docker-learning", "-p", "test_*.py", "-v"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
