import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sealArenaReceipt, verifyArenaReceipt } from "../src/features/play/arena/receipt";
import { arenaFixtureTerminal } from "./support/arena-fixtures";
import { createArenaTranscript } from "../src/features/play/arena/transcript";

function receiptInput() {
  const { definition, state } = arenaFixtureTerminal();
  return {
    definition,
    transcript: createArenaTranscript(definition, state),
    priorConditions: Object.fromEntries(definition.teams.flatMap((team) => team.fighters.map((fighter) => [fighter.assetId, fighter.condition]))),
    encounterId: "arena:encounter:receipt",
    checkpointId: "arena:checkpoint:receipt",
    actorId: "player:arena",
    authority: { kind: "offline-pending" as const, deviceId: "device:one" },
    publication: { state: "pending" as const, revision: 0 },
    createdAt: "2026-07-16T23:00:00.000Z",
  };
}

describe("self-verifying Arena receipt", () => {
  it("binds parents, definition, transcript, consequences, actor, authority, and publication", () => {
    const input = receiptInput();
    const receipt = sealArenaReceipt(input);
    assert.match(receipt.digest, /^sha256:[a-f0-9]{64}$/);
    assert.equal(receipt.actorId, input.actorId);
    assert.equal(receipt.definitionDigest, input.transcript.definitionDigest);
    assert.deepEqual(receipt.parentRevisionDigests, Object.fromEntries(input.definition.teams.flatMap((team) => team.fighters.map((fighter) => [fighter.assetId, fighter.revisionDigest]))));
    assert.deepEqual(verifyArenaReceipt(receipt), { ok: true, errors: [] });
    assert.equal(sealArenaReceipt(input).digest, receipt.digest);
  });

  it("rejects mutation of every authority-sensitive receipt field", () => {
    const receipt = sealArenaReceipt(receiptInput());
    const invalid = [
      { ...receipt, actorId: "player:other" },
      { ...receipt, definitionDigest: `sha256:${"0".repeat(64)}` },
      { ...receipt, parentRevisionDigests: { ...receipt.parentRevisionDigests, [Object.keys(receipt.parentRevisionDigests)[0]!]: `sha256:${"1".repeat(64)}` } },
      { ...receipt, transcript: { ...receipt.transcript, digest: `sha256:${"2".repeat(64)}` } },
      { ...receipt, consequences: { ...receipt.consequences, digest: `sha256:${"3".repeat(64)}` } },
      { ...receipt, authority: { kind: "offline-pending" as const, deviceId: "device:other" } },
      { ...receipt, publication: { state: "published" as const, revision: 0 } },
      { ...receipt, digest: `sha256:${"4".repeat(64)}` },
    ];
    for (const candidate of invalid) assert.equal(verifyArenaReceipt(candidate).ok, false);
  });

  it("requires published global authority to carry a positive revision", () => {
    const input = receiptInput();
    assert.throws(() => sealArenaReceipt({ ...input, authority: { kind: "global", deviceId: null }, publication: { state: "published", revision: 0 } }), /arena_receipt_publication_invalid/);
    const receipt = sealArenaReceipt({ ...input, authority: { kind: "global", deviceId: null }, publication: { state: "published", revision: 8 } });
    assert.equal(verifyArenaReceipt(receipt).ok, true);
  });
});
