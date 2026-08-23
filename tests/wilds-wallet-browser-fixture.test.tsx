import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WildsWalletBrowserFixture } from "../src/features/play/wallet/WildsWalletBrowserFixture";
import { WildsWalletInstrument } from "../src/features/play/wallet/WildsWalletInstrument";
import { createWildsWalletControllerState } from "../src/features/play/wallet/wilds-wallet-controller";

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
  const finalHud = css.slice(css.lastIndexOf("/* Balanced persistent status homes"));
  assert.match(finalHud, /\.wilds-left-instrument-home\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*104px 44px;[^}]*grid-template-rows:\s*44px 44px;/s);
  assert.match(finalHud, /\.wilds-left-instrument-home > \.wilds-kai-command-pill\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1/);
  assert.match(finalHud, /\.wilds-left-instrument-home > \.wilds-audio-settings\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1/);
  assert.match(finalHud, /\.wilds-left-instrument-home > \.wilds-wallet-instrument\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*2/);
  const walletValueRule = css.match(/\.wilds-wallet-instrument > strong\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(walletValueRule, /font:\s*800 clamp\(6px, 1\.75vw, 8px\)/);
  assert.doesNotMatch(walletValueRule, /overflow:\s*hidden|text-overflow:/);
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\)[\s\S]*\.wilds-wallet-terminal-header\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wilds-wallet-terminal/);
  assert.match(css, /@media \(max-width: 350px\)[\s\S]*\.wilds-left-instrument-home\s*\{[^}]*grid-template-columns:\s*min\(30vw, 104px\) 44px;/s);
  assert.match(css, /@media \(max-width: 350px\)[\s\S]*\.wilds-left-instrument-home > \.wilds-wallet-instrument\s*\{[^}]*width:\s*min\(30vw, 104px\);/s);
});

test("wallet authority failures preserve a safe upstream Receiz code for production diagnosis", () => {
  const route = readFileSync("app/api/auth/wildz/wallet-authority/route.ts", "utf8");
  const helper = readFileSync("src/lib/receiz/receiz-http-failure.ts", "utf8");
  assert.match(route, /receizHttpFailureCode\(cause\)/);
  assert.match(helper, /cause instanceof ReceizHttpError/);
  assert.match(helper, /\["code", "error", "message"\]/);
  assert.match(helper, /\^\[A-Z\]\[A-Z0-9_\]\{2,80\}\$/);
  assert.doesNotMatch(helper, /JSON\.stringify\(cause\.payload\)/);
});

test("shell passes a private wallet cache key separately from an optional public username", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  assert.match(shell, /walletIdentityKey=\{identity\.actorId\}/);
  assert.match(shell, /walletPublicUsername=\{identity\.username \?\? null\}/);
  assert.match(campaign, /useWildsWalletController\(walletIdentityKey, walletAuthorityGeneration/);
  assert.match(campaign, /authorizeWildsWalletTransferWithIdentity\(walletReadIdentityKey, input\)/);
  assert.match(campaign, /walletAuthorization\?: WildsWalletClientAuthorizationPort/);
  assert.match(campaign, /authorization: walletTransferAuthorization/);
  assert.match(campaign, /readAuthorization: walletReadAuthorization/);
  assert.match(campaign, /onAuthorize=\{walletController\.authorizeTransfer \?\? undefined\}/);
});

test("campaign mounts the terminal outside the Canvas and instrument directly after Kai Klok", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const hud = readFileSync("src/features/play/WildsBalancedStatusHud.tsx", "utf8");
  assert.ok(campaign.indexOf("useWildsWalletController") < campaign.indexOf("<WildsWorldCanvas"));
  assert.ok(campaign.indexOf("<WildsWalletTerminal") > campaign.indexOf("</CanvasErrorBoundary>"));
  assert.match(hud, /wilds-kai-command-pill[\s\S]*<WildsAudioSettings[\s\S]*<WildsWalletInstrument/);
  assert.doesNotMatch(campaign, /NEXT_PUBLIC_RECEIZ_WALLET_ENABLED/);
  assert.match(campaign, /exclusiveOwner === "wallet"/);
  assert.match(hud, /walletEnabled \? <WildsWalletInstrument/);
});

test("wallet HUD control is a compact wallet icon with a stable Phi balance", () => {
  const state = {
    ...createWildsWalletControllerState("explorer", "generation"),
    status: "verified" as const,
    summary: {
      status: "verified" as const,
      admittedPhiMicro: "1250000",
      displayUsdCents: null,
      assetCountsStatus: "available" as const,
      transferableResourceCount: 0,
      transferableCardCount: 0,
      reservedCardCount: 0,
      pendingCount: 0
    }
  };
  const markup = renderToStaticMarkup(createElement(WildsWalletInstrument, {
    disabled: false,
    onOpen() {},
    state
  }));
  assert.match(markup, /data-wallet-status="verified"/);
  assert.match(markup, /class="wilds-wallet-glyph"/);
  assert.match(markup, />Φ 1\.25</);
  assert.doesNotMatch(markup, /PHI RESERVE|SECURE|VERIFYING/);
});

test("an in-progress wallet authorization blocks owner release before modal admission changes", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const closeStart = campaign.indexOf("const closeOwnedModal");
  const walletGuard = campaign.indexOf('owner === "wallet" && !canCloseWildsWalletTerminal(walletController)', closeStart);
  const release = campaign.indexOf("releasePlayModalOwner(owner)", closeStart);
  assert.ok(walletGuard > closeStart && walletGuard < release);
});
