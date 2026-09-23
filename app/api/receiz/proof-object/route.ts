import { NextRequest, NextResponse } from "next/server";
import { createReceizClient, RECEIZ_DEFAULT_BASE_URL } from "@receiz/sdk";
import {
  MAX_WILDZ_PROOF_OBJECT_BYTES,
  createWildzExportProofObject
} from "@/lib/receiz/wildz-proof-object-export";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import {
  readWildzHttpArtifact
} from "@/lib/receiz/wildz-http-artifact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
const MAX_PROOF_OBJECT_REQUEST_BYTES = MAX_WILDZ_PROOF_OBJECT_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;
const WILDZ_PROOF_OBJECT_UPSTREAM_TIMEOUT_MS = 25_000;

function json(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, {
    status,
    headers: { "cache-control": "no-store" }
  });
}

function statusFor(error: string) {
  if (error === "receiz_authority_required" || error === "receiz_identity_key_required") return 401;
  if (error === "wildz_proof_object_seal_timeout") return 504;
  if (error === "wildz_proof_object_continuity_invalid") return 502;
  if (error.startsWith("wildz_restore_")) return 400;
  if (error.startsWith("wildz_proof_object_")) return 400;
  return 502;
}

function upstreamBaseUrl() {
  return (process.env.RECEIZ_BASE_URL || RECEIZ_DEFAULT_BASE_URL).replace(/\/+$/, "");
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
    const uploaded = await readWildzHttpArtifact(request, {
      fallbackFilename: "wildz-proof-object.png",
      maximumBytes: MAX_WILDZ_PROOF_OBJECT_BYTES
    });
    const multipartKind = uploaded.form?.get("kind");
    const headerKind = request.headers.get("x-wildz-proof-kind");
    const kind = multipartKind ?? headerKind;
    if (kind !== "card" && kind !== "vault" && kind !== "map" && kind !== "identity") {
      return json("wildz_proof_object_request_invalid", 400);
    }
    const actor = await resolveWildzCookieActor(request);
    if (!actor.accessToken) return json("receiz_authority_required", 401);
    const client = createReceizClient({
      baseUrl: upstreamBaseUrl(), accessToken: actor.accessToken,
      fetchImpl: (url, init) => fetch(url, { ...init, cache: "no-store",
        signal: AbortSignal.timeout(WILDZ_PROOF_OBJECT_UPSTREAM_TIMEOUT_MS) })
    });
    const { admitted } = await createWildzExportProofObject({
      actor, bytes: uploaded.bytes, filename: uploaded.filename, kind,
      createProofObject: client.assets.createProofObject, artifacts: client.artifacts
    });
    const { artifactBytes, filename, mimeType } = admitted;
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
