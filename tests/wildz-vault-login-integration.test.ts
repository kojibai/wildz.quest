import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("the shared restore adapter routes V3 player Vaults through proof-sealed Receiz login", () => {
  const adapter = read("src/lib/receiz/wildz-identity-adapter.ts");

  assert.match(adapter, /createWildzVaultLoginCoordinator/);
  assert.match(adapter, /createWildzPendingVaultRepository/);
  assert.match(adapter, /receizCommerceAdapter\.verifyArtifact/);
  assert.match(adapter, /defaultVaultLoginCoordinator\.begin/);
  assert.match(adapter, /status !== "not_player_vault"/);
  assert.match(adapter, /resumePendingWildzVault/);
  assert.match(adapter, /WildzVaultLoginRedirectError/);
});

test("bootstrap best-effort purges expired staged Vault bytes before identity recovery", () => {
  const adapter = read("src/lib/receiz/wildz-identity-adapter.ts");
  const bootstrapStart = adapter.indexOf("export async function bootstrapWildzContinuity");
  const purge = adapter.indexOf("defaultPendingVaultRepository.purgeExpired()", bootstrapStart);
  const identityBootstrap = adapter.indexOf("defaultIdentityRepository.bootstrap", bootstrapStart);

  assert.ok(bootstrapStart >= 0);
  assert.ok(purge > bootstrapStart && purge < identityBootstrap);
  assert.match(adapter.slice(purge, identityBootstrap), /catch/);
});

test("resume best-effort purges other expired staged Vault bytes before admission", () => {
  const adapter = read("src/lib/receiz/wildz-identity-adapter.ts");
  const resumeStart = adapter.indexOf("export function resumePendingWildzVault");
  const purge = adapter.indexOf("defaultPendingVaultRepository.purgeExpired()", resumeStart);
  const resume = adapter.indexOf("defaultVaultLoginCoordinator.resume", resumeStart);

  assert.ok(resumeStart >= 0);
  assert.ok(purge > resumeStart && purge < resume);
  assert.match(adapter.slice(purge, resume), /catch/);
});

test("the app resumes a staged Vault before automatic identity bootstrap and removes auth query keys", () => {
  const shell = read("src/features/shell/WildzApp.tsx");

  assert.match(shell, /searchParams\.get\("wildzResume"\)/);
  assert.match(shell, /resumePendingWildzVault/);
  assert.ok(shell.indexOf("resumePendingWildzVault") < shell.indexOf("bootstrapWildzContinuity(window.localStorage)"));
  assert.match(shell, /history\.replaceState/);
  assert.match(shell, /searchParams\.delete\("wildzResume"\)/);
  assert.match(shell, /window\.location\.assign\(cause\.loginUrl\)/);
  assert.match(shell, /shouldClearWildzResumeAfterError/);
  assert.match(shell, /Retry Vault restore/);
});

test("remote Receiz login is public session authority and never fabricates an exportable key", () => {
  const coordinator = read("src/lib/receiz/wildz-vault-login-coordinator.ts");

  assert.match(coordinator, /localAuthority: "remote-only"/);
  assert.match(coordinator, /portableStateStatus: "missing"/);
  assert.match(coordinator, /writeSession\(tx, session, true\)/);
  assert.doesNotMatch(coordinator, /createReceizIdIdentity|createReceizIdentityKeyFile|privateKey/);
});
