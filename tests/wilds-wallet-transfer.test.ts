import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  digestReceizCanonicalV122,
  planReceizReserveV122,
  planReceizSettlementV122,
  receizOidcScopesForRails,
  type ReceizProofAuthorityV123,
  type ReceizValueExecutionOutcomeV123,
  type ReceizWorldValueIntentV122
} from "@receiz/sdk";
import type { ReceizCommerceAdapter } from "../src/lib/receiz/adapter";
import type {
  WildsWalletTransferJournalEntry,
  WildsWalletTransferJournalPort
} from "../src/lib/receiz/wilds-wallet-transfer-journal";
import {
  exchangeWildsWalletProofAuthority,
  executeWildsWalletPhiTransfer,
  previewWildsWalletPhiTransfer,
  recoverWildsWalletPhiTransfer,
  stageWildsWalletPhiTransfer
} from "../src/lib/receiz/wilds-wallet-transfer";

const H = {
  source: "1".repeat(64),
  destination: "2".repeat(64),
  nextSource: "3".repeat(64),
  nextDestination: "4".repeat(64),
  registry: "5".repeat(64),
  reducer: "6".repeat(64),
  sourceProof: "7".repeat(64),
  destinationProof: "8".repeat(64),
  key: "9".repeat(64),
  artifact: "a".repeat(64),
  revocation: "b".repeat(64)
} as const;

const transferInput = {
  ownerBinding: "receiz:owner:private",
  applicationId: "wildz.quest",
  rail: "settlement" as const,
  amountPhiMicro: "2500000",
  sourceProofObjectId: "proof:source:private",
  sourceValueHead: H.source,
  destinationSubjectId: "subject:destination:private",
  expectedDestinationHead: H.destination,
  usdPerPhiMicrocents: "1250000",
  priceBasis: { source: "canonical-test", head: H.registry },
  idempotencyKey: "wildz:wallet:attempt:0001"
};

class DurableTestJournal implements WildsWalletTransferJournalPort {
  readonly durable = true as const;
  readonly entries = new Map<string, WildsWalletTransferJournalEntry>();

  async load(ownerBinding: string, idempotencyKey: string) {
    return this.entries.get(`${ownerBinding}\u0000${idempotencyKey}`) ?? null;
  }

  async stage(entry: WildsWalletTransferJournalEntry) {
    const key = `${entry.ownerBinding}\u0000${entry.idempotencyKey}`;
    const existing = this.entries.get(key);
    if (existing) return structuredClone(existing);
    const stored = structuredClone(entry);
    this.entries.set(key, stored);
    return structuredClone(stored);
  }

  async bindAuthority(ownerBinding: string, idempotencyKey: string, authorityDigest: string) {
    const key = `${ownerBinding}\u0000${idempotencyKey}`;
    const existing = this.entries.get(key);
    if (!existing) return null;
    if (existing.authorityDigest && existing.authorityDigest !== authorityDigest) return structuredClone(existing);
    const stored = structuredClone({ ...existing, authorityDigest });
    this.entries.set(key, stored);
    return structuredClone(stored);
  }

  async remove(entry: WildsWalletTransferJournalEntry) {
    const key = `${entry.ownerBinding}\u0000${entry.idempotencyKey}`;
    const existing = this.entries.get(key);
    if (!existing
      || existing.intent.valueIntentDigest !== entry.intent.valueIntentDigest
      || existing.authorityDigest !== entry.authorityDigest) return false;
    this.entries.delete(key);
    return true;
  }
}

type TransferRail = Pick<
  ReceizCommerceAdapter,
  | "planPhiSettlementV123"
  | "planPhiReserveV123"
  | "validatePhiIntentV123"
  | "executePhiSettlementV123"
  | "executePhiReserveV123"
  | "phiExecutionByIdempotencyKeyV123"
  | "exchangeProofAuthorityV123"
>;

async function authority(
  rail: "settlement" | "reserve" = "settlement",
  applicationId = "wildz.quest"
): Promise<ReceizProofAuthorityV123> {
  const basis = {
    schema: "receiz.identity.proof-authority.v123" as const,
    applicationId,
    keyId: H.key,
    artifactDigest: H.artifact,
    grantedScopes: receizOidcScopesForRails(rail),
    issuedAtKai: 13731001,
    expiresAtKai: 13731121,
    nonce: "wallet-proof-authority-0001",
    revocationHead: H.revocation,
    tokenType: "Bearer" as const,
    expiresIn: 120,
    refreshable: false as const,
    authority: {
      grantIsIdentityAuthority: false as const,
      strongerTruth: "receiz-identity-artifact" as const
    }
  };
  return Object.freeze({
    ...basis,
    authorityDigest: await digestReceizCanonicalV122({
      ...basis,
      grantedScopes: [...basis.grantedScopes].sort()
    }),
    accessToken: "server-only-proof-authority-token"
  });
}

async function committed(
  intent: ReceizWorldValueIntentV122,
  proofAuthority: ReceizProofAuthorityV123,
  overrides: Partial<ReceizValueExecutionOutcomeV123 & { status: "committed" }> = {}
): Promise<ReceizValueExecutionOutcomeV123> {
  const receiptBasis = {
    schema: "receiz.value.execution-receipt.v123" as const,
    executionId: "execution:0001",
    rail: intent.rail,
    valueIntentDigest: intent.valueIntentDigest,
    amountPhiMicro: intent.amountPhiMicro,
    sourcePriorHead: intent.sourceValueHead,
    sourceHead: H.nextSource,
    destinationPriorHead: intent.expectedDestinationHead,
    destinationHead: H.nextDestination,
    authorityDigest: proofAuthority.authorityDigest,
    idempotencyKey: intent.idempotencyKey!,
    registryDigest: H.registry,
    reducerDigest: H.reducer,
    acceptedAtKai: 13731002,
    authority: {
      receiptIsProofAuthority: false as const,
      strongerTruth: `${intent.rail}-proof-object` as "settlement-proof-object" | "reserve-proof-object"
    }
  };
  const outcome = {
    status: "committed" as const,
    rail: intent.rail,
    intent,
    receipt: {
      ...receiptBasis,
      receiptDigest: await digestReceizCanonicalV122(receiptBasis)
    },
    sourceHead: H.nextSource,
    destinationHead: H.nextDestination,
    proofReferences: [
      { schema: "receiz.value.proof-reference.v123" as const, objectId: intent.sourceProofObjectId, head: H.nextSource, proofDigest: H.sourceProof },
      { schema: "receiz.value.proof-reference.v123" as const, objectId: intent.destinationSubjectId, head: H.nextDestination, proofDigest: H.destinationProof }
    ]
  };
  return { ...outcome, ...overrides } as ReceizValueExecutionOutcomeV123;
}

function rail(overrides: Partial<TransferRail> = {}): TransferRail {
  return {
    planPhiSettlementV123: planReceizSettlementV122,
    planPhiReserveV123: planReceizReserveV122,
    validatePhiIntentV123: async () => true,
    executePhiSettlementV123: async () => ({ status: "unknown" }),
    executePhiReserveV123: async () => ({ status: "unknown" }),
    phiExecutionByIdempotencyKeyV123: async () => ({ status: "unknown" }),
    exchangeProofAuthorityV123: async () => authority(),
    ...overrides
  };
}

describe("Wilds wallet V123 Phi authority", () => {
  it("previews only sanitized Phi facts and refuses to stage without an injected durable journal", async () => {
    const preview = await previewWildsWalletPhiTransfer(transferInput, rail());
    assert.deepEqual(preview, {
      status: "preview",
      rail: "settlement",
      amountPhiMicro: "2500000",
      quotedUsdCents: "3"
    });
    assert.doesNotMatch(JSON.stringify(preview), /source|destination|head|digest|proof|subject|idempotency/i);

    await assert.rejects(
      stageWildsWalletPhiTransfer(transferInput, { rail: rail() }),
      /wilds_wallet_durable_journal_required/
    );
  });

  it("stages the exact SDK plan before execution without persisting reusable proof authority", async () => {
    const journal = new DurableTestJournal();
    const staged = await stageWildsWalletPhiTransfer(transferInput, { rail: rail(), journal });
    assert.deepEqual(staged, {
      status: "staged",
      rail: "settlement",
      amountPhiMicro: "2500000",
      quotedUsdCents: "3"
    });
    const entry = await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey);
    assert.equal(entry?.intent.valueIntentDigest.length, 64);
    assert.equal(entry?.intent.idempotencyKey, transferInput.idempotencyKey);
    assert.equal(entry?.applicationId, "wildz.quest");
    assert.equal(entry?.authorityDigest, null);
    assert.doesNotMatch(JSON.stringify(entry), /accessToken|server-only-proof-authority-token/);
  });

  it("checks exact idempotency recovery before execute and adopts a commit after a lost response", async () => {
    const journal = new DurableTestJournal();
    const proofAuthority = await authority();
    let executionCalls = 0;
    let recoveryCalls = 0;
    let recovered: ReceizValueExecutionOutcomeV123 = { status: "unknown" };
    const valueRail = rail({
      phiExecutionByIdempotencyKeyV123: async () => {
        recoveryCalls += 1;
        return recovered;
      },
      executePhiSettlementV123: async (intent) => {
        executionCalls += 1;
        recovered = await committed(intent, proofAuthority);
        throw new Error("response_lost_after_commit");
      }
    });
    await stageWildsWalletPhiTransfer(transferInput, { rail: valueRail, journal });

    assert.deepEqual(await executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authority: proofAuthority
    }, { rail: valueRail, journal }), {
      status: "unknown",
      rail: "settlement",
      amountPhiMicro: "2500000"
    });
    assert.ok(await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey));

    const adopted = await executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authority: proofAuthority
    }, { rail: valueRail, journal });
    assert.equal(adopted.status, "committed");
    assert.equal(executionCalls, 1);
    assert.equal(recoveryCalls, 2);
    assert.equal(await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey), null);
    assert.doesNotMatch(JSON.stringify(adopted), /proof:|subject:|head|authority|accessToken|execution:/i);
  });

  it("retains ambiguous or unattributable outcomes and removes only an exact bound zero-write", async () => {
    const journal = new DurableTestJournal();
    const proofAuthority = await authority();
    await stageWildsWalletPhiTransfer(transferInput, { rail: rail(), journal });
    const entry = await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey);
    assert.ok(entry);
    const mismatched = await committed(entry.intent, proofAuthority, {
      proofReferences: [{
        schema: "receiz.value.proof-reference.v123",
        objectId: "proof:wrong",
        head: H.nextSource,
        proofDigest: H.sourceProof
      }]
    });

    const malformedResult = await recoverWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey
    }, {
      rail: rail({ phiExecutionByIdempotencyKeyV123: async () => mismatched }),
      journal
    });
    assert.equal(malformedResult.status, "unknown");
    assert.ok(await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey));

    const unboundZeroWrite = await recoverWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey
    }, {
      rail: rail({
        phiExecutionByIdempotencyKeyV123: async () => ({
          status: "zero-write",
          rail: "settlement",
          failure: { code: "SOURCE_HEAD_STALE", writesOnFailure: 0 },
          currentSourceHead: "c".repeat(64),
          currentDestinationHead: H.destination
        })
      }),
      journal
    });
    assert.deepEqual(unboundZeroWrite, {
      status: "unknown",
      rail: "settlement",
      amountPhiMicro: "2500000"
    });
    assert.ok(await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey));

    const zeroWrite = await executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authority: proofAuthority
    }, {
      rail: rail({
        phiExecutionByIdempotencyKeyV123: async () => ({ status: "unknown" }),
        executePhiSettlementV123: async () => ({
          status: "zero-write",
          rail: "settlement",
          failure: { code: "SOURCE_HEAD_STALE", writesOnFailure: 0 },
          currentSourceHead: "c".repeat(64),
          currentDestinationHead: H.destination
        })
      }),
      journal
    });
    assert.deepEqual(zeroWrite, {
      status: "zero-write",
      rail: "settlement",
      code: "SOURCE_HEAD_STALE"
    });
    assert.equal(await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey), null);
  });

  it("prevents semantic mutation under a duplicate idempotency key", async () => {
    const journal = new DurableTestJournal();
    const valueRail = rail();
    await stageWildsWalletPhiTransfer(transferInput, { rail: valueRail, journal });
    await assert.rejects(stageWildsWalletPhiTransfer({
      ...transferInput,
      amountPhiMicro: "2500001"
    }, { rail: valueRail, journal }), /wilds_wallet_idempotency_conflict/);
    assert.equal((await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey))?.intent.amountPhiMicro, "2500000");
  });

  it("rejects a valid proof authority issued to another application", async () => {
    const journal = new DurableTestJournal();
    await stageWildsWalletPhiTransfer(transferInput, { rail: rail(), journal });
    await assert.rejects(executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authority: await authority("settlement", "other.example")
    }, { rail: rail(), journal }), /wilds_wallet_proof_authority_application_mismatch/);
    assert.ok(await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey));
  });

  it("derives the minimum rail scopes for proof-authority exchange and rejects partial grants", async () => {
    const expectedScopes = receizOidcScopesForRails("reserve");
    let requestedScopes: readonly string[] = [];
    const complete = await authority("reserve");
    const adapter = rail({
      exchangeProofAuthorityV123: async (input) => {
        requestedScopes = input.scopes;
        return complete;
      }
    });
    const input = {
      rail: "reserve" as const,
      artifact: "server-only-exact-artifact",
      challenge: {
        schema: "receiz.identity.proof-authority-challenge.v123" as const,
        audience: "wildz.quest",
        nonce: "wallet-proof-authority-0001",
        issuedAtKai: 13731001,
        expiresAtKai: 13731121,
        consent: { approved: true as const, statementDigest: H.registry },
        proof: {
          schema: "receiz.identity.login_proof.v1" as const,
          keyId: H.key,
          alg: "Ed25519" as const,
          challengeB64Url: "challenge",
          signatureB64Url: "signature"
        }
      },
      applicationId: "wildz.quest"
    };
    assert.equal((await exchangeWildsWalletProofAuthority(input, adapter)).authorityDigest, complete.authorityDigest);
    assert.deepEqual(requestedScopes, expectedScopes);

    const partialBasis = {
      ...complete,
      grantedScopes: ["receiz:reserve.read"],
      accessToken: undefined,
      authorityDigest: undefined
    };
    const { accessToken: _ignoredToken, authorityDigest: _ignoredDigest, ...partialDigestBasis } = partialBasis;
    const partial = {
      ...partialDigestBasis,
      authorityDigest: await digestReceizCanonicalV122(partialDigestBasis),
      accessToken: complete.accessToken
    } as ReceizProofAuthorityV123;
    await assert.rejects(exchangeWildsWalletProofAuthority(input, rail({
      exchangeProofAuthorityV123: async () => partial
    })), /wilds_wallet_proof_authority_scope_mismatch/);
  });
});
