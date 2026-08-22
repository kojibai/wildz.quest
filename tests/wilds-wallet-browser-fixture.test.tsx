import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WildsWalletBrowserFixture } from "../src/features/play/wallet/WildsWalletBrowserFixture";

test("browser fixture exposes deterministic verified, offline, recovery, rejection, and committed states", () => {
  const markup = renderToStaticMarkup(createElement(WildsWalletBrowserFixture));
  for (const state of ["verified", "offline-verified", "unknown", "zero-write", "committed"]) {
    assert.match(markup, new RegExp(`data-fixture-state="${state}"`));
  }
});

test("wallet CSS owns responsive geometry, safe areas, touch floors, long text, and reduced motion", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wilds-wallet-terminal\s*\{[\s\S]*width:\s*clamp\(520px, 46vw, 760px\)/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.wilds-wallet-terminal/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.wilds-wallet-terminal[\s\S]*inset:\s*0/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.wilds-wallet-terminal :is\(button, input, select\)[^{]*\{[^}]*min-height:\s*44px/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /\.wilds-left-instrument-home > \.wilds-wallet-instrument\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*2/);
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\)[\s\S]*\.wilds-wallet-terminal-header\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wilds-wallet-terminal/);
});

test("shell passes a private wallet cache key separately from an optional public username", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  assert.match(shell, /walletIdentityKey=\{identity\.actorId\}/);
  assert.match(shell, /walletPublicUsername=\{identity\.username \?\? null\}/);
  assert.match(campaign, /useWildsWalletController\(walletIdentityKey, walletAuthorityGeneration/);
  assert.match(campaign, /walletAuthorization\?: WildsWalletClientAuthorizationPort/);
  assert.match(campaign, /authorization: walletAuthorization/);
  assert.match(campaign, /onAuthorize=\{walletController\.authorizeTransfer \?\? undefined\}/);
});

test("campaign mounts the terminal outside the Canvas and instrument directly after Kai Klok", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const hud = readFileSync("src/features/play/WildsBalancedStatusHud.tsx", "utf8");
  assert.ok(campaign.indexOf("useWildsWalletController") < campaign.indexOf("<WildsWorldCanvas"));
  assert.ok(campaign.indexOf("<WildsWalletTerminal") > campaign.indexOf("</CanvasErrorBoundary>"));
  assert.match(hud, /wilds-kai-command-pill[\s\S]*<WildsWalletInstrument[\s\S]*<WildsAudioSettings/);
});

test("an in-progress wallet authorization blocks owner release before modal admission changes", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const closeStart = campaign.indexOf("const closeOwnedModal");
  const walletGuard = campaign.indexOf('owner === "wallet" && !canCloseWildsWalletTerminal(walletController)', closeStart);
  const release = campaign.indexOf("releasePlayModalOwner(owner)", closeStart);
  assert.ok(walletGuard > closeStart && walletGuard < release);
});
