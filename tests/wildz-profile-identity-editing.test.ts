import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("profile username saves through signed Receiz continuation and canonical alignment", () => {
  const adapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");
  const route = readFileSync("app/api/auth/wildz/session/route.ts", "utf8");
  assert.match(adapter, /claimWildzProfileIdentity/);
  assert.match(adapter, /buildReceizIdContinueRequest/);
  assert.match(adapter, /alignWildzContinuityWithProofSession/);
  assert.match(adapter, /wildz_username_taken/);
  assert.match(route, /status:\s*"conflict"/);
  assert.match(route, /upstream\.status === 409/);
});

test("profile edit never replaces the existing Receiz key", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  assert.doesNotMatch(shell, /createNamedWildzIdentity/);
  assert.match(shell, /claimWildzProfileIdentity/);
});
