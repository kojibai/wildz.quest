import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("shareable player route opens the profile over the same game shell", () => {
  const source = readFileSync("app/[username]/page.tsx", "utf8");
  assert.match(source, /<WildzApp/);
  assert.match(source, /kind:\s*"profile"/);
  assert.doesNotMatch(source, /marketplace|PublicStorefront/);
});
