import assert from "node:assert/strict";
import test from "node:test";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import { projectWildsGroveGenesis } from "../src/features/play/wilds-grove-genesis";
import { verifyWildsRegenerativeGrove } from "../src/features/play/wilds-regenerative-grove";
import { verifyWildsWorldEmissionProof } from "../src/features/play/wilds-world-emission";

test("the bounded world deterministically begins with reachable living Groves", () => {
  const moment = deriveKaiKlokMoment({ occurredAt: "2026-07-15T00:00:00.000Z", authority: "world" });
  const left = projectWildsGroveGenesis(moment);
  const right = projectWildsGroveGenesis(moment);

  assert.deepEqual(left, right);
  assert.equal(left.groves.length, 25);
  assert.equal(left.groves.every(verifyWildsRegenerativeGrove), true);
  assert.equal(verifyWildsWorldEmissionProof(left.emission), true);
  assert.equal(left.emission.globalRemainingPhiMicro, "250000000");
  assert.equal(left.groves.some((grove) => grove.position.x === -32 && grove.position.z === -32), true);
});
