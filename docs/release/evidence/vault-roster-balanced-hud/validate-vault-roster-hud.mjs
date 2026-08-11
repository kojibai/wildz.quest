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
const expectedSelfByteLength = Number("19852");

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
  { path: `${prefix}battle-leader-neiatid.png`, sha256: "35101ddf488032c3b242bb2039837566ae0d7e91ceee5223b92036537af2f89b", bytes: 343344, mode: "0644" },
  { path: `${prefix}browser-replay.js`, sha256: "064ff90dd312f1dc56ce47540f0387a45f5b99492ae9b32de16faf1f10d8ffe0", bytes: 31146, mode: "0644" },
  { path: `${prefix}browser-result.json`, sha256: "d51ff2f81144d20aab0e441200ee44cc0e41beedc678b3345f0f18ab8b86a4ac", bytes: 148961, mode: "0644" },
  { path: `${prefix}card-vault-toiusap.png`, sha256: "5895c6f9e12e1504433f4e8970f7ea6b158bb12a7115402a3a201e07be5ff2ad", bytes: 693194, mode: "0644" },
  { path: `${prefix}resting-1440x900.png`, sha256: "3f9889a69a50460d79fc5317bea9aaad03c91e3b964f923e0c4db9961bc1556f", bytes: 1588297, mode: "0644" },
  { path: `${prefix}resting-320x568.png`, sha256: "2e5aa1d9dfafa65faa0b9881c849ef90c7de5f128583f55df30d9652f8491a53", bytes: 544229, mode: "0644" },
  { path: `${prefix}resting-360x800.png`, sha256: "4240663c62ada9548b0e0d575b3c595471ea6e9099151487cc96d74025ec79c7", bytes: 638805, mode: "0644" },
  { path: `${prefix}resting-390x844.png`, sha256: "86a43c010b07d2696a4a3f423a516738abfa4f9a82daad3180714210286513fe", bytes: 733898, mode: "0644" },
  { path: `${prefix}resting-430x932.png`, sha256: "15888fd8ab9f5c40722de82120899bc9ca148d3b445db7dc613a1924b11e01f1", bytes: 788121, mode: "0644" },
  { path: `${prefix}resting-768x1024.png`, sha256: "a79f89e393254b052423a57a8fe623418b1b964ac8b5dd7ade1183b5ff8b0e26", bytes: 1123622, mode: "0644" },
  { path: `${prefix}resting-844x390.png`, sha256: "34a6f1a57d413f1323733e177231b486edb06cc7bb0e5f6f49b68796b0b0c91a", bytes: 863436, mode: "0644" },
  { path: `${prefix}slate-neiatid.png`, sha256: "ac2ae630fa55e117a54237ffc8a79cbab2bdfda2f97a110ca47f347d6189227e", bytes: 735422, mode: "0644" }
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
exact(interaction.tapPower, { eventText: "Signal warm. Follow the search clue.", commandStillMounted: true }, "tap power exact event and recovery");
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
