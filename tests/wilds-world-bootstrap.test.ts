import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST as bootstrapRoute } from "../app/api/wilds/world/bootstrap/route.js";
import { WildsWorldService } from "../src/features/play/wilds-world-service.js";
import type { WildsWorldRecord } from "../src/features/play/wilds-world-record.js";
import * as worldServer from "../src/lib/receiz/wilds-world-server.js";
import {
  WILDZ_PROOF_SESSION_COOKIE,
  createWildzVaultProofSession,
  packWildzProofSession
} from "../src/lib/receiz/wildz-proof-session.js";

const SECRET = "wildz-world-bootstrap-test-secret-at-least-thirty-two-bytes";
const GENESIS_PULSE = "2026-07-15T00:00:00.000Z";
const serviceKey = Symbol.for("receiz.wilds.world.service.v3");
const practiceKey = Symbol.for("receiz.wilds.world.practice.v3");
const hydrationKey = Symbol.for("receiz.wilds.world.hydrated.v3");
const repositoryKey = Symbol.for("receiz.wilds.world.repository.v3");
const mutationQueueKey = Symbol.for("receiz.wilds.world.mutation_queue.v3");
let priorSecret: string | undefined;

function clearWorldGlobals() {
  const root = globalThis as Record<symbol, unknown>;
  for (const key of [serviceKey, practiceKey, hydrationKey, repositoryKey, mutationQueueKey]) delete root[key];
}

function canonicalWorld(pulse = GENESIS_PULSE): WildsWorldRecord {
  const canonical = new WildsWorldService();
  canonical.tick({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });
  canonical.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });
  return { checkpoint: canonical.checkpoint(), eventTail: canonical.events() };
}

function proofRequest() {
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
      headers: { cookie: `${WILDZ_PROOF_SESSION_COOKIE}=${token}` }
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
  clearWorldGlobals();
});

afterEach(() => {
  clearWorldGlobals();
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

test("an authenticated bootstrap deterministically publishes genesis from canonical head zero", async () => {
  let publicationInput: Record<string, unknown> | undefined;
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => null,
    publish: async (input: Record<string, unknown>) => {
      publicationInput = input;
      const record = input.record as WildsWorldRecord;
      return {
        published: true,
        mode: "receiz_live",
        revision: record.checkpoint.revision,
        conflict: false,
        record
      };
    },
    audit: async () => true
  };
  const { request, session } = proofRequest();

  const result = await bootstrap(request);

  const expected = canonicalWorld();
  assert.equal(result.mode, "receiz_live");
  assert.equal(result.projection.revision, expected.checkpoint.revision);
  assert.equal(result.publication.published, true);
  assert.deepEqual(publicationInput?.expectedHead, { revision: 0, lastEventId: null });
  assert.deepEqual(publicationInput?.record, expected);
  assert.deepEqual(publicationInput?.actor, {
    playerId: `vault:${session.subjectKey}`,
    handle: "bjklock.receiz.id",
    receizActorId: `vault:${session.subjectKey}`,
    practice: false,
    vaultCardRootSha256: session.vaultCardRootSha256
  });
});

test("an authenticated bootstrap accepts and rehydrates a valid competing positive world", async () => {
  const competing = canonicalWorld("2026-07-16T00:00:00.000Z");
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => null,
    publish: async () => ({
      published: false,
      mode: "receiz_recovery_pending",
      revision: canonicalWorld().checkpoint.revision,
      conflict: true,
      record: competing
    }),
    audit: async () => true
  };

  const result = await bootstrap(proofRequest().request);

  assert.equal(result.mode, "receiz_live");
  assert.equal(result.projection.revision, competing.checkpoint.revision);
  assert.equal(result.publication.published, false);
  assert.equal(result.publication.conflict, true);
  assert.equal(result.publication.mode, "receiz_live");
  assert.equal(
    ((globalThis as Record<symbol, unknown>)[serviceKey] as WildsWorldService).checkpoint().lastEventId,
    competing.checkpoint.lastEventId
  );
});

test("an unsuccessful genesis publication rolls canonical memory back to head zero and fails closed", async () => {
  (globalThis as Record<symbol, unknown>)[repositoryKey] = {
    recover: async () => null,
    publish: async () => ({
      published: false,
      mode: "receiz_recovery_pending",
      revision: canonicalWorld().checkpoint.revision
    }),
    audit: async () => true
  };

  await assert.rejects(bootstrap(proofRequest().request), /wilds_world_canonical_publish_required/);

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
