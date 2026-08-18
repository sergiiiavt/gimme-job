import assert from "node:assert/strict";
import { filterRelevantVacancies } from "../agent/src/job-intake.js";
import { extractCompanyFromHtml, inferCompanyFromText, isUsableCompany } from "../agent/src/sources/company.js";
import { parseLobbyXDescription, parseLobbyXListing } from "../agent/src/sources/lobbyx.js";
import { parseRobotaUaDescription, parseRobotaUaResponse } from "../agent/src/sources/robotaua.js";
import { parseRssDetailDescription } from "../agent/src/sources/rss.js";
import { parseWorkUaDescription, parseWorkUaListing } from "../agent/src/sources/workua.js";

const headers = {
  accept: "text/html, application/json, application/rss+xml, application/atom+xml, text/xml, */*",
  "user-agent": "GimmeJob-Live-Smoke/1.0",
};

async function text(url: string): Promise<string> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  assert.equal(response.ok, true, `${url} returned HTTP ${response.status}`);
  return response.text();
}

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  assert.equal(response.ok, true, `${url} returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function xmlValue(block: string, name: string): string {
  return block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1]
    ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .trim() ?? "";
}

function rssFirstLink(xml: string): string {
  const item = xml.match(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/i)?.[1] ?? "";
  const direct = xmlValue(item, "link");
  const href = item.match(/<link[^>]+href=["']([^"']+)/i)?.[1] ?? "";
  const result = direct || href;
  assert.ok(result.startsWith("http"), "RSS feed did not expose a vacancy link");
  return result;
}

function assertFullDescription(source: string, description: string): void {
  assert.ok(description.length >= 120, `${source} detail description is unexpectedly short (${description.length} chars)`);
  assert.doesNotMatch(description, /<\/?(?:div|p|li|ul|ol|h[1-6])\b/i, `${source} description still contains presentation HTML`);
  console.log(`${source}: OK, ${description.length} description chars`);
}

function assertCompany(source: string, company: string): void {
  assert.ok(isUsableCompany(company), `${source} did not expose a usable company name (received ${JSON.stringify(company)})`);
  console.log(`${source}: company OK — ${company}`);
}

function assertCompanyCoverage(source: string, companies: string[], minimum: number): void {
  assert.ok(companies.length > 0, `${source} did not return company candidates`);
  const known = companies.filter(isUsableCompany).length;
  const coverage = known / companies.length;
  assert.ok(
    coverage >= minimum,
    `${source} company coverage ${(coverage * 100).toFixed(1)}% is below ${(minimum * 100).toFixed(0)}% (${known}/${companies.length})`,
  );
  console.log(`${source}: company coverage ${(coverage * 100).toFixed(1)}% (${known}/${companies.length})`);
}

async function smokeRss(source: "DOU" | "Djinni", feed: string): Promise<void> {
  const xml = await text(feed);
  const url = rssFirstLink(xml);
  const html = await text(url);
  const description = parseRssDetailDescription(url, html);
  assertFullDescription(source, description);
  assertCompany(source, extractCompanyFromHtml(url, html) || inferCompanyFromText(description));
}

async function smokeWorkUa(): Promise<void> {
  const html = await text("https://www.work.ua/en/jobs/?search=QA%20Engineer");
  const listings = parseWorkUaListing(html);
  assert.ok(listings.length > 0, "Work.ua search returned no parseable vacancies");
  assertCompanyCoverage("Work.ua", listings.map((listing) => listing.company), 0.8);
  const relevant = filterRelevantVacancies(listings.map((listing) => ({
    source: "workua:smoke", externalId: listing.url, title: listing.title, company: listing.company,
    location: listing.location, remote: false, url: listing.url, applyUrl: listing.url,
    description: listing.description, salaryText: null, postedAt: null, contactEmail: null,
  })));
  const vacancy = relevant.jobs[0] ?? listings[0];
  const detailHtml = await text(vacancy.url);
  assertFullDescription("Work.ua", parseWorkUaDescription(detailHtml));
  assertCompany("Work.ua detail", vacancy.company || extractCompanyFromHtml(vacancy.url, detailHtml));
}

async function smokeRobotaUa(): Promise<void> {
  const payload = await json<unknown>("https://api.rabota.ua/vacancy/search?keyWords=QA%20Engineer&count=20&page=0");
  const jobs = parseRobotaUaResponse(payload, "smoke");
  assert.ok(jobs.length > 0, "Robota.ua API returned no parseable vacancies");
  assertCompanyCoverage("Robota.ua", jobs.map((job) => job.company), 0.9);
  const relevant = filterRelevantVacancies(jobs).jobs;
  assert.ok(relevant.length > 0, "Robota.ua API returned no relevant software-QA vacancy in the smoke sample");
  const vacancy = relevant[0];
  const detailHtml = await text(vacancy.url);
  const detail = parseRobotaUaDescription(detailHtml, vacancy.description);
  assertFullDescription("Robota.ua", detail);
  assert.ok(detail.length >= vacancy.description.length, "Robota.ua detail extraction is shorter than its search/API description");
  assertCompany("Robota.ua detail", vacancy.company || extractCompanyFromHtml(vacancy.url, detailHtml));
}

async function smokeLobbyX(): Promise<void> {
  const items = await json<Array<{ id: number; date: string | null; link: string; title: { rendered: string } }>>(
    "https://thelobbyx.com/wp-json/wp/v2/tors?search=QA%20Engineer&tors-status=84&per_page=20",
  );
  const listings = parseLobbyXListing(items);
  assert.ok(listings.length > 0, "Lobby X API returned no parseable vacancies");
  let lastError: unknown = null;
  for (const listing of listings.slice(0, 5)) {
    try {
      const html = await text(listing.url);
      const description = parseLobbyXDescription(html);
      if (description.length >= 120) {
        assertFullDescription("Lobby X", description);
        assertCompany("Lobby X", extractCompanyFromHtml(listing.url, html) || inferCompanyFromText(description));
        return;
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Lobby X detail pages did not yield a complete description and company");
}

async function main(): Promise<void> {
  const includeLocalWorkUa = process.argv.includes("--include-local-workua");
  const checks: Array<[string, () => Promise<void>]> = [
    ["DOU", () => smokeRss("DOU", "https://jobs.dou.ua/vacancies/feeds/?search=QA")],
    ["Djinni", () => smokeRss("Djinni", "https://djinni.co/jobs/rss/?primary_keyword=QA")],
    ["Robota.ua", smokeRobotaUa],
    ["Lobby X", smokeLobbyX],
  ];
  if (includeLocalWorkUa) checks.splice(2, 0, ["Work.ua (local-only)", smokeWorkUa]);
  else console.log("Work.ua: SKIPPED in cloud smoke; direct HTML access returned HTTP 403 from a GitHub-hosted runner. Use --include-local-workua from a local network to probe it explicitly.");

  const failures: string[] = [];
  for (const [name, check] of checks) {
    try { await check(); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${name}: ${message}`);
      console.error(`${name}: FAILED — ${message}`);
    }
  }

  if (failures.length) throw new Error(`Live vacancy smoke test failed:\n${failures.join("\n")}`);
  console.log("All cloud-safe live vacancy source smoke checks passed.");
}

await main();
