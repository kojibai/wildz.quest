import assert from "node:assert/strict";
import { test } from "node:test";
import { generateWildzCharacter } from "../src/features/identity/wildz-genesis";

test("character genesis is deterministic for one identity and Kai Pulse", () => {
  const input = {
    identityRef: "receiz:test-key",
    kaiPulse: "1721066400000",
    gender: "female" as const,
    version: 1 as const
  };

  assert.deepEqual(generateWildzCharacter(input), generateWildzCharacter(input));
  assert.notDeepEqual(generateWildzCharacter(input), generateWildzCharacter({ ...input, kaiPulse: "1721066400001" }));
});

test("character genesis seals a bounded authored trait set", () => {
  const character = generateWildzCharacter({
    identityRef: "receiz:another-key",
    kaiPulse: "1721066400010",
    gender: "male",
    version: 1
  });

  assert.equal(character.schema, "wildz.character_genesis.v1");
  assert.equal(character.digest.length, 64);
  assert.match(character.traits.primaryColor, /^#[A-F0-9]{6}$/);
  assert.match(character.traits.secondaryColor, /^#[A-F0-9]{6}$/);
  assert.ok(character.traits.outfit.length > 0);
});
