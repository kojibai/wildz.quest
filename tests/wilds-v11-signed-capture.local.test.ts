import assert from "node:assert/strict";
import { createPrivateKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { it } from "node:test";
import { createOwnerBoundInitialPlayState, applyWildsInput, restorePlayState, selectedCard, serializePlayState,
  upgradeV10PlayStateToV11 } from "../src/features/play/game-state";
import { emptyWildsV11EncounterOutbox, enqueueWildsV11Site } from "../src/features/play/wilds-encounter-outbox-v11";
import { generateWildsRegionV11 } from "../src/features/play/wilds-region-generator-v11";
import { signWildsV11Encounter } from "../src/lib/receiz/wilds-v11-encounter-signer";
import { sealWildsV11Birth } from "../src/features/play/wilds-card-proof-v11";
import { WILDS_V11_ENCOUNTER_KEY_ID, WILDS_V11_ENCOUNTER_PUBLIC_KEYS } from "../src/features/play/wilds-v11-release-keys";
import { canonicalPortableCardJson, portableCardBaseProofAsset, sha256PortableBasis, verifyAnyWildsCard } from "../src/features/play/portable-card";
import { wildsCardArtwork } from "../src/features/play/wilds-card-artwork";
import { projectWildsHomecomingOffer } from "../src/features/play/wilds-creature-homecoming";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import { embedPortableCardInPng, renderWildsCardSvg, verifyPortableCardPng } from "../src/features/play/card-export";
import { projectLivingCardDossier } from "../src/features/play/living-card-dossier";
import { settleWildBattleCard } from "../src/features/play/wild-battle-life";
import { extractVerifiedWildzCards } from "../src/lib/receiz/wildz-cross-platform-cards";

const localKeyFile = ".env.v11-signing.local";

it("plays a signed site through the ordinary ball, card, restore, and meeting path",
  { skip: !existsSync(localKeyFile) }, async () => {
    const actorId = "player.local-release-check";
    const line = readFileSync(localKeyFile, "utf8").trim();
    const secret = Buffer.from(line.slice(line.indexOf("=") + 1), "base64");
    const privateKey = createPrivateKey({ key: secret, format: "der", type: "pkcs8" });
    assert.equal(privateKey.export({ format: "jwk" }).x, WILDS_V11_ENCOUNTER_PUBLIC_KEYS[WILDS_V11_ENCOUNTER_KEY_ID]);
    const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const slot = generateWildsRegionV11("0", "0").encounterSites[0]!;
    const site = { worldVersion: 11 as const, regionX: "0", regionZ: "0", localX: slot.localX, localZ: slot.localZ };
    const result = signWildsV11Encounter({ schema: "wildz.encounter-input.v11", keyId: WILDS_V11_ENCOUNTER_KEY_ID,
      law: "wildz.rarity.v11", actorId, site, slot: 0 }, privateKeyPem);
    const birth = await sealWildsV11Birth(result, WILDS_V11_ENCOUNTER_PUBLIC_KEYS);
    const time = Date.now();
    const at = (offset: number) => new Date(time + offset).toISOString();
    let state = upgradeV10PlayStateToV11(createOwnerBoundInitialPlayState(actorId, at(0)));
    const originalCard = state.inventory[0]!;
    state = { ...state, worldCoordinateMode: "region-local", worldAddress: site,
      player: { x: site.localX / 1_000_000, z: site.localZ / 1_000_000 },
      pendingEncounterSitesV11: enqueueWildsV11Site(emptyWildsV11EncounterOutbox(), { actorId, site, slot: 0 }) };
    state = applyWildsInput(state, { type: "admit-v11-birth", birth, ownerReceizId: actorId, admittedAt: at(1_000) });
    assert.equal(state.encounter.phase, "battle_intro");
    state = applyWildsInput(state, { type: "start-battle", at: at(2_000) });
    assert.equal(state.encounter.phase, "player_turn");
    assert.ok(state.battle);
    state = { ...state, encounter: { ...state.encounter, phase: "capture_ready" },
      battle: { ...state.battle, phase: "capture_ready",
        wild: { ...state.battle.wild, hp: 1, hpRatio: 1 / state.battle.wild.maxHp } } };
    state = applyWildsInput(state, { type: "battle-action", action: { type: "capture" }, at: at(3_000) });
    assert.equal(state.encounter.phase, "capsule");
    const originalProofBytes = canonicalPortableCardJson(state.inventory.find(asset => asset.id === originalCard.id));
    state = applyWildsInput(state, { type: "advance-encounter", at: at(4_000) });
    assert.equal(state.encounter.phase, "sealed");
    state = applyWildsInput(state, { type: "advance-encounter", at: at(5_000) });
    assert.equal(state.encounter.phase, "revealed");
    const card = state.inventory.find(asset => asset.id === (state.encounter.phase === "revealed" ? state.encounter.assetId : ""));
    assert.ok(card);
    assert.equal(isLivingCardAsset(card), false);
    assert.equal(verifyAnyWildsCard(card).ok, true);
    assert.equal(!isLivingCardAsset(card) && card.manifest.birthV11?.proofDigest, birth.proofDigest);
    assert.equal(card.manifest.rarity, birth.birth.rarity);
    assert.equal(canonicalPortableCardJson(state.inventory.find(asset => asset.id === originalCard.id)), originalProofBytes);
    const restored = restorePlayState(serializePlayState(state), actorId);
    const restoredCard = restored.inventory.find(asset => asset.id === card.id);
    assert.ok(restoredCard);
    assert.equal(isLivingCardAsset(restoredCard), true);
    assert.equal(verifyAnyWildsCard(restoredCard).ok, true);
    assert.equal(selectedCard(restored).id, restoredCard.manifest.familyId);
    assert.equal(portableCardBaseProofAsset(restoredCard).proof.digest, card.proof.digest);
    const png = embedPortableCardInPng(Uint8Array.from(Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")), restoredCard);
    assert.equal(verifyPortableCardPng(png).asset?.proof.digest, card.proof.digest);
    const extracted = extractVerifiedWildzCards({ pngBasis: png, verifiedPortableSnapshot: null, restoredVaultFiles: [] });
    assert.equal(extracted.assets[0]?.proof.digest, restoredCard.proof.digest);
    if (!isLivingCardAsset(restoredCard)) throw new Error("signed_living_card_expected");
    const { birthV11: _removedBirth, ...unsignedManifest } = restoredCard.manifest;
    assert.equal(verifyAnyWildsCard({ ...restoredCard, manifest: unsignedManifest,
      proof: { ...restoredCard.proof, digest: sha256PortableBasis(canonicalPortableCardJson(unsignedManifest)) } }).ok, false);
    assert.ok(state.battle);
    const grown = settleWildBattleCard(restoredCard, state.battle, at(6_000));
    assert.equal(verifyAnyWildsCard(grown).ok, true);
    assert.equal(grown.manifest.birthV11?.proofDigest, birth.proofDigest);
    assert.equal(canonicalPortableCardJson(restored.inventory.find(asset => asset.id === originalCard.id)), originalProofBytes);
    const importBase = upgradeV10PlayStateToV11(createOwnerBoundInitialPlayState(actorId, at(0)));
    const importBaseProofBytes = canonicalPortableCardJson(importBase.inventory.find(asset => asset.id === originalCard.id));
    const imported = applyWildsInput(importBase, { type: "import-card", asset: restoredCard });
    assert.equal(imported.inventory.some(asset => asset.id === restoredCard.id), true);
    assert.equal(canonicalPortableCardJson(imported.inventory.find(asset => asset.id === originalCard.id)), importBaseProofBytes);
    assert.match(wildsCardArtwork(restoredCard), /<svg/);
    assert.match(renderWildsCardSvg(restoredCard), /<svg/);
    assert.equal(projectLivingCardDossier(restoredCard, "https://wildz.quest").verification.ok, true);
    assert.ok(projectWildsHomecomingOffer({ card: restoredCard, continuity: undefined,
      playerAddress: site, present: true, completed: false }));
  });
