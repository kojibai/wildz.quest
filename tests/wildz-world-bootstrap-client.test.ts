import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WildzWorldConnectRequiredError,
  bootstrapWildzSharedWorld
} from "../src/lib/receiz/wildz-session-bridge";

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

test("shared-world bootstrap preserves the server-issued Connect continuation", async () => {
  await assert.rejects(
    bootstrapWildzSharedWorld(async () => Response.json({
      ok: false,
      error: "wilds_world_connect_required",
      connectUrl: "/api/auth/receiz/start?returnTo=%2F&usernameHint=bjklock.receiz.id"
    }, { status: 401 })),
    (error: unknown) => error instanceof WildzWorldConnectRequiredError
      && error.connectUrl.includes("usernameHint=bjklock.receiz.id")
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
