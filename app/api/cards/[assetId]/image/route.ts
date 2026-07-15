import { NextRequest, NextResponse } from "next/server";
import { GET as getPublicCard } from "../route";
import { renderWildsCardSvg } from "@/features/play/card-export";
import type { PublicWildsCardRecord } from "@/features/play/public-card-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  const response = await getPublicCard(request, context);
  if (!response.ok) return response;
  const payload = await response.json() as { record?: PublicWildsCardRecord };
  if (!payload.record?.asset) return NextResponse.json({ ok: false, error: "wilds_public_card_not_found" }, { status: 404 });

  return new NextResponse(renderWildsCardSvg(payload.record.asset, { origin: new URL(request.url).origin }), {
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=86400",
      "content-type": "image/svg+xml; charset=utf-8"
    }
  });
}
