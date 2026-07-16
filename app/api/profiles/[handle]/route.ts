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
import { advanceWildzPublicState } from "@/lib/receiz/wildz-public-state";

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
  if (error === "receiz_authority_required") return json({ ok: false, error }, 401);
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
    const profile = (await repository.load()).state.profiles[username.toLowerCase()] ?? null;
    return profile
      ? json({ ok: true, profile }, 200, true)
      : json({ ok: false, error: "wildz_public_profile_not_found" }, 404);
  } catch (cause) {
    return profileError(cause);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ handle: string }> }) {
  try {
    const actor = await resolveWildzCookieActor(request);
    const { handle } = await context.params;
    const requestedHandle = canonicalWildzHandle(handle);
    if (requestedHandle !== canonicalWildzHandle(actor.actorId)) {
      throw new Error("wildz_public_profile_owner_mismatch");
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("wildz_public_profile_invalid");
    const profile = sanitizePublicWildzProfile(body as Record<string, unknown>);
    if (profile.username !== requestedHandle) throw new Error("wildz_public_profile_owner_mismatch");

    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const repository = createReceizWildzPublicRepository({ adapter });
    const current = await repository.load();
    const ownershipAuthority = await loadVerifiedWildzPublicOwnershipAuthority(adapter);
    const requestedCardIds = new Set<string>();
    for (const requested of profile.vault) {
      const card = current.state.cards[requested.id];
      if (requestedCardIds.has(requested.id)
        || !card
        || !verifyAnyWildsCard(card).ok
        || card.proof.digest !== requested.proofDigest) {
        throw new Error("wildz_public_profile_card_unverified");
      }
      requireCurrentWildzPublicOwner(
        ownershipAuthority,
        card,
        actor.actorId,
        "wildz_public_profile_card_not_owned"
      );
      requestedCardIds.add(requested.id);
    }

    const occurredAt = new Date().toISOString();
    const next = advanceWildzPublicState(current.state, {
      type: "publish-profile",
      actorHandle: requestedHandle,
      expectedRevision: current.state.revision,
      profile
    }, { occurredAt });
    await repository.publish(next, {
      expectedHead: current.head,
      idempotencyKey: `profile:${requestedHandle}:${next.revision}`,
      merchantReceizId: actor.receizUserId
    });
    return json({ ok: true, published: true, profile }, 201);
  } catch (cause) {
    return profileError(cause);
  }
}
