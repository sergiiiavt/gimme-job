import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const { parseWorkUaListing } = await import("../agent/src/sources/workua.ts");
const { inferCompanyFromDescription, parseLobbyXDescription, parseLobbyXListing } = await import(
  "../agent/src/sources/lobbyx.ts"
);

const WORK_UA_FIXTURE = `
<div class="mb-lg ">
  <h2 class="my-0">
    <a tabindex="-1" href="/en/jobs/8336058/" title="QA Engineer (Apps), job from August 10, 2026">QA Engineer (Apps)</a>
  </h2>
</div><div class="mt-sm">
  <div class="text-indent"><span class="glyphicon glyphicon-company glyphicon-fs-24" title="Company Information"></span><span class="">
  <span class="strong-600">Ajax Systems</span></span><span class="">Kyiv</span></div>
</div>
<p class="ellipsis ellipsis-line ellipsis-line-3 text-default-7 mb-0">
  Full-time. Work experience more than 1 year.
  Ajax Systems is looking for a QA Engineer to join the mobile apps team&hellip;
</p>

<div class="mb-lg ">
  <h2 class="my-0">
    <a tabindex="-1" href="/en/jobs/8009646/" title="Hidden company role, job from August 12, 2026">Hidden company role</a>
  </h2>
</div><div class="mt-sm">
  <div class="text-indent"><span class="glyphicon glyphicon-company glyphicon-fs-24" title="Company Information"></span><span class="mr-xs">
  <span class="strong-600">Company is hidden</span></span><ul class="list-unstyled my-0"><li>badge</li></ul><span class="">Dnipro</span></div>
</div>
<p class="ellipsis ellipsis-line ellipsis-line-3 text-default-7 mb-0">
  Full-time. Some description text for the hidden-company listing&hellip;
</p>
`;

const LOBBY_X_TOR_LIST = [
  {
    id: 77271,
    date: "2026-02-20T14:54:47",
    link: "https://thelobbyx.com/tor/qa-automation-engineer-sap/",
    title: { rendered: "QA Automation Engineer (SAP S/4HANA)" },
  },
  {
    id: 1,
    date: null,
    link: "",
    title: { rendered: "" },
  },
];

const LOBBY_X_DETAIL_HTML = `
<html><body>
<div class="wrapper"><div class="container vacancy-description">
  <h2>Огляд</h2>
  <p>Vyriy Industries — українська Defense Tech компанія, що розробляє автономні системи.</p>
  <h2>Обов'язки</h2>
  <ul><li>побудова системи забезпечення якості</li></ul>
</div></div>
<div class="unrelated">should not be included</div>
</body></html>
`;

test("parseWorkUaListing extracts title/company/location and skips incomplete cards", () => {
  const listings = parseWorkUaListing(WORK_UA_FIXTURE, "https://www.work.ua");

  assert.equal(listings.length, 2);

  assert.equal(listings[0].url, "https://www.work.ua/en/jobs/8336058");
  assert.equal(listings[0].title, "QA Engineer (Apps)");
  assert.equal(listings[0].company, "Ajax Systems");
  assert.equal(listings[0].location, "Kyiv");
  assert.match(listings[0].description, /mobile apps team/);

  assert.equal(listings[1].company, "Unknown", "'Company is hidden' should map to Unknown");
  assert.equal(listings[1].location, "Dnipro");
});

test("parseLobbyXListing decodes titles and drops incomplete entries", () => {
  const listings = parseLobbyXListing(LOBBY_X_TOR_LIST);

  assert.equal(listings.length, 1);
  assert.equal(listings[0].id, 77271);
  assert.equal(listings[0].title, "QA Automation Engineer (SAP S/4HANA)");
  assert.equal(listings[0].url, "https://thelobbyx.com/tor/qa-automation-engineer-sap");
  assert.equal(listings[0].postedAt, new Date("2026-02-20T14:54:47").toISOString());
});

test("parseLobbyXDescription extracts only the vacancy-description container", () => {
  const description = parseLobbyXDescription(LOBBY_X_DETAIL_HTML);

  assert.match(description, /Vyriy Industries/);
  assert.match(description, /побудова системи забезпечення якості/);
  assert.doesNotMatch(description, /should not be included/);
});

test("inferCompanyFromDescription recognizes the 'Name — description' convention", () => {
  assert.equal(
    inferCompanyFromDescription("Vyriy Industries — українська Defense Tech компанія"),
    "Vyriy Industries",
  );
  assert.equal(
    inferCompanyFromDescription("ДП «Цифрова Армія» — державне підприємство"),
    "ДП «Цифрова Армія»",
  );
  assert.equal(inferCompanyFromDescription("No dash prefix here at all."), "Unknown");
});
