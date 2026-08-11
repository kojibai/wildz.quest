import assert from "node:assert/strict";
import { test } from "node:test";
import { generateIdentityBoundWildzCharacter } from "../src/features/identity/wildz-genesis";
import { projectWildsExplorerAppearance } from "../src/features/play/wilds-explorer-appearance";
import { projectWildzExplorerRender } from "../src/features/play/wildz-explorer-proof";

test("the account-creation Kai Pulse projects every sealed explorer trait into render data", () => {
  const character = generateIdentityBoundWildzCharacter({
    keyId: "receiz:proof-explorer",
    createdAt: "2026-08-10T12:34:56.000Z"
  });
  const appearance = projectWildsExplorerAppearance(character);

  assert.equal(appearance.outfitPrimary, character.traits.primaryColor);
  assert.equal(appearance.outfitSecondary, character.traits.secondaryColor);
  assert.equal(appearance.outfitProfile, character.traits.outfit);
  assert.equal(appearance.hairProfile, character.traits.hair);
  assert.equal(appearance.accessory, character.traits.accessory);
  assert.equal(appearance.trail, character.traits.trail);
  assert.equal(appearance.signatureMark, character.traits.signatureMark);
  assert.match(appearance.skin, /^#[A-Fa-f0-9]{6}$/);
  assert.match(appearance.hair, /^#[A-Fa-f0-9]{6}$/);
  assert.ok(appearance.materialRoughness >= 0.3 && appearance.materialRoughness <= 1);
  assert.ok(appearance.signatureSeed >= 0 && appearance.signatureSeed <= 1);
});

test("the local 3D explorer consumes proof-derived appearance instead of a pink-blue gender split", () => {
  const character = generateIdentityBoundWildzCharacter({
    keyId: "receiz:rendered-proof-explorer",
    createdAt: "2026-08-10T18:24:00.000Z"
  });
  const render = projectWildzExplorerRender(character);

  assert.equal(render.style, character.gender);
  assert.equal(render.character.digest, character.digest);
  assert.deepEqual(render.appearance, projectWildsExplorerAppearance(character));
  assert.equal(render.appearance.outfitPrimary, character.traits.primaryColor);
  assert.equal(render.appearance.outfitSecondary, character.traits.secondaryColor);
});
