import { createReceizClient } from "@receiz/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  canonicalWildzHandle,
  sanitizePublicWildzProfile
} from "@/features/profile/public-profile";
import { verifyAnyWildsCard } from "@/features/play/portable-card";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import { createReceizWildzPublicRepository } from "@/lib/receiz/wildz-public-repository";
import {
  loadVerifiedWildzPublicOwnershipAuthority,
  requireCurrentWildzPublicOwner
} from "@/lib/receiz/wildz-public-ownership";
import { publishPublicWildzProfile, resolvePublicWildzProfile } from "@/lib/receiz/wildz-profile-adapter";
import { parseSignedWildzProfilePublication } from "@/lib/receiz/wildz-profile-publication-envelope";
import { resolveSdkPublicWildzCard } from "@/lib/receiz/wildz-market-public-card";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";
import { canonicalWildzProfilePath } from "@/features/profile/public-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200, publicProjection = false) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": status === 200 ? "public, max-age=60, stale-while-revalidate=300" : "no-store",
      ...(publicProjection ? { "x-wildz-public-projection": "sanitized" } : {})
    }
  });
}

function profileError(cause: unknown) {
  const error = cause instanceof Error ? cause.message : "wildz_public_profile_invalid";
  if (error === "unauthorized" || error === "receiz_identity_key_required" || error === "receiz_authority_required") return json({ ok: false, error }, 401);
  if (error === "receiz_profile_required"
    || error === "wildz_public_profile_owner_mismatch"
    || error === "wildz_public_profile_card_not_owned"
    || error === "wildz_public_profile_card_unverified") return json({ ok: false, error }, 403);
  if (error.includes("conflict")) return json({ ok: false, error }, 409);
  if (error.includes("publish") || error.includes("unconfirmed") || error.includes("unavailable")) {
    return json({ ok: false, error }, 503);
  }
  return json({ ok: false, error }, 400);
}

export async function GET(_request: NextRequest, context: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await context.params;
    const username = canonicalWildzHandle(handle);
    const repository = createReceizWildzPublicRepository({ adapter: createReceizCommerceAdapter() });
    const profile = await resolvePublicWildzProfile(username)
      ?? (await repository.load()).state.profiles[username.toLowerCase()] ?? null;
    return profile
      ? json({ ok: true, profile }, 200, true)
      : json({ ok: false, error: "wildz_public_profile_not_found" }, 404);
  } catch (cause) {
    return profileError(cause);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await context.params;
    const requestedHandle = canonicalWildzHandle(handle);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("wildz_public_profile_invalid");
    const profile = sanitizePublicWildzProfile(body.signedPublication ? body.profile : body);
    if (profile.username !== requestedHandle) throw new Error("wildz_public_profile_owner_mismatch");
    const signed = body.signedPublication ? parseSignedWildzProfilePublication(body.signedPublication, profile) : null;
    const actor = signed ? null : await resolveWildzCookieActor(request);
    // A proof session identifies the player but does not supply a registry write token.
    // Let a matching local Identity Seal sign, including after switching Connect accounts.
    if (!signed && (!actor?.accessToken || requestedHandle !== canonicalWildzHandle(actor.actorId))) {
      throw new Error("receiz_authority_required");
    }
    const actorId = requestedHandle.slice(1);
    const adapter = createReceizCommerceAdapter(actor?.accessToken ? {accessToken: actor.accessToken} : undefined);
    const ownershipAuthority = await loadVerifiedWildzPublicOwnershipAuthority(adapter);
    const requestedCardIds = new Set<string>();
    for (const requested of profile.vault) {
      if (requestedCardIds.has(requested.id)) throw new Error("wildz_public_profile_card_unverified");
      requestedCardIds.add(requested.id);
    }
    // Bound network concurrency without serializing up to 120 independent public reads.
    for (let offset = 0; offset < profile.vault.length; offset += 6) {
      await Promise.all(profile.vault.slice(offset, offset + 6).map(async requested => {
        const card = await resolveSdkPublicWildzCard(requested.id, {adapter, requestOrigin: WILDZ_PRODUCT.origin});
        if (!card || !verifyAnyWildsCard(card).ok || card.proof.digest !== requested.proofDigest) {
          throw new Error("wildz_public_profile_card_unverified");
        }
        requireCurrentWildzPublicOwner(ownershipAuthority, card, actorId, "wildz_public_profile_card_not_owned");
      }));
    }

    if (signed) {
      const result = await createReceizClient().publicStore.publishSigned(signed.signed, {
        idempotencyKey: `wildz-profile:${requestedHandle.slice(1)}:${signed.record.publishedAt}`
      });
      if (result.ok !== true || !result.appendAnchorId || result.knownHead?.appendAnchorId !== result.appendAnchorId) {
        throw new Error("wildz_public_profile_publication_unconfirmed");
      }
    } else {
      await publishPublicWildzProfile(profile as unknown as Record<string, unknown>, {
        adapter, merchantReceizId: actor!.profileHandle,
        sourceUrl: `${WILDZ_PRODUCT.origin}${canonicalWildzProfilePath(requestedHandle)}`
      });
    }
    return json({ ok: true, published: true, profile }, 201);
  } catch (cause) {
    return profileError(cause);
  }
}
