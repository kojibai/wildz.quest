import assert from "node:assert/strict";
import { test } from "node:test";
import { bootstrapWildzSharedWorld } from "../src/lib/receiz/wildz-session-bridge";
import { WildsWorldService } from "../src/features/play/wilds-world-service";

test("shared-world bootstrap accepts only an acknowledged live canonical projection", async () => {
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const projection = {
    schema: "receiz.wilds_world_projection.v3",
    worldId: "wilds:global:v3",
    revision: 2
  };
  const result = await bootstrapWildzSharedWorld(async (input, init) => {
    requests.push({ input, init });
    return Response.json({ ok: true, mode: "receiz_live", projection });
  });

  assert.deepEqual(result, { ok: true, mode: "receiz_live", projection });
  assert.equal(requests[0]?.input, "/api/wilds/world/bootstrap");
  assert.equal(requests[0]?.init?.method, "POST");
  assert.equal(requests[0]?.init?.credentials, "same-origin");
});

test("shared-world bootstrap preserves an Identity Seal publication request without navigation", async () => {
  const world = new WildsWorldService();
  const pulse = "2026-07-15T00:00:00.000Z";
  world.tick({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });
  world.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });
  const storeStateRecord = { checkpoint: world.checkpoint(), eventTail: world.events() };
  const projection = {
    schema: "receiz.wilds_world_projection.v3",
    worldId: "wilds:global:v3",
    revision: 2
  };
  const publication = {
    published: false,
    required: "identity_proof",
    draft: {
      schema: "receiz.wildz_world_identity_publication.v1",
      tenantHost: "wildz.quest",
      merchantReceizId: "bjklock.receiz.id",
      sourceUrl: "https://wildz.quest/api/wilds/world/snapshot",
      namespace: "wilds:global:v3",
      projectionState: "published",
      platform: "Wildz",
      title: "Receiz Wildz canonical world",
      storeStateRecord,
      expectedHead: { revision: 0, lastEventId: null },
      idempotencyKey: `wilds:global:v3:${storeStateRecord.checkpoint.revision}:${storeStateRecord.checkpoint.lastEventId}`
    }
  };
  const result = await bootstrapWildzSharedWorld(async () => Response.json({
    ok: true,
    mode: "kai_live",
    projection,
    publication
  }));
  assert.equal(result.mode, "kai_live");
  assert.deepEqual(result.publication, publication);
});

test("shared-world bootstrap rejects Connect-required responses without exposing a navigation", async () => {
  await assert.rejects(
    bootstrapWildzSharedWorld(async () => Response.json({
      ok: false,
      error: "wilds_world_connect_required",
      connectUrl: "/api/auth/receiz/start?returnTo=%2F&usernameHint=bjklock.receiz.id"
    }, { status: 401 })),
    /wildz_world_bootstrap_unavailable/
  );
});

test("shared-world bootstrap fails closed on practice, recovery, malformed, or rejected responses", async () => {
  for (const response of [
    Response.json({ ok: true, mode: "local_practice", projection: {} }),
    Response.json({ ok: true, mode: "receiz_recovery_pending", projection: {} }),
    Response.json({ ok: false, error: "wilds_world_canonical_publish_required" }, { status: 503 }),
    Response.json(null)
  ]) {
    await assert.rejects(
      bootstrapWildzSharedWorld(async () => response),
      /wildz_world_bootstrap_unavailable/
    );
  }
});
