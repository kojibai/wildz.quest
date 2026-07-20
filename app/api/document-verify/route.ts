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

export const runtime = "nodejs";

export async function POST(request: Request) {
  const baseUrl = (process.env.RECEIZ_BASE_URL || "https://receiz.com").replace(/\/$/, "");
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ ok: false, kind: "unknown", errors: ["unsupported_content_type"], warnings: [] }, { status: 415 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, kind: "unknown", errors: ["file_required"], warnings: [] }, { status: 400 });
  }
  if (request.headers.get("x-wildz-artifact-open") === "v113") {
    try {
      const filename = file instanceof File ? file.name : "wildz.receized";
      const client = createReceizClient({ baseUrl });
      const admitted = await openWildzArtifact(file, filename, client.artifacts);
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
  const upstreamForm = new FormData();
  upstreamForm.set("file", file, file instanceof File ? file.name : "wildz-vault.receized.png");
  const upstream = await fetch(`${baseUrl}/api/document-verify`, {
    method: "POST",
    body: upstreamForm,
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
      const bytes = new Uint8Array(await file.arrayBuffer());
      const codec = createWildzArtifactCodec({
        identityRepository: {
          prepare: async () => { throw new Error("wildz_server_identity_import_not_allowed"); }
        },
        commerceVaultReader: { inspect: inspectReceizCommerceVault }
      });
      const verified = await verifyProofSealedWildzVault({
        bytes,
        mimeType: file.type || "application/octet-stream",
        name: file instanceof File ? file.name : null,
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
