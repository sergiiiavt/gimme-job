import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const migrationUrl = new URL("../drizzle/0013_preserve_known_job_company.sql", import.meta.url);

test("company preservation migration blocks Unknown from replacing a known company", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE jobs (id TEXT PRIMARY KEY, company TEXT NOT NULL)");
  db.exec(sql);

  db.prepare("INSERT INTO jobs (id, company) VALUES (?, ?)").run("job-1", "Ajax Systems");
  db.prepare("UPDATE jobs SET company = ? WHERE id = ?").run("Unknown", "job-1");
  assert.equal(db.prepare("SELECT company FROM jobs WHERE id = ?").get("job-1").company, "Ajax Systems");

  db.prepare("UPDATE jobs SET company = ? WHERE id = ?").run("MacPaw", "job-1");
  assert.equal(db.prepare("SELECT company FROM jobs WHERE id = ?").get("job-1").company, "MacPaw");

  db.prepare("INSERT INTO jobs (id, company) VALUES (?, ?)").run("job-2", "Unknown");
  db.prepare("UPDATE jobs SET company = ? WHERE id = ?").run("3DTech", "job-2");
  assert.equal(db.prepare("SELECT company FROM jobs WHERE id = ?").get("job-2").company, "3DTech");

  db.close();
});
