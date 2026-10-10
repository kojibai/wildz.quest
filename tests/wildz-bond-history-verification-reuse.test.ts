import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { test, type TestContext } from "node:test";
import { isAdmittedWildsCard, retainAdmittedWildsInventory, verifyAndAdmitWildsCard } from "../src/features/play/admitted-inventory";
import { appendCreatureHistoryEvent, verifyCreatureHistory, verifyCreatureHistoryCooperatively } from "../src/features/play/creature-history";
import type { CreatureHistoryChain, CreatureHistoryEventDraft } from "../src/features/play/creature-history-types";
import { applyWildsInput, createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { admitLegacyCard, appendLivingCardHistory, currentCreatureHistoryProjection, verifyLivingCard } from "../src/features/play/living-card-proof";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import { canonicalPortableCardJson, sealCollectedCard, sha256PortableBasis } from "../src/features/play/portable-card";

const OWNER = "bond_history_reuse_keeper";
const BORN_AT = "2026-08-11T12:00:00.000Z";

function card(index = 0) {
  return admitLegacyCard(sealCollectedCard({
    formId: "mintcub-1", ownerReceizId: OWNER, encounterId: `bond-history-reuse:${index}`, capturedAt: BORN_AT
  }), BORN_AT);
}

function event(index: number): CreatureHistoryEventDraft {
  return {
    eventId: `bond-history:fixture:${index}`, rulesetVersion: "wildz.progression.v1",
    occurredAt: new Date(Date.parse(BORN_AT) + index * 60_000).toISOString(),
    source: { mode: "training", activityId: `training:fixture:${index}`, actorId: OWNER, authority: "local" },
    evidence: { sourceEventIds: [`fixture:${index}`] }, effects: [{ kind: "progress", xpDelta: 0, growthEvents: [] }]
  };
}

function freezeFixture<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeFixture(child);
    Object.freeze(value);
  }
  return value;
}

// Observe real event digest encoding, without substituting any verifier or hash.
// Reintroducing repeated predecessor replay must fail the operation-work budget.
function countEventDigests(t: TestContext) {
  let encodings = 0;
  const stringify = JSON.stringify;
  t.mock.method(JSON, "stringify", (value: unknown, ...args: unknown[]) => {
    if (value && typeof value === "object" && "schema" in value
      && value.schema === "receiz.wildz.creature_history_event.v1") encodings++;
    return Reflect.apply(stringify, JSON, [value, ...args]);
  });
  return () => encodings;
}

test("bonding with 68 admitted cards validates only the new event after a 301-event predecessor", (t) => {
  const initial = createOwnerBoundInitialPlayState(OWNER, BORN_AT);
  const source = card();
  let history = source.manifest.history!;
  for (let index = 1; index <= 300; index++) history = appendCreatureHistoryEvent(history, event(index));
  const manifest = { ...source.manifest, history };
  const selected = { ...source, manifest, proof: { ...source.proof, digest: sha256PortableBasis(canonicalPortableCardJson(manifest)) } };
  const inventory = [selected, ...Array.from({ length: 67 }, (_, index) => card(index + 1))];
  const digests = countEventDigests(t);
  for (const asset of inventory) assert.equal(verifyAndAdmitWildsCard(asset), true);
  retainAdmittedWildsInventory(inventory);
  assert.equal(digests(), 368, "admission independently replays all 301 selected events and 67 other birth events");
  const admissionDigests = digests();
  const beforeProjection = currentCreatureHistoryProjection(selected);
  const state = {
    ...initial, inventory, selectedAssetId: selected.id, selectedCardId: selected.manifest.familyId,
    discoveredCardIds: [...new Set([...initial.discoveredCardIds, selected.manifest.familyId])],
    livingProgress: { [selected.id]: beforeProjection.growth },
    adventureConditions: { [selected.id]: beforeProjection.condition },
    companionProgress: { [selected.manifest.familyId]: { level: 1, xp: 0, bond: beforeProjection.bond } }
  };
  const started = performance.now();
  const bonded = applyWildsInput(state, { type: "train", cardId: selected.manifest.familyId, at: "2026-08-11T18:00:00.000Z" });
  const elapsedMs = performance.now() - started;
  const operationDigests = digests() - admissionDigests;
  const updated = bonded.inventory[0]!;
  assert.ok(isLivingCardAsset(updated));
  assert.equal(updated.manifest.history!.events.length, 302);
  assert.equal(currentCreatureHistoryProjection(updated).bond, beforeProjection.bond + 1);
  assert.equal(currentCreatureHistoryProjection(updated).xp, 40);
  assert.deepEqual(updated.manifest.history!.events.slice(0, 301), history.events);
  assert.ok(bonded.pendingSyncAssetIds.includes(selected.id));
  for (let index = 1; index < 68; index++) assert.equal(bonded.inventory[index], inventory[index]);
  t.diagnostic(JSON.stringify({ fixture: "synthetic 68-card bond; workstation CPU, not iPhone timing", historyEvents: 301,
    eventDigestEncodings: operationDigests, elapsedMs }));
  // Encode the constructed new event, then independently validate that suffix.
  assert.equal(operationDigests, 2, "an admitted immutable predecessor must not replay during bond append");
  const beforeSecond = digests();
  const again = applyWildsInput(bonded, { type: "train", cardId: selected.manifest.familyId, at: "2026-08-11T18:15:00.000Z" });
  const twice = again.inventory[0]!;
  assert.ok(isLivingCardAsset(twice));
  assert.equal(twice.manifest.history!.events.length, 303);
  assert.equal(currentCreatureHistoryProjection(twice).bond, beforeProjection.bond + 2);
  assert.equal(digests() - beforeSecond, 2, "a privately validated successor retains its immutable verified prefix");
  const beforeIndependent = digests();
  assert.equal(verifyLivingCard(structuredClone(twice)).ok, true);
  assert.equal(digests() - beforeIndependent, 303, "an imported successor independently replays its complete history");
  assert.equal(verifyLivingCard(structuredClone(updated)).ok, true, "the new successor still supports independent complete verification");
});

test("an exact fully frozen history reuses only its own complete successful verification", (t) => {
  const history = freezeFixture(appendLivingCardHistory({ asset: card(), event: event(1) }).manifest.history!);
  const digests = countEventDigests(t);
  assert.equal(verifyCreatureHistory(history).ok, true);
  assert.equal(digests(), 2, "first verification must replay every event");
  assert.equal(verifyCreatureHistory(history).ok, true);
  assert.equal(digests(), 2, "the exact immutable object may reuse complete verification");
  const copied = freezeFixture(structuredClone(history));
  assert.equal(verifyCreatureHistory(copied).ok, true);
  assert.equal(digests(), 4, "a copied object must independently replay every event");
});

test("mutable and root-only frozen histories reject nested tampering after successful verification", () => {
  for (const shallowFreeze of [false, true]) {
    const history = structuredClone(card().manifest.history!);
    if (shallowFreeze) Object.freeze(history);
    assert.equal(verifyCreatureHistory(history).ok, true);
    Object.assign(history.events[0]!.evidence, { sourceEventIds: ["changed with the same claimed digest"] });
    assert.equal(verifyCreatureHistory(history).ok, false);
    assert.throws(() => appendCreatureHistoryEvent(history, event(1)), /creature_history_previous_invalid/);
  }
});

test("a copied deeply frozen tampered history cannot borrow verification from the original", () => {
  const original = freezeFixture(card().manifest.history!);
  assert.equal(verifyCreatureHistory(original).ok, true);
  const changed = structuredClone(original);
  Object.assign(changed.events[0]!.evidence, { sourceEventIds: ["changed with the same claimed digest"] });
  freezeFixture(changed);
  assert.equal(verifyCreatureHistory(changed).ok, false);
  assert.throws(() => appendCreatureHistoryEvent(changed, event(1)), /creature_history_previous_invalid/);
});

test("frozen accessor and non-plain histories do not retain a verification result", async (t) => {
  for (const cooperative of [false, true]) {
    const source = card().manifest.history!;
    let projection = freezeFixture(structuredClone(source.projection));
    const accessor = { ...source };
    Object.defineProperty(accessor, "projection", { enumerable: true, get: () => projection });
    freezeFixture(accessor);
    const verify = (chain: CreatureHistoryChain) => cooperative
      ? verifyCreatureHistoryCooperatively(chain, { now: () => 0, yield: async () => {} })
      : verifyCreatureHistory(chain);
    assert.equal((await verify(accessor)).ok, true);
    projection = freezeFixture({ ...projection, bond: projection.bond + 1 });
    assert.equal((await verify(accessor)).ok, false, "an accessor can change returned data despite Object.freeze");
  }
  const nonPlain = Object.assign(Object.create({ fixtureClass: true }) as CreatureHistoryChain, card().manifest.history!);
  freezeFixture(nonPlain);
  const digests = countEventDigests(t);
  assert.equal(verifyCreatureHistory(nonPlain).ok, true);
  assert.equal(verifyCreatureHistory(nonPlain).ok, true);
  assert.equal(digests(), 2, "non-plain prototypes must take complete verification on every call");
});

test("a valid new history event cannot cache a living card whose revision projection is invalid", () => {
  const source = freezeFixture(card());
  assert.equal(verifyLivingCard(source).ok, true);
  const revision = source.manifest.revisions.at(-1)!;
  const successor = appendLivingCardHistory({ asset: source, event: {
    ...event(1), effects: [{ kind: "transformation", fromRevisionDigest: revision.digest,
      toRevisionDigest: `sha256:${"d".repeat(64)}`, formId: revision.formId, stage: revision.stage,
      ascensionRank: revision.ascensionRank }]
  } });
  assert.equal(verifyCreatureHistory(successor.manifest.history!).ok, true);
  assert.equal(verifyLivingCard(successor).ok, false, "history validity alone cannot replace enclosing card invariants");
  assert.throws(() => appendLivingCardHistory({ asset: successor, event: event(2) }), /wilds_living_previous_invalid/);
});

test("immutable admitted-prefix appends still reject event conflicts, Kai regression, and forged admission", () => {
  const source = freezeFixture(card());
  assert.equal(verifyLivingCard(source).ok, true);
  const successor = appendLivingCardHistory({ asset: source, event: event(1) });
  assert.equal(appendLivingCardHistory({ asset: successor, event: event(1) }), successor);
  assert.throws(() => appendLivingCardHistory({ asset: successor, event: {
    ...event(1), effects: [{ kind: "progress", xpDelta: 1, growthEvents: [] }]
  } }), /creature_history_event_conflict/);
  assert.throws(() => appendLivingCardHistory({ asset: successor, event: {
    ...event(2), kai: source.manifest.history!.events[0]!.kai
  } }), /creature_history_kai_regression/);
  assert.throws(() => appendLivingCardHistory({ asset: successor, event: {
    ...event(2), source: { ...event(2).source, authority: "verified-receipt" },
    evidence: { receiptDigest: `sha256:${"a".repeat(64)}`, replayDigest: `sha256:${"b".repeat(64)}` }
  } }), /creature_history_authority_(admission_invalid|evidence_required)/);
});

test("an accessor-backed candidate cannot acquire immutable card admission", () => {
  const source = card();
  const candidate = { ...source };
  Object.defineProperty(candidate, "manifest", { enumerable: true, get: () => source.manifest });
  assert.equal(verifyAndAdmitWildsCard(candidate), false);
  assert.equal(isAdmittedWildsCard(candidate), false);
  assert.equal(Object.isFrozen(source.manifest), false, "freezing must not invoke an accessor or mistake it for immutable bytes");
});

test("mutable living-card verification cannot retain a later modified manifest", () => {
  for (const shallowFreeze of [false, true]) {
    const source = card();
    if (shallowFreeze) Object.freeze(source);
    assert.equal(verifyLivingCard(source).ok, true);
    source.manifest.name = "Modified after successful verification";
    assert.equal(verifyLivingCard(source).ok, false);
    assert.throws(() => appendLivingCardHistory({ asset: source, event: event(1) }), /wilds_living_previous_invalid/);
  }
});

test("a substituted copy of a private verified prefix still needs complete verification", () => {
  const source = freezeFixture(card());
  assert.equal(verifyLivingCard(source).ok, true);
  const first = appendLivingCardHistory({ asset: source, event: event(1) });
  const substituted = structuredClone(first);
  Object.assign(substituted.manifest.history!.events[0]!.evidence, { sourceEventIds: ["substituted-prefix"] });
  freezeFixture(substituted);
  assert.equal(substituted.proof.digest, first.proof.digest);
  assert.equal(verifyLivingCard(substituted).ok, false);
  assert.throws(() => appendLivingCardHistory({ asset: substituted, event: event(2) }), /wilds_living_previous_invalid/);
});

test("a no-history legacy checkpoint is fully established before retaining later appends", (t) => {
  const source = card();
  const { history: _history, ...manifest } = source.manifest;
  const legacy = freezeFixture({ ...source, manifest, proof: {
    ...source.proof, digest: sha256PortableBasis(canonicalPortableCardJson(manifest))
  } });
  assert.equal(verifyLivingCard(legacy).ok, true);
  const first = appendLivingCardHistory({ asset: legacy, event: event(1) });
  assert.equal(first.manifest.history!.completeness, "legacy-checkpoint");
  assert.equal(first.manifest.history!.events.length, 2);
  assert.equal(verifyLivingCard(structuredClone(first)).ok, true);
  const digests = countEventDigests(t);
  const second = appendLivingCardHistory({ asset: first, event: event(2) });
  assert.equal(digests(), 2, "the established migration prefix does not replay on a later append");
  assert.equal(verifyLivingCard(structuredClone(second)).ok, true);
});
