import { NextRequest, NextResponse } from "next/server";
import { createReceizCommerceAdapter, type ReceizCommerceAdapter } from "./adapter";
import {
  normalizeWildsWalletCursor,
  normalizeWildsWalletPublicUsername,
  parseWildsWalletMicroPhi,
  projectWildsWalletCapabilities,
  projectWildsWalletLedgerPage,
  projectWildsWalletRecipient,
  projectWildsWalletSummary
} from "./wilds-wallet-projections";
import {
  resolveWildsWalletReadAuthority,
  type WildsWalletReadAuthority
} from "./wilds-wallet-route-authority";

const RECIPIENT_LOOKUP_LIMIT = 6;
const RECIPIENT_LOOKUP_WINDOW_SECONDS = 60;

type WalletAdapter = Pick<ReceizCommerceAdapter, "walletSummary" | "walletLedger" | "worldProfile">;

export type WildsWalletRecipientLookupLimiter = Readonly<{
  consume(input: Readonly<{
    actorId: string;
    limit: number;
    windowSeconds: number;
    scope: "wilds_wallet_recipient_lookup";
  }>): Promise<"allowed" | "limited">;
}>;

export type WildsWalletRouteHandlerDependencies = Readonly<{
  resolveAuthority(request: NextRequest): Promise<WildsWalletReadAuthority>;
  createAdapter(accessToken: string): WalletAdapter;
  recipientLookupLimiter?: WildsWalletRecipientLookupLimiter;
}>;

type WalletRouteFallback =
  | "receiz_wallet_read_unavailable"
  | "receiz_wallet_recipient_unavailable"
  | "receiz_wallet_request_invalid"
  | "receiz_wallet_capabilities_unavailable";

const SAFE_FAILURES = Object.freeze({
  receiz_wallet_read_scope_required: 401,
  receiz_wallet_authority_required: 401,
  receiz_wallet_profile_binding_invalid: 403,
  receiz_wallet_token_binding_invalid: 403,
  receiz_wallet_profile_resolution_unavailable: 503,
  receiz_wallet_introspection_unavailable: 503,
  wilds_wallet_cursor_invalid: 400,
  wilds_wallet_request_fields_invalid: 400,
  wilds_wallet_username_invalid: 400,
  wilds_wallet_micro_phi_invalid: 400,
  receiz_wallet_recipient_unavailable: 404,
  receiz_wallet_recipient_rate_limited: 429,
  receiz_wallet_recipient_lookup_unavailable: 503,
  receiz_wallet_read_unavailable: 502,
  receiz_wallet_request_invalid: 400,
  receiz_wallet_capabilities_unavailable: 502
} as const);

type SafeWalletRouteCode = keyof typeof SAFE_FAILURES;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

function safeCode(cause: unknown, fallback: WalletRouteFallback): SafeWalletRouteCode {
  const candidate = cause instanceof Error ? cause.message : "";
  return Object.hasOwn(SAFE_FAILURES, candidate) ? candidate as SafeWalletRouteCode : fallback;
}

export function classifyWildsWalletRouteFailure(cause: unknown, fallback: WalletRouteFallback) {
  const error = safeCode(cause, fallback);
  return { status: SAFE_FAILURES[error], body: { error } };
}

function failure(cause: unknown, fallback: WalletRouteFallback) {
  const result = classifyWildsWalletRouteFailure(cause, fallback);
  return json(result.body, result.status);
}

function assertExactFields(value: unknown, fields: readonly string[], required: readonly string[] = fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("wilds_wallet_request_fields_invalid");
  const body = value as Record<string, unknown>;
  if (!required.every((field) => Object.hasOwn(body, field)) || !Object.keys(body).every((field) => fields.includes(field))) {
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

async function consumeRecipientLookup(limiter: WildsWalletRecipientLookupLimiter | undefined, actorId: string) {
  if (!limiter) throw new Error("receiz_wallet_recipient_lookup_unavailable");
  try {
    const result = await limiter.consume({
      actorId,
      limit: RECIPIENT_LOOKUP_LIMIT,
      windowSeconds: RECIPIENT_LOOKUP_WINDOW_SECONDS,
      scope: "wilds_wallet_recipient_lookup"
    });
    if (result === "limited") throw new Error("receiz_wallet_recipient_rate_limited");
    if (result !== "allowed") throw new Error("receiz_wallet_recipient_lookup_unavailable");
  } catch (cause) {
    if (cause instanceof Error && cause.message === "receiz_wallet_recipient_rate_limited") throw cause;
    throw new Error("receiz_wallet_recipient_lookup_unavailable");
  }
}

function defaultDependencies(): WildsWalletRouteHandlerDependencies {
  return {
    resolveAuthority: resolveWildsWalletReadAuthority,
    createAdapter: (accessToken) => createReceizCommerceAdapter({ accessToken }),
    // No process-local fallback is permitted: production recipient lookup remains closed
    // until the hosting platform wires a durable limiter port into this handler factory.
    recipientLookupLimiter: undefined
  };
}

export function createWildsWalletRouteHandlers(
  overrides: Partial<WildsWalletRouteHandlerDependencies> = {}
) {
  const dependencies: WildsWalletRouteHandlerDependencies = { ...defaultDependencies(), ...overrides };

  return Object.freeze({
    async summary(request: NextRequest) {
      try {
        const authority = await dependencies.resolveAuthority(request);
        return json(projectWildsWalletSummary(await dependencies.createAdapter(authority.accessToken).walletSummary()));
      } catch (cause) {
        return failure(cause, "receiz_wallet_read_unavailable");
      }
    },

    async ledger(request: NextRequest) {
      try {
        const authority = await dependencies.resolveAuthority(request);
        const cursor = normalizeWildsWalletCursor(request.nextUrl.searchParams.get("cursor"));
        const adapter = dependencies.createAdapter(authority.accessToken);
        return json(projectWildsWalletLedgerPage(await adapter.walletLedger({ limit: 50, cursor: cursor ?? undefined }), authority.actorId));
      } catch (cause) {
        return failure(cause, "receiz_wallet_read_unavailable");
      }
    },

    async recipient(request: NextRequest) {
      try {
        const authority = await dependencies.resolveAuthority(request);
        const body = assertExactFields(await readJsonBody(request), ["username"]);
        const username = normalizeWildsWalletPublicUsername(body.username);
        await consumeRecipientLookup(dependencies.recipientLookupLimiter, authority.actorId);
        try {
          const response = await dependencies.createAdapter(authority.accessToken).worldProfile(`${username}.receiz.id`);
          const recipient = projectWildsWalletRecipient(response.ok === true ? response.world : null);
          if (recipient.username !== username) throw new Error("receiz_wallet_recipient_unavailable");
          return json(recipient);
        } catch {
          throw new Error("receiz_wallet_recipient_unavailable");
        }
      } catch (cause) {
        return failure(cause, "receiz_wallet_recipient_unavailable");
      }
    },

    async request(request: NextRequest) {
      try {
        const authority = await dependencies.resolveAuthority(request);
        const body = assertExactFields(await readJsonBody(request), ["amountPhiMicro"], []);
        const amountPhiMicro = body.amountPhiMicro === undefined ? null : parseWildsWalletMicroPhi(body.amountPhiMicro);
        return json({
          locator: `wildz:receive:${authority.actorId}`,
          request: amountPhiMicro === null ? null : { kind: "phi", amountPhiMicro, authority: "non-authoritative" }
        });
      } catch (cause) {
        return failure(cause, "receiz_wallet_request_invalid");
      }
    },

    async capabilities(request: NextRequest) {
      try {
        await dependencies.resolveAuthority(request);
        return json(projectWildsWalletCapabilities());
      } catch (cause) {
        return failure(cause, "receiz_wallet_capabilities_unavailable");
      }
    }
  });
}
