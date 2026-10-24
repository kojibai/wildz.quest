import { NextRequest, NextResponse } from "next/server";
import { renderWildsCardSvg } from "@/features/play/card-export";
import { parsePublicCardParam } from "@/features/play/public-card-registry";
import { resolvePublicWildsCardArtwork } from "@/lib/receiz/wildz-public-card-resolver";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";
import { retainedWildzCardArtwork } from "@/lib/receiz/wildz-prepared-card-artwork";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  try {
    const {assetId: rawAssetId} = await context.params;
    const {assetId} = parsePublicCardParam(rawAssetId);
    const expectedDigest = request.nextUrl.searchParams.get("digest");
    if (expectedDigest !== null && !/^sha256:[a-f0-9]{64}$/.test(expectedDigest)) {
      return NextResponse.json({ok: false, error: "wildz_public_card_digest_invalid"}, {status: 400, headers: {"cache-control": "no-store"}});
    }
    const origin = new URL(request.url).origin;
    const prepared = expectedDigest ? await retainedWildzCardArtwork(assetId, expectedDigest, WILDZ_PRODUCT.origin) : null;
    if (prepared) return new NextResponse(prepared, {
      headers: {"cache-control": "public, max-age=60, stale-while-revalidate=86400", "content-type": "image/svg+xml; charset=utf-8"}
    });
    const asset = await resolvePublicWildsCardArtwork(assetId, WILDZ_PRODUCT.origin, request.nextUrl.searchParams.get("profile") ?? undefined);
    if (!asset) return NextResponse.json({ok: false, error: "wildz_public_card_not_found"}, {status: 404, headers: {"cache-control": "no-store"}});
    if (expectedDigest !== null && asset.proof.digest !== expectedDigest) {
      return NextResponse.json({ok: false, error: "wildz_public_card_revision_changed"}, {status: 409, headers: {"cache-control": "no-store"}});
    }
    return new NextResponse(renderWildsCardSvg(asset, {origin}), {
      headers: {"cache-control": "public, max-age=60, stale-while-revalidate=86400", "content-type": "image/svg+xml; charset=utf-8"}
    });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "wildz_public_card_recovery_failed";
    return NextResponse.json({ok: false, error}, {status: error === "wildz_public_card_id_invalid" ? 400 : 503, headers: {"cache-control": "no-store"}});
  }
}
