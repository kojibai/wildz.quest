import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";

test("Wildz ships crawlable canonical metadata and honest game structured data", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  const page = readFileSync("app/page.tsx", "utf8");
  const product = readFileSync("src/lib/wildz/product.ts", "utf8");

  assert.match(product, /Wildz: Living Creature Adventure Game/);
  assert.match(layout, /max-image-preview/);
  assert.match(layout, /summary_large_image/);
  assert.match(layout, /width: 1200/);
  assert.match(layout, /height: 630/);
  assert.match(page, /"VideoGame", "SoftwareApplication"/);
  assert.match(page, /primaryImageOfPage/);
  assert.match(page, /isAccessibleForFree: true/);
  assert.match(page, /<h1[^>]*>Wildz living creature adventure game<\/h1>/);
  assert.doesNotMatch(layout, /keywords:/);
});

test("robots and canonical sitemaps expose the public game without crawling private APIs", () => {
  const robots = readFileSync("app/robots.ts", "utf8");
  const sitemap = readFileSync("app/sitemap.ts", "utf8");
  const imageSitemap = readFileSync("app/image-sitemap.xml/route.ts", "utf8");

  assert.match(robots, /disallow: \["\/api\/", "\/test-fixtures\/"\]/);
  assert.match(robots, /image-sitemap\.xml/);
  assert.match(sitemap, /priority: 1/);
  assert.match(imageSitemap, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
  assert.match(imageSitemap, /WILDZ_PRODUCT\.discoveryImage/);
});

test("social and discovery masters have exact fast-preview dimensions", async () => {
  const social = await sharp("public/social/wildz-open-graph.png").metadata();
  const messageFallback = await sharp("public/social/wildz-open-graph.jpg").metadata();
  const discovery = await sharp("public/social/wildz-living-creatures-discover.webp").metadata();

  assert.deepEqual([social.width, social.height], [1200, 630]);
  assert.deepEqual([messageFallback.width, messageFallback.height], [1200, 630]);
  assert.deepEqual([discovery.width, discovery.height], [1280, 720]);
});
