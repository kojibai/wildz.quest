import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WildsCapabilityControls } from "../src/features/play/WildsCapabilityControls";
import type { WildsProjectedCapabilityControl } from "../src/features/play/wilds-world-capability-controls";
import type { WildsCapabilityContext } from "../src/features/play/wilds-world-capability-context";

function control(family: WildsProjectedCapabilityControl["family"], label: string, capacity: number): WildsProjectedCapabilityControl {
  return Object.freeze({ assetId: "asset:ui", family, label, action: `${label} now`, icon: family === "lumber" ? "timber" : family, unlockLevel: 1, capacity, currentPower: 70, runtimeAvailable: capacity > 0 });
}

function context(family: WildsProjectedCapabilityControl["family"], state: WildsCapabilityContext["state"], explanation: string): WildsCapabilityContext {
  return Object.freeze({ family, state, candidateIds: Object.freeze([]), primaryTargetId: null, explanation, intent: Object.freeze({ kind: state === "recovering" ? "explain-recovery" : state === "active" ? "toggle" : "execute", targetId: null, expectedHead: null }) });
}

test("renders only supplied proof controls with stable state and capacity semantics", () => {
  const controls = Object.freeze([control("light", "Grove Pulse", 82), control("track", "Trace Song", 0)]);
  const contexts = new Map([
    ["light", context("light", "active", "Living light is active.")],
    ["track", context("track", "recovering", "Trace Song is recovering.")]
  ] as const);
  const markup = renderToStaticMarkup(createElement(WildsCapabilityControls, { controls, contexts, enabled: true, onRequest() {} }));

  assert.match(markup, /aria-label="Grove Pulse\. Living light is active\. Capacity 82 percent"/);
  assert.match(markup, /is-active/);
  assert.match(markup, /is-recovering/);
  assert.doesNotMatch(markup, /Swim/);
});

test("capability layout keeps app-grade touch targets and responsive upward wrapping", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wilds-capability-control\s*\{[\s\S]*?min-width:\s*44px/);
  assert.match(css, /\.wilds-capability-control\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.wilds-capability-controls\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?wilds-capability-control/);
});

