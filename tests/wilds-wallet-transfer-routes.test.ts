import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { planReceizReserveV122, planReceizSettlementV122 } from "@receiz/sdk";
import * as executeRoute from "../app/api/wilds/wallet/transfer/execute/route";
import * as previewRoute from "../app/api/wilds/wallet/transfer/preview/route";
import * as statusRoute from "../app/api/wilds/wallet/transfer/status/route";
import {
  createWildsWalletRouteHandlers,
  createWildsWalletTransferRouteRuntime,
  type WildsWalletRecipientLookupLimiter,
  type WildsWalletTransferRouteRuntime
} from "../src/lib/receiz/wilds-wallet-route-handlers";
import type { WildsWalletTransferJournalEntry } from "../src/lib/receiz/wilds-wallet-transfer-journal";

const ACTOR = {
  accessToken: "token:owner",
  ownerReceizId: "receiz:owner",
  actorId: "kai_01",
  profileHandle: "kai_01.receiz.id"
};
const ATTEMPT = "v1.AAAAAAAAAAAAAAAA.AA.BBBBBBBBBBBBBBBBBBBBBB";

function request(path: string, method: "GET" | "POST", body?: unknown, origin = "https://wildz.quest") {
  return new NextRequest(`https://wildz.quest${path}`, {
    method,
    headers: method === "POST" ? { "content-type": "application/json", origin } : undefined,
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

function runtime(overrides: Partial<WildsWalletTransferRouteRuntime> = {}): WildsWalletTransferRouteRuntime {
  return {
    durable: true,
    capabilityAdmission: async () => ({
      sdkVersion: "124.0.0",
      rails: {
        proofAuthorityExchange: true,
        settlementExecution: true,
        reserveExecution: true,
        valueExecutionRecovery: true,
        worldPlanning: false,
        worldExecution: false,
        subjectNamespaces: false
      },
      grantedScopes: ["receiz:settlement.read", "receiz:settlement.write"]
    }),
    preview: async (_authority, input) => ({
      status: "staged",
      rail: input.rail,
      amountPhiMicro: input.amountPhiMicro,
      quotedUsdCents: "27",
      attempt: ATTEMPT,
      expiresAtKai: 1_000
    }),
    execute: async () => ({ status: "committed", rail: "settlement", amountPhiMicro: "2500000" }),
    status: async () => ({ status: "unknown", rail: "settlement", amountPhiMicro: "2500000" }),
    receive: async (_authority, amountPhiMicro) => ({
      locator: `wildz:receive:${ATTEMPT}`,
      request: amountPhiMicro === null ? null : { kind: "phi", amountPhiMicro, authority: "non-authoritative" }
    }),
    ...overrides
  };
}

function handlers(
  transferRuntime: WildsWalletTransferRouteRuntime | null = runtime(),
  recipientLookupLimiter: WildsWalletRecipientLookupLimiter | null = {
    durable: true,
    consume: async () => "allowed"
  }
) {
  return createWildsWalletRouteHandlers({
    resolveAuthority: async () => ACTOR,
    createAdapter: () => ({
      walletSummary: async () => ({ ok: true, balancePhiMicro: "1" }),
      walletLedger: async () => ({ ok: true, cursor: null, nextCursor: null, since: null, events: [] }),
      worldProfile: async () => ({ ok: false })
    }),
    recipientLookupLimiter: recipientLookupLimiter ?? undefined,
    transferRuntime: transferRuntime ?? undefined
  });
}

async function body(response: Response) {
  assert.equal(response.headers.get("cache-control"), "no-store");
  return response.json();
}

describe("Wilds wallet V123 transfer routes", () => {
  it("stages only an exact public transfer command and returns no authority coordinates", async () => {
    let admitted: unknown;
    const routes = handlers(runtime({
      preview: async (authority, input) => {
        admitted = { authority, input };
        return { status: "staged", rail: "settlement", amountPhiMicro: "2500000", quotedUsdCents: "27", attempt: ATTEMPT, expiresAtKai: 1_000 };
      }
    }));
    const response = await routes.transferPreview(request("/api/wilds/wallet/transfer/preview", "POST", {
      recipientUsername: "@Friend_2.RECEIZ.ID",
      amountPhiMicro: "02500000",
      rail: "settlement",
      operationNonce: "8c64cb0e-6958-41cb-b16d-1fe9f1b96f30"
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(admitted, {
      authority: ACTOR,
      input: {
        recipientUsername: "friend_2",
        amountPhiMicro: "2500000",
        rail: "settlement",
        operationNonce: "8c64cb0e-6958-41cb-b16d-1fe9f1b96f30"
      }
    });
    const projection = await body(response);
    assert.deepEqual(projection, {
      status: "staged", rail: "settlement", amountPhiMicro: "2500000",
      quotedUsdCents: "27", attempt: ATTEMPT, expiresAtKai: 1_000
    });
    assert.doesNotMatch(JSON.stringify(projection), /intent|head|subject|proof|authority|digest|execution|receiz:owner|token:owner/i);
  });

  it("rejects every request authority injection before transfer resolution", async () => {
    let calls = 0;
    const routes = handlers(runtime({ preview: async () => { calls += 1; throw new Error("unexpected"); } }));
    const injectedFields = [
      "ownerBinding", "ownerReceizId", "sourceProofObjectId", "sourceValueHead",
      "destinationSubjectId", "expectedDestinationHead", "usdPerPhiMicrocents",
      "priceBasis", "priceBasisDigest", "idempotencyKey", "authority", "authorityDigest",
      "accessToken", "intent", "executionId", "currentKai", "grantedScopes"
    ];
    for (const field of injectedFields) {
      const response = await routes.transferPreview(request("/api/wilds/wallet/transfer/preview", "POST", {
        recipientUsername: "friend_2", amountPhiMicro: "1", rail: "settlement",
        operationNonce: "8c64cb0e-6958-41cb-b16d-1fe9f1b96f30", [field]: "forged"
      }));
      assert.equal(response.status, 400, field);
      assert.deepEqual(await body(response), { error: "wilds_wallet_transfer_request_invalid" });
    }
    assert.equal(calls, 0);
  });

  it("fails username transfer preview closed without the durable recipient limiter while locator preview remains available", async () => {
    let previewCalls = 0;
    const live = runtime({
      preview: async (_authority, input) => {
        previewCalls += 1;
        return {
          status: "staged", rail: input.rail, amountPhiMicro: input.amountPhiMicro,
          quotedUsdCents: "1", attempt: ATTEMPT, expiresAtKai: 1_000
        };
      }
    });
    const routes = handlers(live, null);
    const username = await routes.transferPreview(request("/api/wilds/wallet/transfer/preview", "POST", {
      recipientUsername: "friend_2", amountPhiMicro: "25", rail: "settlement",
      operationNonce: "8c64cb0e-6958-41cb-b16d-1fe9f1b96f30"
    }));
    assert.equal(username.status, 503);
    assert.deepEqual(await body(username), { error: "receiz_wallet_recipient_lookup_unavailable" });
    assert.equal(previewCalls, 0);

    const locator = await routes.transferPreview(request("/api/wilds/wallet/transfer/preview", "POST", {
      recipientLocator: `wildz:receive:${ATTEMPT}`, amountPhiMicro: "25", rail: "settlement",
      operationNonce: "8c64cb0e-6958-41cb-b16d-1fe9f1b96f30"
    }));
    assert.equal(locator.status, 200);
    assert.equal(previewCalls, 1);
  });

  it("keeps proof-authority exchange in-game and returns only sanitized terminal outcomes", async () => {
    let consent: unknown;
    const routes = handlers(runtime({
      execute: async (_authority, input) => {
        consent = input;
        return { status: "unknown", rail: "settlement", amountPhiMicro: "2500000" };
      }
    }));
    const response = await routes.transferExecute(request("/api/wilds/wallet/transfer/execute", "POST", {
      attempt: ATTEMPT,
      consent: { artifact: "proof-signed-artifact", challenge: { schema: "receiz.identity.proof-authority-challenge.v123" } }
    }));

    assert.equal(response.status, 202);
    assert.deepEqual(consent, {
      attempt: ATTEMPT,
      consent: { artifact: "proof-signed-artifact", challenge: { schema: "receiz.identity.proof-authority-challenge.v123" } }
    });
    assert.deepEqual(await body(response), { status: "unknown", rail: "settlement", amountPhiMicro: "2500000" });
    assert.equal(response.headers.get("location"), null);
  });

  it("recovers an exact opaque attempt and never treats staged or malformed 200 data as committed", async () => {
    const staged = handlers(runtime({ status: async () => ({ status: "staged", rail: "settlement", amountPhiMicro: "5", quotedUsdCents: "1" }) }));
    const stagedResponse = await staged.transferStatus(request(`/api/wilds/wallet/transfer/status?attempt=${ATTEMPT}`, "GET"));
    assert.equal(stagedResponse.status, 200);
    assert.equal((await body(stagedResponse)).status, "staged");

    const malformed = handlers(runtime({ status: async () => ({ status: "committed", rail: "settlement", amountPhiMicro: "5", executionId: "private" } as never) }));
    const malformedResponse = await malformed.transferStatus(request(`/api/wilds/wallet/transfer/status?attempt=${ATTEMPT}`, "GET"));
    assert.equal(malformedResponse.status, 502);
    assert.deepEqual(await body(malformedResponse), { error: "receiz_wallet_transfer_unavailable" });
  });

  it("is same-origin, no-store, and deployment fail-closed without a durable runtime", async () => {
    const unavailable = handlers(null);
    const missing = await unavailable.transferPreview(request("/api/wilds/wallet/transfer/preview", "POST", {
      recipientUsername: "friend_2", amountPhiMicro: "1", rail: "settlement",
      operationNonce: "8c64cb0e-6958-41cb-b16d-1fe9f1b96f30"
    }));
    assert.equal(missing.status, 503);
    assert.deepEqual(await body(missing), { error: "receiz_wallet_transfer_dependencies_unavailable" });

    const crossOrigin = await handlers().transferExecute(request("/api/wilds/wallet/transfer/execute", "POST", {
      attempt: ATTEMPT, consent: { artifact: "x", challenge: {} }
    }, "https://attacker.example"));
    assert.equal(crossOrigin.status, 403);
    assert.deepEqual(await body(crossOrigin), { error: "wilds_wallet_transfer_origin_invalid" });
  });

  it("advertises live Phi only when the durable runtime admits exact installed rails and scopes", async () => {
    const live = await handlers().capabilities(request("/api/wilds/wallet/capabilities", "GET"));
    const projection = await body(live);
    assert.deepEqual(projection.phiSettlement, { available: true });
    assert.deepEqual(projection.phiReserve, { available: false, reason: "receiz_v123_scope_required" });
    assert.deepEqual(projection.send, { available: true });
    assert.deepEqual(projection.recipientLookup, { available: true });

    const closed = await handlers(null).capabilities(request("/api/wilds/wallet/capabilities", "GET"));
    assert.deepEqual((await body(closed)).send, { available: false, reason: "receiz_v123_execution_unavailable" });
    const lookupClosed = await handlers(runtime(), null).capabilities(request("/api/wilds/wallet/capabilities", "GET"));
    assert.deepEqual((await body(lookupClosed)).recipientLookup, { available: false, reason: "receiz_v123_execution_unavailable" });
  });

  it("seals exact receive binding and reopens it across instances without public lookup", async () => {
    const secret = "wallet-route-shared-cross-instance-secret-32-bytes";
    const entries = new Map<string, WildsWalletTransferJournalEntry>();
    let stages = 0;
    const journal = {
      durable: true as const,
      load: async (owner: string, key: string) => entries.get(`${owner}\0${key}`) ?? null,
      loadTerminal: async () => null,
      stage: async (entry: WildsWalletTransferJournalEntry) => {
        const key = `${entry.ownerBinding}\0${entry.idempotencyKey}`;
        const existing = entries.get(key);
        if (existing) return existing;
        stages += 1;
        entries.set(key, entry);
        return entry;
      },
      bindAuthority: async () => null,
      terminalize: async () => null,
      purgeTerminal: async () => 0
    };
    const destination = { applicationId: "wildz", destinationSubjectId: "subject:private-destination", expectedDestinationHead: "2".repeat(64) };
    const context = {
      serverDerived: true as const,
      capabilityAdmission: runtime().capabilityAdmission,
      receiveBinding: async () => destination,
      resolve: async ({ authority, command, idempotencyKey, destinationBinding }: Parameters<Parameters<typeof createWildsWalletTransferRouteRuntime>[0]["context"]["resolve"]>[0]) => ({
        ownerBinding: authority.ownerReceizId,
        authenticatedOwnerReceizId: authority.ownerReceizId,
        applicationId: destinationBinding!.applicationId,
        rail: command.rail,
        amountPhiMicro: command.amountPhiMicro,
        sourceProofObjectId: "proof:private-source",
        sourceValueHead: "1".repeat(64),
        destinationSubjectId: destinationBinding!.destinationSubjectId,
        expectedDestinationHead: destinationBinding!.expectedDestinationHead,
        usdPerPhiMicrocents: "1250000",
        priceBasis: { source: "exact" },
        idempotencyKey,
        grantedScopes: ["receiz:settlement.read", "receiz:settlement.write"]
      })
    };
    const authorityAdmission = {
      serverDerived: true as const,
      currentKai: async () => 10_000,
      resolveAuthorityBinding: async () => ({ revocationHead: "3".repeat(64), ownerBinding: ACTOR.ownerReceizId })
    };
    const rail = {
      planPhiSettlementV123: planReceizSettlementV122,
      planPhiReserveV123: planReceizReserveV122,
      validatePhiIntentV123: async () => true,
      executePhiSettlementV123: async () => ({ status: "unknown" as const }),
      executePhiReserveV123: async () => ({ status: "unknown" as const }),
      phiExecutionByIdempotencyKeyV123: async () => ({ status: "unknown" as const }),
      exchangeProofAuthorityV123: async () => { throw new Error("not-called"); }
    };
    const first = createWildsWalletTransferRouteRuntime({ context, journal, authorityAdmission, createAdapter: () => rail, secret });
    const second = createWildsWalletTransferRouteRuntime({ context, journal, authorityAdmission, createAdapter: () => rail, secret });
    const receive = await first.receive(ACTOR, null) as { locator: string };
    assert.match(receive.locator, /^wildz:receive:v1\./);
    assert.doesNotMatch(receive.locator, /subject|private-destination|222222/);

    const command = { recipientLocator: receive.locator, amountPhiMicro: "25", rail: "settlement" as const, operationNonce: "8c64cb0e-6958-41cb-b16d-1fe9f1b96f30" };
    const staged = await second.preview(ACTOR, command) as { status: string; attempt: string };
    assert.equal(staged.status, "staged");
    const duplicate = await first.preview(ACTOR, command) as { status: string };
    assert.equal(duplicate.status, "staged");
    assert.equal(stages, 1);
    await assert.rejects(second.execute(ACTOR, {
      attempt: staged.attempt,
      consent: { artifact: "identity-artifact", challenge: { consent: { statementDigest: "0".repeat(64) } } }
    }), /wilds_wallet_transfer_consent_binding_invalid/);

    const locatorParts = receive.locator.slice("wildz:receive:".length).split(".");
    const ciphertext = Buffer.from(locatorParts[2], "base64url");
    ciphertext[0] ^= 1;
    locatorParts[2] = ciphertext.toString("base64url");
    const tampered = `wildz:receive:${locatorParts.join(".")}`;
    await assert.rejects(second.preview(ACTOR, { ...command, recipientLocator: tampered }), /wilds_wallet_receive_locator_invalid/);
  });

  it("keeps the plaintext receive coordinate proposal-only and rejects it as destination authority", async () => {
    const closed = handlers(null);
    const receive = await closed.request(request("/api/wilds/wallet/request", "POST", { amountPhiMicro: "25" }));
    assert.deepEqual(await body(receive), {
      locator: "wildz:receive:kai_01",
      request: { kind: "phi", amountPhiMicro: "25", authority: "non-authoritative" }
    });
    const preview = await closed.transferPreview(request("/api/wilds/wallet/transfer/preview", "POST", {
      recipientLocator: "wildz:receive:kai_01", amountPhiMicro: "25", rail: "settlement",
      operationNonce: "8c64cb0e-6958-41cb-b16d-1fe9f1b96f30"
    }));
    assert.equal(preview.status, 400);
    assert.deepEqual(await body(preview), { error: "wilds_wallet_receive_locator_invalid" });
  });
});

describe("Wilds wallet transfer route exports", () => {
  it("exports only Next-supported route fields", () => {
    assert.deepEqual(Object.keys(previewRoute).sort(), ["POST", "dynamic", "runtime"]);
    assert.deepEqual(Object.keys(executeRoute).sort(), ["POST", "dynamic", "runtime"]);
    assert.deepEqual(Object.keys(statusRoute).sort(), ["GET", "dynamic", "runtime"]);
  });
});
