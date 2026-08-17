import { WILDZ_PRODUCT } from "@/lib/wildz/product";

export const dynamic = "force-static";

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;"
  })[character] ?? character);
}

export function GET() {
  const page = escapeXml(WILDZ_PRODUCT.origin);
  const image = escapeXml(`${WILDZ_PRODUCT.origin}${WILDZ_PRODUCT.discoveryImage}`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${page}</loc>
    <image:image>
      <image:loc>${image}</image:loc>
      <image:title>Wildz living creature adventure game</image:title>
      <image:caption>An explorer bonding with a living creature in the Wildz wilderness.</image:caption>
    </image:image>
  </url>
</urlset>`;
  return new Response(xml, {
    headers: {
      "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "content-type": "application/xml; charset=utf-8"
    }
  });
}
