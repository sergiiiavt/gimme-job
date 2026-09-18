import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const {
  extractCompanyFromHtml,
  inferCompanyFromText,
  isUsableCompany,
  recoverJobCompany,
} = await import("../agent/src/sources/company.ts");

test("company validation keeps legitimate names containing digits", () => {
  assert.equal(isUsableCompany("3DTech"), true);
  assert.equal(isUsableCompany("Unknown"), false);
  assert.equal(isUsableCompany("Company is hidden"), false);
  assert.equal(isUsableCompany("QA Engineer"), false);
  assert.equal(isUsableCompany("Companies"), false);
});

test("company validation rejects legacy values fabricated from vacancy prose", () => {
  assert.equal(isUsableCompany("- Hands"), false);
  assert.equal(isUsableCompany("We provides e"), false);
  assert.equal(isUsableCompany("The project is a large"), false);
  assert.equal(isUsableCompany("- Софт"), false);
});

test("company inference supports Lobby X and Djinni prose variants", () => {
  assert.equal(
    inferCompanyFromText("Vyriy Industries — українська Defense Tech компанія, що розробляє автономні системи."),
    "Vyriy Industries",
  );
  assert.equal(
    inferCompanyFromText("Occam Industries is a European defence technology company developing autonomous systems."),
    "Occam Industries",
  );
  assert.equal(
    inferCompanyFromText("ДП «Цифрова Армія» — державне підприємство у сфері оборонних технологій."),
    "ДП «Цифрова Армія»",
  );
  assert.equal(
    inferCompanyFromText("About the company: United Tech is a global IT product company.\nRequirements\n- API testing"),
    "United Tech",
  );
});

test("company inference rejects ordinary vacancy metadata as a company", () => {
  assert.equal(
    inferCompanyFromText("Full-time - Work experience more than 2 years.\nRequirements\n- API testing"),
    "",
  );
  assert.equal(
    inferCompanyFromText("Requirements — API testing, SQL, regression testing"),
    "",
  );
});

test("company extraction prefers JobPosting hiringOrganization metadata", () => {
  const html = `
    <html><head>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "QA Engineer",
          "hiringOrganization": { "@type": "Organization", "name": "Ajax Systems" }
        }
      </script>
    </head><body></body></html>
  `;
  assert.equal(extractCompanyFromHtml("https://example.com/jobs/1", html), "Ajax Systems");
});

test("company extraction supports company profile links without using navigation roots", () => {
  const html = `
    <main>
      <a href="/companies/">Companies</a>
      <h1>Manual QA Engineer</h1>
      <a href="/jobs/?company=united-tech-ce985">United Tech</a>
    </main>
  `;
  assert.equal(extractCompanyFromHtml("https://djinni.co/jobs/1", html), "United Tech");
});

test("company extraction supports Djinni's current company-slug route", () => {
  const html = `
    <main>
      <h1>QA Engineer</h1>
      <a href="/jobs/company-dataforest/">Dataforest</a>
      <p>Dataforest is seeking a QA Engineer for web and API testing.</p>
    </main>
  `;
  assert.equal(extractCompanyFromHtml("https://djinni.co/jobs/841628-qa-engineer-with-ai/", html), "Dataforest");
});

test("company recovery uses structural evidence and never description prose", async () => {
  const common = {
    source: "rss:test",
    externalId: "1",
    title: "QA Engineer",
    company: "Unknown",
    location: "Kyiv",
    remote: false,
    url: "https://invalid.example/jobs/1",
    applyUrl: "https://invalid.example/jobs/1",
    salaryText: null,
    postedAt: null,
    contactEmail: null,
  };

  const fromTitle = await recoverJobCompany({
    ...common,
    title: "QA Engineer at MacPaw",
    description: "Software QA role.",
  });
  assert.equal(fromTitle.company, "MacPaw");
  assert.equal((fromTitle.raw as Record<string, unknown>).companySource, "title-derived");

  const fromDescription = await recoverJobCompany({
    ...common,
    description: "Occam Industries is a European defence technology company.\nRequirements\n- API testing",
  });
  assert.equal(fromDescription.company, "Unknown");
});

test("company recovery respects an adapter's exhausted structural lookup", async () => {
  const originalFetch = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = (async () => {
    fetched = true;
    throw new Error("must not fetch");
  }) as typeof fetch;

  try {
    const recovered = await recoverJobCompany({
      source: "lobbyx:test",
      externalId: "1",
      title: "QA Engineer",
      company: "Unknown",
      location: "Ukraine",
      remote: false,
      url: "https://thelobbyx.com/tor/qa-engineer/",
      applyUrl: "https://thelobbyx.com/tor/qa-engineer/",
      description: "Software QA role.",
      salaryText: null,
      postedAt: null,
      contactEmail: null,
      raw: { companySource: "missing" },
    });
    assert.equal(recovered.company, "Unknown");
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("company extraction does not fall back to prose on the vacancy page", () => {
  const html = `
    <main>
      <h1>QA Engineer</h1>
      <p>The project is a large media platform.</p>
      <ul><li>- Hands-on experience with Playwright</li></ul>
    </main>
  `;
  assert.equal(extractCompanyFromHtml("https://example.com/jobs/1", html), "");
});
