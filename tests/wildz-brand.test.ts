import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("metadata and product contract use the Wildz identity", () => {
  const layout = read("app/layout.tsx");
  const product = read("src/lib/wildz/product.ts");
  assert.match(layout, /WILDZ_PRODUCT/);
  assert.match(product, /wildz\.quest/);
  assert.doesNotMatch(layout, /Receiz\.app|ecommerce/i);
});

test("brand provides safe vector mark and wordmark", () => {
  const mark = read("public/brand/wildz-mark.svg");
  const wordmark = read("public/brand/wildz-wordmark.svg");
  assert.match(mark, /<svg[^>]+viewBox="0 0 64 64"/);
  assert.match(mark, /id="wildz-seed"/);
  assert.match(wordmark, /aria-label="Wildz"/);
  assert.doesNotMatch(mark + wordmark, /<script|(?:href|src)="https?:\/\//);
});
