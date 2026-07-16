import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WILDS_BOSS_FAMILIES,
  WILDS_ECOLOGY_FAMILIES,
  WILDS_RAID_CARD_ROLES
} from "../src/features/play/wilds-v3-contracts.js";

test("V3 family and semantic raid contracts remain stable", () => {
  assert.deepEqual(WILDS_ECOLOGY_FAMILIES, [
    "wandering-market",
    "echo-ruin",
    "unstable-portal",
    "convergence-festival",
    "creature-migration",
    "resource-bloom",
    "stormfront",
    "settlement-distress"
  ]);
  assert.deepEqual(WILDS_BOSS_FAMILIES, [
    "crystal-burrower",
    "skycoil-tempest",
    "mirecrown-colossus",
    "embermane-siegebeast",
    "tidal-prism-leviathan",
    "echo-antler-warden",
    "lumen-moth-sovereign",
    "voidroot-devourer"
  ]);
  assert.deepEqual(WILDS_RAID_CARD_ROLES, [
    "vanguard",
    "striker",
    "warden",
    "resonator",
    "wayfinder",
    "steward"
  ]);
});
