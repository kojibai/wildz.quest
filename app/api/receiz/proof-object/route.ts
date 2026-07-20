import { NextRequest, NextResponse } from "next/server";
import { RECEIZ_DEFAULT_BASE_URL } from "@receiz/sdk";
import {
  MAX_WILDZ_PROOF_OBJECT_BYTES,
  requireVerifiedWildzPng
} from "@/lib/receiz/wildz-proof-object-export";
import { requireWildzIdentityBindingFromEnvelope } from "@/lib/receiz/wildz-identity-binding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
const MAX_PROOF_OBJECT_REQUEST_BYTES = MAX_WILDZ_PROOF_OBJECT_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;

function json(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, {
    status,
    headers: { "cache-control": "no-store" }
  });
}

function statusFor(error: string) {
  if (error === "wildz_proof_object_continuity_invalid") return 502;
  if (error.startsWith("wildz_restore_")) return 400;
  if (error.startsWith("wildz_proof_object_")) return 400;
  return 502;
}

function upstreamBaseUrl() {
  return (process.env.RECEIZ_BASE_URL || RECEIZ_DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function safeDispositionFilename(disposition: string | null, fallback: string) {
  const value = disposition?.match(/filename=(?:"([^"]+)"|([^;\s]+))/i)?.slice(1).find(Boolean);
  return value && /^[a-zA-Z0-9._-]{1,220}$/.test(value) ? value : `${fallback.replace(/\.png$/i, "")}.receized.png`;
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = request.headers.get("content-length");
    // Safari may stream browser-created multipart FormData without exposing a
    // Content-Length header. Treat the header as an early rejection hint, then
    // enforce the authoritative size limit on the parsed File below.
    if (contentLength !== null) {
      const requestBytes = /^\d+$/.test(contentLength) ? Number(contentLength) : Number.NaN;
      if (!Number.isSafeInteger(requestBytes) || requestBytes <= 0) {
        return json("wildz_proof_object_request_invalid", 400);
      }
      if (requestBytes > MAX_PROOF_OBJECT_REQUEST_BYTES) {
        return json("wildz_proof_object_size_invalid", 413);
      }
    }
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File) || (kind !== "card" && kind !== "vault")) {
      return json("wildz_proof_object_request_invalid", 400);
    }
    if (!file.size || file.size > MAX_WILDZ_PROOF_OBJECT_BYTES) {
      return json("wildz_proof_object_size_invalid", 413);
    }
    const payloadBytes = new Uint8Array(await file.arrayBuffer());
    // The verified Card/Vault proof is the authority. A browser cookie or
    // external login must never outrank or gate the proof being sealed.
    if (kind === "vault") {
      try {
        requireVerifiedWildzPng(kind, payloadBytes);
      } catch {
        // Identity-bound Vaults intentionally carry their signed Identity Seal
        // and binding after the PNG IEND. Verify that complete envelope instead.
        await requireWildzIdentityBindingFromEnvelope(payloadBytes);
      }
    } else {
      requireVerifiedWildzPng(kind, payloadBytes);
    }
    const upstreamForm = new FormData();
    upstreamForm.set("file", new File([payloadBytes.slice().buffer], file.name, { type: "image/png" }));
    upstreamForm.set("visualStamp", "0");
    const upstream = await fetch(`${upstreamBaseUrl()}/api/document-seal`, {
      method: "POST",
      body: upstreamForm,
      cache: "no-store"
    });
    if (!upstream.ok) {
      const payload = await upstream.json().catch(() => null) as { error?: string; message?: string } | null;
      throw new Error(payload?.error || payload?.message || "wildz_proof_object_seal_failed");
    }
    const artifactBytes = new Uint8Array(await upstream.arrayBuffer());
    const mimeType = upstream.headers.get("content-type")?.split(";", 1)[0]?.trim() || "application/octet-stream";
    const filename = safeDispositionFilename(upstream.headers.get("content-disposition"), file.name);
    const headers = new Headers({
      "cache-control": "no-store",
      "content-disposition": `attachment; filename=${filename}`,
      "content-type": mimeType,
      "x-wildz-proof-authority": "receiz-sealed-artifact"
    });
    return new Response(artifactBytes.slice().buffer, { status: 200, headers });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "wildz_proof_object_failed";
    return json(error, statusFor(error));
  }
}
