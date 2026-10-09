import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { receizOidcScopesForRails } from "@receiz/sdk";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { compileFunction } from "node:vm";
import { createWildsWalletV124TransferRuntime } from "../src/lib/receiz/wilds-wallet-v124-runtime.js";
import { wildsWalletTransferConsentStatementDigest } from "../src/lib/receiz/wilds-wallet-transfer-consent.js";

const H = {
  subject: "1".repeat(64),
  value: "2".repeat(64),
  registry: "3".repeat(64),
  reducer: "4".repeat(64),
  state: "5".repeat(64),
  proof: "6".repeat(64),
  genesis: "7".repeat(64),
  admitted: "8".repeat(64)
};
const AUTHORITY = {
  accessToken: "access-token",
  ownerReceizId: "receiz:owner",
  actorId: "kai_01",
  profileHandle: "kai_01.receiz.id"
};
const SECRET = "v124-wallet-test-secret-32-bytes-minimum";

function fixture(overrides: Record<string, unknown> = {}, sourceAvailable = true) {
  let stagedPlan: Record<string, unknown> | null = null;
  let sourcePreparations = 0;
  let executions = 0;
  let recoveries = 0;
  let sessions = 0, reads = 0, plainStages = 0;
  let preparedSource: unknown = null, providedSource: unknown = null;
  const rail = {
    grantedScopesV124: async () => receizOidcScopesForRails("settlement"),
    qualifyRuntimeV124: async (input: { operations: readonly string[] }) => ({
      results: input.operations.map((operation) => ({ operation, status: "available" }))
    }),
    subjectStateV122: async () => { reads += 1; return ({
      schema: "receiz.subject.state.v122",
      subjectId: "subject:kai_01",
      proofObjectId: "proof:kai-wallet",
      ownerReceizId: AUTHORITY.ownerReceizId,
      head: H.subject,
      stateDigest: H.state,
      registryDigest: H.registry,
      reducerDigest: H.reducer,
      admittedProofDigest: H.admitted,
      genesisHead: H.genesis,
      opaqueNamespaces: [],
      accessKeyHead: null
    }); },
    walletSummary: async () => ({
      ok: true,
      balancePhiMicro: "9000000",
      settlement: {
        sourceValueHead: H.value,
        usdPerPhiMicrocents: "1250000",
        priceBasis: { schema: "receiz.price-basis.v124", quote: "exact" }
      }
    }),
    quotePhiDisplayUsdV122: () => "406",
    openAuthoritySessionV124: async () => { sessions += 1; return { status: "active", authoritySessionHandle: "session:v124" }; },
    closeAuthoritySessionV124: async () => ({ status: "closed" }),
    resolvePublicRecipientV124: async (input: { normalizedAlias: string; operationNonce: string; purpose: string }) => ({
      schema: "receiz.public-recipient-resolution.v124",
      status: "resolved",
      normalizedAlias: input.normalizedAlias,
      encryptedLocatorB64u: "ZW5jcnlwdGVkLWxvY2F0b3I",
      locatorDigest: createHash("sha256").update("encrypted-locator").digest("hex"),
      purpose: input.purpose,
      operationNonce: input.operationNonce
    }),
    stageExecutionV124: async (plan: Record<string, unknown>) => {
      plainStages += 1;
      stagedPlan = plan;
      return { schema: "receiz.durable-execution-handle.v124", executionId: "execution:v124" };
    },
    stagePreparedExecutionV124: async (plan: Record<string, unknown>, source: unknown) => {
      stagedPlan = plan; preparedSource = source;
      return { schema: "receiz.durable-execution-handle.v124", executionId: "execution:v124" };
    },
    executeV124: async () => {
      executions += 1;
      return { status: "committed" };
    },
    resolveExecutionByIdempotencyV124: async () => {
      recoveries += 1;
      return { status: "committed" };
    },
    publishSealedSourceV124: async () => ({ status: "published" }),
    client: { assets: { createProofObject: async () => { throw new Error("production source seam unexpectedly called"); } } },
    ...overrides
  };
  const runtimeInput = {
    createAdapter: () => rail as never,
    secret: SECRET,
    now: () => 10_000,
    subjectSource: async () => {
      sourcePreparations += 1;
      return {
        schema: "receiz.sealed-artifact-bytes.v124",
        exactBytesB64u: "ZXhhY3Q",
        filename: "wallet.receiz",
        mimeType: "application/vnd.receiz.proof-object+json",
        artifactSha256: "a".repeat(64),
        payloadSha256: "b".repeat(64)
      };
    },
    ...(sourceAvailable ? { executionSource: {
      serverDerived: true,
      rails: ["settlement", "reserve"],
      prepare: async ({ plan }: { plan: Record<string, unknown> }) => {
        // A forwarding fixture, not an admitted artifact or production source.
        providedSource = { fixture: "deployment-held-exact-transition-set", exactPlanDigest: plan.exactPlanDigest };
        return providedSource;
      }
    } } : {})
  };
  const runtime = createWildsWalletV124TransferRuntime(runtimeInput as unknown as Parameters<typeof createWildsWalletV124TransferRuntime>[0]);
  return { runtime, rail, runtimeInput, metrics: () => ({ stagedPlan, sourcePreparations, executions, recoveries, sessions, reads, plainStages, preparedSource, providedSource }) };
}

async function staged(runtime: ReturnType<typeof fixture>["runtime"]) {
  return runtime.preview(AUTHORITY, {
    recipientUsername: "@Friend_2.RECEIZ.ID",
    amountPhiMicro: "3250000",
    rail: "settlement",
    operationNonce: "8c64cb0e-6958-41cb-b16d-1fe9f1b96f30"
  }) as Promise<{ attempt: string; status: string; quotedUsdCents: string }>;
}

describe("Wilds durable V124 Phi runtime", () => {
  it("the installed SDK rejects a custodied plan-only handle before dispatch", () => {
    const sdkEntry = createRequire(import.meta.url).resolve("@receiz/sdk");
    const source = readFileSync(join(dirname(sdkEntry), "v124Execution.js"), "utf8");
    const body = source.split("const execute = async (handle, authoritySession) => {")[1]?.split("const options = {")[0];
    assert.ok(body, "installed SDK execution predispatch guard exists");
    const guard = compileFunction(body, ["handle", "custodiedHandles", "preparedExecutionHandles", "fail"]);
    const handle = {};
    assert.throws(() => guard(handle, new WeakSet([handle]), new WeakMap(), (code: string) => { throw TypeError(code); }), /V124_EXECUTION_TRANSITION_SOURCE_REQUIRED/);
  });

  it("an absent transition source qualifies value execution unavailable and refuses review before proof or session work", async () => {
    const f = fixture({}, false);
    const capability = await f.runtime.capabilityAdmission(AUTHORITY);
    assert.equal(capability.rails.settlementExecution, false);
    assert.equal(capability.rails.reserveExecution, false);
    await assert.rejects(staged(f.runtime), /receiz_wallet_transfer_source_unavailable/);
    assert.equal(f.metrics().reads, 0);
    assert.equal(f.metrics().sourcePreparations, 0);
    assert.equal(f.metrics().sessions, 0);
    assert.equal(f.metrics().stagedPlan, null);
    assert.equal(f.metrics().executions, 0);
  });

  it("old sealed attempts return known SOURCE_UNAVAILABLE before any mutation when the source is absent", async () => {
    const configured = fixture(), absent = fixture({}, false);
    const preview = await staged(configured.runtime);
    assert.deepEqual(await absent.runtime.execute(AUTHORITY, { attempt: preview.attempt, consent: { artifact: "unused", challenge: {} } }), { status: "zero-write", rail: "settlement", code: "SOURCE_UNAVAILABLE" });
    assert.equal(absent.metrics().reads, 0);
    assert.equal(absent.metrics().sessions, 0);
    assert.equal(absent.metrics().sourcePreparations, 0);
    assert.equal(absent.metrics().stagedPlan, null);
    assert.equal(absent.metrics().executions, 0);
  });

  it("a configured source refusing the exact participant plan never stages or executes value", async () => {
    const f = fixture();
    f.runtimeInput.executionSource!.prepare = async () => null as never;
    const preview = await staged(f.runtime);
    const statementDigest = await wildsWalletTransferConsentStatementDigest({ attempt: preview.attempt, amountPhiMicro: "3250000", rail: "settlement" });
    assert.deepEqual(await f.runtime.execute(AUTHORITY, { attempt: preview.attempt,
      consent: { artifact: "identity-artifact", challenge: { consent: { statementDigest } } } }),
      { status: "zero-write", rail: "settlement", code: "SOURCE_UNAVAILABLE" });
    assert.equal(f.metrics().stagedPlan, null);
    assert.equal(f.metrics().plainStages, 0);
    assert.equal(f.metrics().executions, 0);
  });
  it("an unresolved recipient returns zero-write before staging or executing any value", async () => {
    const base = fixture({ resolvePublicRecipientV124: async () => ({ status: "unavailable" }) });
    const preview = await staged(base.runtime);
    const statementDigest = await wildsWalletTransferConsentStatementDigest({ attempt: preview.attempt, amountPhiMicro: "3250000", rail: "settlement" });
    assert.deepEqual(await base.runtime.execute(AUTHORITY, { attempt: preview.attempt,
      consent: { artifact: "identity-artifact", challenge: { consent: { statementDigest } } } }),
      { status: "zero-write", rail: "settlement", code: "RECIPIENT_UNAVAILABLE" });
    assert.equal(base.metrics().stagedPlan, null);
    assert.equal(base.metrics().executions, 0);
  });

  it("seals source custody, resolves a one-use locator, stages exact CAS, and commits", async () => {
    const { runtime, metrics } = fixture();
    const preview = await staged(runtime);
    assert.equal(preview.status, "staged");
    assert.equal(preview.quotedUsdCents, "406");
    assert.match(preview.attempt, /^v2\./);
    assert.doesNotMatch(preview.attempt, /friend_2|subject:kai|proof:kai|3250000/);
    const statementDigest = await wildsWalletTransferConsentStatementDigest({
      attempt: preview.attempt,
      amountPhiMicro: "3250000",
      rail: "settlement"
    });
    const result = await runtime.execute(AUTHORITY, {
      attempt: preview.attempt,
      consent: { artifact: "identity-artifact", challenge: { consent: { statementDigest } } }
    });
    assert.deepEqual(result, { status: "committed", rail: "settlement", amountPhiMicro: "3250000", recipientUsername: "friend_2" });
    const state = metrics();
    assert.equal(state.sourcePreparations, 1);
    assert.equal(state.executions, 1);
    assert.ok(state.stagedPlan);
    assert.equal(state.plainStages, 0);
    assert.equal(state.preparedSource, state.providedSource);
    const exactPlan = JSON.parse(Buffer.from(String(state.stagedPlan!.exactPlanBytesB64u), "base64url").toString("utf8"));
    const intent = exactPlan.operations[0].payload;
    assert.equal(intent.schema, "receiz.locator-bound-value-intent.v124");
    assert.equal(intent.sourceProofObjectId, "proof:kai-wallet");
    assert.equal(intent.sourceValueHead, H.value);
    assert.equal(intent.amountPhiMicro, "3250000");
    assert.equal(intent.recipientLocator.operationNonce, createHash("sha256").update("receiz.wildz.public-recipient.v124\0").update("8c64cb0e-6958-41cb-b16d-1fe9f1b96f30").digest("base64url"));
    assert.equal(intent.authority.strongerTruth, "sealed-receiz-proof-object");
    assert.doesNotMatch(JSON.stringify(exactPlan), /friend_2|receiz:owner|identity-artifact/);
  });

  it("recovers the one exact committed outcome after the execute response is lost", async () => {
    const base = fixture({ executeV124: async () => { throw new Error("response-lost"); } });
    const preview = await staged(base.runtime);
    const statementDigest = await wildsWalletTransferConsentStatementDigest({ attempt: preview.attempt, amountPhiMicro: "3250000", rail: "settlement" });
    assert.deepEqual(await base.runtime.execute(AUTHORITY, {
      attempt: preview.attempt,
      consent: { artifact: "identity-artifact", challenge: { consent: { statementDigest } } }
    }), { status: "committed", rail: "settlement", amountPhiMicro: "3250000", recipientUsername: "friend_2" });
    assert.equal(base.metrics().recoveries, 1);
    assert.deepEqual(await base.runtime.status(AUTHORITY, preview.attempt), {
      status: "committed", rail: "settlement", amountPhiMicro: "3250000", recipientUsername: "friend_2"
    });
  });

  it("fails stale source heads with zero writes before opening an authority session", async () => {
    let sessions = 0;
    const base = fixture({
      openAuthoritySessionV124: async () => { sessions += 1; return { status: "active", authoritySessionHandle: "never" }; }
    });
    const preview = await staged(base.runtime);
    base.rail.walletSummary = async () => ({
      ok: true,
      balancePhiMicro: "9000000",
      settlement: {
        sourceValueHead: "c".repeat(64),
        usdPerPhiMicrocents: "1250000",
        priceBasis: { schema: "receiz.price-basis.v124", quote: "changed" }
      }
    });
    const statementDigest = await wildsWalletTransferConsentStatementDigest({ attempt: preview.attempt, amountPhiMicro: "3250000", rail: "settlement" });
    assert.deepEqual(await base.runtime.execute(AUTHORITY, {
      attempt: preview.attempt,
      consent: { artifact: "identity-artifact", challenge: { consent: { statementDigest } } }
    }), { status: "zero-write", rail: "settlement", code: "STALE_HEAD" });
    assert.equal(sessions, 0);
    assert.equal(base.metrics().sourcePreparations, 0);
  });
});
