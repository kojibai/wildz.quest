import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";
import { publicPageMetadata } from "../src/lib/wildz/search-metadata";

test("page-specific previews override the shared artwork for Open Graph and Twitter", () => {
  const metadata = publicPageMetadata(
    "Wildz Market", "Find your legend.", "/market",
    { url: "/social/wildz-market-open-graph.png", alt: "Wildz Market creature cards in a living forest" }
  );
  assert.deepEqual(metadata.openGraph?.images, [{
    url: "https://wildz.quest/social/wildz-market-open-graph.png",
    secureUrl: "https://wildz.quest/social/wildz-market-open-graph.png",
    width: 1200, height: 630, type: "image/png",
    alt: "Wildz Market creature cards in a living forest"
  }]);
  assert.deepEqual(metadata.twitter?.images, [{
    url: "https://wildz.quest/social/wildz-market-open-graph.png",
    alt: "Wildz Market creature cards in a living forest"
  }]);
  assert.equal(metadata.alternates?.canonical, "/market");
  assert.equal(metadata.openGraph?.url, "/market");
  assert.notDeepEqual(publicPageMetadata("Explorer guide", "Explore.", "/guide").openGraph?.images, metadata.openGraph?.images);
});

test("JPEG page previews declare the matching Open Graph media type", () => {
  const metadata = publicPageMetadata("Wildz Market", "Find your legend.", "/market", {
    url: "/social/wildz-market-open-graph.jpg", alt: "Wildz Market creature cards"
  });
  assert.deepEqual(metadata.openGraph?.images, [{
    url: "https://wildz.quest/social/wildz-market-open-graph.jpg",
    secureUrl: "https://wildz.quest/social/wildz-market-open-graph.jpg",
    width: 1200, height: 630, type: "image/jpeg", alt: "Wildz Market creature cards"
  }]);
  assert.deepEqual(metadata.twitter?.images, [{
    url: "https://wildz.quest/social/wildz-market-open-graph.jpg", alt: "Wildz Market creature cards"
  }]);
});

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

test("Market preview files are public raster images sized for large social cards", async () => {
  for (const [extension, format] of [["png", "png"], ["jpg", "jpeg"]]) {
    const path = `public/social/wildz-market-open-graph.${extension}`;
    const image = await sharp(path).metadata();
    assert.deepEqual([image.width, image.height], [1200, 630]);
    assert.equal(image.format, format);
    assert.equal(image.hasAlpha, false);
    assert.ok(statSync(path).size < 1_500_000, "Preview must remain small enough for message crawlers");
  }
});


test("public page metadata keeps each canonical and preview specific to that page", () => {
  const guide = publicPageMetadata("Explorer guide", "Learn to explore.", "/guide");
  const about = publicPageMetadata("About Wildz", "Official game information.", "/about");
  assert.equal(guide.alternates?.canonical, "/guide");
  assert.equal(about.alternates?.canonical, "/about");
  assert.equal(guide.openGraph?.url, "/guide");
  assert.equal(guide.openGraph?.description, "Learn to explore.");
  assert.equal(guide.twitter?.description, "Learn to explore.");
  assert.equal(guide.openGraph?.title, "Explorer guide · Wildz");
  assert.notDeepEqual(guide, about);
});

test("discovery routes stay outside gameplay and crawlers can render published profiles", () => {
  for (const path of ["app/guide/page.tsx", "app/about/page.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /["']use client["']|@receiz|features\/play|useEffect|useFrame/);
    assert.match(source, /prefetch=\{false\}/);
  }
  const robots = readFileSync("app/robots.ts", "utf8");
  assert.match(robots, /allow:.*"\/api\/profiles\/"/);
  for (const path of ["app/claim/layout.tsx", "app/test-fixtures/layout.tsx", "app/offline/page.tsx"]) {
    assert.match(readFileSync(path, "utf8"), /index: false/);
  }
});
