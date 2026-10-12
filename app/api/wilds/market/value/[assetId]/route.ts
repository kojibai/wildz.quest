import { NextRequest, NextResponse } from "next/server";
import { canonicalizeReceizV122, createReceizClient, ReceizHttpError } from "@receiz/sdk";
import {
  parseSignedWildzMarketValuePublicationV129, readWildzMarketPublicValueRecordV129,
  verifyWildzMarketPublicValueRootV129
} from "@/lib/receiz/wildz-market-public-value-source-v129";
import { wildzNativeApplicationId } from "@/lib/receiz/wildz-native-application";
import { readWildzMarketPublicSourceProofV128, verifyWildzMarketSourceProofV128 } from "@/lib/receiz/wildz-market-source-repository-v128";
import { wildzMarketValueListingBindsCardV129 } from "@/lib/receiz/wildz-market-value-listing-guard-v129";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "no-store" };
const MAX_REQUEST_BYTES = 3 * 1024 * 1024;
const sdk = (applicationId?: string) => createReceizClient({ baseUrl: process.env.RECEIZ_BASE_URL ?? "https://receiz.com", ...(applicationId ? { applicationId } : {}) });
function error(code: string, status: number) { return NextResponse.json({ ok: false, error: code }, { status, headers }); }
async function asset(context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  if (!/^wilds:[a-f0-9]{24}$/.test(assetId)) throw Error("wildz_market_value_asset_invalid");
  return assetId;
}

/** Anonymous exact public bytes only. No grant, key, native operation or seal. */
export async function GET(request: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  try {
    const assetId = await asset(context);
    if (request.nextUrl.searchParams.size) return error("wildz_market_value_query_invalid", 400);
    const record = await readWildzMarketPublicValueRecordV129(sdk(), assetId);
    return record ? NextResponse.json({ ok: true, record }, { headers }) : error("wildz_market_value_not_published", 404);
  } catch (cause) {
    return error(cause instanceof Error && cause.message === "wildz_market_value_asset_invalid" ? cause.message : "wildz_market_value_public_read_unavailable", cause instanceof Error && cause.message === "wildz_market_value_asset_invalid" ? 400 : 503);
  }
}

/** The Identity Seal signed-public-store rail verifies the actual publisher.
 * Its first source additionally requires a native seller listing for this card.
 * The fixed publication key preserves first issuance across lost responses. */
export async function POST(request: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  try {
    const assetId = await asset(context);
    if (request.nextUrl.searchParams.size || !request.body) return error("wildz_market_value_request_invalid", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    const reader = request.body.getReader();
    try {
      for (;;) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.length;
        if (size > MAX_REQUEST_BYTES) { await reader.cancel(); return error("wildz_market_value_request_too_large", 413); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let payload: unknown;
    try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { return error("wildz_market_value_request_invalid", 400); }
    const { record, signed } = parseSignedWildzMarketValuePublicationV129(payload);
    const applicationId = wildzNativeApplicationId();
    if (record.assetId !== assetId || record.applicationId !== applicationId) return error("wildz_market_value_application_binding_invalid", 400);
    const root = await verifyWildzMarketPublicValueRootV129(record);
    if (root.verification.continuity.state !== "verified" || root.verification.continuity.ownerReceizId !== record.publisherHandle)
      return error("wildz_market_value_publisher_binding_invalid", 403);
    const client = sdk(applicationId);
    const prior = await readWildzMarketPublicValueRecordV129(client, assetId);
    if (prior) {
      if (canonicalizeReceizV122(prior) !== canonicalizeReceizV122(record)) return error("wildz_market_value_origin_conflict", 409);
      return NextResponse.json({ ok: true, record: prior }, { headers });
    }
    // A copied public card plus a stranger's document seal cannot preempt the
    // seller's issuance. Admission is from the actual existing native journal.
    const source = await readWildzMarketPublicSourceProofV128(client);
    if (!source) return error("wildz_market_value_native_listing_required", 409);
    const native = await verifyWildzMarketSourceProofV128(client, source, { applicationId, historical: true });
    const listed = Object.values(native.state.listings).some(listing =>
      wildzMarketValueListingBindsCardV129(listing, record.publisherHandle, root.card, root.certificate));
    if (!listed) return error("wildz_market_value_native_listing_required", 409);
    const result = await client.publicStore.publishSigned(signed, { idempotencyKey: `wildz:market-public-value:${assetId}` });
    if (result.ok !== true || !result.appendAnchorId || result.knownHead?.appendAnchorId !== result.appendAnchorId)
      return error("wildz_market_value_publication_unconfirmed", 503);
    const confirmed = await readWildzMarketPublicValueRecordV129(client, assetId);
    if (!confirmed || canonicalizeReceizV122(confirmed) !== canonicalizeReceizV122(record)) return error("wildz_market_value_publication_unconfirmed", 503);
    return NextResponse.json({ ok: true, record: confirmed }, { status: 201, headers });
  } catch (cause) {
    const status = cause instanceof ReceizHttpError && [400,401,403,409,413,429].includes(cause.status) ? cause.status
      : cause instanceof Error && cause.message.startsWith("wildz_market_value_") ? 400 : 503;
    return error(cause instanceof Error && /^wildz_market_value_[a-z_]{2,90}$/.test(cause.message) ? cause.message : "wildz_market_value_publication_failed", status);
  }
}
