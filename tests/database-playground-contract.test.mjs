import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("database playground is present in navigation and uses the real proxy", async () => {
  const [navigation, client, styles, proxy] = await Promise.all([
    source("app/site-navigation.tsx"),
    source("app/playgrounds/databases/database-playground.tsx"),
    source("app/playgrounds/databases/database-playground.module.css"),
    source("app/api/playgrounds/databases/route.ts"),
  ]);

  assert.match(navigation, /database-playground/);
  assert.match(navigation, /\/playgrounds\/databases/);
  assert.match(client, /Database Playground/);
  assert.match(client, /MySQL 8/);
  assert.match(client, /PostgreSQL 16/);
  assert.match(client, /\/api\/playgrounds\/databases/);
  assert.match(client, /type LeftTab = "database" \| "examples"/);
  assert.match(client, /type ExampleCategory = "basics" \| "joins" \| "aggregation" \| "engine" \| "indexes"/);
  assert.match(client, /Engine differences/);
  assert.match(client, /Indexes & plans/);
  assert.match(client, /String concatenation/);
  assert.match(client, /JSON value extraction/);
  assert.match(client, /Use query/);
  assert.match(client, /CREATE INDEX/);
  assert.match(client, /EXPLAIN/);
  assert.match(client, /Results/);
  assert.match(client, /current === table\.name \? "" : table\.name/);
  assert.match(client, /styles\.editorActions/);
  assert.match(client, /styles\.technicalPanel/);
  assert.match(client, /styles\.workbench/);
  assert.match(client, /result\.rows\.map/);
  assert.doesNotMatch(client, /insertIdentifier/);
  assert.doesNotMatch(client, /Preview rows/);
  assert.doesNotMatch(client, /quoteIdentifier/);
  assert.doesNotMatch(client, /setWorkspace/);
  assert.doesNotMatch(client, /Real database workspace/);
  assert.doesNotMatch(client, /workspaceMeta/);
  assert.doesNotMatch(client, /PAGE_SIZE/);
  assert.doesNotMatch(client, /visibleRows/);
  assert.doesNotMatch(client, /pagination/);
  assert.doesNotMatch(client, /type ResultTab/);
  assert.doesNotMatch(client, />Structure</);
  assert.doesNotMatch(client, />History/);
  assert.match(client, /Refresh/);
  assert.match(client, /Reset/);
  assert.match(client, /Run SQL/);
  assert.match(styles, /grid-template-columns: 280px minmax\(0, 1fr\)/);
  assert.match(styles, /grid-template-rows: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.exampleCategories/);
  assert.match(styles, /font-size: 12\.5px/);
  assert.doesNotMatch(styles, /\.pagination/);
  assert.doesNotMatch(client, /GIMMEJOB_AI_SERVICE_TOKEN/);
  assert.match(proxy, /authorization: `Bearer \$\{token\}`/);
  assert.match(proxy, /\/db-lab\/v1\//);
});

test("database lab API is isolated behind Caddy and bridges only the intended networks", async () => {
  const [compose, caddy, bootstrap, server] = await Promise.all([
    source("ops/hetzner/docker-compose.yml"),
    source("ops/hetzner/Caddyfile"),
    source("ops/hetzner/bootstrap.sh"),
    source("ops/hetzner/db-lab-api/server.mjs"),
  ]);

  assert.match(compose, /db-lab-api:/);
  assert.match(compose, /db_lab_internal/);
  assert.match(compose, /n8n_internal/);
  assert.match(caddy, /handle_path \/db-lab\/\*/);
  assert.match(caddy, /reverse_proxy db-lab-api:8080/);
  assert.match(bootstrap, /db-lab-api\/server\.mjs/);
  assert.match(server, /MAX_ACTIVE_REQUESTS = 4/);
  assert.match(server, /QUERY_TIMEOUT_MS = 7_000/);
  assert.match(server, /MAX_OUTPUT_BYTES = 512 \* 1024/);
  assert.match(server, /timingSafeEqual/);
  assert.match(server, /MYSQL_LAB_ROOT_PASSWORD/);
  assert.match(server, /POSTGRES_LAB_ADMIN_PASSWORD/);
  assert.doesNotMatch(server, /5f74c260-c3f7-4119-b26f-fa5e8cadcc00/);
});
