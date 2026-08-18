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
});

test("company inference supports Lobby X dash and sentence variants", () => {
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

test("company extraction supports company profile links used by job boards", () => {
  const html = `
    <main>
      <h1>Manual QA Engineer</h1>
      <a class="company" href="/companies/united-tech/">United Tech</a>
    </main>
  `;
  assert.equal(extractCompanyFromHtml("https://djinni.co/jobs/1", html), "United Tech");
});

test("company recovery uses title and description before another network request", async () => {
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

  const fromDescription = await recoverJobCompany({
    ...common,
    description: "Occam Industries is a European defence technology company.\nRequirements\n- API testing",
  });
  assert.equal(fromDescription.company, "Occam Industries");
});
