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
  assert.match(source, /role="dialog"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /triggerRef\.current\?\.focus\(\)/);
});

test("Kai teaching inspector remains inside the cockpit and scrolls without a blank surface", async () => {
  const css = await readFile("app/globals.css", "utf8");
  assert.match(css, /\.wilds-kai-inspector-popover\s*\{[\s\S]*position:\s*absolute[\s\S]*max-height:[\s\S]*overflow-y:\s*auto/s);
  assert.match(css, /\.wilds-kai-inspector-popover\s*\{[\s\S]*background:[^;]*(#030d12|rgb\()/s);
  assert.match(css, /\.wilds-kai-moment-utterance/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.wilds-kai-inspector-popover/s);
});

test("cockpit CSS breathes from Kai state and honors reduced motion", async () => {
  const css = await readFile("app/globals.css", "utf8");
  assert.match(css, /\.wilds-kai-command-pill/);
  assert.match(css, /@keyframes wilds-neural-heartbeat/);
  assert.match(css, /\.wilds-neural-spine/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wilds-neural-command/s);
});
