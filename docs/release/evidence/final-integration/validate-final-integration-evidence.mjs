#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const bundle = "docs/release/evidence/final-integration";
const manifestPath = `${bundle}/final-integration-evidence-manifest.json`;
const resultPath = `${bundle}/final-integration-evidence-result.json`;

const fail = (message) => { throw new Error(`final_integration_evidence_invalid: ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const trackedMode = (path) => {
  const line = execFileSync("git", ["ls-files", "-s", "--", path], { cwd: root, encoding: "utf8" }).trim();
  assert(line.length > 0, `${path} is not tracked`);
  return line.split(/\s+/)[0];
};

const manifest = readJson(manifestPath);
const result = readJson(resultPath);

assert(manifest.schema === "wildz.final-integration-evidence-manifest.v1", "manifest schema");
assert(result.schema === "wildz.final-integration-evidence.v1", "result schema");
assert(manifest.productCommit === result.productCommit, "product commit mismatch");
assert(manifest.nextBuildId === result.nextBuildId, "Next build mismatch");
assert(manifest.trackedBundleRoot === bundle, "tracked bundle root");
assert(manifest.commands.validation === `node ${bundle}/validate-final-integration-evidence.mjs`, "validation command is not exact");
execFileSync("git", ["cat-file", "-e", `${manifest.productCommit}^{commit}`], { cwd: root });
const localBuildIdPath = resolve(root, ".next/BUILD_ID");
if (existsSync(localBuildIdPath)) {
  assert(readFileSync(localBuildIdPath, "utf8").trim() === manifest.nextBuildId, "local .next build differs from capture");
}

assert(result.listenersInstalledBeforeNavigation === true, "listeners were not installed before navigation");
assert(result.production.url === manifest.productionUrl, "production URL");
assert(result.production.viewport.width === manifest.viewport.width, "viewport width");
assert(result.production.viewport.height === manifest.viewport.height, "viewport height");
assert(result.production.viewport.dpr === manifest.viewport.deviceScaleFactor, "viewport DPR");
assert(result.production.canvasCount > 0, "canvas count");
assert(result.production.overflowX === 0, "horizontal overflow");
assert(result.production.scriptChunks.length > 0, "production chunks missing");
assert(result.listenerEvidence.requestCount > 0, "request capture empty");
for (const key of ["consoleEntries", "pageErrors", "requestFailures", "httpErrors"]) {
  assert(result.listenerEvidence[key].length === 0, `listenerEvidence.${key} is not empty`);
}

assert(result.profile.open.worldInert === true, "Profile world inert");
assert(result.profile.open.worldAriaHidden === "true", "Profile world aria-hidden");
assert(result.profile.open.utilityInert === true, "Profile utility inert");
assert(result.profile.open.dialogModal === "true", "Profile modal semantics");
assert(result.profile.initialFocus.insideShell === true, "Profile initial focus");
assert(result.profile.repeatedInputBlocked === true, "Profile repeated input predicate");
assert(same(result.profile.before, result.profile.afterRepeatedBlockedInput), "Profile world changed under repeated input");
assert(result.profile.tabSequence.length === 12, "Profile Tab sample count");
assert(result.profile.tabStayedInside === true && result.profile.tabSequence.every((entry) => entry.insideShell), "Profile focus containment");
assert(result.profile.restoredFocus.isProfileOrigin === true, "Profile focus restoration");

assert(result.market.open.worldInert === true, "Market world inert");
assert(result.market.open.worldAriaHidden === "true", "Market world aria-hidden");
assert(result.market.open.localUnavailable === true, "Market local unavailable state");
assert(result.market.open.listingsRequestCount === 0, "Market resource listing requests");
assert(result.market.listingsRequests.length === 0, "Market captured listing requests");
assert(result.market.initialFocus.insideShell === true, "Market initial focus");
assert(result.market.tabSequence.length === 12, "Market Tab sample count");
assert(result.market.tabStayedInside === true && result.market.tabSequence.every((entry) => entry.insideShell), "Market focus containment");
assert(result.market.restoredFocus.isToolsOrigin === true, "Market focus restoration");

const keyboard = result.keyboardAbility;
assert(keyboard.initial.activeElementTag === "DIV", "keyboard listbox element");
assert(keyboard.initial.role === "listbox" && keyboard.initial.tabIndex === 0, "keyboard listbox focus semantics");
assert(Boolean(keyboard.initial.activeDescendant), "keyboard active descendant");
assert(keyboard.initial.optionRole === "option" && keyboard.initial.optionSelected === "true", "keyboard selected option semantics");
assert(same(keyboard.arrows.map((row) => row.key), ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]), "keyboard arrow coverage");
for (const row of keyboard.arrows) {
  assert(row.activeElementRole === "listbox", `${row.key} focus owner`);
  assert(row.priorActiveDescendant !== row.activeDescendant, `${row.key} did not change selection`);
  assert(row.selectedOptionCount === 1, `${row.key} selected option count`);
  assert(row.selectedOptionRole === "option" && row.selectedOptionAriaSelected === "true", `${row.key} option semantics`);
  assert(row.beforePosition.x === row.afterPosition.x && row.beforePosition.z === row.afterPosition.z, `${row.key} moved explorer`);
}
assert(keyboard.arrowsChangedSelection === true && keyboard.arrowsKeptPlayerStill === true, "keyboard arrow aggregate predicates");
assert(Boolean(keyboard.committedLabel), "keyboard committed label");
assert(keyboard.beforeAction.selectedAbility === keyboard.committedLabel, "keyboard selected ability did not commit");
assert(keyboard.committedFocus.isCompanion === true && keyboard.normalCancelFocus.isCompanion === true, "keyboard focus restoration");
assert(keyboard.dialogOpened === true, "keyboard causal dialog");
assert(keyboard.causalChange.energy < 0 && keyboard.causalChange.xp > 0 && keyboard.causalChange.bond > 0 && keyboard.causalChange.eventChanged === true, "keyboard causal state change");

const pointer = result.pointerAbility;
assert(pointer.captureDuringHold.hasCapture === true, "pointer capture during hold");
assert(pointer.captureAfterRelease.hasCapture === false, "pointer capture after release");
assert(pointer.captureAfterRelease.events.some((event) => event.type === "gotpointercapture"), "pointer gotpointercapture event");
assert(pointer.captureAfterRelease.events.some((event) => event.type === "lostpointercapture"), "pointer lostpointercapture event");
assert(Boolean(pointer.selected.activeDescendant), "pointer selected descendant");
assert(pointer.selected.label === pointer.committedLabel, "pointer selected label did not commit");
assert(pointer.beforeAction.selectedAbility === pointer.committedLabel, "pointer committed ability mismatch");
assert(pointer.dialogOpened === true, "pointer causal dialog");
assert(pointer.causalChange.energy < 0 && pointer.causalChange.xp > 0 && pointer.causalChange.bond > 0 && pointer.causalChange.eventChanged === true, "pointer causal state change");

const owner = result.ownerCancellation;
assert(owner.wheelBefore.wheelMounted === true && owner.wheelBefore.active === "listbox", "owner cancellation precondition");
assert(owner.captureBeforeClaim.hasCapture === true, "owner cancellation pointer precondition");
assert(owner.afterClaim.wheelMounted === false, "owner cancellation wheel remains mounted");
assert(owner.afterClaim.pointerCaptureAfterClaim === false, "owner cancellation capture remains owned");
assert(owner.afterClaim.focusInsideShell === true && owner.afterClaim.companionFocused === false, "owner cancellation focus theft");
assert(owner.afterClaim.worldInert === true, "owner cancellation world gating");
assert(owner.normalCommitFocus.isCompanion === true, "normal commit focus restoration");

const rawCaptureReferences = new Set();
const collectRawCaptureReferences = (value) => {
  if (typeof value === "string") {
    if (value.startsWith("output/playwright/")) rawCaptureReferences.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectRawCaptureReferences(item);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectRawCaptureReferences(item);
  }
};
collectRawCaptureReferences(result);
const mappedRawReferences = new Set(Object.keys(manifest.capturePathMap));
assert(same([...mappedRawReferences].sort(), [...rawCaptureReferences].sort()), "capturePathMap is incomplete or contains stale raw paths");

const artifacts = new Map(manifest.artifacts.map((artifact) => [artifact.path, artifact]));
assert(artifacts.size === manifest.artifacts.length, "duplicate manifest artifact paths");
for (const artifact of manifest.artifacts) {
  assert(artifact.path.startsWith(`${bundle}/`), `${artifact.path} is outside tracked bundle`);
  const absolute = resolve(root, artifact.path);
  assert(existsSync(absolute), `${artifact.path} is missing`);
  const bytes = readFileSync(absolute);
  assert(bytes.length === artifact.bytes, `${artifact.path} byte size`);
  assert(sha256(bytes) === artifact.sha256, `${artifact.path} SHA-256`);
  assert(trackedMode(artifact.path) === artifact.mode, `${artifact.path} tracked mode`);
  assert(statSync(absolute).isFile(), `${artifact.path} is not a file`);
}
for (const [rawPath, trackedPath] of Object.entries(manifest.capturePathMap)) {
  const artifact = artifacts.get(trackedPath);
  assert(Boolean(artifact), `${rawPath} maps to an unmanifested target`);
  assert(trackedMode(trackedPath) === artifact.mode, `${rawPath} target is not tracked with recorded mode`);
}

console.log(JSON.stringify({
  ok: true,
  schema: "wildz.final-integration-evidence-validation.v1",
  productCommit: manifest.productCommit,
  nextBuildId: manifest.nextBuildId,
  artifactsVerified: manifest.artifacts.length,
  captureReferencesResolved: rawCaptureReferences.size
}, null, 2));
