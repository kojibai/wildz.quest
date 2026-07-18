import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("in-world onboarding is compact, motion-safe, and cannot scroll the entry page", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wildz-in-world-onboarding\s*\{[^}]*inset:\s*0[^}]*overflow:\s*hidden[^}]*overscroll-behavior:\s*none/s);
  assert.match(css, /\.wildz-onboarding-card\s*\{[^}]*width:\s*min\(560px, 100%\)[^}]*max-height:\s*calc\(100dvh/s);
  assert.match(css, /@media \(max-width: 560px\), \(max-height: 620px\)/);
});
