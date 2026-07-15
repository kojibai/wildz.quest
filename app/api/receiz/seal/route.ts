export const runtime = "nodejs";

export async function POST(request: Request) {
  const baseUrl = (process.env.RECEIZ_BASE_URL || "https://receiz.com").replace(/\/$/, "");
  const contentType = request.headers.get("content-type") ?? "";
  const upstream = await fetch(`${baseUrl}/api/document-seal`, {
    method: "POST",
    body: await request.arrayBuffer(),
    headers: { "content-type": contentType },
    cache: "no-store"
  });
  const headers = new Headers();
  for (const key of ["content-type", "content-disposition", "x-receiz-verify-path", "x-receiz-verify-url"]) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set("cache-control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers });
}
