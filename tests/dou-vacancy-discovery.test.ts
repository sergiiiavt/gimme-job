import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const { RssJobSource, parseDouVacancyListing } = await import("../agent/src/sources/rss.ts");

function card(id: number, title: string, company: string, location: string, teaser = "Software testing and QA responsibilities.") {
  return `<li class="l-vacancy">
    <div class="title">
      <a class="vt" href="/companies/${company.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/vacancies/${id}/">${title}</a>
      <span class="company">в <a href="#">${company}</a></span>
      <span class="cities">${location}</span>
    </div>
    <div class="sh-info">${teaser}</div>
  </li>`;
}

test("DOU listing parser preserves AQA vacancies and canonical IDs", () => {
  const jobs = parseDouVacancyListing([
    card(368919, "AQA Engineer", "Twist Robotics", "Київ, Львів, віддалено"),
    card(368979, "QA Automation Engineer (.Net) / Kyiv", "Airlogix", "Київ"),
    card(364050, "AQA/Manual (офіс, Київ)", "Eleven", "Київ"),
  ].join("\n"), "rss:dou-qa");

  assert.deepEqual(jobs.map((job) => job.externalId), ["368919", "368979", "364050"]);
  assert.deepEqual(jobs.map((job) => job.company), ["Twist Robotics", "Airlogix", "Eleven"]);
  assert.equal(jobs[0].remote, true);
  assert.equal(jobs[1].remote, false);
});

test("DOU source follows xhr-load pagination beyond the first twenty cards", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const firstPage = Array.from({ length: 20 }, (_, index) =>
    card(500000 + index, `QA Engineer ${index + 1}`, `Company ${index + 1}`, "Київ"),
  ).join("\n");
  const secondPage = [
    card(368919, "AQA Engineer", "Twist Robotics", "Київ, Львів, віддалено", "Automation QA, Kubernetes, CI/CD and E2E testing."),
    card(368979, "QA Automation Engineer (.Net) / Kyiv", "Airlogix", "Київ", "QA automation for .NET desktop and web applications."),
    card(364050, "AQA/Manual (офіс, Київ)", "Eleven", "Київ", "Manual and automated software testing for defence technology."),
  ].join("\n");
  const calls: Array<{ url: string; method: string }> = [];

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method });

    if (url === "https://jobs.dou.ua/vacancies/?category=QA") {
      return new Response(`<html><script>window.CSRF_TOKEN = "csrf-test-token";</script><ul>${firstPage}</ul></html>`, {
        status: 200,
        headers: { "set-cookie": "csrftoken=cookie-token; Path=/; Secure" },
      });
    }

    if (url === "https://jobs.dou.ua/vacancies/xhr-load/?category=QA") {
      assert.equal(method, "POST");
      assert.match(String(init?.body), /count=20/);
      assert.equal((init?.headers as Record<string, string>)?.["x-requested-with"], "XMLHttpRequest");
      return new Response(JSON.stringify({ html: secondPage, last: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (/https:\/\/jobs\.dou\.ua\/companies\/.+\/vacancies\/\d+\/?$/.test(url)) {
      return new Response(`<html><head><script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "JobPosting",
        description: "<h2>Requirements</h2><p>Software QA and automation experience.</p><h2>Responsibilities</h2><p>Maintain regression coverage and investigate defects.</p>",
        datePosted: "2026-08-07T09:00:00Z",
      })}</script></head><body></body></html>`, { status: 200 });
    }

    return new Response("not found", { status: 404, statusText: "Not Found" });
  }) as typeof fetch;

  try {
    const jobs = await new RssJobSource("dou-qa", "https://jobs.dou.ua/vacancies/feeds/?search=QA").collect();
    const ids = new Set(jobs.map((job) => job.externalId));
    assert.equal(jobs.length, 23);
    assert.equal(ids.has("368919"), true);
    assert.equal(ids.has("368979"), true);
    assert.equal(ids.has("364050"), true);
    assert.equal(calls.filter((call) => call.url.includes("xhr-load")).length, 1);
    assert.equal(jobs.find((job) => job.externalId === "368919")?.company, "Twist Robotics");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
