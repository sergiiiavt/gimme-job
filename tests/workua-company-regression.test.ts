import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const { parseWorkUaListing } = await import("../agent/src/sources/workua.ts");

test("Work.ua parser keeps legitimate company names containing digits", () => {
  const html = `
    <div class="mb-lg ">
      <h2 class="my-0">
        <a href="/en/jobs/9999999/">QA Engineer</a>
      </h2>
    </div>
    <div class="mt-sm">
      <div class="text-indent">
        <span class="glyphicon glyphicon-company glyphicon-fs-24" title="Company Information"></span>
        <span class=""><span class="strong-600">3DTech</span></span>
        <span class="">Kyiv</span>
      </div>
    </div>
    <p class="ellipsis ellipsis-line ellipsis-line-3 text-default-7 mb-0">
      Software QA testing for web and embedded products.
    </p>
  `;

  const [listing] = parseWorkUaListing(html);
  assert.ok(listing);
  assert.equal(listing.company, "3DTech");
  assert.equal(listing.location, "Kyiv");
});
