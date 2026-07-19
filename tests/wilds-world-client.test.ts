import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state.js";
import {
  acceptWildsWorldSnapshot,
  buildWildsWorldCommandBody,
  parseWildsWorldCommandResponse,
  parseWildsWorldSnapshotResponse,
  wildsWorldModeAfterConfirmedBootstrap,
  wildsWorldModeAfterRequestFailure
} from "../src/features/play/use-wilds-world.js";

describe("Wilds world client contract", () => {
  it("never rolls a client back to an older canonical revision", () => {
    const current = { ...initialWildsWorldProjection(), revision: 8 };
    const stale = { ...initialWildsWorldProjection(), revision: 7 };
    const fresh = { ...initialWildsWorldProjection(), revision: 9 };

    assert.equal(acceptWildsWorldSnapshot(current, stale), current);
    assert.equal(acceptWildsWorldSnapshot(current, fresh), fresh);
  });

  it("builds one explicit guest-aware command envelope", () => {
    assert.deepEqual(buildWildsWorldCommandBody("guest-12345678", { type: "raid.join", bossId: "boss:one", commandId: "command:one" }), {
      guestId: "guest-12345678",
      command: { type: "raid.join", bossId: "boss:one", commandId: "command:one" }
    });
  });

  it("sends sealed card material only for semantic raid actions", () => {
    const card = { id: "card:one", proof: { digest: `sha256:${"a".repeat(64)}` } } as never;
    const cardAdmission = { schema: "receiz.wilds.vault_card_membership.v1", leafIndex: 0 } as never;
    assert.deepEqual(buildWildsWorldCommandBody("guest-12345678", { type: "raid.act", bossId: "boss:one", roundId: "round:one", intent: "strike", commandId: "command:act" }, card, cardAdmission), {
      guestId: "guest-12345678",
      command: { type: "raid.act", bossId: "boss:one", roundId: "round:one", intent: "strike", commandId: "command:act" },
      card,
      cardAdmission
    });
  });

  it("accepts exactly one projection and mode layer", () => {
    const projection = initialWildsWorldProjection();
    assert.deepEqual(parseWildsWorldSnapshotResponse({ ok: true, projection, mode: "local_practice" }), {
      projection,
      mode: "local_practice"
    });
    assert.throws(() => parseWildsWorldSnapshotResponse({ ok: true, projection: { projection, mode: "local_practice" }, mode: "local_practice" }), /wilds_world_snapshot_invalid/);
    assert.throws(() => parseWildsWorldSnapshotResponse({ ok: true, projection, mode: "unknown" }), /wilds_world_snapshot_invalid/);
  });

  it("accepts a recovery mode only from a flat command response", () => {
    const projection = initialWildsWorldProjection();
    assert.deepEqual(parseWildsWorldCommandResponse({ ok: true, projection, mode: "receiz_recovery_pending" }), {
      projection,
      mode: "receiz_recovery_pending"
    });
    assert.throws(() => parseWildsWorldCommandResponse({ ok: true, projection, publication: { mode: "receiz_live" } }), /wilds_world_command_response_invalid/);
  });

  it("spreads the server snapshot into the route response", () => {
    const route = readFileSync("app/api/wilds/world/snapshot/route.ts", "utf8");
    assert.match(route, /ok:\s*true,\s*\.\.\.await worldSnapshot/);
    assert.doesNotMatch(route, /projection:\s*await worldSnapshot/);
  });

  it("keeps online request failures reconnecting even when the request carries a guest id", () => {
    const source = readFileSync("src/features/play/use-wilds-world.ts", "utf8");

    assert.equal(wildsWorldModeAfterRequestFailure(false, "connecting"), "reconnecting");
    assert.equal(wildsWorldModeAfterRequestFailure(false, "receiz_live"), "receiz_live");
    assert.equal(wildsWorldModeAfterRequestFailure(true, "receiz_live"), "local_practice");
    assert.doesNotMatch(source, /offline\s*\|\|\s*input\.guestId/);
  });

  it("enters the live client mode immediately after the shell confirms canonical bootstrap", () => {
    assert.equal(wildsWorldModeAfterConfirmedBootstrap("connecting"), "receiz_live");
    assert.equal(wildsWorldModeAfterConfirmedBootstrap("reconnecting"), "reconnecting");
    assert.equal(wildsWorldModeAfterConfirmedBootstrap("local_practice"), "local_practice");
  });

  it("does not visually promote a server practice mode from a separate session flag", () => {
    const hud = readFileSync("src/features/play/WildsLivingWorldHud.tsx", "utf8");
    assert.doesNotMatch(hud, /displayedMode\s*=\s*connected\s*\?/);
    assert.doesNotMatch(hud, /wildsLivingWorldModeLabel\(world\.mode,\s*connected\)/);
  });
});
