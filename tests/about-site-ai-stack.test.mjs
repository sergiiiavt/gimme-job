import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const COMPONENT_PATH = "/app/about-site.tsx";

const server = await createServer({
  appType: "custom",
  configFile: false,
  root: process.cwd(),
  logLevel: "silent",
  plugins: [react()],
  server: { middlewareMode: true },
});

const aboutModule = await server.ssrLoadModule(COMPONENT_PATH);
const { default: AboutSite } = aboutModule;

test.after(async () => {
  await server.close();
});

test("renders LangGraph and the related AI stack as tech-stack section two", () => {
  const html = renderToStaticMarkup(React.createElement(AboutSite, { mode: "public" }));

  const deployment = html.indexOf('aria-labelledby="about-deployment-title"');
  const aiStack = html.indexOf('aria-labelledby="about-ai-stack-title"');
  const n8n = html.indexOf('aria-labelledby="about-n8n-title"');

  assert.ok(deployment >= 0);
  assert.ok(aiStack > deployment);
  assert.ok(n8n > aiStack);
  assert.match(html, /about-tech-section-number">2<\/span>/);
  assert.match(html, /LangGraph/);
  assert.match(html, /LangChain \+ langchain-openai/);
  assert.match(html, /Langfuse/);
  assert.match(html, /Canonical RAG/);
  assert.match(html, /FastAPI AI service/);
  assert.match(html, /Workers AI \+ Vectorize with lexical fallback/);
  assert.match(html, /ai-service\/src\/gimmejob_ai\/learning_path\.py/);
  assert.match(html, /ai-service\/src\/gimmejob_ai\/rag_metrics\.py/);
  assert.match(html, /app\/internal\/rag/);
});

test("renders the AI stack in personal mode", () => {
  const html = renderToStaticMarkup(React.createElement(AboutSite, { mode: "personal" }));

  assert.match(html, /href="\/interview"/);
  assert.match(html, /AI orchestration &amp; RAG/);
});
