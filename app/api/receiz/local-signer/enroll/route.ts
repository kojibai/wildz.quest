import { RECEIZ_DEFAULT_BASE_URL } from "@receiz/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public-key enrollment only. Private keys and card payloads never enter this
 * route. The browser validates the returned certificate against pinned roots. */
export async function POST(request: Request) {
  const headers = { "cache-control": "no-store" };
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "origin_mismatch" }, { status: 403, headers });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "invalid_request" }, { status: 400, headers });
  const parts: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 4096) { await reader.cancel(); return Response.json({ error: "request_too_large" }, { status: 413, headers }); }
    parts.push(value);
  }
  const body = new Uint8Array(size); let offset = 0;
  for (const part of parts) { body.set(part, offset); offset += part.length; }
  let row: Record<string, unknown>;
  try { row = JSON.parse(new TextDecoder().decode(body)); } catch { return Response.json({ error: "invalid_request" }, { status: 400, headers }); }
  if (!row || typeof row !== "object" || Object.keys(row).sort().join(",") !== "challengeB64u,challengeSigB64u,publicKeyRawB64u"
    || ![row.publicKeyRawB64u, row.challengeB64u].every(value => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value))
    || typeof row.challengeSigB64u !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(row.challengeSigB64u)) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  }
  try {
    const response = await fetch(`${RECEIZ_DEFAULT_BASE_URL.replace(/\/$/, "")}/api/signer/v4/receiz/enroll`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(row),
      cache: "no-store", signal: AbortSignal.timeout(12000)
    });
    const result = await response.json();
    return Response.json(response.ok ? { ok: true, cert: result.cert } : { error: "device_enrollment_unavailable" }, { status: response.status, headers });
  } catch { return Response.json({ error: "device_enrollment_unavailable" }, { status: 502, headers }); }
}
