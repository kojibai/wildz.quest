import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("the shared restore adapter keeps Vault merge separate from Profile identity activation", () => {
  const adapter = read("src/lib/receiz/wildz-identity-adapter.ts");

  assert.match(adapter, /createWildzVaultLoginCoordinator/);
  assert.match(adapter, /createWildzPendingVaultRepository/);
  assert.match(adapter, /verifier:\s*\{[\s\S]*openArtifact:\s*openWildzArtifactSameOrigin[\s\S]*\}/);
  assert.doesNotMatch(adapter, /receizCommerceAdapter\.verifyArtifact/);
  assert.match(adapter, /WildzRestoreIntent = "merge-vault" \| "activate-identity"/);
  assert.match(adapter, /preserveActiveIdentity: true/);
  assert.match(adapter, /carryCurrentVault: true/);
  assert.doesNotMatch(adapter, /defaultVaultLoginCoordinator\.begin/);
  assert.match(adapter, /resumePendingWildzVault/);
  assert.doesNotMatch(adapter, /WildzVaultLoginRedirectError|\/api\/auth\/receiz\/start/);
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

test("bootstrap never revalidates proof-native identity or Vault authority through OAuth", () => {
  const adapter = read("src/lib/receiz/wildz-identity-adapter.ts");
  const bootstrapStart = adapter.indexOf("export async function bootstrapWildzContinuity");
  const ownerState = adapter.indexOf("loadWildzRestoredOwnerState", bootstrapStart);
  const reconciliation = adapter.slice(bootstrapStart, ownerState);

  assert.ok(bootstrapStart >= 0 && ownerState > bootstrapStart);
  assert.match(reconciliation, /session\.localAuthority === "remote-only"/);
  assert.match(reconciliation, /wildzRemoteSessionBridge\.current\(\)/);
  assert.doesNotMatch(reconciliation, /session\.localAuthority !== "remote-only"[\s\S]*wildzRemoteSessionBridge\.current/);
  assert.match(reconciliation, /defaultIdentityRepository\.writeSession\(tx, session, true\)/);
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
  assert.doesNotMatch(shell, /window\.location\.assign|\/api\/auth\/receiz\/start/);
  assert.match(shell, /shouldClearWildzResumeAfterError/);
  assert.doesNotMatch(shell, /Retry Vault restore|Sign in as Vault owner/);
});

test("proof-sealed Vault login is app session authority and never fabricates an exportable key", () => {
  const coordinator = read("src/lib/receiz/wildz-vault-login-coordinator.ts");

  assert.match(coordinator, /localAuthority: "proof-sealed-vault"/);
  assert.match(coordinator, /portableStateStatus: "missing"/);
  assert.match(coordinator, /writeSession\(tx, session, true\)/);
  assert.doesNotMatch(coordinator, /receiz_login_required|receiz_account_mismatch|\/api\/auth\/receiz\/start/);
  assert.doesNotMatch(coordinator, /createReceizIdIdentity|createReceizIdentityKeyFile|privateKey/);
});
