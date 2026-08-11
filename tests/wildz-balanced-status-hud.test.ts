import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("world HUD removes the generic status toggle and composes balanced persistent homes", () => {
  const campaign = read("src/features/play/PlayCampaign.tsx");
  const hudPath = "src/features/play/WildsBalancedStatusHud.tsx";

  assert.doesNotMatch(campaign, /worldStatusOpen|wilds-world-status-trigger|wilds-world-status-fan/);
  assert.match(campaign, /<WildsBalancedStatusHud/);
  assert.equal(existsSync(hudPath), true, "the balanced status HUD component must exist");

  const hud = read(hudPath);
  assert.match(hud, /className="wilds-map-status-home"/);
  assert.match(hud, /<WildsLivingWorldHud/);
  assert.match(hud, /<WildsMultiplayer/);
  assert.match(hud, /className="wilds-left-instrument-home"/);
  assert.match(hud, /className="wilds-kai-command-pill"/);
  assert.match(hud, /<WildsAudioSettings/);
});

test("both persistent homes inherit modal ownership and gate their direct actions", () => {
  const campaign = read("src/features/play/PlayCampaign.tsx");
  const hudPath = "src/features/play/WildsBalancedStatusHud.tsx";

  assert.equal(existsSync(hudPath), true, "the balanced status HUD component must exist");
  const hud = read(hudPath);
  assert.equal(hud.match(/aria-hidden=\{blocked\}/g)?.length, 2);
  assert.equal(hud.match(/inert=\{blocked \? true : undefined\}/g)?.length, 2);
  assert.match(hud, /disabled=\{!interactionEnabled\}/);
  assert.match(hud, /if \(!interactionEnabled\) return;[\s\S]*onOpenCommandCenter\(\)/);
  assert.match(campaign, /const backgroundHomesBlocked = !isPlayHomeAvailable\(exclusiveOwner, "status"\)/);
  assert.match(campaign, /blocked=\{backgroundHomesBlocked\}/);
});

test("live controls stay persistent while multiplayer modal content escapes the inert home", () => {
  const multiplayer = read("src/features/play/WildsMultiplayer.tsx");

  assert.doesNotMatch(multiplayer, /controlsExpanded/);
  assert.match(multiplayer, /id="wilds-live-controls"[^>]*className="wilds-live-cluster"/);
  assert.match(multiplayer, /shouldShowIncomingChallenge[\s\S]*typeof document !== "undefined"[\s\S]*createPortal/);
  assert.match(multiplayer, /role="dialog" aria-modal="true" aria-label="Incoming Wilds battle challenge"/);
});

test("balanced homes remain touch-safe and collision-aware at phone and short-landscape sizes", () => {
  const css = read("app/globals.css");
  const finalCss = css.slice(css.lastIndexOf("/* Unified living-world overlay"));

  assert.doesNotMatch(finalCss, /wilds-world-status-trigger|wilds-world-status-fan/);
  assert.match(finalCss, /\.wilds-map-status-home\s*\{[^}]*position:\s*absolute;[^}]*top:\s*calc\([^}]*safe-area-inset-top[^}]*right:\s*max\([^}]*safe-area-inset-right/);
  assert.match(finalCss, /\.wilds-left-instrument-home\s*\{[^}]*position:\s*absolute;[^}]*top:\s*calc\([^}]*safe-area-inset-top[^}]*left:\s*max\([^}]*safe-area-inset-left/);
  assert.match(finalCss, /\.wilds-map-status-home :is\(\.wilds-live-badge, \.wilds-live-share, \.wilds-live-pill\),[\s\S]*\.wilds-left-instrument-home :is\(\.wilds-kai-command-pill, \.wilds-audio-settings > summary\)\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/);
  assert.match(finalCss, /@media \(max-width: 350px\)[\s\S]*\.wilds-map-status-home\s*\{[^}]*max-width:\s*calc\(100vw - 136px/);
  assert.match(finalCss, /@media \(orientation: landscape\) and \(max-height: 500px\)[\s\S]*\.wilds-left-instrument-home\s*\{[^}]*grid-template-columns:\s*104px 44px;/);
});
