import assert from "node:assert/strict";
import test from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { projectWildsCapabilityControls } from "../src/features/play/wilds-world-capability-controls";
import * as capabilityControlModule from "../src/features/play/wilds-world-capability-controls";

function card(formId: string, encounterId: string) {
  return sealCollectedCard({
    formId,
    ownerReceizId: "wilds.capability.controls",
    encounterId,
    capturedAt: "2026-08-25T12:00:00.000Z"
  });
}

test("active proof projects only its deduplicated Level-1 capability controls", () => {
  const winged = card("voltray-1", "capability-controls:winged");
  const controls = projectWildsCapabilityControls(winged, emptyAdventureCondition(winged.id));
  const families = controls.map((entry) => entry.family);

  assert.equal(new Set(families).size, families.length);
  assert.equal(controls.every((entry) => entry.unlockLevel === 1), true);
  assert.equal(families.includes("flight"), true);
  assert.equal(families.includes("glide"), true);
  assert.equal(families.includes("swim"), false);
  assert.equal(controls.every((entry) => entry.assetId === winged.id), true);
});

test("powered flight keeps the plane and removes the feather glide duplicate", () => {
  const winged = card("voltray-1", "capability-controls:single-flight-control");
  const controls = projectWildsCapabilityControls(winged, emptyAdventureCondition(winged.id));
  const projectQuick = (capabilityControlModule as unknown as {
    projectWildsQuickCapabilityControls?: (entries: typeof controls, traversal: readonly string[]) => typeof controls;
  }).projectWildsQuickCapabilityControls;

  assert.equal(typeof projectQuick, "function");
  const quick = projectQuick!(controls, ["flight", "glide"]);
  assert.equal(quick.some((entry) => entry.family === "flight"), true);
  assert.equal(quick.some((entry) => entry.family === "glide"), false);
});

test("named proof abilities label their owning family while stable family glyphs remain unchanged", () => {
  const tide = card("ledgerfox-1", "capability-controls:tide");
  const controls = projectWildsCapabilityControls(tide, emptyAdventureCondition(tide.id));
  const current = controls.find((entry) => entry.family === "current");

  assert.ok(current);
  assert.equal(current.label, tide.manifest.abilityNames[0]);
  assert.equal(current.icon, "current");
  assert.equal(current.action.length > 0, true);
});

test("condition suppresses execution capacity without erasing proof identity", () => {
  const winged = card("voltray-1", "capability-controls:injured");
  const condition = {
    ...emptyAdventureCondition(winged.id),
    injuries: [{ id: "injury:wing", kind: "wing" as const, severity: 2 as const, sourceEventId: "fall:1" }]
  };
  const controls = projectWildsCapabilityControls(winged, condition);
  const flight = controls.find((entry) => entry.family === "flight");

  assert.ok(flight);
  assert.equal(flight.capacity, 0);
  assert.equal(flight.runtimeAvailable, false);
});

test("structurally equal inputs reuse the bounded canonical projection", () => {
  const asset = card("mintcub-1", "capability-controls:cache");
  const condition = emptyAdventureCondition(asset.id);
  const first = projectWildsCapabilityControls(asset, condition);
  const second = projectWildsCapabilityControls(structuredClone(asset), structuredClone(condition));

  assert.equal(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(first.every(Object.isFrozen), true);
});


test("quick actions omit passive and presentation-only duplicates without erasing the card", () => {
  const asset = card("voltray-1", "capability-controls:unique-effects");
  const all = projectWildsCapabilityControls(asset, emptyAdventureCondition(asset.id));
  const quick = capabilityControlModule.projectWildsQuickCapabilityControls([...all, ...all], ["flight", "glide"]);
  const effects = quick.map(c => c.family === "flight" || c.family === "glide" ? "aerial-toggle" : c.family);
  assert.equal(new Set(effects).size, effects.length);
  assert.equal(quick.some(c => ["swim", "climb", "balance", "resist", "anchor", "camouflage", "break", "rescue"].includes(c.family)), false);
  assert.ok(all.length >= quick.length);
  assert.ok(quick.every(c => all.includes(c)));
});

test("a suppressed powered-flight action keeps the distinct available glide route", () => {
  const asset = card("voltray-1", "capability-controls:glide-fallback");
  const all = projectWildsCapabilityControls(asset, emptyAdventureCondition(asset.id)).map(c => c.family === "flight" ? { ...c, runtimeAvailable: false, capacity: 0 } : c);
  const quick = capabilityControlModule.projectWildsQuickCapabilityControls(all, ["glide"]);
  assert.equal(quick.some(c => c.family === "flight"), false);
  assert.equal(quick.some(c => c.family === "glide"), true);
});
