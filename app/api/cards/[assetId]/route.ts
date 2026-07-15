import { NextRequest, NextResponse } from "next/server";
import type { JsonObject, ReceizKeyFileV1 } from "@receiz/sdk";
import { admitPublicWildsCard, parsePublicWildsCardRecord, publicWildsCardRecoverySourceUrls, resolveLocalPublicWildsCard, type PublicWildsCardIdentityProof } from "@/features/play/public-card-registry";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { receizRequestSession } from "@/lib/receiz/session";
import { platform } from "@/lib/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReceizKeyFile(value: unknown): value is ReceizKeyFileV1 {
  return isRecord(value) && value.schema === "receiz.key.v1" && value.name === "Receiz Key" && value.version === 1;
}

function compactCardPath(assetId: string) {
  return `/c/${assetId.slice("wilds:".length)}`;
}

function publicationSucceeded(value: unknown) {
  return isRecord(value) && value.ok !== false && (value.ok === true || typeof value.appendAnchorId === "string" || isRecord(value.knownHead));
}

function publicOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host") ?? new URL(request.url).host;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto ?? new URL(request.url).protocol.replace(":", "");
  return `${protocol}://${host}`;
}

export async function POST(request: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  const body = await request.json().catch(() => null) as { asset?: PortableCardAsset; identityProof?: PublicWildsCardIdentityProof } | null;
  if (!body?.asset || body.asset.id !== assetId) return NextResponse.json({ ok: false, error: "wilds_public_card_id_mismatch" }, { status: 400 });

  let record;
  try {
    record = admitPublicWildsCard(body.asset, `${publicOrigin(request)}${compactCardPath(assetId)}`);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "wilds_public_card_invalid" }, { status: 422 });
  }

  const session = receizRequestSession(request);
  const hasPublicationAuthority = Boolean(session.accessToken || isReceizKeyFile(body.identityProof?.keyFile));
  let published = false;
  let publicationError: string | null = null;
  if (hasPublicationAuthority) {
    try {
      const host = new URL(record.sourceUrl).host;
      const adapter = createReceizCommerceAdapter({ accessToken: session.accessToken });
      const base = {
        tenantHost: host,
        merchantReceizId: record.asset.manifest.ownerReceizId,
        title: `${record.asset.manifest.name} living card`,
        sourceUrl: record.sourceUrl,
        namespace: `wilds-card:${record.assetId}`,
        projectionState: "published",
        platform: platform.productName
      };
      const options = { idempotencyKey: `wilds-card:${record.assetId}:${record.asset.proof.digest}` };
      const result = isReceizKeyFile(body.identityProof?.keyFile)
        ? await adapter.publishPublicStoreWithIdentityProof({
          ...base,
          storeStateRecord: record as unknown as JsonObject,
          keyFile: body.identityProof.keyFile,
          passphrase: body.identityProof.passphrase
        }, options)
        : await adapter.publishPublicStore({ ...base, state: record as unknown as JsonObject }, options);
      published = publicationSucceeded(result);
      if (!published && isRecord(result)) publicationError = String(result.error ?? result.message ?? "wilds_public_card_publication_failed");
    } catch (error) {
      published = false;
      publicationError = error instanceof Error ? error.message : "wilds_public_card_publication_failed";
    }
  }
  if (!published) return NextResponse.json({
    ok: false,
    published: false,
    error: publicationError ?? "wilds_public_card_authority_required",
    record
  });
  return NextResponse.json({ ok: true, published: true, record });
}

export async function GET(request: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  const local = resolveLocalPublicWildsCard(assetId);
  if (local) return NextResponse.json({ ok: true, record: local });

  const origin = publicOrigin(request);
  const sourceUrls = publicWildsCardRecoverySourceUrls(assetId, origin, platform.domain);
  for (const sourceUrl of sourceUrls) {
    try {
      const recovered = parsePublicWildsCardRecord(await createReceizCommerceAdapter().readAppStateByUrl(sourceUrl));
      if (recovered?.assetId === assetId) return NextResponse.json({ ok: true, record: recovered });
    } catch {
      // Try the legacy source URL before reporting the verified card unavailable.
    }
  }
  return NextResponse.json({ ok: false, error: "wilds_public_card_not_found" }, { status: 404 });
}
