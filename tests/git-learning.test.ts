import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { register as registerLoader } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const { default: catalog } = await import("../content/git-learning/catalog.ts");
const { staticRagDocuments } = await import("../worker/rag.ts");
const headings = (markdown: string) => [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
const blocks = (markdown: string) => [...markdown.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1]);
const slug = (heading: string) => heading.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

test("Git publishes an ordered bilingual path with explicit review status and primary references", () => {
  assert.equal(catalog.status, "under-review");
  assert.ok(catalog.chapters.length >= 14);
  assert.equal(new Set(catalog.chapters.map((chapter) => chapter.id)).size, catalog.chapters.length);
  assert.deepEqual(catalog.chapters.map((chapter) => chapter.order), catalog.chapters.map((_, index) => index + 1));
  const sources = new Set(catalog.sources.map((source) => source.id));
  assert.equal(sources.size, catalog.sources.length);
  for (const source of catalog.sources) {
    const url = new URL(source.url);
    assert.equal(url.protocol, "https:");
    assert.ok(["git-scm.com", "docs.github.com", "git-lfs.com"].includes(url.hostname));
  }
  for (const chapter of catalog.chapters) {
    assert.ok(chapter.labelUk && chapter.descriptionUk, `${chapter.id}: translated navigation`);
    assert.ok(chapter.sourceIds.length >= 2);
    for (const id of chapter.sourceIds) assert.ok(sources.has(id), `${chapter.id}: reference ${id}`);
    for (const markdown of [chapter.markdown, chapter.markdownUk]) {
      assert.ok(markdown.length >= 2500, `${chapter.id}: developed content`);
      assert.ok(headings(markdown).length >= 7, `${chapter.id}: navigable sections`);
    }
    assert.equal(headings(chapter.markdown).length, headings(chapter.markdownUk).length, `${chapter.id}: section link parity`);
    assert.deepEqual(blocks(chapter.markdown), blocks(chapter.markdownUk), `${chapter.id}: identical executable examples`);
    assert.equal(new Set(headings(chapter.markdown).map(slug)).size, headings(chapter.markdown).length);
    assert.match(chapter.markdown, /## Checkpoint and answer/);
    assert.match(chapter.markdownUk, /## Контрольне запитання та відповідь/);
  }
});

test("canonical RAG discovers every Git chapter and section despite its pending content review", () => {
  const documents = staticRagDocuments().filter((document) => document.metadata.catalog === "git");
  for (const chapter of catalog.chapters) {
    const entries = documents.filter((document) => document.metadata.topic === chapter.id);
    assert.ok(entries.some((document) => !document.metadata.section), `${chapter.id}: topic document`);
    for (const heading of headings(chapter.markdown)) {
      const section = entries.find((document) => document.metadata.section === slug(heading));
      assert.ok(section, `${chapter.id}: linkable ${heading}`);
      assert.equal(section.metadata.route, "/learn/git");
      assert.ok(section.text.length > heading.length);
    }
    assert.equal(entries.length, headings(chapter.markdown).length + 1, `${chapter.id}: rendered sections only`);
  }
});

const isolatedGitEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_EDITOR: "true",
};

test("the published conflict walkthrough produces and resolves a real two-parent merge", () => {
  const chapter = catalog.chapters.find((item) => item.id === "conflict-resolution");
  assert.ok(chapter);
  const commands = blocks(chapter.markdown);
  const directory = mkdtempSync(path.join(tmpdir(), "git-course-conflict-"));
  try {
    const conflict = spawnSync("bash", ["-e", "-c", commands[0]], { cwd: directory, env: isolatedGitEnv, encoding: "utf8" });
    assert.ifError(conflict.error);
    assert.equal(conflict.status, 1, conflict.stdout + conflict.stderr);
    const checkout = path.join(directory, "git-conflict-lab");
    const result = spawnSync("bash", ["-e", "-c", commands.slice(1).join("\n")], { cwd: checkout, env: isolatedGitEnv, encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(readFileSync(path.join(checkout, "settings.ini"), "utf8"), "retries=3\n");
    const parents = spawnSync("git", ["rev-list", "--parents", "-n", "1", "HEAD"], { cwd: checkout, encoding: "utf8" });
    assert.equal(parents.status, 0);
    assert.equal(parents.stdout.trim().split(/\s+/).length, 3);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the offline collaboration lab verifies real Git state, recovery, leases and bisect", () => {
  const result = spawnSync("python3", ["examples/git-collaboration/verify_workflow.py"], {
    cwd: new URL("../", import.meta.url), encoding: "utf8", timeout: 30_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
