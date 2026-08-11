#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bundleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(bundleDir, "../../../..");
const prefix = "docs/release/evidence/vault-roster-balanced-hud/";
const expectedFiles = [
  "browser-replay.js",
  "browser-result.json",
  "validate-vault-roster-hud.mjs",
  "capture-reward.png",
  "card-vault-toiusap.png",
  "slate-neiatid.png",
  "resting-320x568.png",
  "resting-360x800.png",
  "resting-390x844.png",
  "resting-430x932.png",
  "resting-844x390.png",
  "resting-768x1024.png",
  "resting-1440x900.png"
].map((name) => `${prefix}${name}`).sort();
const expectedViewports = ["320x568", "360x800", "390x844", "430x932", "844x390", "768x1024", "1440x900"];
const cards = {
  vault: { id: "wilds:123e00f59899025a366d578f", name: "Toiusap", ability: "Stone Pulse", position: "1/2" },
  captured: { id: "wilds:223616f27f33bc5b5fa273d9", name: "Neiatid", ability: "Tide Pulse", position: "2/2" }
};

const fail = (message) => { throw new Error(`vault-roster-balanced-hud evidence invalid: ${message}`); };
const check = (condition, message) => { if (!condition) fail(message); };
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const exactStrings = (actual, expected, label) => check(JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()), `${label} mismatch`);

const manifest = await readJson(resolve(bundleDir, "manifest.json"));
const result = await readJson(resolve(bundleDir, "browser-result.json"));

check(manifest.schema === "wildz.vault-roster-balanced-hud.manifest.v1", "manifest schema");
check(manifest.productCommit === "cea7b57", "captured product commit");
check(manifest.baseCommit === "07a8e93", "base commit");
check(manifest.buildId === "qW7HIxXbLMMm4UdSFwYsD", "build id");
check(manifest.replay.command === `/Users/bjklock/.codex/skills/playwright/scripts/playwright_cli.sh -s=modal-reward-clean run-code "$(cat docs/release/evidence/vault-roster-balanced-hud/browser-replay.js)"`, "replay command");
check(typeof manifest.browser.userAgent === "string" && manifest.browser.userAgent.includes("Chrome/152."), "browser user agent");
exactStrings(manifest.browser.viewports, expectedViewports, "manifest viewport contract");
exactStrings(manifest.files.map((entry) => entry.path), expectedFiles, "manifest file contract");
check(Object.keys(manifest.rawToTracked).length === 11, "raw-to-tracked mapping count");
check(manifest.claims.selection === `${prefix}browser-result.json#/selection`, "selection claim pointer");
check(manifest.claims.matrix === `${prefix}browser-result.json#/matrix`, "matrix claim pointer");
check(manifest.claims.recovery === `${prefix}browser-result.json#/interaction`, "recovery claim pointer");
check(manifest.claims.residuals === `${prefix}browser-result.json#/battleLeader`, "residual claim pointer");

for (const entry of manifest.files) {
  const absolute = resolve(repoRoot, entry.path);
  check(absolute.startsWith(repoRoot), `path escapes repository: ${entry.path}`);
  const bytes = await readFile(absolute);
  const info = await stat(absolute);
  check(bytes.byteLength === entry.bytes, `byte size for ${entry.path}`);
  check(sha256(bytes) === entry.sha256, `sha256 for ${entry.path}`);
  check((info.mode & 0o777).toString(8).padStart(4, "0") === entry.mode, `mode for ${entry.path}`);
}

check(result.schema === "wildz.vault-roster-balanced-hud.browser.v1", "browser result schema");
check(result.productCommit === "cea7b57" && result.buildId === "qW7HIxXbLMMm4UdSFwYsD", "artifact identity");
check(result.fixtureBoundary.includes("No storage injection or test fixture route was used"), "fixture boundary disclosure");
check(result.capture.inventoryBefore === 1 && result.capture.inventoryAfter === 2, "capture inventory count 1 to 2");
check(result.capture.rewardModalCount === 1, "exactly one capture reward modal");
check(result.capture.capturedCard.id === cards.captured.id && result.capture.capturedCard.name === cards.captured.name, "captured exact asset");
check(result.capture.newMarkerDirectlyObserved === false, "unobserved ephemeral New marker must remain disclosed false");

const assertActive = (proof, card, label) => {
  check(proof.activeAssetId === card.id, `${label} exact asset id`);
  check(proof.commandName === card.name && proof.commandAbility === card.ability && proof.commandPosition === card.position, `${label} command projection`);
  check(proof.command.startsWith(`${card.name}. Tap to use ${card.ability}.`), `${label} accessible command`);
  check(proof.portraitTitle === `${card.name} deck portrait full-body companion`, `${label} exact portrait title`);
  check(proof.worldActorLabels.includes(card.name), `${label} world actor`);
};
check(result.selection.vaultCards.length === 2, "real two-card Vault profile");
check(result.selection.vaultDetail.standaloneHref === `/cards/${encodeURIComponent(cards.vault.id)}`, "Vault detail exact asset href");
assertActive(result.selection.vaultSelected, cards.vault, "Card Vault selection");
assertActive(result.selection.vaultReloaded, cards.vault, "Card Vault reload");
check(result.selection.vaultReloaded.serviceWorkerBypassed === true, "Card Vault exact artifact reload");
check(result.selection.slateEntries.some((entry) => entry.id === cards.vault.id) && result.selection.slateEntries.some((entry) => entry.id === cards.captured.id), "Slate exact roster ids");
check(result.selection.capturedButtonRect.width >= 44 && result.selection.capturedButtonRect.height >= 44, "Slate captured-card target floor");
assertActive(result.selection.slateSelected, cards.captured, "Slate selection");
assertActive(result.selection.slateReloaded, cards.captured, "Slate reload");
check(result.selection.slateReloaded.serviceWorkerBypassed === true, "Slate exact artifact reload");

check(result.matrix.length === 7, "seven viewport records");
exactStrings(result.matrix.map((entry) => entry.size), expectedViewports, "browser viewport contract");
for (const entry of result.matrix) {
  const [width, height] = entry.size.split("x").map(Number);
  const resting = entry.resting;
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
  check(entry.live.rosterCount === 1, `${entry.size} live roster`);
  check(entry.multiplayer.liveBadgePresent === true && entry.multiplayer.remoteCount === 0, `${entry.size} measured empty multiplayer state`);
}

const interaction = result.interaction;
check(interaction.twoTouchDuring.dpadPressed === "true" && interaction.twoTouchReleased === "false", "simultaneous touch release");
check(interaction.horizontalCycle.ownedOnly === true && interaction.horizontalCycle.before === interaction.horizontalCycle.restored, "owned-only horizontal cycle");
check(interaction.tapPower.commandStillMounted === true, "tap power recovery");
check(interaction.holdSlide.wheelVisible === true && typeof interaction.holdSlide.selected === "string", "hold-slide abilities");
check(interaction.pointerCancel.wheelCount === 0 && interaction.pointerCancel.mode.includes("mode-pending"), "pointer cancel");
check(interaction.lostCapture.before === "true" && interaction.lostCapture.after === "false", "lost pointer capture");
check(interaction.keyboard.wheelOpened === true && interaction.keyboard.focusRestored === true, "keyboard ability selection");
check(interaction.resizeCancellation.wheelCount === 0 && interaction.resizeCancellation.commandMode.includes("mode-pending"), "resize cancellation");
check(interaction.escape.drawerClosed === true, "Escape drawer recovery");
check(interaction.text200.fontSize === "32px" && interaction.text200.overflowX === 0, "200 percent text");
check(interaction.reducedMotion.matches === true && interaction.reducedMotion.drawerTransition === "0s", "reduced motion");
check(interaction.offline.online === false && interaction.offline.canvasCount > 0 && interaction.offline.commandCount === 1, "offline recovery");
check(interaction.lifecycle.visibilityState === "visible" && interaction.lifecycle.canvasCount > 0, "lifecycle recovery");
check(interaction.audioToggle.after !== interaction.audioToggle.before && interaction.audioToggle.restored === true, "audio toggle");
check(interaction.hapticSafety.map((entry) => entry.variant).join(",") === "missing,non-callable,throwing" && interaction.hapticSafety.every((entry) => entry.commandMounted), "haptic safety variants");
assertActive(interaction.finalActive, cards.captured, "final active creature");

check(result.browserHealth.consoleErrors.length === 0, "console errors");
check(result.browserHealth.consoleWarnings.length === 0, "console warnings");
check(result.browserHealth.pageErrors.length === 0, "page errors");
check(result.browserHealth.httpErrors.length === 0, "HTTP errors");
check(result.browserHealth.failedRequests.length <= 1 && result.browserHealth.failedRequests.every((request) => request.error === "net::ERR_ABORTED" && request.url.includes(`/cards/${encodeURIComponent(cards.vault.id)}?_rsc=`)), "only expected reload-cancelled RSC prefetch may fail");
check(result.battleLeader.reached === false && result.battleLeader.reason.includes("outside a player-facing trainer interaction radius"), "unreached next battle must remain disclosed");

console.log(`vault-roster-balanced-hud evidence valid: ${manifest.files.length} files, ${result.matrix.length} viewports, build ${result.buildId}, commit ${result.productCommit}`);
