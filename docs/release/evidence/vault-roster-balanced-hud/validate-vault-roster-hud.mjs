#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const fail = (message) => { throw new Error(`vault-roster-balanced-hud evidence invalid: ${message}`); };
const check = (condition, message) => { if (!condition) fail(message); };
const canonical = (value) => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value;
const exact = (actual, expected, label) => check(JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected)), `${label} mismatch`);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = async (filename) => JSON.parse(await readFile(filename, "utf8"));

const bundleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(bundleDir, "../../../..");
const prefix = "docs/release/evidence/vault-roster-balanced-hud/";
const selfPath = `${prefix}validate-vault-roster-hud.mjs`;
const selfBytes = await readFile(fileURLToPath(import.meta.url));
const selfInfo = await stat(fileURLToPath(import.meta.url));
const expectedSelfByteLength = Number("21806");

let manifestPath = resolve(bundleDir, "manifest.json");
let resultPath = resolve(bundleDir, "browser-result.json");
for (let index = 2; index < process.argv.length; index += 1) {
  const option = process.argv[index];
  const value = process.argv[index + 1];
  check((option === "--manifest" || option === "--result") && value, `unknown or incomplete option ${option}`);
  if (option === "--manifest") manifestPath = resolve(process.cwd(), value);
  if (option === "--result") resultPath = resolve(process.cwd(), value);
  index += 1;
}

const buildId = "9sYHunZv9Fb2Jn8qLGnlF";
const productCommit = "cea7b57";
const productCommitFull = "cea7b57bc6f8e2e9e5d425d0007ed48dd8cb2ec1";
const baseCommit = "07a8e93";
const baseCommitFull = "07a8e93910aec06f5f04c035d9879a41fbdc969f";
const userAgent = "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.8 Mobile Safari/537.36";
const replayCommand = `/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh -s=modal-reward-clean run-code "$(cat docs/release/evidence/vault-roster-balanced-hud/browser-replay.js)"`;
const artifactIdentityBoundary = "Build id and product commit are declared capture coordinates. This bundle proves the recorded behavior on the served optimized artifact but does not cryptographically attest source-to-build provenance.";
const viewports = ["320x568", "360x800", "390x844", "430x932", "844x390", "768x1024", "1440x900"];
const fixtureBoundary = "Selection-only replay begins with an existing legitimate two-card production IndexedDB profile containing Toiusap and Neiatid. This replay does not qualify either card's acquisition provenance. No storage injection or test-fixture route was used.";
const qualificationBoundary = {
  selectionProfileInventoryCount: 2,
  acquisitionReplayed: false,
  newMarker: { browserQualified: false, evidence: "Automated implementation tests only; not asserted by this browser replay." }
};
const releaseGates = {
  test: "1086/1086 tests, 109 suites",
  typecheck: "pass",
  lint: "pass",
  build: "pass",
  releaseCheck: "pass; conformance 15/15; secret scan 770 files",
  doctor: "SDK/MCP/AI skills 118.0.0 compatible; live API, checkout, and webhooks require deployment environment",
  directorAudit: "pass",
  diffCheck: "pass"
};
const kaiHomesInert = [
  { selector: ".wildz-reference-hud", inert: true, ariaHidden: "true" },
  { selector: ".wilds-map-status-home", inert: true, ariaHidden: "true" },
  { selector: ".wilds-left-instrument-home", inert: true, ariaHidden: "true" },
  { selector: ".wildz-world-controls", inert: false, ariaHidden: null }
];
const targetLabels = (beatStepPulse) => [
  "Open profile for Wildz Explorer, explorer level 7, 38% energy",
  "Open mission details · 50% progress",
  "World reconnecting",
  "Open global live explorers · connected worldwide",
  "Share Wildz invite",
  `Open living Command Center. Beat step pulse ${beatStepPulse}`,
  "Wilds audio settings",
  "Make camp and recover",
  "Switch to walking",
  "Movement trackpad. Running. Hold and drag in any direction to travel.",
  "Open world tools",
  "Toiusap, level 1, 0 XP, bond 0, Ready",
  "Neiatid, level 1, 48 XP, bond 12, Ready, active",
  "Neiatid. Tap to use Tide Pulse. Swipe sideways to change companion, swipe up for roster, or hold for abilities."
];
const expectedTargetLabelsByViewport = {
  "320x568": targetLabels("21:19:07"),
  "360x800": targetLabels("21:19:07"),
  "390x844": targetLabels("21:19:07"),
  "430x932": targetLabels("21:19:08"),
  "844x390": targetLabels("21:19:08"),
  "768x1024": targetLabels("21:19:08"),
  "1440x900": targetLabels("21:19:08")
};
const expectedTargetCount = 14;
const cards = {
  Toiusap: {
    id: "wilds:123e00f59899025a366d578f",
    name: "Toiusap",
    ability: "Stone Pulse",
    position: "1/2",
    stats: { health: 63, power: 79, guard: 76, speed: 77, bond: 53 },
    href: "/cards/wilds%3A123e00f59899025a366d578f",
    portraitTitle: "Toiusap deck portrait full-body companion",
    portraitDigest: '<svg xmlns="http://www.w3.org/2000/svg" data-heartbound="heroic-companion" data-identity-signature="sha256:a96922d34a0f9df62ba97e59181c3608a8030fa5961fc0eeafaa5705afd98428" data-bo'
  },
  Neiatid: {
    id: "wilds:223616f27f33bc5b5fa273d9",
    name: "Neiatid",
    ability: "Tide Pulse",
    position: "2/2",
    stats: { health: 87, power: 61, guard: 69, speed: 47, bond: 55 },
    href: "/cards/wilds%3A223616f27f33bc5b5fa273d9",
    portraitTitle: "Neiatid deck portrait full-body companion",
    portraitDigest: '<svg xmlns="http://www.w3.org/2000/svg" data-heartbound="heroic-companion" data-identity-signature="sha256:9c9751f72cb816832cbd288f18ce428accef1473f64c5f97827984ad71993699" data-bo'
  }
};

const expectedArtifactFiles = [
  { path: `${prefix}battle-leader-neiatid.png`, sha256: "df732b8cb162ad6d109efe2ddabcb48745d62596a1c2b47dc03640978a6e60ef", bytes: 343060, mode: "0644" },
  { path: `${prefix}browser-replay.js`, sha256: "ae463639d8cd3dd5e716e92f2e8fab88553f85f043a4f087ba021262e868129b", bytes: 31301, mode: "0644" },
  { path: `${prefix}browser-result.json`, sha256: "d60bc6725863d6c085dd9d5e402604e2c8862e72f3a24cb28ccde34420822151", bytes: 151249, mode: "0644" },
  { path: `${prefix}card-vault-toiusap.png`, sha256: "0da7d5fedf7f14fbb3cb4bad560ce30f8577202aaf7b250cbb691b954937cc04", bytes: 691408, mode: "0644" },
  { path: `${prefix}resting-1440x900.png`, sha256: "6907076741497ca8baafd9cc0a1c1a8748921daf3d1034a05b4604bbe29a7fe5", bytes: 1601787, mode: "0644" },
  { path: `${prefix}resting-320x568.png`, sha256: "7f9303d0a67afac4cdc85f1455fe07de2c8d652e8836cac5c51ce8d963698a67", bytes: 508577, mode: "0644" },
  { path: `${prefix}resting-360x800.png`, sha256: "969748f53f99e933a2113cc90fa9d9512be50856ae9cb1834ce2ab36cb5f5ae4", bytes: 612648, mode: "0644" },
  { path: `${prefix}resting-390x844.png`, sha256: "0ae113770fe91650db61f2faed8e7dd2385f996c2f560b8ac1c31af318946b6b", bytes: 710982, mode: "0644" },
  { path: `${prefix}resting-430x932.png`, sha256: "fb15fc219ad39f8fc3b05e58fdb2626e7187132a7babf7135ecae20f523e047c", bytes: 757709, mode: "0644" },
  { path: `${prefix}resting-768x1024.png`, sha256: "3cfcd5dfcf582661cbacd97d66a8f4667c3f0f9558f9bd5d4fa4987a68080a9a", bytes: 1118825, mode: "0644" },
  { path: `${prefix}resting-844x390.png`, sha256: "ed73eb141efe8d7c53f77915fbfd039bd0c500c8257cdc6c6b05f44eb67820ae", bytes: 842027, mode: "0644" },
  { path: `${prefix}slate-neiatid.png`, sha256: "a71895ec03b25f6f691d05a83866afcbc5ea5728b93da6d9740689bc6cf524ad", bytes: 697414, mode: "0644" }
];
const expectedFiles = [...expectedArtifactFiles, {
  path: selfPath,
  sha256: sha256(selfBytes),
  bytes: selfBytes.byteLength,
  mode: "0755"
}].sort((left, right) => left.path.localeCompare(right.path));
const expectedBundleNames = [
  "battle-leader-neiatid.png", "browser-replay.js", "browser-result.json", "card-vault-toiusap.png", "manifest.json",
  "resting-1440x900.png", "resting-320x568.png", "resting-360x800.png", "resting-390x844.png", "resting-430x932.png",
  "resting-768x1024.png", "resting-844x390.png", "slate-neiatid.png", "validate-vault-roster-hud.mjs"
].sort();
const rawToTracked = {
  "output/playwright/task5-battle-leader-neiatid-final.png": `${prefix}battle-leader-neiatid.png`,
  "output/playwright/task5-browser-result.json": `${prefix}browser-result.json`,
  "output/playwright/task5-card-vault-toiusap-final.png": `${prefix}card-vault-toiusap.png`,
  "output/playwright/task5-resting-1440x900.png": `${prefix}resting-1440x900.png`,
  "output/playwright/task5-resting-320x568.png": `${prefix}resting-320x568.png`,
  "output/playwright/task5-resting-360x800.png": `${prefix}resting-360x800.png`,
  "output/playwright/task5-resting-390x844.png": `${prefix}resting-390x844.png`,
  "output/playwright/task5-resting-430x932.png": `${prefix}resting-430x932.png`,
  "output/playwright/task5-resting-768x1024.png": `${prefix}resting-768x1024.png`,
  "output/playwright/task5-resting-844x390.png": `${prefix}resting-844x390.png`,
  "output/playwright/task5-slate-neiatid-final.png": `${prefix}slate-neiatid.png`
};
const claimPointers = {
  selection: `${prefix}browser-result.json#/selection`,
  stats: `${prefix}browser-result.json#/selection/vaultManifests`,
  matrix: `${prefix}browser-result.json#/matrix`,
  recovery: `${prefix}browser-result.json#/interaction`,
  battleLeader: `${prefix}browser-result.json#/battleLeader`,
  browserHealth: `${prefix}browser-result.json#/browserHealth`,
  boundaries: `${prefix}browser-result.json#/qualificationBoundary`
};

const manifest = await readJson(manifestPath);
const result = await readJson(resultPath);
exact((await readdir(bundleDir)).sort(), expectedBundleNames, "exact bundle member set");

check(manifest.schema === "wildz.vault-roster-balanced-hud.manifest.v2", "manifest schema");
check(manifest.baseCommit === baseCommit && manifest.baseCommitFull === baseCommitFull, "base commit identity");
check(manifest.productCommit === productCommit && manifest.productCommitFull === productCommitFull, "product commit identity");
check(manifest.buildId === buildId, "build id");
check(manifest.artifact.identityBoundary === artifactIdentityBoundary, "declared artifact identity boundary");
check(manifest.browser.userAgent === userAgent, "browser user agent");
exact(manifest.browser.viewports, viewports, "manifest viewports");
check(manifest.replay.server === "pnpm start -p 49817" && manifest.replay.command === replayCommand && manifest.replay.profile === "modal-reward-clean", "replay command contract");
check(manifest.replay.profileBoundary === fixtureBoundary, "profile boundary");
exact(manifest.rawToTracked, rawToTracked, "raw-to-tracked contract");
exact(manifest.claims, claimPointers, "claim pointers");
exact(manifest.releaseGates, releaseGates, "release gate literals");
exact([...manifest.files].sort((left, right) => left.path.localeCompare(right.path)), expectedFiles, "manifest file metadata");

for (const entry of expectedFiles) {
  const absolute = resolve(repoRoot, entry.path);
  check(absolute.startsWith(`${repoRoot}${sep}`), `path escapes repository: ${entry.path}`);
  const bytes = await readFile(absolute);
  const info = await stat(absolute);
  check(bytes.byteLength === entry.bytes, `byte size for ${entry.path}`);
  check(sha256(bytes) === entry.sha256, `sha256 for ${entry.path}`);
  check((info.mode & 0o777).toString(8).padStart(4, "0") === entry.mode, `mode for ${entry.path}`);
}
check((selfInfo.mode & 0o777) === 0o755, "validator executable mode");
check(selfBytes.byteLength === expectedSelfByteLength, "validator hard-coded byte size");

check(result.schema === "wildz.vault-roster-balanced-hud.browser.v1", "browser result schema");
check(result.productCommit === productCommit && result.buildId === buildId && result.userAgent === userAgent, "browser artifact identity");
check(result.fixtureBoundary === fixtureBoundary, "browser fixture boundary");
exact(result.qualificationBoundary, qualificationBoundary, "qualification boundary");
check(!Object.hasOwn(result, "capture"), "capture must not be an authoritative browser claim");
check(!Object.hasOwn(manifest.claims, "capture"), "capture must not be a manifest claim");
check(!Object.keys(manifest.rawToTracked).some((key) => /capture|reward/i.test(key)), "capture/reward must not be in raw mappings");

const assertManifest = (proof, card, label) => {
  check(proof.assetId === card.id && proof.manifestName === card.name && proof.namePresent === true, `${label} exact identity`);
  check(proof.source === "live Card Vault sealed-manifest DOM", `${label} live manifest source`);
  exact(proof.stats, card.stats, `${label} exact health/power/guard/speed/bond`);
  check(proof.standaloneHref === card.href, `${label} exact href`);
  for (const [stat, value] of Object.entries(card.stats)) check(proof.text.includes(`${stat[0].toUpperCase()}${stat.slice(1)}${value}`), `${label} DOM text ${stat}`);
};
const assertActive = (proof, card, label) => {
  check(proof.activeAssetId === card.id, `${label} exact asset id`);
  check(proof.commandName === card.name && proof.commandAbility === card.ability && proof.commandPosition === card.position, `${label} command projection`);
  check(proof.command === `${card.name}. Tap to use ${card.ability}. Swipe sideways to change companion, swipe up for roster, or hold for abilities.`, `${label} accessible command literal`);
  check(proof.portraitTitle === card.portraitTitle && proof.portraitMarkupDigestBasis === card.portraitDigest, `${label} exact portrait`);
  exact(proof.worldActorLabels, [card.name], `${label} world actor`);
};

check(result.selection.vaultCards.length === 2, "existing two-card Vault profile");
check(result.selection.vaultCards[0].includes("Toiusap") && result.selection.vaultCards[1].includes("Neiatid"), "Vault exact names");
assertManifest(result.selection.vaultManifests.Toiusap, cards.Toiusap, "Toiusap");
assertManifest(result.selection.vaultManifests.Neiatid, cards.Neiatid, "Neiatid");
assertActive(result.selection.vaultSelected, cards.Toiusap, "Card Vault selection");
assertActive(result.selection.vaultReloaded, cards.Toiusap, "Card Vault reload");
check(result.selection.vaultReloaded.serviceWorkerBypassed === true, "Card Vault exact artifact reload");
exact(result.selection.slateEntries.map((entry) => entry.id), [cards.Toiusap.id, cards.Neiatid.id], "Slate exact ids");
check(result.selection.slateButtonRect.width === 184 && result.selection.slateButtonRect.height === 108, "Slate exact selected target");
assertActive(result.selection.slateSelected, cards.Neiatid, "Slate selection");
assertActive(result.selection.slateReloaded, cards.Neiatid, "Slate reload");
check(result.selection.slateReloaded.serviceWorkerBypassed === true, "Slate exact artifact reload");

check(result.matrix.length === 7, "seven viewport records");
exact(result.matrix.map((entry) => entry.size), viewports, "browser viewports");
for (const entry of result.matrix) {
  const [width, height] = entry.size.split("x").map(Number);
  const resting = entry.resting;
  exact(resting.openSurfaces, { slate: 0, liveRoster: 0, playerInteraction: 0, dialogs: 0, audioSheets: 0 }, `${entry.size} true resting surface state`);
  check(resting.viewport.width === width && resting.viewport.height === height, `${entry.size} viewport dimensions`);
  check(resting.canvas.display.width === width && resting.canvas.display.height === height, `${entry.size} canvas rect`);
  check(resting.canvas.drawingBuffer.width > 0 && resting.canvas.drawingBuffer.height > 0, `${entry.size} drawing buffer`);
  check(resting.diagnostics.canvas.drawingBufferWidth === resting.canvas.drawingBuffer.width, `${entry.size} diagnostic drawing width`);
  check(resting.diagnostics.render.calls > 0 && resting.diagnostics.render.triangles > 0, `${entry.size} renderer counters`);
  check(resting.diagnostics.memory.geometries > 0 && resting.diagnostics.memory.textures > 0, `${entry.size} renderer memory`);
  check(resting.diagnostics.budget.withinBudget === true, `${entry.size} renderer budget`);
  check(resting.targets.length === expectedTargetCount, `${entry.size} exact target count`);
  exact(resting.targets.map((target) => target.label).sort(), expectedTargetLabelsByViewport[entry.size].toSorted(), `${entry.size} exact target label set`);
  check(resting.targets.every((target) => target.floor44 === true && target.width >= 44 && target.height >= 44), `${entry.size} target dimensions and floor flags`);
  const explorerTarget = resting.targets.find((target) => target.label === expectedTargetLabelsByViewport[entry.size][0]);
  const missionTarget = resting.targets.find((target) => target.label === expectedTargetLabelsByViewport[entry.size][1]);
  check(explorerTarget?.width >= 44 && explorerTarget?.height >= 44, `${entry.size} Explorer root target floor`);
  check(missionTarget?.width >= 44 && missionTarget?.height >= 44, `${entry.size} Mission root target floor`);
  check(resting.targetFloorFailures.length === 0, `${entry.size} target floors`);
  check(resting.safeBounds.every((surface) => surface.pass), `${entry.size} safe bounds`);
  check(resting.positiveCollisions.length === 0, `${entry.size} painted-surface collisions`);
  check(resting.document.overflowX === 0, `${entry.size} horizontal overflow`);
  check(entry.preview.className.includes("mode-preview") && entry.preview.entries === 2, `${entry.size} Slate preview`);
  check(entry.expanded.className.includes("mode-expanded") && entry.expanded.entries === 2, `${entry.size} Slate expanded`);
  check(entry.audio.open === true, `${entry.size} audio sheet`);
  check(entry.kai.dialogCount === 1, `${entry.size} Kai Command Center modal`);
  exact(entry.kai.homesInert, kaiHomesInert, `${entry.size} Kai inert ownership`);
  check(entry.live.rosterCount === 1, `${entry.size} live roster`);
  check(entry.multiplayer.liveBadgePresent === true && entry.multiplayer.remoteCount === 0, `${entry.size} empty multiplayer state`);
}

const interaction = result.interaction;
check(interaction.twoTouchDuring.dpadPressed === "true" && interaction.twoTouchReleased === "false", "simultaneous touch release");
exact(interaction.horizontalCycle, { before: "Neiatid", after: "Toiusap", restored: "Neiatid", ownedOnly: true }, "owned-only horizontal cycle");
exact(interaction.tapPower, { eventText: "Signal warm · closer. Follow the search clue.", commandStillMounted: true }, "tap power exact event and recovery");
check(interaction.holdSlide.wheelVisible === true && interaction.holdSlide.selected === "Mossbeak Bond", "hold-slide exact ability");
exact(interaction.pointerCancel, { wheelCount: 0, mode: "wilds-companion-command-zone mode-pending" }, "pointer cancel");
exact(interaction.lostCapture, { before: "true", after: "false" }, "lost pointer capture");
exact(interaction.keyboard, { wheelOpened: true, focusRestored: true }, "keyboard ability selection");
exact(interaction.resizeCancellation, { wheelCount: 0, commandMode: "wilds-companion-command-zone mode-pending" }, "resize cancellation");
check(interaction.escape.drawerClosed === true, "Escape drawer recovery");
exact(interaction.text200, { fontSize: "32px", overflowX: 0 }, "200 percent text");
exact(interaction.reducedMotion, { matches: true, drawerTransition: "0s" }, "reduced motion");
check(interaction.offline.online === false && interaction.offline.canvasCount > 0 && interaction.offline.commandCount === 1, "offline recovery");
check(interaction.lifecycle.visibilityState === "visible" && interaction.lifecycle.canvasCount > 0, "lifecycle recovery");
check(interaction.audioToggle.before === false && interaction.audioToggle.after === true && interaction.audioToggle.restored === true, "audio toggle");
exact(interaction.hapticSafety, [
  { variant: "missing", selected: "Toiusap", commandMounted: true },
  { variant: "non-callable", selected: "Neiatid", commandMounted: true },
  { variant: "throwing", selected: "Toiusap", commandMounted: true }
], "haptic safety variants");
assertActive(interaction.finalActive, cards.Neiatid, "final active creature");

exact(result.battleLeader, {
  reached: true,
  via: ["Open mission details", "Battle Trainer"],
  activeAssetId: cards.Neiatid.id,
  activeName: "Neiatid",
  surface: "Selected battle roster",
  trainerName: "Reefway Toma",
  rosterCount: 2,
  leadName: "Neiatid",
  leadRole: "Lead",
  leadPortraitTitle: null,
  visualProof: { locator: ".wilds-trainer-challenge", visibleBefore: true, visibleAfter: true, screenshot: "output/playwright/task5-battle-leader-neiatid-final.png" }
}, "next-battle leader proof");
exact(result.browserHealth.consoleErrors, [], "console errors");
exact(result.browserHealth.consoleWarnings, [], "console warnings");
exact(result.browserHealth.pageErrors, [], "page errors");
exact(result.browserHealth.httpErrors, [], "HTTP errors");
check(result.browserHealth.failedRequests.length <= 1 && result.browserHealth.failedRequests.every((request) => request.method === "GET" && request.error === "net::ERR_ABORTED" && request.url.startsWith(`http://127.0.0.1:49817${cards.Toiusap.href}?_rsc=`)), "only expected reload-cancelled Toiusap RSC prefetch may fail");

console.log(`vault-roster-balanced-hud evidence valid: ${expectedBundleNames.length} bundle members, ${expectedFiles.length} hashed files, ${result.matrix.length} viewports, declared build ${buildId}, declared commit ${productCommit}; source-to-build provenance not cryptographically attested`);
