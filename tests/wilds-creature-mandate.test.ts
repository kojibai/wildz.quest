import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createWildsCreatureMandate,
  evaluateWildsCreatureConsent,
  reverifyWildsCreatureMandate
} from "../src/features/play/wilds-creature-mandate";

const safePollination = () => ({
  creatureSubjectId: "creature:bee",
  creatureHead: "a".repeat(64),
  condition: { energy: 82, fatigue: 10, injury: 0, stress: 8 },
  bond: 74,
  preferences: { professions: ["pollinate"], avoidHazards: ["fire"] },
  capabilities: { professions: ["pollinate", "survey"] },
  safety: { risk: 8, hazards: [] as string[], supportAvailable: true },
  requested: { professions: ["pollinate"], maxActions: 6 },
  kaiUPulse: 1_000_000
});

describe("sovereign creature consent and work mandates", () => {
  it("accepts safe preferred work and pauses embodied exhaustion", () => {
    assert.equal(evaluateWildsCreatureConsent(safePollination()).decision, "accept");
    assert.equal(evaluateWildsCreatureConsent({
      ...safePollination(),
      condition: { ...safePollination().condition, energy: 4 }
    }).decision, "pause");
  });

  it("refuses feared unsafe work and requests help for unsupported capability", () => {
    assert.equal(evaluateWildsCreatureConsent({
      ...safePollination(),
      safety: { risk: 92, hazards: ["fire"], supportAvailable: false }
    }).decision, "refuse");
    assert.equal(evaluateWildsCreatureConsent({
      ...safePollination(),
      requested: { professions: ["pollinate", "haul"], maxActions: 6 }
    }).decision, "request-help");
  });

  it("seals accepted bounded work and rejects stale, expired, or revoked authority", () => {
    const consent = evaluateWildsCreatureConsent(safePollination());
    const mandate = createWildsCreatureMandate({
      consent,
      creatureSubjectId: "creature:bee",
      creatureHead: "a".repeat(64),
      region: { x: 0, z: 0 },
      professions: ["pollinate"],
      allowedResourceIds: ["grove:one"],
      maxActions: 6,
      issuedAtKaiUPulse: 1_000_000,
      expiresAtKaiUPulse: 2_000_000
    });

    assert.equal(reverifyWildsCreatureMandate(mandate, {
      creatureHead: "a".repeat(64), kaiUPulse: 1_500_000, revokedMandateIds: []
    }).ok, true);
    assert.equal(reverifyWildsCreatureMandate(mandate, {
      creatureHead: "b".repeat(64), kaiUPulse: 1_500_000, revokedMandateIds: []
    }).ok, false);
    assert.equal(reverifyWildsCreatureMandate(mandate, {
      creatureHead: "a".repeat(64), kaiUPulse: 2_000_001, revokedMandateIds: []
    }).ok, false);
    assert.equal(reverifyWildsCreatureMandate(mandate, {
      creatureHead: "a".repeat(64), kaiUPulse: 1_500_000, revokedMandateIds: [mandate.mandateId]
    }).ok, false);
  });

  it("cannot expand area, actions, professions, or resources after sealing", () => {
    const consent = evaluateWildsCreatureConsent(safePollination());
    const mandate = createWildsCreatureMandate({
      consent,
      creatureSubjectId: "creature:bee",
      creatureHead: "a".repeat(64),
      region: { x: 0, z: 0 },
      professions: ["pollinate"],
      allowedResourceIds: ["grove:one"],
      maxActions: 6,
      issuedAtKaiUPulse: 1_000_000,
      expiresAtKaiUPulse: 2_000_000
    });
    const expanded = structuredClone(mandate) as typeof mandate & { maxActions: number };
    expanded.maxActions = 7;
    assert.equal(reverifyWildsCreatureMandate(expanded, {
      creatureHead: "a".repeat(64), kaiUPulse: 1_500_000, revokedMandateIds: []
    }).ok, false);
  });

  it("does not accept wall-clock absence as creature condition input", () => {
    assert.equal("lastSeenAt" in safePollination().condition, false);
    assert.equal(evaluateWildsCreatureConsent(safePollination()).decision, "accept");
  });
});
