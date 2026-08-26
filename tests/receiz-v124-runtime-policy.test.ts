import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { ReceizCommerceAdapter } from "../src/lib/receiz/adapter";
import {
  WILDZ_V124_TWIN_OPERATIONS,
  WILDZ_V124_VALUE_OPERATIONS,
  WILDZ_V124_WORLD_OPERATIONS,
  qualifyWildzV124Operations
} from "../src/lib/receiz/v124-runtime-policy";

function rail(statuses: Readonly<Record<string, "available" | "degraded" | "unavailable">>) {
  return {
    qualifyRuntimeV124: async (input: { applicationId: string; operations: readonly string[] }) => ({
      schema: "receiz.operational-capability-report.v124",
      applicationId: input.applicationId,
      requestedOperations: input.operations,
      qualifiedAtKaiUPulse: 1,
      results: input.operations.map((operation) => ({ operation, status: statuses[operation] ?? "available" })),
      reportDigest: "report",
      runtimeReceiptDigest: "receipt",
      authority: {
        reportIsProofAuthority: false,
        reportIsOperationalAuthority: false,
        strongerTruth: "receiz-identity-artifact"
      }
    })
  } as unknown as Pick<ReceizCommerceAdapter, "qualifyRuntimeV124">;
}

describe("Receiz v124 production-runtime policy", () => {
  it("names every relevant Twin, replay/private-world, durable execution, and value rail", () => {
    assert.deepEqual(WILDZ_V124_TWIN_OPERATIONS, [
      "subject.resolve",
      "subject.brain.retrieve",
      "subject.twin.message",
      "subject.memory.project",
      "subject.namespaces.resolve"
    ]);
    for (const operation of [
      "domain.replay.verify",
      "domain.checkpoint.verify",
      "domain.private-additions.resolve",
      "execution.atomic-mutation.plan"
    ]) assert.ok(WILDZ_V124_WORLD_OPERATIONS.includes(operation as never), operation);
    for (const operation of [
      "identity.public-recipient.resolve",
      "value.settlement.execute",
      "value.reserve.execute",
      "execution.resolve-by-idempotency-key"
    ]) assert.ok(WILDZ_V124_VALUE_OPERATIONS.includes(operation as never), operation);
  });

  it("admits optional remote work only when every requested production dependency is available", async () => {
    const ready = await qualifyWildzV124Operations(rail({}), WILDZ_V124_TWIN_OPERATIONS);
    assert.equal(ready.available, true);
    assert.deepEqual(ready.unavailable, []);

    const unavailable = await qualifyWildzV124Operations(rail({
      "subject.memory.project": "degraded"
    }), WILDZ_V124_TWIN_OPERATIONS);
    assert.equal(unavailable.available, false);
    assert.deepEqual(unavailable.unavailable, ["subject.memory.project"]);
    assert.equal(unavailable.report.authority.reportIsProofAuthority, false);
  });

  it("exposes canonical SDK methods instead of reconstructing V124 authority", () => {
    const adapter = readFileSync("src/lib/receiz/adapter.ts", "utf8");
    for (const method of [
      "openAuthoritySessionV124",
      "refreshAuthoritySessionV124",
      "closeAuthoritySessionV124",
      "stagePreparedExecutionV124",
      "resolveExecutionByIdempotencyV124",
      "verifiedDomainReplayV124",
      "verifiedPrivateDomainAdditionsV124",
      "exportDomainReplayProofObjectV124",
      "restoreDomainReplayProofObjectV124",
      "resolveSubjectNamespacesV124",
      "resolvePublicRecipientV124",
      "publishSealedSourceV124",
      "subjectTwinMemorySummary"
    ]) assert.match(adapter, new RegExp(`\\b${method}\\b`), method);
    assert.doesNotMatch(adapter, /authoritySessionHandle\s*:\s*["'`]wildz/);
  });

  it("keeps generated intelligence subordinate to proof admission and memory enrichment optional", () => {
    const route = readFileSync("app/api/receiz/creature-observer/route.ts", "utf8");
    const panel = readFileSync("src/features/play/CreatureConsciousnessPanel.tsx", "utf8");
    const composition = route.indexOf("composeCreatureIntelligenceReply");
    const admittedSpeech = route.indexOf("const speech = admittedResult.reply");
    const optionalAudio = route.indexOf("const enrichment");
    assert.ok(composition >= 0 && admittedSpeech > composition && optionalAudio > admittedSpeech);
    assert.match(route, /proof object is the source authority/);
    assert.match(route, /responseRail: admittedResult\.source/);
    assert.match(route, /const qualified = await twinQualification/);
    assert.match(route, /subjects\.twin\.memorySummary/);
    assert.match(route, /await enrichmentSettled/);
    assert.match(route, /Enrichment never affects the proof response rail/);
    assert.match(panel, /V124 memory\/audio enrichment[\s\S]*setLoading\(false\)/);
  });
});
