import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import {
  renderWildsCardSvg,
  renderWildsVaultSvg
} from "@/features/play/card-export";
import { verifyAnyWildsCard, type PortableCardAsset } from "@/features/play/portable-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RASTER_REQUEST_BYTES = 16 * 1024 * 1024;
const MAX_VAULT_CARDS = 1_000;

function json(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length && (!Number.isSafeInteger(length) || length > MAX_RASTER_REQUEST_BYTES)) {
      return json("wildz_artifact_image_size_invalid", 413);
    }
    const input = await request.json().catch(() => null) as { kind?: unknown; assets?: unknown } | null;
    if (!input || (input.kind !== "card" && input.kind !== "vault") || !Array.isArray(input.assets)) {
      return json("wildz_artifact_image_request_invalid", 400);
    }
    if (!input.assets.length
      || input.assets.length > (input.kind === "card" ? 1 : MAX_VAULT_CARDS)
      || input.assets.some((asset) => !verifyAnyWildsCard(asset as PortableCardAsset).ok)) {
      return json("wildz_artifact_image_card_invalid", 422);
    }
    const assets = input.assets as PortableCardAsset[];
    const svg = input.kind === "card" ? renderWildsCardSvg(assets[0]!) : renderWildsVaultSvg(assets);
    const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    return new Response(png, {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": "image/png",
        "x-wildz-raster-authority": "verified-card-projection"
      }
    });
  } catch (cause) {
    if (process.env.NODE_ENV !== "production") {
      return json(`wildz_artifact_image_failed:${cause instanceof Error ? cause.message : "unknown"}`, 500);
    }
    return json("wildz_artifact_image_failed", 500);
  }
}
