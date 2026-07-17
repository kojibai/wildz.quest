import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Genesis atmosphere stays lightweight, two-line, and motion-safe", () => {
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(css, /\.wildz-genesis-brand\s*\{[^}]*width:\s*min\(100%,\s*940px\)/s);
  assert.match(css, /\.wildz-genesis-copy\s*\{[^}]*gap:\s*6px/s);
  assert.match(css, /\.wildz-genesis-tagline\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.wildz-genesis-subtext\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.wildz-genesis-powered\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.wildz-genesis-powered\s*\{[^}]*margin-top:\s*clamp\(18px,\s*3vh,\s*28px\)/s);
  assert.match(css, /\.wildz-genesis-powered img\s*\{[^}]*width:\s*96px;[^}]*height:\s*26px/s);
  assert.match(css, /\.wildz-genesis-powered:focus-visible/);
  assert.match(css, /@keyframes wildz-genesis-aurora/);
  assert.match(css, /@keyframes wildz-genesis-geometry/);
  assert.match(css, /@keyframes wildz-genesis-halo/);
  assert.match(css, /@keyframes wildz-genesis-seal/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wildz-genesis-powered/s);
  assert.doesNotMatch(css, /\.wildz-genesis[^\n{]*\{[^}]*url\(https?:/s);
});
