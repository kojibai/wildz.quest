import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Command Center uses the sheet lifecycle without adding a seventh dock button", async () => {
  const source = await readFile("src/features/play/WildsCommandDock.tsx", "utf8");
  assert.match(source, /dockVisible\?: boolean/);
  assert.match(source, /items\.filter\(\(item\) => item\.dockVisible !== false\)/);
  assert.match(source, /items\.find\(\(item\) => item\.key === activeKey\)/);
  assert.match(source, /"commandCenter"/);
});

test("neural cockpit exposes the full Kai coordinate and consequence branches", async () => {
  const source = await readFile("src/features/play/command-center/WildsCommandCenter.tsx", "utf8");
  for (const token of ["latticeCoordinate", "coordinate", "Now", "Squad", "World", "Mission", "wilds-neural-spine", "data-kai-chakra"]) {
    assert.match(source, new RegExp(token));
  }
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /WildsKaiMomentInspector/);
});

test("Eternal Pulse opens a contained, keyboard-safe Kai teaching inspector", async () => {
  const source = await readFile("src/features/play/command-center/WildsKaiMomentInspector.tsx", "utf8");
  for (const token of [
    "What this moment is saying",
    "Six harmonic days",
    "Seven harmonic weeks",
    "Eight eternal months",
    "Six chakra arks",
    "Deterministic mathematics",
    "Coordinate legend",
    "Full teaching",
    "☤ KAI"
  ]) assert.match(source, new RegExp(token));
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /aria-controls="wilds-kai-moment-inspector"/);
  assert.match(source, /<WildsPopoverSurface[^>]*ariaLabel="Kai moment inspector"/);
  const surface = await readFile("src/features/play/WildsPopoverSurface.tsx", "utf8");
  assert.match(surface, /event\.key === "Escape"/);
  assert.match(source, /triggerRef\.current\?\.focus\(\)/);
});

test("Kai teaching inspector restores its independent overlay and native momentum scroller", async () => {
  const css = await readFile("app/globals.css", "utf8");
  assert.match(css, /\.wilds-popover-layer\.is-contained > \.wilds-popover-surface\.wilds-kai-inspector-popover\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\);[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.wilds-command-sheet-content\s*\{[^}]*overflow-y:\s*auto[^}]*touch-action:\s*pan-y/s);
  assert.doesNotMatch(css, /\.wilds-command-sheet-content \.wilds-kai-inspector-popover\s*\{[^}]*position:\s*relative[^}]*overflow:\s*visible/s);
  assert.match(css, /\.wilds-popover-layer\.is-contained \.wilds-popover-scroll\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.wilds-popover-scroll\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior-y:\s*contain;[^}]*touch-action:\s*pan-y;[^}]*-webkit-overflow-scrolling:\s*touch;/s);
  assert.match(css, /\.wilds-kai-inspector-popover\s*\{[\s\S]*background:[^;]*(#030d12|rgb\()/s);
  assert.match(css, /\.wilds-kai-moment-utterance/);
  assert.match(css, /\.wilds-kai-moment-utterance\s*\{[^}]*white-space:\s*normal/s);
  assert.doesNotMatch(css, /\.wilds-kai-moment-utterance\s*\{[^}]*-webkit-line-clamp/s);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.wilds-kai-inspector-popover/s);
});

test("cockpit CSS breathes from Kai state and honors reduced motion", async () => {
  const css = await readFile("app/globals.css", "utf8");
  assert.match(css, /\.wilds-kai-command-pill/);
  assert.match(css, /@keyframes wilds-neural-heartbeat/);
  assert.match(css, /\.wilds-neural-spine/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wilds-neural-command/s);
});
