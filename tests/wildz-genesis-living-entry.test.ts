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
  assert.match(css, /\.wildz-genesis\s*\{[^}]*--kai-pulse-duration:\s*5\.236s/s);
  assert.match(css, /animation:\s*wildz-genesis-geometry var\(--kai-pulse-duration\)/);
  assert.match(css, /animation:\s*wildz-genesis-aurora var\(--kai-pulse-duration\)/);
  assert.match(css, /animation:\s*wildz-genesis-halo var\(--kai-pulse-duration\)/);
  assert.match(css, /animation:\s*wildz-genesis-seal var\(--kai-pulse-duration\)/);
  assert.match(css, /animation:\s*wildz-genesis-glint var\(--kai-pulse-duration\)/);
  assert.match(css, /animation-delay:\s*calc\(var\(--kai-pulse-duration\) \* -\.22\)/);
  assert.match(css, /@keyframes wildz-genesis-glint \{ 0%, 43% \{ opacity: 0;/);
  assert.match(css, /@keyframes wildz-genesis-aurora/);
  assert.match(css, /@keyframes wildz-genesis-geometry/);
  assert.match(css, /@keyframes wildz-genesis-halo/);
  assert.match(css, /@keyframes wildz-genesis-seal/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wildz-genesis-powered/s);
  assert.doesNotMatch(css, /wildz-genesis-(?:geometry|aurora|halo|seal|glint) (?:9|10|11|16|18)s/);
  assert.doesNotMatch(css, /\.wildz-genesis[^\n{]*\{[^}]*url\(https?:/s);
});
