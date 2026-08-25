import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST as bootstrapRoute } from "../app/api/wilds/world/bootstrap/route.js";
import { WildsWorldService } from "../src/features/play/wilds-world-service.js";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment.js";
import { createKaiTemporalRoot } from "../src/features/play/kai-temporal-root.js";
import { createWildsCreatureMandate, evaluateWildsCreatureConsent } from "../src/features/play/wilds-creature-mandate.js";
import { creatureForm } from "../src/features/play/creature-catalog.js";
import { sealCollectedCard, sha256PortableBasis } from "../src/features/play/portable-card.js";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority.js";
import {
  createWildsMaterialHarvest,
  createWildsStewardHarvestOperation,
  createWildsStewardPhiAward,
  initialWildsHarvestedSourceState,
  projectWildsCreatureWorkFamilies
} from "../src/features/play/wilds-steward-construction.js";
import { admitWildsGroveAction, previewWildsGroveAction, projectWildsRegenerativeGrove } from "../src/features/play/wilds-regenerative-grove.js";
import { projectWildsRegionalWeather } from "../src/features/play/wilds-regional-weather.js";
import { admitWildsEmission, admitWildsEmissionOutcome, createWildsWorldEmissionGenesis, previewWildsEmission } from "../src/features/play/wilds-world-emission.js";
import type { WildsWorldRecord } from "../src/features/play/wilds-world-record.js";
import * as worldServer from "../src/lib/receiz/wilds-world-server.js";
import {
  WILDZ_PROOF_SESSION_COOKIE,
  createWildzVaultProofSession,
  packWildzProofSession
} from "../src/lib/receiz/wildz-proof-session.js";
import { WILDZ_RECEIZ_SESSION_SCOPE } from "../src/lib/receiz/wildz-auth-url.js";

const SECRET = "wildz-world-bootstrap-test-secret-at-least-thirty-two-bytes";
const GENESIS_PULSE = "2026-07-15T00:00:00.000Z";
const serviceKey = Symbol.for("receiz.wilds.world.service.v3");
const practiceKey = Symbol.for("receiz.wilds.world.practice.v3");
const hydrationKey = Symbol.for("receiz.wilds.world.hydrated.v3");
const repositoryKey = Symbol.for("receiz.wilds.world.repository.v3");
const mutationQueueKey = Symbol.for("receiz.wilds.world.mutation_queue.v3");
let priorSecret: string | undefined;
let priorFetch: typeof globalThis.fetch;

function commandKai() {
  return createKaiTemporalRoot(deriveKaiKlokMoment({ occurredAt: GENESIS_PULSE, authority: "world" }));
}

function clearWorldGlobals() {
  const root = globalThis as Record<symbol, unknown>;
  for (const key of [serviceKey, practiceKey, hydrationKey, repositoryKey, mutationQueueKey]) delete root[key];
}

function canonicalWorld(pulse = GENESIS_PULSE): WildsWorldRecord {
  const canonical = new WildsWorldService();
  canonical.tick({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });
  canonical.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });
  canonical.tickGroves({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });
  return { checkpoint: canonical.checkpoint(), eventTail: canonical.events() };
}

function canonicalGroveWorld() {
  const moment = deriveKaiKlokMoment({ occurredAt: GENESIS_PULSE, authority: "world" });
  const seeded = new WildsWorldService(canonicalWorld());
  const projectedGrove = Object.values(seeded.snapshot().groves)[0]!;
  const emission = seeded.snapshot().worldEmission!;
  const weather = projectedGrove.weather;
  const professions = ["gather"];
  const consent = evaluateWildsCreatureConsent({
    creatureSubjectId: "creature:bee", creatureHead: "4".repeat(64),
    condition: { energy: 90, fatigue: 0, injury: 0, stress: 0 }, bond: 90,
    preferences: { professions, avoidHazards: [] }, capabilities: { professions },
    safety: { risk: 1, hazards: [], supportAvailable: true }, requested: { professions, maxActions: 2 }, kaiUPulse: moment.uPulse
  });
  const mandate = createWildsCreatureMandate({
    consent, creatureSubjectId: "creature:bee", creatureHead: "4".repeat(64), region: { x: -2, z: -2 },
    professions, allowedResourceIds: [projectedGrove.groveId], maxActions: 2,
    issuedAtKaiUPulse: moment.uPulse, expiresAtKaiUPulse: moment.uPulse + 10_000_000
  });
  const observation = previewWildsGroveAction({
    grove: projectedGrove, action: "observe", actor: { id: "bjklock.receiz.id", head: "5".repeat(64) }, mandate, weather, moment, emission
  });
  const grove = admitWildsGroveAction({ grove: projectedGrove, preview: observation });
  const world = seeded;
  const authority = { actorId: "bjklock", canonical: true, pulse: GENESIS_PULSE, occurredAt: GENESIS_PULSE, uPulse: moment.uPulse } as const;
  world.execute({
    type: "grove.act", operation: observation.operation, grove,
    emission: admitWildsEmissionOutcome({ emission, operation: observation.operation, contributionClass: "ecology", preview: observation.emission }),
    amountPhiMicro: observation.emission.amountPhiMicro,
    commandId: "grove:observe:bootstrap"
  }, authority);
  const observedEmission = world.snapshot().worldEmission!;
  const observedPreview = previewWildsGroveAction({
    grove, action: "gather", actor: { id: "bjklock.receiz.id", head: "5".repeat(64) }, mandate, weather, moment, emission: observedEmission
  });
  const admittedGrove = admitWildsGroveAction({ grove, preview: observedPreview });
  const admittedEmission = admitWildsEmission({ emission: observedEmission, operation: observedPreview.operation, contributionClass: "ecology", preview: observedPreview.emission });
  return {
    record: { checkpoint: world.checkpoint(), eventTail: world.events() },
    command: {
      type: "grove.act" as const, operation: observedPreview.operation, grove: admittedGrove, emission: admittedEmission,
      amountPhiMicro: observedPreview.emission.amountPhiMicro, commandId: "grove:gather:bootstrap", kai: commandKai()
    }
  };
}

function canonicalStewardWorld() {
  const actorId = "bjklock.receiz.id";
  const moment = deriveKaiKlokMoment({ occurredAt: GENESIS_PULSE, authority: "world" });
  const service = new WildsWorldService(canonicalWorld());
  const source = [-1, 0, 1].flatMap((x) => [-1, 0, 1].flatMap((z) => projectWildsResourceRegion(x, z)))
    .find((candidate) => candidate.kind === "timber")!;
  assert.ok(source);
  const asset = sealCollectedCard({ capturedAt: GENESIS_PULSE, encounterId: "bootstrap-steward", formId: "mintcub-1", ownerReceizId: actorId });
  const creatureSubjectId = `creature:${sha256PortableBasis(asset.id).slice(0, 32)}`;
  const creatureHead = sha256PortableBasis(asset.proof.digest);
  const professions = projectWildsCreatureWorkFamilies(creatureForm(asset.manifest.formId)!.element);
  const consent = evaluateWildsCreatureConsent({
    creatureSubjectId, creatureHead,
    condition: { energy: 100, fatigue: 0, injury: 0, stress: 0 }, bond: 80,
    preferences: { professions, avoidHazards: [] }, capabilities: { professions },
    safety: { risk: 1, hazards: [], supportAvailable: false }, requested: { professions, maxActions: 2 }, kaiUPulse: moment.uPulse
  });
  const mandate = createWildsCreatureMandate({
    consent, creatureSubjectId, creatureHead, region: { x: source.regionX, z: source.regionZ },
    professions, allowedResourceIds: [source.sourceId], maxActions: 2,
    issuedAtKaiUPulse: moment.uPulse, expiresAtKaiUPulse: moment.uPulse + 1_000_000
  });
  const currentSource = initialWildsHarvestedSourceState(source);
  const harvested = createWildsMaterialHarvest({
    source, current: currentSource, ownerReceizId: actorId, actorPosition: source.position,
    creature: { subjectId: creatureSubjectId, head: creatureHead, workFamilies: professions, willing: true },
    kaiUPulse: moment.uPulse
  });
  const operation = createWildsStewardHarvestOperation({
    source, currentSource, harvestedSource: harvested.source, lot: harvested.lot,
    ownerReceizId: actorId, playerHead: sha256PortableBasis(actorId), creatureSubjectId, creatureHead,
    kaiUPulse: moment.uPulse
  });
  const currentEmission = service.snapshot().worldEmission!;
  const preview = previewWildsEmission({ emission: currentEmission, operation, contributionClass: "construction" });
  const emission = admitWildsEmission({ emission: currentEmission, operation, contributionClass: "construction", preview });
  const phiAward = createWildsStewardPhiAward({ ownerReceizId: actorId, operation, currentEmission, nextEmission: emission, amountPhiMicro: preview.amountPhiMicro });
  return {
    record: { checkpoint: service.checkpoint(), eventTail: service.events() },
    card: asset,
    command: {
      type: "resource.material.harvest" as const, source, sourceHead: currentSource.head,
      actorPosition: { x: source.position.x, z: source.position.z }, mandate, operation, emission,
      amountPhiMicro: preview.amountPhiMicro, phiAward, cardProofDigest: asset.proof.digest,
      commandId: "command:steward:bootstrap", kai: commandKai()
    }
  };
}

function proofRequest(withReceizResponseToken = false) {
  const session = createWildzVaultProofSession({
    actorId: "bjklock",
    profileHandle: "bjklock.receiz.id",
    proofBasisSha256: "a".repeat(64),
    byteDigestSha256: "b".repeat(64),
    vaultCardRootSha256: `sha256:${"c".repeat(64)}`,
    issuedAt: Date.now()
  }, SECRET);
  const token = packWildzProofSession(session, SECRET);
  return {
    request: new NextRequest("https://wildz.quest/api/wilds/world/bootstrap", {
      method: "POST",
      headers: { cookie: [
        `${WILDZ_PROOF_SESSION_COOKIE}=${token}`,
        ...(withReceizResponseToken ? [
          "receiz_access_token=receiz-response-token",
          `receiz_session_scope=${encodeURIComponent(WILDZ_RECEIZ_SESSION_SCOPE)}`
        ] : [])
      ].join("; ") }
    }),
    session
  };
}

function bootstrap(request: NextRequest) {
  const implementation = (worldServer as typeof worldServer & {
    bootstrapWildsWorld?: (request: NextRequest) => Promise<{
      projection: { revision: number };
      mode: string;
      publication: { published: boolean; mode: string; revision: number; conflict?: boolean };
    }>;
  }).bootstrapWildsWorld;
  assert.equal(typeof implementation, "function", "bootstrapWildsWorld must be implemented");
  if (!implementation) throw new Error("bootstrapWildsWorld must be implemented");
  return implementation(request);
}

beforeEach(() => {
  priorSecret = process.env.RECEIZ_OAUTH_STATE_SECRET;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  priorFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ preferred_username: "bjklock" });
  clearWorldGlobals();
});

afterEach(() => {
  clearWorldGlobals();
  globalThis.fetch = priorFetch;
  if (priorSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
  else process.env.RECEIZ_OAUTH_STATE_SECRET = priorSecret;
});

test("an authenticated bootstrap rehydrates an existing positive canonical world without republishing it", async () => {
  const record = canonicalWorld("2026-07-15T12:00:00.000Z");
  let publishes = 0;
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => record,
    publish: async () => {
      publishes += 1;
      throw new Error("unexpected_publish");
    },
    audit: async () => true
  };

  const result = await bootstrap(proofRequest().request);

  assert.equal(result.mode, "receiz_live");
  assert.equal(result.projection.revision, record.checkpoint.revision);
  assert.deepEqual(result.publication, {
    published: false,
    mode: "receiz_live",
    revision: record.checkpoint.revision,
    record
  });
  assert.equal(publishes, 0);
});

test("an authenticated bootstrap prepares deterministic genesis for Identity Seal publication", async () => {
  let publishes = 0;
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => null,
    publish: async () => { publishes += 1; throw new Error("delegated_publish_forbidden"); },
    audit: async () => true
  };
  const { request } = proofRequest();

  const result = await bootstrap(request);

  const expected = canonicalWorld();
  assert.equal(result.mode, "kai_live");
  assert.equal(result.projection.revision, expected.checkpoint.revision);
  assert.equal(result.publication.published, false);
  assert.equal((result.publication as { required?: string }).required, "identity_proof");
  assert.equal(result.publication.draft.merchantReceizId, "bjklock.receiz.id");
  assert.deepEqual(result.publication.draft.expectedHead, { revision: 0, lastEventId: null });
  assert.deepEqual(result.publication.draft.storeStateRecord, expected);
  assert.equal(publishes, 0);
});

test("a matching Receiz response token directly publishes genesis with user authority", async () => {
  let publishedAccessToken = "";
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => null,
    publish: async ({ actor, record }: { actor: { accessToken?: string }; record: WildsWorldRecord }) => {
      publishedAccessToken = actor.accessToken ?? "";
      return { published: true, mode: "receiz_live", revision: record.checkpoint.revision, record };
    },
    audit: async () => true
  };

  const result = await bootstrap(proofRequest(true).request);

  assert.equal(result.mode, "receiz_live");
  assert.equal(result.publication.published, true);
  assert.equal(publishedAccessToken, "receiz-response-token");
});

test("an authenticated proof session joins the canonical Kai world without a separate OIDC token", async () => {
  let recoveries = 0;
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => {
      recoveries += 1;
      return canonicalWorld();
    },
    publish: async () => { throw new Error("unexpected_publish"); },
    audit: async () => true
  };

  const result = await bootstrap(proofRequest().request);

  assert.equal(result.mode, "receiz_live");
  assert.equal(result.projection.revision, canonicalWorld().checkpoint.revision);
  assert.equal(recoveries, 1);
});

test("the bootstrap route accepts proof-native identity without delegated player access", async () => {
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => canonicalWorld(),
    publish: async () => { throw new Error("unexpected_publish"); },
    audit: async () => true
  };
  const response = await bootstrapRoute(proofRequest().request);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.mode, "receiz_live");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("genesis bootstrap never invokes the delegated publication repository", async () => {
  let publishes = 0;
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => null,
    publish: async () => { publishes += 1; throw new Error("delegated_publish_forbidden"); },
    audit: async () => true
  };

  const result = await bootstrap(proofRequest().request);

  assert.equal(result.mode, "kai_live");
  assert.equal(result.publication.published, false);
  assert.equal((result.publication as { required?: string }).required, "identity_proof");
  assert.equal(publishes, 0);
});

test("prepared Identity Seal genesis rolls canonical memory back until the proof append is recoverable", async () => {
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => null,
    publish: async () => ({
      published: false,
      mode: "receiz_recovery_pending",
      revision: canonicalWorld().checkpoint.revision
    }),
    audit: async () => true
  };

  const result = await bootstrap(proofRequest().request);

  assert.equal(result.mode, "kai_live");
  assert.equal(
    ((globalThis as Record<symbol, unknown>)[serviceKey] as WildsWorldService).checkpoint().revision,
    0
  );
});

test("bootstrap requires a proof-session actor before touching the canonical repository", async () => {
  let recoveries = 0;
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => {
      recoveries += 1;
      return null;
    },
    publish: async () => { throw new Error("unexpected_publish"); },
    audit: async () => true
  };
  const request = new NextRequest("https://wildz.quest/api/wilds/world/bootstrap", { method: "POST" });

  await assert.rejects(bootstrap(request), /wilds_world_proof_session_required/);
  assert.equal(recoveries, 0);
});

test("the bootstrap route returns only a no-store acknowledged live projection", async () => {
  const record = canonicalWorld();
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => record,
    publish: async () => { throw new Error("unexpected_publish"); },
    audit: async () => true
  };

  const response = await bootstrapRoute(proofRequest().request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(body.ok, true);
  assert.equal(body.mode, "receiz_live");
  assert.equal(body.projection.revision, record.checkpoint.revision);
});

test("the bootstrap route rejects a missing proof session without probing or mutating Receiz", async () => {
  let repositoryCalls = 0;
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => {
      repositoryCalls += 1;
      return null;
    },
    publish: async () => {
      repositoryCalls += 1;
      throw new Error("unexpected_publish");
    },
    audit: async () => true
  };

  const response = await bootstrapRoute(new NextRequest(
    "https://wildz.quest/api/wilds/world/bootstrap",
    { method: "POST" }
  ));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "wilds_world_proof_session_required"
  });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(repositoryCalls, 0);
});

test("a proof-native player command prepares an Identity Seal append and never delegates publication", async () => {
  const record = canonicalWorld();
  let publishes = 0;
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => record,
    publish: async () => { publishes += 1; throw new Error("delegated_publish_forbidden"); },
    audit: async () => { throw new Error("delegated_audit_forbidden"); }
  };
  const result = await worldServer.executeWildsWorldCommand(proofRequest().request, {
    command: {
      type: "team.create",
      name: "Proof Keepers",
      commandId: "command:team:create:identity-proof-test",
      kai: commandKai()
    }
  });

  assert.equal(result.mode, "kai_live");
  assert.equal(result.publication.published, false);
  assert.equal(result.publication.required, "identity_proof");
  assert.equal(result.publication.draft.merchantReceizId, "bjklock.receiz.id");
  assert.equal(result.publication.draft.expectedHead.revision, record.checkpoint.revision);
  assert.equal(result.publication.draft.storeStateRecord.checkpoint.revision > record.checkpoint.revision, true);
  assert.equal(publishes, 0);
});

test("a matching Receiz response token publishes a player command before acknowledging it", async () => {
  const record = canonicalWorld();
  let publishedRevision = -1;
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => record,
    publish: async ({ actor, record: next }: { actor: { accessToken?: string }; record: WildsWorldRecord }) => {
      assert.equal(actor.accessToken, "receiz-response-token");
      publishedRevision = next.checkpoint.revision;
      return { published: true, mode: "receiz_live", revision: next.checkpoint.revision, record: next };
    },
    audit: async () => true
  };

  const result = await worldServer.executeWildsWorldCommand(proofRequest(true).request, {
    command: { type: "team.create", name: "Global Keepers", commandId: "command:team:create:response-token", kai: commandKai() }
  });

  assert.equal(result.mode, "receiz_live");
  assert.equal(result.publication.published, true);
  assert.equal(publishedRevision, result.projection.revision);
});

test("a Grove operation reaches the canonical world only after its exact V124 plan commits", async () => {
  const data = canonicalGroveWorld();
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => data.record,
    publish: async () => { throw new Error("delegated_publish_forbidden"); },
    audit: async () => true
  };
  let sourceRevisionDuringExecution = -1;
  const result = await worldServer.executeWildsWorldCommand(proofRequest().request, {
    command: data.command,
    receizExecution: { authoritySession: { signedSourceAuthority: true } }
  }, {
    prepareLivingWorldAuthorityV124: async () => ({ signedSourceAuthority: true }) as never,
    executeLivingWorldV124: async (input) => {
      sourceRevisionDuringExecution = ((globalThis as Record<symbol, unknown>)[serviceKey] as WildsWorldService).checkpoint().revision;
      assert.equal(input.amountPhiMicro, data.command.amountPhiMicro);
      assert.equal(input.operation.planDigest, data.command.operation.planDigest);
      return { status: "committed" };
    }
  });

  assert.equal(sourceRevisionDuringExecution, data.record.checkpoint.revision);
  assert.equal(result.projection.revision, data.record.checkpoint.revision + 1);
  assert.equal(result.projection.worldEmission?.head, data.command.emission.head);
});

test("source-authoritative steward work reaches the world and settlement together", async () => {
  const data = canonicalStewardWorld();
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => data.record,
    publish: async () => { throw new Error("delegated_publish_forbidden"); },
    audit: async () => true
  };
  let sourceRevisionDuringExecution = -1;
  const result = await worldServer.executeWildsWorldCommand(proofRequest().request, {
    command: data.command,
    card: data.card,
    receizExecution: { authoritySession: { signedSourceAuthority: true } }
  }, {
    prepareLivingWorldAuthorityV124: async () => ({ signedSourceAuthority: true }) as never,
    executeLivingWorldV124: async (input) => {
      sourceRevisionDuringExecution = ((globalThis as Record<symbol, unknown>)[serviceKey] as WildsWorldService).checkpoint().revision;
      assert.equal(input.amountPhiMicro, "40000");
      assert.equal(input.operation.intention.kind, "steward.harvest-timber");
      assert.notEqual(input.heads.inventory.current, input.heads.inventory.next);
      return { status: "committed" };
    }
  });

  assert.equal(sourceRevisionDuringExecution, data.record.checkpoint.revision);
  assert.equal(result.projection.revision, data.record.checkpoint.revision + 1);
  assert.equal(Object.keys(result.projection.stewardPhiAwards).length, 1);
  assert.equal(result.projection.worldEmission?.head, data.command.emission.head);
});

test("source-authoritative steward work commits without a second global execution grant", async () => {
  const data = canonicalStewardWorld();
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => data.record,
    publish: async () => { throw new Error("delegated_publish_forbidden"); },
    audit: async () => true
  };

  const result = await worldServer.executeWildsWorldCommand(proofRequest().request, {
    command: data.command,
    card: data.card
  }, {
    prepareLivingWorldAuthorityV124: async () => { throw new Error("representation_must_not_gate_source"); },
    executeLivingWorldV124: async () => { throw new Error("representation_must_not_gate_source"); }
  });

  assert.equal(result.projection.revision, data.record.checkpoint.revision + 1);
  assert.equal(Object.keys(result.projection.materialLots).length, 1);
  assert.equal(Object.keys(result.projection.stewardPhiAwards).length, 1);
  assert.equal(result.projection.worldEmission?.head, data.command.emission.head);
});

test("a V124 zero-write representation cannot roll back an admitted source proof", async () => {
  const data = canonicalGroveWorld();
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => data.record,
    publish: async () => { throw new Error("unexpected_publish"); },
    audit: async () => true
  };
  const result = await worldServer.executeWildsWorldCommand(proofRequest().request, {
    command: data.command,
    receizExecution: { authoritySession: { signedSourceAuthority: true } }
  }, {
    prepareLivingWorldAuthorityV124: async () => ({ signedSourceAuthority: true }) as never,
    executeLivingWorldV124: async () => ({ status: "zero-write", reasonCode: "STALE_HEAD" })
  });

  assert.equal(result.projection.revision, data.record.checkpoint.revision + 1);
  assert.equal(result.projection.groves[data.command.grove.groveId]?.head, data.command.grove.head);
  assert.equal((result.publication as { required?: string }).required, "identity_proof");
});

test("a temporarily unavailable global projection cannot roll back admitted source work", async () => {
  const data = canonicalStewardWorld();
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => data.record,
    publish: async () => ({ published: false, mode: "receiz_recovery_pending", revision: data.record.checkpoint.revision + 1 }),
    audit: async () => true
  };
  const result = await worldServer.executeWildsWorldCommand(proofRequest(true).request, { command: data.command, card: data.card });
  assert.equal(result.mode, "receiz_recovery_pending");
  assert.equal(result.projection.revision, data.record.checkpoint.revision + 1);
  assert.equal(Object.keys(result.projection.materialLots).length, 1);
  assert.equal(((globalThis as Record<symbol, unknown>)[serviceKey] as WildsWorldService).checkpoint().revision, result.projection.revision);
});
