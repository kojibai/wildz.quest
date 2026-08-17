import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import { canCurrentWildzOwnerObserveCreature } from "../src/lib/receiz/wildz-creature-observer-ownership";
import type { WildzProofSession } from "../src/lib/receiz/wildz-proof-session";
import {
  createWildzVaultCardMembershipProof,
  deriveWildzVaultCardAdmission
} from "../src/lib/receiz/wildz-vault-card-admission";

test("a current Vault owner can chat with an exact claimed historical-owner card", () => {
  const card = initialPlayState.inventory[0]!;
  const profileHandle = "new_keeper.receiz.id";
  const admission = deriveWildzVaultCardAdmission({ cards: [card], playerHandle: profileHandle });
  const membership = createWildzVaultCardMembershipProof(admission, card);
  const proofSession = {
    schema: "receiz.wildz.proof_session.v1",
    keyId: "new-keeper-key",
    actorId: "new_keeper",
    profileHandle,
    displayName: "New Keeper",
    authority: "identity-key",
    subjectKey: "a".repeat(64),
    vaultCardRootSha256: admission.root,
    issuedAt: Date.now()
  } satisfies WildzProofSession;

  assert.equal(canCurrentWildzOwnerObserveCreature({
    actorId: "new_keeper",
    profileHandle,
    proofSession,
    card,
    cardAdmission: membership
  }), true);
  assert.equal(canCurrentWildzOwnerObserveCreature({
    actorId: "new_keeper",
    profileHandle,
    proofSession,
    card,
    cardAdmission: null
  }), false);
  assert.equal(canCurrentWildzOwnerObserveCreature({
    actorId: "impostor",
    profileHandle,
    proofSession,
    card,
    cardAdmission: membership
  }), false);
});

test("the Twin request carries current Vault custody without rewriting capture ownership", () => {
  const panel = readFileSync("src/features/play/CreatureConsciousnessPanel.tsx", "utf8");
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const route = readFileSync("app/api/receiz/creature-observer/route.ts", "utf8");
  assert.match(panel, /\.\.\.\(cardAdmission \? \{ cardAdmission \} : \{\}\)/);
  assert.match(inventory, /createWildzVaultCardMembershipProof\(vaultAdmission, selected\)/);
  assert.match(route, /canCurrentWildzOwnerObserveCreature/);
  assert.doesNotMatch(route, /actor\.actorId !== input\.card\.manifest\.ownerReceizId/);
});
