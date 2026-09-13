import assert from "node:assert/strict";
import test from "node:test";
import { isCurrentWildzGameplaySource } from "../src/features/identity/wildz-gameplay-source";
import { createWildzGameplayPublisher } from "../src/lib/performance/wildz-gameplay-publisher";

for (const sameIdentity of [false, true]) {
  test(`queued gameplay cannot overwrite an explicit ${sameIdentity ? "same-identity" : "different-identity"} seal restore`, async () => {
    const previous = { session: { keyId: "previous", actorId: "previous" }, restoreEpoch: 1 };
    let current = previous;
    let roster = ["old-one", "old-two"];
    const publisher = createWildzGameplayPublisher<string[], number>({
      setTimer: () => 1, clearTimer: () => {},
      publish(value) { if (isCurrentWildzGameplaySource(current, previous)) roster = value; }
    });
    publisher.schedule(roster, false);
    current = { session: sameIdentity ? previous.session : { keyId: "restored", actorId: "restored" }, restoreEpoch: 2 };
    const sealedRoster = Array.from({ length: 34 }, (_, index) => `sealed-${index}`);
    roster = sealedRoster;
    await publisher.flush(); // The old game flushes during unmount.
    assert.equal(roster, sealedRoster);
    assert.equal(roster.length, 34);
    assert.equal(isCurrentWildzGameplaySource(current, current), true);
    assert.equal(isCurrentWildzGameplaySource(null, current), false);
  });
}
