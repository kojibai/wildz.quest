import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { isDeepStrictEqual } from "node:util";
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
  WildsWalletTransferJournalPort,
  WildsWalletTransferTerminalIntegrityBasis,
  WildsWalletTransferTerminalIntegrityPort,
  WildsWalletTransferTerminalProjection,
  WildsWalletTransferTerminalRecord
} from "../src/lib/receiz/wilds-wallet-transfer-journal";
import {
  exchangeWildsWalletProofAuthority,
  executeWildsWalletPhiTransfer,
  previewWildsWalletPhiTransfer,
  recoverWildsWalletPhiTransfer,
  stageWildsWalletPhiTransfer,
  type WildsWalletAdmittedProofAuthority,
  type WildsWalletProofAuthorityAdmissionPort
} from "../src/lib/receiz/wilds-wallet-transfer";

const ARTIFACT = "server-only-exact-artifact";
const ARTIFACT_DIGEST = createHash("sha256").update(ARTIFACT).digest("hex");
const terminalIntegrity: WildsWalletTransferTerminalIntegrityPort = Object.freeze({
  serverDerived: true as const,
  async digest(basis: WildsWalletTransferTerminalIntegrityBasis) {
    return createHash("sha256").update(JSON.stringify(basis)).digest("hex");
  }
});

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
  artifact: ARTIFACT_DIGEST,
  revocation: "b".repeat(64)
} as const;

const transferInput = {
  ownerBinding: "receiz:owner:private",
  applicationId: "wildz",
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
  readonly terminals = new Map<string, WildsWalletTransferTerminalRecord>();

  async load(ownerBinding: string, idempotencyKey: string) {
    return this.entries.get(`${ownerBinding}\u0000${idempotencyKey}`) ?? null;
  }

  async loadTerminal(ownerBinding: string, idempotencyKey: string) {
    return this.terminals.get(`${ownerBinding}\u0000${idempotencyKey}`) ?? null;
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

  async terminalize(
    entry: WildsWalletTransferJournalEntry,
    projection: WildsWalletTransferTerminalProjection,
    terminalizedAtKai: number,
    retainUntilKai: number,
    terminalIntegrityDigest: string
  ) {
    const key = `${entry.ownerBinding}\u0000${entry.idempotencyKey}`;
    const existing = this.entries.get(key);
    if (!existing || !isDeepStrictEqual(existing, entry)) return null;
    const record: WildsWalletTransferTerminalRecord = structuredClone({
      schema: "wildz.wallet.phi-transfer-terminal.v1" as const,
      entry,
      projection,
      terminalizedAtKai,
      retainUntilKai,
      terminalIntegrityDigest
    });
    this.entries.delete(key);
    this.terminals.set(key, record);
    return structuredClone(record);
  }

  async purgeTerminal(currentKai: number, limit: number) {
    let removed = 0;
    for (const [key, record] of this.terminals) {
      if (removed >= limit) break;
      if (record.retainUntilKai <= currentKai) {
        this.terminals.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

class ExactAuthorityAdmission implements WildsWalletProofAuthorityAdmissionPort {
  readonly serverDerived = true as const;
  current = 13731002;
  revocationHead: string | null = H.revocation;
  ownerBinding = transferInput.ownerBinding;

  async currentKai() {
    return this.current;
  }

  async resolveAuthorityBinding() {
    return this.revocationHead
      ? { revocationHead: this.revocationHead, ownerBinding: this.ownerBinding }
      : null;
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
  applicationId = "wildz",
  overrides: Partial<Omit<ReceizProofAuthorityV123, "authorityDigest">> = {}
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
    },
    ...overrides
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

function exchangeInput(overrides: Record<string, unknown> = {}) {
  return {
    ownerBinding: transferInput.ownerBinding,
    rail: "settlement" as const,
    artifact: ARTIFACT,
    challenge: {
      schema: "receiz.identity.proof-authority-challenge.v123" as const,
      audience: "wildz",
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
    applicationId: "wildz",
    ...overrides
  };
}

async function admitAuthority(
  proofAuthority: ReceizProofAuthorityV123 | undefined = undefined,
  admission = new ExactAuthorityAdmission(),
  input = exchangeInput()
): Promise<WildsWalletAdmittedProofAuthority> {
  const admittedAuthority = proofAuthority ?? await authority();
  return exchangeWildsWalletProofAuthority(input, {
    rail: rail({ exchangeProofAuthorityV123: async () => admittedAuthority }),
    authorityAdmission: admission
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
  it("terminalizes an exact commit so a lost response, restart, and duplicate status recover identically", async () => {
    const journal = new DurableTestJournal();
    const authorityAdmission = new ExactAuthorityAdmission();
    const proofAuthority = await authority();
    await stageWildsWalletPhiTransfer(transferInput, { rail: rail(), journal, authorityAdmission });
    let lookups = 0;
    const exactRail = rail({
      phiExecutionByIdempotencyKeyV123: async () => {
        lookups += 1;
        const entry = await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey);
        assert.ok(entry);
        return committed(entry.intent, proofAuthority);
      },
      executePhiSettlementV123: async (intent) => committed(intent, proofAuthority)
    });
    const authorityContext = await admitAuthority(proofAuthority, authorityAdmission);
    const first = await executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authorityContext
    }, { rail: exactRail, journal, authorityAdmission, terminalIntegrity });
    assert.equal(first.status, "committed");

    // Simulate the HTTP response being lost after the server completed, then a
    // fresh instance/status request reading only durable terminal state.
    const recovered = await recoverWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey
    }, { rail: exactRail, journal, authorityAdmission, terminalIntegrity });
    assert.deepEqual(recovered, first);
    const duplicate = await recoverWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey
    }, { rail: exactRail, journal, authorityAdmission, terminalIntegrity });
    assert.deepEqual(duplicate, first);
    assert.equal(lookups, 1);
    assert.equal(typeof (journal as unknown as { purgeTerminal?: unknown }).purgeTerminal, "function");
  });
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
    assert.equal(entry?.applicationId, "wildz");
    assert.equal(entry?.authorityDigest, null);
    assert.doesNotMatch(JSON.stringify(entry), /accessToken|server-only-proof-authority-token/);
  });

  it("checks exact idempotency recovery before execute and adopts a commit after a lost response", async () => {
    const journal = new DurableTestJournal();
    const proofAuthority = await authority();
    const authorityAdmission = new ExactAuthorityAdmission();
    const authorityContext = await admitAuthority(proofAuthority, authorityAdmission);
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
      authorityContext
    }, { rail: valueRail, journal, authorityAdmission, terminalIntegrity }), {
      status: "unknown",
      rail: "settlement",
      amountPhiMicro: "2500000"
    });
    assert.ok(await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey));

    const adopted = await executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authorityContext
    }, { rail: valueRail, journal, authorityAdmission, terminalIntegrity });
    assert.equal(adopted.status, "committed");
    assert.equal(executionCalls, 1);
    assert.equal(recoveryCalls, 2);
    assert.equal(await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey), null);
    assert.doesNotMatch(JSON.stringify(adopted), /proof:|subject:|head|authority|accessToken|execution:/i);
  });

  it("retains ambiguous or unattributable outcomes and terminalizes only an exact bound zero-write", async () => {
    const journal = new DurableTestJournal();
    const proofAuthority = await authority();
    const authorityAdmission = new ExactAuthorityAdmission();
    const authorityContext = await admitAuthority(proofAuthority, authorityAdmission);
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
      authorityContext
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
      journal,
      authorityAdmission,
      terminalIntegrity
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
    await assert.rejects(stageWildsWalletPhiTransfer({
      ...transferInput,
      priceBasis: { source: "different-canonical-price", head: H.registry }
    }, { rail: valueRail, journal }), /wilds_wallet_idempotency_conflict/);
    assert.equal((await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey))?.intent.amountPhiMicro, "2500000");
  });

  it("rejects every tampered durable row before lookup, execution, or terminalization", async () => {
    const mutations: Array<(entry: WildsWalletTransferJournalEntry) => unknown> = [
      (entry) => ({ ...entry, schema: "wildz.wallet.phi-transfer-journal.v0" }),
      (entry) => ({ ...entry, ownerBinding: "foreign-owner" }),
      (entry) => ({ ...entry, applicationId: "" }),
      (entry) => ({ ...entry, rail: "reserve" }),
      (entry) => ({ ...entry, idempotencyKey: "different-key" }),
      (entry) => ({ ...entry, authorityDigest: "not-a-digest" }),
      (entry) => ({ ...entry, intent: { ...entry.intent, valueIntentDigest: H.registry } }),
      (entry) => ({ ...entry, intent: { ...entry.intent, amountPhiMicro: "not-canonical" } }),
      (entry) => ({ ...entry, unexpectedAuthority: "poison" })
    ];

    for (const mutate of mutations) {
      const journal = new DurableTestJournal();
      await stageWildsWalletPhiTransfer(transferInput, { rail: rail(), journal });
      const key = `${transferInput.ownerBinding}\u0000${transferInput.idempotencyKey}`;
      const original = journal.entries.get(key);
      assert.ok(original);
      journal.entries.set(key, mutate(original) as WildsWalletTransferJournalEntry);
      let lookupCalls = 0;
      await assert.rejects(recoverWildsWalletPhiTransfer({
        ownerBinding: transferInput.ownerBinding,
        idempotencyKey: transferInput.idempotencyKey
      }, {
        rail: rail({
          phiExecutionByIdempotencyKeyV123: async () => {
            lookupCalls += 1;
            return { status: "unknown" };
          }
        }),
        journal
      }), /wilds_wallet_transfer_journal_invalid/);
      assert.equal(lookupCalls, 0);
      assert.ok(journal.entries.has(key));
    }
  });

  it("validates journal entries returned by atomic stage and authority binding", async () => {
    const backing = new DurableTestJournal();
    const malformedStage: WildsWalletTransferJournalPort = {
      durable: true,
      load: backing.load.bind(backing),
      loadTerminal: backing.loadTerminal.bind(backing),
      stage: async (entry) => ({ ...entry, rail: "reserve" }),
      bindAuthority: backing.bindAuthority.bind(backing),
      terminalize: backing.terminalize.bind(backing),
      purgeTerminal: backing.purgeTerminal.bind(backing)
    };
    await assert.rejects(stageWildsWalletPhiTransfer(transferInput, {
      rail: rail(),
      journal: malformedStage
    }), /wilds_wallet_transfer_journal_invalid/);

    const journal = new DurableTestJournal();
    await stageWildsWalletPhiTransfer(transferInput, { rail: rail(), journal });
    const authorityAdmission = new ExactAuthorityAdmission();
    const authorityContext = await admitAuthority(await authority(), authorityAdmission);
    let executionCalls = 0;
    const malformedBind: WildsWalletTransferJournalPort = {
      durable: true,
      load: journal.load.bind(journal),
      loadTerminal: journal.loadTerminal.bind(journal),
      stage: journal.stage.bind(journal),
      bindAuthority: async (ownerBinding, idempotencyKey, authorityDigest) => {
        const entry = await journal.load(ownerBinding, idempotencyKey);
        return entry ? { ...entry, rail: "reserve", authorityDigest } : null;
      },
      terminalize: journal.terminalize.bind(journal),
      purgeTerminal: journal.purgeTerminal.bind(journal)
    };
    await assert.rejects(executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authorityContext
    }, {
      rail: rail({
        executePhiSettlementV123: async () => {
          executionCalls += 1;
          return { status: "unknown" };
        }
      }),
      journal: malformedBind,
      authorityAdmission
    }), /wilds_wallet_transfer_journal_invalid/);
    assert.equal(executionCalls, 0);
    assert.equal((await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey))?.authorityDigest, null);
  });

  it("retains reconciliation state when exact terminalization loses its CAS", async () => {
    const backing = new DurableTestJournal();
    const journal: WildsWalletTransferJournalPort = {
      durable: true,
      load: backing.load.bind(backing),
      loadTerminal: backing.loadTerminal.bind(backing),
      stage: backing.stage.bind(backing),
      bindAuthority: backing.bindAuthority.bind(backing),
      terminalize: async () => null,
      purgeTerminal: backing.purgeTerminal.bind(backing)
    };
    const proofAuthority = await authority();
    const authorityAdmission = new ExactAuthorityAdmission();
    const authorityContext = await admitAuthority(proofAuthority, authorityAdmission);
    const valueRail = rail({
      phiExecutionByIdempotencyKeyV123: async () => ({ status: "unknown" }),
      executePhiSettlementV123: async (intent) => committed(intent, proofAuthority)
    });
    await stageWildsWalletPhiTransfer(transferInput, { rail: valueRail, journal });

    assert.deepEqual(await executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authorityContext
    }, { rail: valueRail, journal, authorityAdmission, terminalIntegrity }), {
      status: "unknown",
      rail: "settlement",
      amountPhiMicro: "2500000"
    });
    assert.ok(await backing.load(transferInput.ownerBinding, transferInput.idempotencyKey));
  });

  it("rejects a forged terminal row that invents a commit without authenticated outcome evidence", async () => {
    const journal = new DurableTestJournal();
    await stageWildsWalletPhiTransfer(transferInput, { rail: rail(), journal });
    const entry = await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey);
    assert.ok(entry);
    const key = `${entry.ownerBinding}\u0000${entry.idempotencyKey}`;
    journal.entries.delete(key);
    journal.terminals.set(key, {
      schema: "wildz.wallet.phi-transfer-terminal.v1",
      entry,
      projection: { status: "committed", rail: entry.rail, amountPhiMicro: entry.intent.amountPhiMicro },
      terminalizedAtKai: 1,
      retainUntilKai: 2,
      terminalIntegrityDigest: "0".repeat(64)
    });

    await assert.rejects(recoverWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey
    }, { rail: rail(), journal, terminalIntegrity }), /wilds_wallet_transfer_journal_invalid/);
  });

  it("returns unknown when terminalize changes the exact projection or retention winner", async () => {
    const backing = new DurableTestJournal();
    const journal: WildsWalletTransferJournalPort = {
      durable: true,
      load: backing.load.bind(backing),
      loadTerminal: backing.loadTerminal.bind(backing),
      stage: backing.stage.bind(backing),
      bindAuthority: backing.bindAuthority.bind(backing),
      terminalize: async (entry, _projection, terminalizedAtKai, retainUntilKai, terminalIntegrityDigest) => ({
        schema: "wildz.wallet.phi-transfer-terminal.v1",
        entry,
        projection: { status: "zero-write", rail: entry.rail, code: "SOURCE_HEAD_STALE" },
        terminalizedAtKai,
        retainUntilKai: retainUntilKai - 1,
        terminalIntegrityDigest
      }),
      purgeTerminal: backing.purgeTerminal.bind(backing)
    };
    const proofAuthority = await authority();
    const authorityAdmission = new ExactAuthorityAdmission();
    const authorityContext = await admitAuthority(proofAuthority, authorityAdmission);
    const valueRail = rail({
      phiExecutionByIdempotencyKeyV123: async () => ({ status: "unknown" }),
      executePhiSettlementV123: async (intent) => committed(intent, proofAuthority)
    });
    await stageWildsWalletPhiTransfer(transferInput, { rail: valueRail, journal });

    assert.deepEqual(await executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authorityContext
    }, { rail: valueRail, journal, authorityAdmission, terminalIntegrity }), {
      status: "unknown",
      rail: "settlement",
      amountPhiMicro: "2500000"
    });
  });

  it("rejects expired or revoked admitted contexts without poisoning a staged journal", async () => {
    const journal = new DurableTestJournal();
    const authorityAdmission = new ExactAuthorityAdmission();
    const firstAuthority = await authority();
    const firstContext = await admitAuthority(firstAuthority, authorityAdmission);
    await stageWildsWalletPhiTransfer(transferInput, { rail: rail(), journal });

    authorityAdmission.current = firstAuthority.expiresAtKai;
    await assert.rejects(executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authorityContext: firstContext
    }, { rail: rail(), journal, authorityAdmission }), /wilds_wallet_proof_authority_expired/);
    assert.equal((await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey))?.authorityDigest, null);

    const freshAuthority = await authority("settlement", "wildz", {
      issuedAtKai: 13731121,
      expiresAtKai: 13731241,
      nonce: "wallet-proof-authority-0002"
    });
    authorityAdmission.current = 13731122;
    const baseInput = exchangeInput();
    const freshContext = await admitAuthority(freshAuthority, authorityAdmission, exchangeInput({
      challenge: {
        ...baseInput.challenge,
        issuedAtKai: 13731121,
        expiresAtKai: 13731241,
        nonce: "wallet-proof-authority-0002"
      }
    }));
    const valueRail = rail({
      phiExecutionByIdempotencyKeyV123: async () => ({ status: "unknown" }),
      executePhiSettlementV123: async (intent) => committed(intent, freshAuthority)
    });
    assert.equal((await executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authorityContext: freshContext
    }, { rail: valueRail, journal, authorityAdmission, terminalIntegrity })).status, "committed");
    assert.equal(await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey), null);
  });

  it("rechecks the exact current revocation head before binding an admitted context", async () => {
    const journal = new DurableTestJournal();
    const authorityAdmission = new ExactAuthorityAdmission();
    const authorityContext = await admitAuthority(await authority(), authorityAdmission);
    await stageWildsWalletPhiTransfer(transferInput, { rail: rail(), journal });
    await assert.rejects(executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authorityContext: { ...authorityContext, admittedAtKai: 0 }
    }, { rail: rail(), journal, authorityAdmission }), /wilds_wallet_proof_authority_context_invalid/);
    assert.equal((await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey))?.authorityDigest, null);

    authorityAdmission.revocationHead = "c".repeat(64);

    await assert.rejects(executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authorityContext
    }, { rail: rail(), journal, authorityAdmission }), /wilds_wallet_proof_authority_revoked/);
    assert.equal((await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey))?.authorityDigest, null);
  });

  it("rejects a valid proof authority issued to another application", async () => {
    const journal = new DurableTestJournal();
    const authorityAdmission = new ExactAuthorityAdmission();
    const baseInput = exchangeInput();
    const authorityContext = await admitAuthority(
      await authority("settlement", "other.example"),
      authorityAdmission,
      exchangeInput({
        applicationId: "other.example",
        challenge: { ...baseInput.challenge, audience: "other.example" }
      })
    );
    await stageWildsWalletPhiTransfer(transferInput, { rail: rail(), journal });
    await assert.rejects(executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authorityContext
    }, { rail: rail(), journal, authorityAdmission }), /wilds_wallet_proof_authority_application_mismatch/);
    assert.equal((await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey))?.authorityDigest, null);
  });

  it("rejects a live same-application authority admitted for another owner before recovery or binding", async () => {
    const journal = new DurableTestJournal();
    await stageWildsWalletPhiTransfer(transferInput, { rail: rail(), journal });
    const authorityAdmission = new ExactAuthorityAdmission();
    authorityAdmission.ownerBinding = "foreign-owner";
    const authorityContext = await admitAuthority(await authority(), authorityAdmission, exchangeInput({
      ownerBinding: "foreign-owner"
    }));
    let recoveryCalls = 0;
    let executionCalls = 0;

    await assert.rejects(executeWildsWalletPhiTransfer({
      ownerBinding: transferInput.ownerBinding,
      idempotencyKey: transferInput.idempotencyKey,
      authorityContext
    }, {
      rail: rail({
        phiExecutionByIdempotencyKeyV123: async () => {
          recoveryCalls += 1;
          return { status: "unknown" };
        },
        executePhiSettlementV123: async () => {
          executionCalls += 1;
          return { status: "unknown" };
        }
      }),
      journal,
      authorityAdmission
    }), /wilds_wallet_proof_authority_owner_mismatch/);
    assert.equal(recoveryCalls, 0);
    assert.equal(executionCalls, 0);
    assert.equal((await journal.load(transferInput.ownerBinding, transferInput.idempotencyKey))?.authorityDigest, null);
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
    const input = { ...exchangeInput(), rail: "reserve" as const };
    const authorityAdmission = new ExactAuthorityAdmission();
    const admitted = await exchangeWildsWalletProofAuthority(input, { rail: adapter, authorityAdmission });
    assert.equal(admitted.authority.authorityDigest, complete.authorityDigest);
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
    await assert.rejects(exchangeWildsWalletProofAuthority(input, {
      rail: rail({ exchangeProofAuthorityV123: async () => partial }),
      authorityAdmission
    }), /wilds_wallet_proof_authority_scope_mismatch/);
  });

  it("binds exchanged authority to exact artifact, challenge, key, nonce, application, and Kai window", async () => {
    const authorityAdmission = new ExactAuthorityAdmission();
    const cases: ReadonlyArray<{
      name: string;
      response: ReceizProofAuthorityV123;
      input?: ReturnType<typeof exchangeInput>;
      code: RegExp;
    }> = [
      {
        name: "artifact digest",
        response: await authority("settlement", "wildz", { artifactDigest: "c".repeat(64) }),
        code: /wilds_wallet_proof_authority_artifact_mismatch/
      },
      {
        name: "proof key",
        response: await authority("settlement", "wildz", { keyId: "c".repeat(64) }),
        code: /wilds_wallet_proof_authority_key_mismatch/
      },
      {
        name: "nonce",
        response: await authority("settlement", "wildz", { nonce: "foreign-nonce" }),
        code: /wilds_wallet_proof_authority_nonce_mismatch/
      },
      {
        name: "application",
        response: await authority("settlement", "other.example"),
        code: /wilds_wallet_proof_authority_application_mismatch/
      },
      {
        name: "invalid ordering",
        response: await authority("settlement", "wildz", { issuedAtKai: 13731121, expiresAtKai: 13731001 }),
        code: /wilds_wallet_proof_authority_time_invalid/
      },
      {
        name: "expired",
        response: await authority("settlement", "wildz", { issuedAtKai: 13730881, expiresAtKai: 13731001 }),
        code: /wilds_wallet_proof_authority_expired/
      },
      {
        name: "challenge proof key",
        response: await authority(),
        input: exchangeInput({
          challenge: {
            ...exchangeInput().challenge,
            proof: { ...exchangeInput().challenge.proof, keyId: "c".repeat(64) }
          }
        }),
        code: /wilds_wallet_proof_authority_key_mismatch/
      }
    ];

    for (const scenario of cases) {
      await assert.rejects(exchangeWildsWalletProofAuthority(scenario.input ?? exchangeInput(), {
        rail: rail({ exchangeProofAuthorityV123: async () => scenario.response }),
        authorityAdmission
      }), scenario.code, scenario.name);
    }

    authorityAdmission.revocationHead = "c".repeat(64);
    await assert.rejects(exchangeWildsWalletProofAuthority(exchangeInput(), {
      rail: rail({ exchangeProofAuthorityV123: async () => authority() }),
      authorityAdmission
    }), /wilds_wallet_proof_authority_revoked/);
  });

  it("fails proof-authority exchange closed without server-derived Kai and revocation admission", async () => {
    await assert.rejects(exchangeWildsWalletProofAuthority(exchangeInput(), {
      rail: rail({ exchangeProofAuthorityV123: async () => authority() })
    }), /wilds_wallet_proof_authority_admission_required/);

    const authorityAdmission = new ExactAuthorityAdmission();
    let exchangeCalls = 0;
    const adapter = rail({
      exchangeProofAuthorityV123: async () => {
        exchangeCalls += 1;
        return authority();
      }
    });
    await assert.rejects(exchangeWildsWalletProofAuthority(exchangeInput({
      challenge: { ...exchangeInput().challenge, audience: "other.example" }
    }), {
      rail: adapter,
      authorityAdmission
    }), /wilds_wallet_proof_authority_challenge_invalid/);
    await assert.rejects(exchangeWildsWalletProofAuthority(exchangeInput({
      challenge: { ...exchangeInput().challenge, issuedAtKai: 13731121, expiresAtKai: 13731001 }
    }), {
      rail: adapter,
      authorityAdmission
    }), /wilds_wallet_proof_authority_challenge_invalid/);
    authorityAdmission.current = 13731121;
    await assert.rejects(exchangeWildsWalletProofAuthority(exchangeInput(), {
      rail: rail({
        exchangeProofAuthorityV123: async () => {
          exchangeCalls += 1;
          return authority();
        }
      }),
      authorityAdmission
    }), /wilds_wallet_proof_authority_challenge_expired/);
    assert.equal(exchangeCalls, 0);
  });
});
