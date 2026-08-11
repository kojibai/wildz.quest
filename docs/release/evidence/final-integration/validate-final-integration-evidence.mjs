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
const expected = {
  productCommit: "c26ae652894db84868c0343c108c048aa32d0fb4",
  nextBuildId: "pVMRsX8Mh21tHuB69B34C",
  startedAt: "2026-08-11T05:10:30.321Z",
  finishedAt: "2026-08-11T05:10:37.332Z",
  production: {
    url: "http://127.0.0.1:49816/",
    title: "Wildz",
    viewport: { width: 390, height: 844, dpr: 1 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36",
    canvasCount: 2,
    overflowX: 0,
    scriptChunks: [
      "http://127.0.0.1:49816/_next/static/chunks/acfafb44-f6a0b112f5720eb7.js",
      "http://127.0.0.1:49816/_next/static/chunks/8920-e8a44724f7d68c07.js",
      "http://127.0.0.1:49816/_next/static/chunks/main-app-7db33f4786c6ffdf.js",
      "http://127.0.0.1:49816/_next/static/chunks/app/layout-26d3d4a0b593426f.js",
      "http://127.0.0.1:49816/_next/static/chunks/091b534c-291448adc41f8b14.js",
      "http://127.0.0.1:49816/_next/static/chunks/3c0a7a34-30af208f1d84d817.js",
      "http://127.0.0.1:49816/_next/static/chunks/18533f58-893357b5e6300aaa.js",
      "http://127.0.0.1:49816/_next/static/chunks/3a8a8fad-b7792acd0f3ed948.js",
      "http://127.0.0.1:49816/_next/static/chunks/e9540a35-3a09ca5be6c59996.js",
      "http://127.0.0.1:49816/_next/static/chunks/1c0345e6-301608ed5eaced19.js",
      "http://127.0.0.1:49816/_next/static/chunks/f63a2255-ce9e5eb44eba4efd.js",
      "http://127.0.0.1:49816/_next/static/chunks/8898-6bd3ae2036150b59.js",
      "http://127.0.0.1:49816/_next/static/chunks/1922-52bd6e6aa489d9fe.js",
      "http://127.0.0.1:49816/_next/static/chunks/3749-9bdffe236e94ea42.js",
      "http://127.0.0.1:49816/_next/static/chunks/1072-10d7b116f96bac08.js",
      "http://127.0.0.1:49816/_next/static/chunks/polyfills-42372ed130431b0a.js",
      "http://127.0.0.1:49816/_next/static/chunks/webpack-fb8243b3d177d49b.js"
    ]
  },
  listenerEvidence: { consoleEntries: [], pageErrors: [], requestFailures: [], httpErrors: [], requestCount: 84 },
  initialWorld: {
    x: -2,
    z: -1,
    mapLabel: "Open world map. Current position X -2, Z -1",
    energy: 84,
    xp: 0,
    bond: 0,
    event: "Iruozof joined your deck. Walk near another wild companion.",
    selectedAbility: "Prism Pulse"
  },
  profileTabLabels: [
    "Edit profile", "Upload Identity Seal or Record", "Save Identity Seal", "Return to world",
    "Edit profile", "Upload Identity Seal or Record", "Save Identity Seal", "Return to world",
    "Edit profile", "Upload Identity Seal or Record", "Save Identity Seal", "Return to world"
  ],
  keyboardInitial: {
    activeElementTag: "DIV",
    role: "listbox",
    tabIndex: 0,
    activeDescendant: "wilds-companion-ability-0",
    optionRole: "option",
    optionSelected: "true",
    optionLabel: "Prism Pulse"
  },
  keyboardArrows: [
    ["ArrowLeft", "wilds-companion-ability-0", "wilds-companion-ability-1", "Emberglide Bond"],
    ["ArrowRight", "wilds-companion-ability-1", "wilds-companion-ability-0", "Prism Pulse"],
    ["ArrowUp", "wilds-companion-ability-0", "wilds-companion-ability-1", "Emberglide Bond"],
    ["ArrowDown", "wilds-companion-ability-1", "wilds-companion-ability-0", "Prism Pulse"]
  ],
  keyboardBeforeAction: {
    x: -2, z: -1, mapLabel: "Open world map. Current position X -2, Z -1",
    energy: 84, xp: 0, bond: 0,
    event: "Iruozof joined your deck. Walk near another wild companion.", selectedAbility: "Emberglide Bond"
  },
  keyboardAfterAction: {
    x: -2, z: -1, mapLabel: "Open world map. Current position X -2, Z -1",
    energy: 82, xp: 4, bond: 2, event: "Arena of Echoes entrance awakened.", selectedAbility: "Emberglide Bond"
  },
  pointerBefore: {
    x: -2, z: -1, mapLabel: "Open world map. Current position X -2, Z -1",
    energy: 82, xp: 4, bond: 2,
    event: "Iruozof used Emberglide Bond. Gain 2 bond after a successful Beryl Marsh mission.", selectedAbility: "Emberglide Bond"
  },
  pointerBeforeAction: {
    x: -2, z: -1, mapLabel: "Open world map. Current position X -2, Z -1",
    energy: 82, xp: 4, bond: 2,
    event: "Iruozof used Emberglide Bond. Gain 2 bond after a successful Beryl Marsh mission.", selectedAbility: "Prism Pulse"
  },
  pointerAfterAction: {
    x: -2, z: -1, mapLabel: "Open world map. Current position X -2, Z -1",
    energy: 81, xp: 8, bond: 3, event: "Arena of Echoes entrance awakened.", selectedAbility: "Prism Pulse"
  },
  pointerTransitions: ["pointermove", "pointerdown", "gotpointercapture", "pointermove", "pointermove", "pointermove", "pointermove", "pointerup", "lostpointercapture"],
  ownerTransitions: ["pointermove", "pointerdown", "gotpointercapture", "pointermove", "pointermove", "pointermove", "pointermove", "pointerup", "lostpointercapture", "pointermove", "pointerdown", "gotpointercapture", "pointerup", "lostpointercapture", "pointermove", "pointerdown", "gotpointercapture", "lostpointercapture"],
  profileRestoreLabel: "Open profile for Wildz Explorer, explorer level 7, 84% energy",
  toolsRestoreLabel: "Open world tools",
  keyboardCompanionLabel: "Iruozof. Tap to use Emberglide Bond. Swipe sideways to change companion, swipe up for roster, or hold for abilities.",
  pointerCompanionLabel: "Iruozof. Tap to use Prism Pulse. Swipe sideways to change companion, swipe up for roster, or hold for abilities."
};

assert(manifest.schema === "wildz.final-integration-evidence-manifest.v1", "manifest schema");
assert(result.schema === "wildz.final-integration-evidence.v1", "result schema");
assert(result.productCommit === expected.productCommit, "recorded product commit literal");
assert(result.nextBuildId === expected.nextBuildId, "recorded build ID literal");
assert(manifest.productCommit === result.productCommit, "product commit mismatch");
assert(manifest.nextBuildId === result.nextBuildId, "Next build mismatch");
assert(same(manifest.provenance, {
  productCommit: "recorded-and-validated-as-ancestor-of-release-evidence",
  nextBuildId: "recorded-capture-metadata-with-optional-local-comparison",
  browser: "observed-by-listeners-installed-before-navigation"
}), "capture provenance classification");
assert(manifest.trackedBundleRoot === bundle, "tracked bundle root");
assert(manifest.commands.validation === `node ${bundle}/validate-final-integration-evidence.mjs`, "validation command is not exact");
execFileSync("git", ["cat-file", "-e", `${manifest.productCommit}^{commit}`], { cwd: root });
execFileSync("git", ["merge-base", "--is-ancestor", manifest.productCommit, "HEAD"], { cwd: root });
const localBuildIdPath = resolve(root, ".next/BUILD_ID");
let localBuildIdCheck = "not-present-optional";
if (existsSync(localBuildIdPath)) {
  assert(readFileSync(localBuildIdPath, "utf8").trim() === manifest.nextBuildId, "local .next build differs from capture");
  localBuildIdCheck = "present-and-matched-optional";
}

assert(result.listenersInstalledBeforeNavigation === true, "listeners were not installed before navigation");
assert(result.startedAt === expected.startedAt && result.finishedAt === expected.finishedAt, "capture timestamps");
assert(same(result.production, expected.production), "exact production browser metadata");
assert(same(result.listenerEvidence, expected.listenerEvidence), "exact listener evidence");
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
assert(same(result.profile.open, { worldInert: true, worldAriaHidden: "true", utilityInert: true, dialogModal: "true" }), "exact Profile open state");
assert(same(result.profile.before, expected.initialWorld), "exact Profile before state");
assert(same(result.profile.afterRepeatedBlockedInput, expected.initialWorld), "exact Profile blocked-input state");
assert(result.profile.initialFocus.insideShell === true, "Profile initial focus");
assert(result.profile.initialFocus.ariaLabel === "Return to world" && result.profile.initialFocus.className === "wildz-overlay-dismiss", "exact Profile initial focus origin");
assert(result.profile.repeatedInputBlocked === true, "Profile repeated input predicate");
assert(same(result.profile.before, result.profile.afterRepeatedBlockedInput), "Profile world changed under repeated input");
assert(result.profile.tabSequence.length === 12, "Profile Tab sample count");
assert(result.profile.tabStayedInside === true && result.profile.tabSequence.every((entry) => entry.insideShell), "Profile focus containment");
assert(same(result.profile.tabSequence.map((entry) => entry.ariaLabel), expected.profileTabLabels), "exact Profile four-label sequence repeated three times");
assert(result.profile.restoredFocus.isProfileOrigin === true, "Profile focus restoration");
assert(result.profile.restoredFocus.ariaLabel === expected.profileRestoreLabel && result.profile.restoredFocus.className === "wildz-explorer-capsule", "exact Profile restored focus label");

assert(result.market.open.worldInert === true, "Market world inert");
assert(result.market.open.worldAriaHidden === "true", "Market world aria-hidden");
assert(result.market.open.localUnavailable === true, "Market local unavailable state");
assert(result.market.open.listingsRequestCount === 0, "Market resource listing requests");
assert(same(result.market.open, { worldInert: true, worldAriaHidden: "true", localUnavailable: true, listingsRequestCount: 0 }), "exact Market open state");
assert(result.market.listingsRequests.length === 0, "Market captured listing requests");
assert(result.market.initialFocus.insideShell === true, "Market initial focus");
assert(result.market.initialFocus.ariaLabel === "Return to world" && result.market.initialFocus.className === "wildz-overlay-dismiss", "exact Market initial focus");
assert(result.market.tabSequence.length === 12, "Market Tab sample count");
assert(result.market.tabStayedInside === true && result.market.tabSequence.every((entry) => entry.insideShell), "Market focus containment");
assert(same(result.market.tabSequence.map((entry) => entry.ariaLabel), Array(12).fill("Return to world")), "exact Market Tab sequence");
assert(result.market.restoredFocus.isToolsOrigin === true, "Market focus restoration");
assert(result.market.restoredFocus.ariaLabel === expected.toolsRestoreLabel && result.market.restoredFocus.className === "wilds-world-tools-trigger", "exact Market restored focus label");

const keyboard = result.keyboardAbility;
assert(same(keyboard.initial, expected.keyboardInitial), "exact keyboard initial composite");
assert(keyboard.initial.activeElementTag === "DIV", "keyboard listbox element");
assert(keyboard.initial.role === "listbox" && keyboard.initial.tabIndex === 0, "keyboard listbox focus semantics");
assert(Boolean(keyboard.initial.activeDescendant), "keyboard active descendant");
assert(keyboard.initial.optionRole === "option" && keyboard.initial.optionSelected === "true", "keyboard selected option semantics");
assert(same(keyboard.arrows.map((row) => row.key), ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]), "keyboard arrow coverage");
assert(same(keyboard.arrows.map((row) => [row.key, row.priorActiveDescendant, row.activeDescendant, row.selectedOptionLabel]), expected.keyboardArrows), "exact keyboard arrows, descendants, and named selections");
for (const row of keyboard.arrows) {
  assert(row.activeElementRole === "listbox", `${row.key} focus owner`);
  assert(row.priorActiveDescendant !== row.activeDescendant, `${row.key} did not change selection`);
  assert(row.selectedOptionCount === 1, `${row.key} selected option count`);
  assert(row.selectedOptionRole === "option" && row.selectedOptionAriaSelected === "true", `${row.key} option semantics`);
  assert(row.beforePosition.x === row.afterPosition.x && row.beforePosition.z === row.afterPosition.z, `${row.key} moved explorer`);
  assert(same(row.beforePosition, { x: -2, z: -1 }) && same(row.afterPosition, { x: -2, z: -1 }), `${row.key} exact explorer coordinates`);
}
assert(keyboard.arrowsChangedSelection === true && keyboard.arrowsKeptPlayerStill === true, "keyboard arrow aggregate predicates");
assert(Boolean(keyboard.committedLabel), "keyboard committed label");
assert(keyboard.committedLabel === "Emberglide Bond", "exact keyboard committed ability");
assert(same(keyboard.beforeCommit, expected.initialWorld), "exact keyboard before-commit state");
assert(same(keyboard.beforeAction, expected.keyboardBeforeAction), "exact keyboard before-action state");
assert(same(keyboard.afterAction, expected.keyboardAfterAction), "exact keyboard after-action state");
assert(same(keyboard.causalChange, { energy: -2, xp: 4, bond: 2, eventChanged: true }), "exact keyboard causal delta");
assert(keyboard.beforeAction.selectedAbility === keyboard.committedLabel, "keyboard selected ability did not commit");
assert(keyboard.committedFocus.isCompanion === true && keyboard.normalCancelFocus.isCompanion === true, "keyboard focus restoration");
assert(keyboard.committedFocus.ariaLabel === expected.keyboardCompanionLabel && keyboard.normalCancelFocus.ariaLabel === expected.keyboardCompanionLabel, "exact keyboard focus labels");
assert(keyboard.dialogOpened === true, "keyboard causal dialog");
assert(keyboard.causalChange.energy < 0 && keyboard.causalChange.xp > 0 && keyboard.causalChange.bond > 0 && keyboard.causalChange.eventChanged === true, "keyboard causal state change");

const pointer = result.pointerAbility;
assert(same(pointer.before, expected.pointerBefore), "exact pointer starting state");
assert(same(pointer.captureDuringHold, { pointerId: 1, hasCapture: true }), "exact pointer hold capture");
assert(pointer.captureDuringHold.hasCapture === true, "pointer capture during hold");
assert(pointer.captureAfterRelease.pointerId === 1, "exact pointer release ID");
assert(pointer.captureAfterRelease.hasCapture === false, "pointer capture after release");
assert(same(pointer.captureAfterRelease.events.map((event) => event.type), expected.pointerTransitions), "exact pointer capture transition sequence");
assert(pointer.captureAfterRelease.events.every((event) => event.pointerId === 1), "exact pointer transition IDs");
assert(pointer.captureAfterRelease.events.some((event) => event.type === "gotpointercapture"), "pointer gotpointercapture event");
assert(pointer.captureAfterRelease.events.some((event) => event.type === "lostpointercapture"), "pointer lostpointercapture event");
assert(Boolean(pointer.selected.activeDescendant), "pointer selected descendant");
assert(same(pointer.selected, { label: "Prism Pulse", activeDescendant: "wilds-companion-ability-0" }), "exact pointer named selection");
assert(pointer.selected.label === pointer.committedLabel, "pointer selected label did not commit");
assert(pointer.committedLabel === "Prism Pulse", "exact pointer committed label");
assert(same(pointer.beforeAction, expected.pointerBeforeAction), "exact pointer before-action state");
assert(same(pointer.afterAction, expected.pointerAfterAction), "exact pointer after-action state");
assert(same(pointer.causalChange, { energy: -1, xp: 4, bond: 1, eventChanged: true }), "exact pointer causal delta");
assert(pointer.beforeAction.selectedAbility === pointer.committedLabel, "pointer committed ability mismatch");
assert(pointer.dialogOpened === true, "pointer causal dialog");
assert(pointer.causalChange.energy < 0 && pointer.causalChange.xp > 0 && pointer.causalChange.bond > 0 && pointer.causalChange.eventChanged === true, "pointer causal state change");

const owner = result.ownerCancellation;
assert(same(owner.wheelBefore, { wheelMounted: true, active: "listbox" }), "exact owner wheel precondition");
assert(same(owner.captureBeforeClaim, { pointerId: 1, hasCapture: true }), "exact owner capture precondition");
assert(owner.wheelBefore.wheelMounted === true && owner.wheelBefore.active === "listbox", "owner cancellation precondition");
assert(owner.captureBeforeClaim.hasCapture === true, "owner cancellation pointer precondition");
assert(owner.afterClaim.wheelMounted === false, "owner cancellation wheel remains mounted");
assert(owner.afterClaim.pointerCaptureAfterClaim === false, "owner cancellation capture remains owned");
assert(owner.afterClaim.focusInsideShell === true && owner.afterClaim.companionFocused === false, "owner cancellation focus theft");
assert(owner.afterClaim.worldInert === true, "owner cancellation world gating");
assert(owner.afterClaim.pointerId === 1, "exact owner pointer ID");
assert(same(owner.afterClaim.events.map((event) => event.type), expected.ownerTransitions), "exact owner capture transition sequence");
assert(owner.afterClaim.events.every((event) => event.pointerId === 1), "exact owner transition IDs");
assert(owner.normalCommitFocus.isCompanion === true, "normal commit focus restoration");
assert(owner.normalCommitFocus.ariaLabel === expected.pointerCompanionLabel && owner.normalCommitFocus.className === "wilds-companion-command", "exact normal commit focus label");

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
  buildIdStatus: "recorded-capture-metadata",
  localBuildIdCheck,
  productCommitCheck: "recorded-and-ancestor-of-HEAD",
  artifactsVerified: manifest.artifacts.length,
  captureReferencesResolved: rawCaptureReferences.size
}, null, 2));
