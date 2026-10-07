import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { assertWildsLegacyResourceAdmission, WILDS_LEGACY_PACKAGE_HISTORY_MESSAGE } from "../src/features/play/wilds-legacy-package-history";

function mountLegacyClaim(kind: "bearer-material" | "bearer-resource", packaged: boolean, conditionalUnavailable = false) {
  const lotId = "lot:already-packaged";
  const memberKind = kind === "bearer-material" ? "material" : "resource";
  const lot = { lotId, kind: "hay" };
  const claim = { claimId: "claim:legacy", kind: "resource", carrier: {
    kind, offer: memberKind === "material" ? { materialLot: lot } : { resourceLot: lot }
  } };
  const world = {
    materialLots: { [lotId]: lot }, resourceLots: { [lotId]: lot },
    reservedMaterialLots: {}, reservedResourceLots: {}, consumedMaterialLots: {}, storedMaterialLots: {},
    resourcePackages: packaged ? { "package:history": {
      status: "unpacked", ownerReceizId: "successor.receiz.id",
      package: { members: [{ kind: memberKind, id: lotId }] }
    } } : {}
  };
  let nativeClaims = 0;
  let conditionalReads = 0;
  let fallbackReads = 0;
  const admission = {
    materialLot: lot, resourceLot: lot, subjectId: "subject:legacy", sourceHandle: "origin.receiz.id",
    receipt: { nextSubjectHead: "head:legacy", receiptId: "receipt:legacy", transferId: "transfer:legacy" }
  };
  const testModule = { exports: {} as { POST(request: unknown): Promise<{ status: number; body: { error?: string; message?: string } }> } };
  const source = ts.transpileModule(readFileSync("app/api/wilds/claims/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const nativeClaim = async () => { nativeClaims++; return admission; };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: unknown, options?: { status?: number }) => ({ body, status: options?.status ?? 200 }) } },
    "@receiz/sdk": { receizKaiNow: () => ({ pulse: 1, uPulse: 1 }) },
    "@/features/play/wilds-portable-claim": { decodeWildsPortableClaim: () => claim },
    "@/features/play/wilds-messenger-ledger": { appendWildsDirectMessage: () => ({ conversation: {} }) },
    "@/lib/receiz/adapter": { createReceizCommerceAdapter: () => ({}) },
    "@/lib/receiz/wilds-card-transfer": {},
    "@/lib/receiz/wilds-resource-transfer": { claimWildsMaterialTransfer: nativeClaim, claimWildsResourceTransfer: nativeClaim },
    "@/lib/receiz/wilds-messenger-server": { publishWildsConversation: async () => {} },
    "@/lib/receiz/wilds-multiplayer-server": { resolveWildsMultiplayerActor: async () => ({ accessToken: "session", practice: false, handle: "legacy-holder.receiz.id", playerId: "legacy-holder", receizActorId: "usr_legacy_holder" }) },
    "@/lib/receiz/wilds-portable-claim-runtime": {},
    "@/features/play/kai-klok-moment": { deriveKaiKlokMomentFromUPulse: (value: unknown) => value },
    "@/features/play/kai-temporal-root": { createKaiTemporalRoot: (value: unknown) => value },
    "@/lib/receiz/wilds-world-server": {
      worldSnapshot: async () => { fallbackReads++; return { projection: { ...world, resourcePackages: {} } }; },
      wildsResourceCustodySnapshot: async () => {
        conditionalReads++;
        if (conditionalUnavailable) throw Error("receiz_conditional_resource_custody_unavailable");
        return { projection: world };
      },
      executeWildsWorldCommand: async () => ({})
    },
    "@/lib/receiz/wilds-resource-custody-capability": { requireWildsResourceCustodyRail: () => ({}) },
    "@/lib/receiz/wilds-resource-package-server": {},
    "@/features/play/wilds-legacy-package-history": { assertWildsLegacyResourceAdmission, WILDS_LEGACY_PACKAGE_HISTORY_MESSAGE, WILDS_LEGACY_PACKAGE_HISTORY_CONFLICT: "wilds_resource_legacy_package_history_conflict" }
  };
  Function("module", "exports", "require", source)(testModule, testModule.exports, (name: string) => {
    const dependency = dependencies[name] ?? dependencies[`${name}.js`];
    if (dependency === undefined) throw Error(`Unexpected claim dependency: ${name}`);
    return dependency;
  });
  return { claim: () => testModule.exports.POST({ json: async () => ({ proof: "legacy-proof" }) }), nativeClaims: () => nativeClaims, conditionalReads: () => conditionalReads, fallbackReads: () => fallbackReads };
}

for (const kind of ["bearer-material", "bearer-resource"] as const) {
  test(`${kind} with unpacked package history cannot native-claim its independent legacy subject`, async () => {
    const fixture = mountLegacyClaim(kind, true);
    const response = await fixture.claim();
    assert.equal(response.status, 409);
    assert.equal(response.body.error, "wilds_resource_legacy_package_history_conflict");
    assert.equal(response.body.message, WILDS_LEGACY_PACKAGE_HISTORY_MESSAGE);
    assert.equal(fixture.nativeClaims(), 0, "the history guard must precede the native claim");
    assert.equal(fixture.conditionalReads(), 1);
    assert.equal(fixture.fallbackReads(), 0, "a stale public projection cannot veto native package history");
  });
  test(`${kind} cannot native-claim when the conditional custody source is unavailable`, async () => {
    const fixture = mountLegacyClaim(kind, false, true);
    const response = await fixture.claim();
    assert.equal(response.status, 503);
    assert.equal(fixture.nativeClaims(), 0);
    assert.equal(fixture.fallbackReads(), 0);
  });
}

function mountLegacyWorldAdmission(type: "resource.transfer.admit" | "resource.material.transfer.admit", conditionalInvalid = false) {
  const kind = type === "resource.transfer.admit" ? "resource" : "material", lotId = "lot:already-packaged";
  const world = { resourcePackages: { "package:history": {
    status: "unpacked", ownerReceizId: "successor.receiz.id", package: { members: [{ kind, id: lotId }] }
  } }, constitutionalCommandReceipts: {} };
  const checkpoint = { revision: 1, lastEventId: "world:one" }, record = { checkpoint, eventTail: [] };
  let nativeReads = 0;
  let conditionalReads = 0;
  let fallbackReads = 0;
  class SourceWorld {
    snapshot() { return world; }
    checkpoint() { return checkpoint; }
    events() { return []; }
  }
  const rail = { subjectStateV122: async () => { nativeReads++; throw Error("native_subject_read_forbidden"); } };
  const dependencies: Record<string, unknown> = {
    "./wilds-resource-custody-capability": { requireWildsResourceCustodyRail: () => ({}) },
    "@receiz/sdk": { receizKaiNow: () => ({ uPulse: 1 }) },
    "@/features/play/kai-klok-moment": { KAI_PULSE_DURATION_MS: 5_000 },
    "@/features/play/wilds-world-service": { WildsWorldService: SourceWorld },
    "@/features/play/wilds-world-record": { findWildsWorldRecord: (value: unknown) => value },
    "@/features/play/wilds-world-authority": { verifyWildsWorldCommandKai: () => ({ uPulse: 1, authority: "world" }), worldCommandRequiresCard: () => false },
    "@/lib/platform": { platform: { domain: "wildz.quest" } },
    "./wilds-multiplayer-server": { resolveWildsMultiplayerActor: async () => ({ accessToken: "session", practice: false, handle: "legacy-holder.receiz.id", playerId: "legacy-holder", receizActorId: "usr_legacy_holder" }) },
    "./wilds-world-repository": { createReceizWildsWorldRepository: () => ({
      recover: async () => { fallbackReads++; return record; },
      recoverConditional: async () => {
        conditionalReads++;
        if (conditionalInvalid) throw Error("wilds_resource_custody_proof_invalid");
        return record;
      }
    }) },
    "./adapter": { createReceizCommerceAdapter: () => rail },
    "@/features/play/wilds-legacy-package-history": { assertWildsLegacyResourceAdmission }
  };
  const testModule = { exports: {} as {
    executeWildsWorldCommand(request: unknown, input: unknown): Promise<unknown>;
    wildsResourceCustodySnapshot(request: unknown, actor: unknown): Promise<{ projection: typeof world }>;
  } };
  const source = ts.transpileModule(readFileSync("src/lib/receiz/wilds-world-server.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  // Isolate the server's world/queue symbols; timeout promises remain pending
  // while the immediately resolved authenticated source wins Promise.race.
  Function("module", "exports", "require", "globalThis", "setTimeout", source)(testModule, testModule.exports,
    (name: string) => dependencies[name] ?? {}, {}, () => 0);
  return { admit: () => testModule.exports.executeWildsWorldCommand({ url: "https://wildz.quest/api/wilds/world/command", headers: new Headers() }, {
    command: { type, lotId, ownerReceizId: "legacy-holder", commandId: "legacy:admit", kai: {} }
  }), snapshot: () => testModule.exports.wildsResourceCustodySnapshot({ url: "https://wildz.quest/api/wilds/world/snapshot", headers: new Headers() }, { accessToken: "session", practice: false }), nativeReads: () => nativeReads, conditionalReads: () => conditionalReads, fallbackReads: () => fallbackReads };
}

test("legacy claim custody snapshot reads verified package history without consulting public projections", async () => {
  const fixture = mountLegacyWorldAdmission("resource.transfer.admit");
  const snapshot = await fixture.snapshot();
  assert.equal(snapshot.projection.resourcePackages["package:history"].status, "unpacked");
  assert.equal(fixture.conditionalReads(), 1);
  assert.equal(fixture.fallbackReads(), 0);
});

test("legacy claim custody snapshot rejects invalid source proof without a fallback", async () => {
  const fixture = mountLegacyWorldAdmission("resource.transfer.admit", true);
  await assert.rejects(fixture.snapshot(), /custody_proof_invalid/);
  assert.equal(fixture.fallbackReads(), 0);
});

for (const type of ["resource.transfer.admit", "resource.material.transfer.admit"] as const) {
  test(`${type} cannot bypass package history through the generic world command route`, async () => {
    const fixture = mountLegacyWorldAdmission(type);
    await assert.rejects(fixture.admit(), /legacy_package_history_conflict/);
    assert.equal(fixture.nativeReads(), 0, "package history must be checked before reading or claiming native title");
    assert.equal(fixture.conditionalReads(), 1);
    assert.equal(fixture.fallbackReads(), 0);
  });
  test(`${type} rejects unverified source recovery before native admission`, async () => {
    const fixture = mountLegacyWorldAdmission(type, true);
    await assert.rejects(fixture.admit(), /custody_proof_invalid/);
    assert.equal(fixture.nativeReads(), 0);
    assert.equal(fixture.fallbackReads(), 0);
  });
}

test("unpack and title succession never revive independent legacy lot instruments", () => {
  type World = Parameters<typeof assertWildsLegacyResourceAdmission>[0];
  for (const status of ["packed", "issuing", "offered", "listed", "reserved", "settling", "unpacked"] as const) {
    const world = { resourcePackages: { "package:history": {
      status, ownerReceizId: "successor.receiz.id", receiptId: "receipt:successor",
      package: { members: [{ kind: "material", id: "lot:timber" }, { kind: "resource", id: "lot:honey" }] }
    } } } as unknown as World;
    assert.throws(() => assertWildsLegacyResourceAdmission(world, "material", "lot:timber"), /legacy_package_history_conflict/);
    assert.throws(() => assertWildsLegacyResourceAdmission(world, "resource", "lot:honey"), /legacy_package_history_conflict/);
    assert.doesNotThrow(() => assertWildsLegacyResourceAdmission(world, "material", "lot:unpackaged"));
    assert.doesNotThrow(() => assertWildsLegacyResourceAdmission(world, "resource", "lot:timber"));
  }
});

for (const kind of ["bearer-material", "bearer-resource"] as const) {
  test(`${kind} without package history retains the legacy native claim path`, async () => {
    const fixture = mountLegacyClaim(kind, false);
    const response = await fixture.claim();
    assert.equal(response.status, 200);
    assert.equal(fixture.nativeClaims(), 1);
    assert.equal(fixture.conditionalReads(), 1);
    assert.equal(fixture.fallbackReads(), 0);
  });
}
