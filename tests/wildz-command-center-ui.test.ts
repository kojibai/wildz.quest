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
});

test("cockpit CSS breathes from Kai state and honors reduced motion", async () => {
  const css = await readFile("app/globals.css", "utf8");
  assert.match(css, /\.wilds-kai-command-pill/);
  assert.match(css, /@keyframes wilds-neural-heartbeat/);
  assert.match(css, /\.wilds-neural-spine/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wilds-neural-command/s);
});
