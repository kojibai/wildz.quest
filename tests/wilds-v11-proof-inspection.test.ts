import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { inspectWildsProofFile } from "../src/features/play/wilds-proof-inspection-v11";
import { sealLocalWildsV11Card } from "../src/features/play/wilds-portable-card-v11";
import { WILDS_V11_CONFORMANCE_PUBLIC_KEYS } from "../src/features/play/wilds-v11-conformance-keys";
import type { WildsV11CreatureCard } from "../src/features/play/wilds-card-proof-v11";

describe("offline proof-file inspection", () => {
  it("distinguishes an encounter, signed birth, and local capture envelope", async () => {
    const encounter = JSON.parse(readFileSync("public/conformance/examples/eternal.json", "utf8"));
    const birth = JSON.parse(readFileSync("public/conformance/examples/creature-proof.json", "utf8")) as WildsV11CreatureCard;
    const localCard = await sealLocalWildsV11Card(birth, birth.encounter.input.actorId,
      "2026-09-27T12:00:00.000Z", WILDS_V11_CONFORMANCE_PUBLIC_KEYS);
    const publishedCard = JSON.parse(readFileSync("public/conformance/examples/local-creature-card.json", "utf8"));
    assert.deepEqual(publishedCard, localCard);
    assert.equal((await inspectWildsProofFile(encounter))?.artifact, "encounter");
    assert.equal((await inspectWildsProofFile(birth))?.artifact, "birth");
    const inspected = await inspectWildsProofFile(localCard);
    assert.equal(inspected?.artifact, "local-card");
    assert.equal(inspected?.example, true);
    assert.equal(inspected?.birth?.temperament, birth.birth.temperament);
    assert.equal((await inspectWildsProofFile(publishedCard))?.artifact, "local-card");
    assert.equal(await inspectWildsProofFile({ ...localCard, capturedAt: "2026-09-27T12:00:01.000Z" }), null);
  });
});
