import { NextRequest, NextResponse } from "next/server";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import {
  normalizeWildsWalletPublicUsername,
  projectWildsWalletRecipient
} from "@/lib/receiz/wilds-wallet-projections";
import {
  resolveWildsWalletReadAuthority,
  wildsWalletAuthorityStatusFor
} from "@/lib/receiz/wilds-wallet-route-authority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECIPIENT_LOOKUP_LIMIT = 6;
const RECIPIENT_LOOKUP_WINDOW_MS = 60_000;
const MAX_RECIPIENT_LOOKUP_ACTORS = 1_024;
const recipientLookups = new Map<string, { count: number; startedAt: number }>();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

function assertExactFields(value: unknown, fields: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("wilds_wallet_request_fields_invalid");
  const body = value as Record<string, unknown>;
  if (!fields.every((field) => Object.hasOwn(body, field)) || !Object.keys(body).every((field) => fields.includes(field))) {
    throw new Error("wilds_wallet_request_fields_invalid");
  }
  return body;
}

async function readJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    throw new Error("wilds_wallet_request_fields_invalid");
  }
}

function admitRecipientLookup(actorId: string) {
  const now = Date.now();
  const previous = recipientLookups.get(actorId);
  if (!previous || now - previous.startedAt >= RECIPIENT_LOOKUP_WINDOW_MS) {
    recipientLookups.set(actorId, { count: 1, startedAt: now });
  } else if (previous.count >= RECIPIENT_LOOKUP_LIMIT) {
    throw new Error("receiz_wallet_recipient_rate_limited");
  } else {
    previous.count += 1;
  }
  if (recipientLookups.size > MAX_RECIPIENT_LOOKUP_ACTORS) {
    for (const [key, value] of recipientLookups) {
      if (now - value.startedAt >= RECIPIENT_LOOKUP_WINDOW_MS || recipientLookups.size > MAX_RECIPIENT_LOOKUP_ACTORS) {
        recipientLookups.delete(key);
      }
    }
  }
}

function failure(cause: unknown) {
  const code = cause instanceof Error ? cause.message : "receiz_wallet_recipient_unavailable";
  if (code === "wilds_wallet_request_fields_invalid" || code === "wilds_wallet_username_invalid") return json({ error: code }, 400);
  if (code === "receiz_wallet_recipient_rate_limited") return json({ error: code }, 429);
  if (code === "receiz_wallet_recipient_unavailable") return json({ error: code }, 404);
  if (code.startsWith("receiz_wallet_")) return json({ error: code }, wildsWalletAuthorityStatusFor(code));
  return json({ error: "receiz_wallet_recipient_unavailable" }, 404);
}

export async function POST(request: NextRequest) {
  try {
    const authority = await resolveWildsWalletReadAuthority(request);
    const body = assertExactFields(await readJsonBody(request), ["username"]);
    const username = normalizeWildsWalletPublicUsername(body.username);
    admitRecipientLookup(authority.actorId);
    const adapter = createReceizCommerceAdapter({ accessToken: authority.accessToken });
    const response = await adapter.worldProfile(`${username}.receiz.id`);
    const recipient = projectWildsWalletRecipient(response.ok === true ? response.world : null);
    if (recipient.username !== username) throw new Error("receiz_wallet_recipient_unavailable");
    return json(recipient);
  } catch (cause) {
    return failure(cause);
  }
}
