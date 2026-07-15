import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const baseUrl = (process.env.RECEIZ_BASE_URL || "https://receiz.com").replace(/\/$/, "");
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ ok: false, kind: "unknown", errors: ["unsupported_content_type"], warnings: [] }, { status: 415 });
  }
  const upstream = await fetch(`${baseUrl}/api/document-verify`, {
    method: "POST",
    body: await request.arrayBuffer(),
    headers: { "content-type": contentType },
    cache: "no-store"
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store"
    }
  });
}
