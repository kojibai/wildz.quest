import assert from "node:assert/strict";
import { test } from "node:test";
import { createKaiTemporalRoot } from "../src/features/play/kai-temporal-root";
import { deriveKaiKlokMomentFromUPulse, kaiUPulseToISOString } from "../src/features/play/kai-klok-moment";
import { WILDS_CLAN_RULES_DIGEST } from "../src/features/play/wilds-city";
import { prepareWildsWorldOutboxEntry } from "../src/features/play/wilds-world-outbox";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state";
import { applyWildsAtlasCivicEvent, mergeWildsAtlasCivic, withoutUnqualifiedCivicWorld } from "../src/features/play/wilds-atlas-receiz-projection";

test("a second player's Atlas advances from exact admitted civic events without replacing its world cursor", () => {
  const genesis = initialWildsWorldProjection();
  const kai = createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse: 8_000_000, authority: "local" }));
  const event = prepareWildsWorldOutboxEntry(genesis, {
    schema: "receiz.wilds_world_outbox_entry.v1", actorId: "alice", guestId: "alice-device",
    command: { type: "clan.create", name: "Reedkeepers", commandId: "atlas:clan:alice", rulesDigest: WILDS_CLAN_RULES_DIGEST, kai },
    queuedAt: kaiUPulseToISOString(kai.uPulse)
  }).events[0]!;
  assert.throws(() => applyWildsAtlasCivicEvent(genesis, event, "bob.receiz.id"), /actor/);
  const shared = applyWildsAtlasCivicEvent(genesis, event, "alice.receiz.id");
  assert.equal(withoutUnqualifiedCivicWorld(shared).clans, undefined);
  assert.deepEqual(withoutUnqualifiedCivicWorld(shared).constitutionalCommandReceipts, {});
  const local = { ...genesis, revision: 20 };
  const view = mergeWildsAtlasCivic(local, shared);
  assert.equal(view.revision, 20);
  assert.equal(view.cursor, local.cursor);
  assert.equal(Object.values(view.clans ?? {})[0]?.name, "Reedkeepers");
  assert.equal(mergeWildsAtlasCivic(view, shared), view);
  assert.equal(mergeWildsAtlasCivic(view, genesis), view);
});
