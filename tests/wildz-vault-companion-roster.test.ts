import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import {
  applyWildsInput,
  initialPlayState,
  restorePlayState,
  selectedAsset,
  serializePlayState,
  type PlayState
} from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { projectVaultCompanionRoster } from "../src/features/play/vault-companion-roster";

const NOW = "2026-08-11T14:30:00.000Z";
const ownedAlive = sealCollectedCard({
  formId: "mintcub-1",
  ownerReceizId: "vault.roster.player",
  encounterId: "vault-roster-alive",
  capturedAt: NOW
});
const ownedRetired = sealCollectedCard({
  formId: "voltray-1",
  ownerReceizId: "vault.roster.player",
  encounterId: "vault-roster-retired",
  capturedAt: "2026-08-11T14:31:00.000Z"
});

test("projects only living cards from the admitted inventory with sealed names and stats", () => {
  const roster = projectVaultCompanionRoster({
    inventory: [ownedAlive, ownedRetired],
    companionProgress: { [ownedAlive.manifest.familyId]: { level: 4, xp: 275, bond: 31 } },
    cardConditions: {
      [ownedAlive.id]: { ...emptyAdventureCondition(ownedAlive.id), fatigue: 18 },
      [ownedRetired.id]: {
        ...emptyAdventureCondition(ownedRetired.id),
        life: "dead",
        retiredAt: NOW,
        retirementCauseEventId: "arena:1"
      }
    },
    activeAssetId: ownedAlive.id,
    newAssetId: ownedAlive.id
  });

  assert.deepEqual(roster.map((entry) => entry.asset.id), [ownedAlive.id]);
  assert.equal(roster[0]?.name, ownedAlive.manifest.name);
  assert.deepEqual(roster[0] && {
    level: roster[0].level,
    xp: roster[0].xp,
    bond: roster[0].bond,
    fatigue: roster[0].fatigue,
    active: roster[0].active,
    newlyCaptured: roster[0].newlyCaptured
  }, { level: 4, xp: 275, bond: 31, fatigue: 18, active: true, newlyCaptured: true });
});

test("never synthesizes catalogue, nearby, remote, or family fallback creatures", () => {
  const roster = projectVaultCompanionRoster({
    inventory: [ownedAlive],
    companionProgress: {},
    cardConditions: {},
    activeAssetId: null,
    newAssetId: null
  });

  assert.deepEqual(roster.map((entry) => entry.asset.id), [ownedAlive.id]);
});

test("labels fatigue, active recovery, and injuries from the persisted adventure condition", () => {
  const fatigued = projectVaultCompanionRoster({
    inventory: [ownedAlive],
    companionProgress: {},
    cardConditions: { [ownedAlive.id]: { ...emptyAdventureCondition(ownedAlive.id), fatigue: 18 } },
    activeAssetId: null,
    newAssetId: null
  });
  const recovering = projectVaultCompanionRoster({
    inventory: [ownedAlive],
    companionProgress: {},
    cardConditions: {
      [ownedAlive.id]: {
        ...emptyAdventureCondition(ownedAlive.id),
        recovery: { state: "resting", trauma: 14, lastEventId: "camp:1" }
      }
    },
    activeAssetId: null,
    newAssetId: null
  });
  const injured = projectVaultCompanionRoster({
    inventory: [ownedAlive],
    companionProgress: {},
    cardConditions: {
      [ownedAlive.id]: {
        ...emptyAdventureCondition(ownedAlive.id),
        injuries: [{ id: "injury:wing", kind: "wing", severity: 2, sourceEventId: "battle:1" }]
      }
    },
    activeAssetId: null,
    newAssetId: null
  });

  assert.equal(fatigued[0]?.conditionLabel, "Tired");
  assert.equal(recovering[0]?.conditionLabel, "Recovering");
  assert.equal(injured[0]?.conditionLabel, "Injured");
});

test("Card Vault and world roster selection converge on one persisted active asset", () => {
  const second = sealCollectedCard({
    formId: "voltray-1",
    ownerReceizId: "vault.roster.player",
    encounterId: "vault-roster-select",
    capturedAt: "2026-08-11T14:32:00.000Z"
  });
  const twoCardState: PlayState = {
    ...structuredClone(initialPlayState),
    inventory: [ownedAlive, second],
    selectedAssetId: ownedAlive.id,
    selectedCardId: ownedAlive.manifest.familyId,
    adventureConditions: {
      [ownedAlive.id]: emptyAdventureCondition(ownedAlive.id),
      [second.id]: emptyAdventureCondition(second.id)
    }
  };

  // Card Vault and the world roster both emit the same exact-asset intent.
  const fromVault = applyWildsInput(twoCardState, { type: "select-asset", assetId: second.id });
  const fromRoster = applyWildsInput(twoCardState, { type: "select-asset", assetId: second.id });

  assert.equal(fromVault.selectedAssetId, second.id);
  assert.equal(fromRoster.selectedAssetId, second.id);
  assert.equal(selectedAsset(restorePlayState(serializePlayState(fromVault)))?.id, second.id);
  assert.equal(selectedAsset(restorePlayState(serializePlayState(fromRoster)))?.id, second.id);
});
