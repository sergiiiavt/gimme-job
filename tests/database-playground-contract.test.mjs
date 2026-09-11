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
  assert.match(client, /MongoDB 8/);
  assert.match(client, /\/api\/playgrounds\/databases/);
  assert.match(client, /type Engine = "mysql" \| "postgres" \| "mongodb"/);
  assert.match(client, /type LeftTab = "database" \| "examples"/);
  assert.match(client, /Documents & arrays/);
  assert.match(client, /Engine differences/);
  assert.match(client, /Indexes & plans/);
  assert.match(client, /String concatenation/);
  assert.match(client, /JSON value extraction/);
  assert.match(client, /\$elemMatch/);
  assert.match(client, /db\.orders\.aggregate/);
  assert.match(client, /db\.orders\.updateOne/);
  assert.match(client, /Use query/);
  assert.match(client, /CREATE INDEX/);
  assert.match(client, /EXPLAIN/);
  assert.match(client, /Results/);
  assert.match(client, /current === table\.name \? "" : table\.name/);
  assert.match(client, /styles\.editorActions/);
  assert.match(client, /styles\.technicalPanel/);
  assert.match(client, /styles\.workbench/);
  assert.match(client, /result\.rows\.map/);
  assert.match(client, /result\.documents/);
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
  assert.match(client, /Run query/);
  assert.match(styles, /grid-template-columns: 280px minmax\(0, 1fr\)/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /grid-template-rows: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.exampleCategories/);
  assert.match(styles, /\.mongoDocuments/);
  assert.doesNotMatch(styles, /\.pagination/);
  assert.doesNotMatch(client, /GIMMEJOB_AI_SERVICE_TOKEN/);
  assert.match(proxy, /authorization: `Bearer \$\{token\}`/);
  assert.match(proxy, /\/db-lab\/v1\//);
  assert.match(proxy, /\/mongo-lab\/v1\//);
  assert.match(proxy, /"mysql", "postgres", "mongodb"/);
});

test("database lab APIs are isolated behind Caddy and bridge only intended networks", async () => {
  const [compose, caddy, bootstrap, sqlServer, mongoServer, mongoSeed] = await Promise.all([
    source("ops/hetzner/docker-compose.yml"),
    source("ops/hetzner/Caddyfile"),
    source("ops/hetzner/bootstrap.sh"),
    source("ops/hetzner/db-lab-api/server.mjs"),
    source("ops/hetzner/mongo-lab-api/server.mjs"),
    source("ops/hetzner/db-lab/mongo-init.js"),
  ]);

  assert.match(compose, /db-lab-api:/);
  assert.match(compose, /mongo-lab:/);
  assert.match(compose, /mongo-lab-api:/);
  assert.match(compose, /mongo:8\.0/);
  assert.match(compose, /mongo_lab_data:/);
  assert.match(compose, /db_lab_internal/);
  assert.match(compose, /n8n_internal/);
  assert.doesNotMatch(compose, /27017:27017/);
  assert.match(caddy, /handle_path \/db-lab\/\*/);
  assert.match(caddy, /reverse_proxy db-lab-api:8080/);
  assert.match(caddy, /handle_path \/mongo-lab\/\*/);
  assert.match(caddy, /reverse_proxy mongo-lab-api:8081/);
  assert.match(bootstrap, /mongo-lab-api\/server\.mjs/);
  assert.match(bootstrap, /db-lab\/mongo-init\.js/);
  assert.match(bootstrap, /MONGO_LAB_ADMIN_PASSWORD/);
  assert.match(bootstrap, /caddy validate --config \/etc\/caddy\/Caddyfile --adapter caddyfile/);
  assert.match(bootstrap, /caddy reload --config \/etc\/caddy\/Caddyfile --adapter caddyfile/);
  assert.match(sqlServer, /MAX_ACTIVE_REQUESTS = 4/);
  assert.match(sqlServer, /QUERY_TIMEOUT_MS = 7_000/);
  assert.match(sqlServer, /MAX_OUTPUT_BYTES = 512 \* 1024/);
  assert.match(sqlServer, /timingSafeEqual/);
  assert.match(sqlServer, /MYSQL_LAB_ROOT_PASSWORD/);
  assert.match(sqlServer, /POSTGRES_LAB_ADMIN_PASSWORD/);
  assert.match(mongoServer, /MongoClient/);
  assert.match(mongoServer, /MAX_ROWS = 200/);
  assert.match(mongoServer, /MAX_OUTPUT_BYTES = 512 \* 1024/);
  assert.match(mongoServer, /\$where/);
  assert.match(mongoServer, /\$function/);
  assert.match(mongoServer, /parseInvocation/);
  assert.doesNotMatch(mongoServer, /\beval\s*\(/);
  assert.match(mongoSeed, /lab\.orders\.insertMany/);
  assert.match(mongoSeed, /items/);
  assert.match(mongoSeed, /shipping/);
  assert.doesNotMatch(sqlServer, /5f74c260-c3f7-4119-b26f-fa5e8cadcc00/);
});
