import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { inspectWildsProofFile } from "../src/features/play/wilds-proof-inspection-v11";
import type { WildsV11CreatureCard } from "../src/features/play/wilds-card-proof-v11";

describe("offline proof-file inspection", () => {
  it("distinguishes a signed encounter from a complete birth", async () => {
    const encounter = JSON.parse(readFileSync("public/conformance/examples/eternal.json", "utf8"));
    const birth = JSON.parse(readFileSync("public/conformance/examples/creature-proof.json", "utf8")) as WildsV11CreatureCard;
    assert.equal((await inspectWildsProofFile(encounter))?.artifact, "encounter");
    assert.equal((await inspectWildsProofFile(birth))?.artifact, "birth");
    const inspected = await inspectWildsProofFile(birth);
    assert.equal(inspected?.artifact, "birth");
    assert.equal(inspected?.example, true);
    assert.equal(inspected?.birth?.temperament, birth.birth.temperament);
    assert.equal(await inspectWildsProofFile({ ...birth, proofDigest: "sha256:changed" }), null);
  });
});
