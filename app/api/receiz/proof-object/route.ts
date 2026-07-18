import { NextRequest, NextResponse } from "next/server";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import {
  createWildzExportProofObject,
  MAX_WILDZ_PROOF_OBJECT_BYTES
} from "@/lib/receiz/wildz-proof-object-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
const MAX_PROOF_OBJECT_REQUEST_BYTES = MAX_WILDZ_PROOF_OBJECT_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;

function json(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, {
    status,
    headers: { "cache-control": "no-store" }
  });
}

function statusFor(error: string) {
  if (error === "receiz_authority_required" || error === "receiz_profile_required") return 401;
  if (error === "wildz_proof_object_owner_mismatch") return 403;
  if (error === "wildz_proof_object_continuity_invalid") return 502;
  if (error.startsWith("wildz_proof_object_")) return 400;
  return 502;
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
    const actor = await resolveWildzCookieActor(request);
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File) || (kind !== "card" && kind !== "vault")) {
      return json("wildz_proof_object_request_invalid", 400);
    }
    if (!file.size || file.size > MAX_WILDZ_PROOF_OBJECT_BYTES) {
      return json("wildz_proof_object_size_invalid", 413);
    }
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const created = await createWildzExportProofObject({
      actor,
      bytes: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
      kind,
      createProofObject: adapter.client.assets.createProofObject,
      artifacts: {
        verifyAndOpen: adapter.verifyAndOpenArtifact,
        download: adapter.downloadArtifact
      }
    });
    const artifactBytes = created.admitted.artifactBytes;
    const headers = new Headers({
      "cache-control": "no-store",
      "content-disposition": `attachment; filename=${created.admitted.filename}`,
      "content-type": created.admitted.mimeType,
      "x-wildz-proof-authority": "receiz-v111-native-record-seal"
    });
    return new Response(artifactBytes.slice().buffer, { status: 200, headers });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "wildz_proof_object_failed";
    return json(error, statusFor(error));
  }
}
