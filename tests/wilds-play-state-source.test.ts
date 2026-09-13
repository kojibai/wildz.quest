import assert from "node:assert/strict";
import { test } from "node:test";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import { createWildsPlayStateSourceAdmission } from "../src/features/play/wilds-play-state-source";
import { createWildzGameplayPublisher } from "../src/lib/performance/wildz-gameplay-publisher";
import { sealCollectedCard } from "../src/features/play/portable-card";

function flightState() {
  const card = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "pilot", encounterId: "flight-source-echo", capturedAt: "2026-08-21T12:05:00.000Z" });
  const imported = applyWildsInput(initialPlayState, { type: "import-card", asset: card });
  return { ...applyWildsInput(imported, { type: "select-asset", assetId: card.id }), player: { x: 0, z: 0 } };
}

test("delayed shell acknowledgment never rewinds flight that advanced after a card-state publication", async () => {
  const admission = createWildsPlayStateSourceAdmission();
  const published = flightState();
  let current = published;
  let shellEcho: typeof current | undefined;
  const publisher = createWildzGameplayPublisher({
    publish(state: typeof current) { admission.published(state); shellEcho = state; },
    setTimer: () => 1, clearTimer: () => {}
  });
  // The shell rerenders for card truth changes; its source prop can arrive after
  // another local input even though both snapshots came from this same campaign.
  publisher.schedule(published, true);
  for (let index = 0; index < 8; index++) current = applyWildsInput(current, { type: "move-vector", x: 1, z: 0, aerialMode: "flight", verticalWorldY: 30 });
  const arrived = { ...current.player };
  assert.ok(arrived.x > 3);
  await publisher.flush();
  assert.equal(shellEcho, published);
  if (admission.shouldAdopt(shellEcho!)) current = shellEcho!;
  assert.deepEqual(current.player, arrived);
  publisher.cancel();
});

test("distinct remote restores and claimed inventory remain authoritative after local publication", () => {
  const admission = createWildsPlayStateSourceAdmission();
  const local = flightState();
  admission.published(local);
  assert.equal(admission.shouldAdopt(local), false);
  const remote = { ...local, player: { x: 40, z: -10 } };
  assert.equal(admission.shouldAdopt(remote), true);
  const claimed = applyWildsInput(remote, { type: "import-card", asset: sealCollectedCard({ formId: "ledgerfox-1", ownerReceizId: "pilot", encounterId: "claimed-inventory", capturedAt: "2026-08-21T12:10:00.000Z" }) });
  assert.notEqual(claimed.inventory, local.inventory);
  assert.equal(admission.shouldAdopt(claimed), true);
  assert.equal(createWildsPlayStateSourceAdmission().shouldAdopt(local), true, "another campaign/account has its own source scope");
});
