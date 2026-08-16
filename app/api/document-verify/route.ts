import { NextResponse } from "next/server";
import { createReceizClient, type DocumentVerifyResponse } from "@receiz/sdk";
import { inspectReceizCommerceVault } from "@/lib/receiz/receiz-commerce-vault";
import { createWildzArtifactCodec } from "@/lib/receiz/wildz-artifact-codec";
import { verifyProofSealedWildzVault } from "@/lib/receiz/wildz-proof-sealed-vault";
import {
  WILDZ_VAULT_PENDING_COOKIE,
  createWildzVaultProofSession,
  packWildzVaultPendingAdmission,
  wildzVaultPendingCookieOptions
} from "@/lib/receiz/wildz-proof-session";
import { deriveWildzVaultCardAdmission } from "@/lib/receiz/wildz-vault-card-admission";
import { openWildzArtifact } from "@/lib/receiz/wildz-artifact-custody";
import { encodeWildzMultipartFile, readWildzHttpArtifact } from "@/lib/receiz/wildz-http-artifact";

export const runtime = "nodejs";
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;

export async function POST(request: Request) {
  const baseUrl = (process.env.RECEIZ_BASE_URL || "https://receiz.com").replace(/\/$/, "");
  let uploaded: Awaited<ReturnType<typeof readWildzHttpArtifact>>;
  try {
    uploaded = await readWildzHttpArtifact(request, {
      fallbackFilename: "wildz-vault.receized.png",
      maximumBytes: MAX_ARTIFACT_BYTES
    });
  } catch (cause) {
    return NextResponse.json({
      ok: false,
      kind: "unknown",
      errors: [cause instanceof Error ? cause.message : "wildz_artifact_upload_invalid"],
      warnings: []
    }, { status: 400 });
  }
  const file = new File([uploaded.bytes.slice().buffer], uploaded.filename, { type: uploaded.mimeType });
  if (request.headers.get("x-wildz-artifact-open") === "v119") {
    try {
      const client = createReceizClient({ baseUrl });
      const admitted = await openWildzArtifact(file, uploaded.filename, client.artifacts);
      return NextResponse.json({
        artifactSha256: admitted.artifactSha256,
        payloadSha256: admitted.payloadSha256,
        payloadBase64Url: Buffer.from(admitted.payloadBytes).toString("base64url"),
        filename: admitted.filename,
        mimeType: admitted.mimeType,
        ownerReceizId: admitted.ownerReceizId,
        claimId: admitted.claimId,
        verifyPath: admitted.verifyPath,
        recordId: admitted.recordId,
        compatibility: admitted.compatibility
      }, { headers: { "cache-control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "wildz_artifact_verification_failed" }, {
        status: 422,
        headers: { "cache-control": "no-store" }
      });
    }
  }
  const upstreamMultipart = encodeWildzMultipartFile({
    bytes: uploaded.bytes,
    filename: uploaded.filename,
    mimeType: uploaded.mimeType
  });
  const upstream = await fetch(`${baseUrl}/api/document-verify`, {
    method: "POST",
    headers: upstreamMultipart.headers,
    body: upstreamMultipart.body,
    cache: "no-store"
  });
  const verification = await upstream.json().catch(() => ({
    ok: false,
    kind: "unknown",
    errors: ["receiz_document_verify_response_invalid"],
    warnings: []
  })) as DocumentVerifyResponse;
  const response = NextResponse.json(verification, {
    status: upstream.status,
    headers: { "cache-control": "no-store" }
  });

  if (upstream.ok && request.headers.get("x-wildz-proof-login") === "vault") {
    try {
      const bytes = uploaded.bytes;
      const codec = createWildzArtifactCodec({
        identityRepository: {
          prepare: async () => { throw new Error("wildz_server_identity_import_not_allowed"); }
        },
        commerceVaultReader: { inspect: inspectReceizCommerceVault }
      });
      const verified = await verifyProofSealedWildzVault({
        bytes,
        mimeType: uploaded.mimeType,
        name: uploaded.filename,
        codec,
        verifier: { verifyArtifact: async () => verification }
      });
      const session = createWildzVaultProofSession({
        actorId: verified.player.actorId,
        profileHandle: verified.player.profileHandle,
        proofBasisSha256: verified.proofBasisSha256,
        byteDigestSha256: verified.byteDigestSha256,
        vaultCardRootSha256: deriveWildzVaultCardAdmission({
          cards: verified.assets,
          playerHandle: verified.player.profileHandle
        }).root
      });
      response.cookies.set(
        WILDZ_VAULT_PENDING_COOKIE,
        packWildzVaultPendingAdmission(session),
        wildzVaultPendingCookieOptions()
      );
    } catch {
      return NextResponse.json({
        ...verification,
        ok: false,
        errors: [
          ...new Set([
            ...(Array.isArray(verification.errors) ? verification.errors : []),
            "wildz_vault_login_session_unavailable"
          ])
        ]
      }, {
        status: 503,
        headers: { "cache-control": "no-store" }
      });
    }
  }
  return response;
}
