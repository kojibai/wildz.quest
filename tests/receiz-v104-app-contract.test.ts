import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const expectedFeatures = [
  "identity",
  "proof",
  "proofMemory",
  "publicStore",
  "commerce"
] as const;

describe("Receiz v104 application contract", () => {
  it("compiles the truthful Wildz artifact-first contract through SDK v104", async () => {
    const sdk = await import("@receiz/sdk");
    assert.equal(sdk.RECEIZ_SDK_VERSION, "104.0.0");
    assert.equal(typeof sdk.defineReceizApp, "function");
    assert.equal(typeof sdk.compileReceizAppContract, "function");

    const input = JSON.parse(readFileSync("receiz.app.json", "utf8"));
    const contract = sdk.defineReceizApp(input);
    const plan = sdk.compileReceizAppContract(contract, { targetSdkVersion: "104.0.0" });

    assert.equal(plan.targetSdkVersion, "104.0.0");
    assert.deepEqual(contract.features, expectedFeatures);
    assert.equal(contract.authority.mode, "artifact-first");
    assert.equal(contract.authority.allowDatabaseAuthority, false);
    assert.equal(plan.authority.proofCreation, "authenticated-native-record-before-seal");
    assert.equal(plan.authority.databaseAuthority, false);
    assert.ok(plan.verificationCommands.length > 0);
  });

  it("passes the v104 repository integration checker with evidence-backed rails", async () => {
    const sdk = await import("@receiz/sdk");
    const generated = JSON.parse(readFileSync("receiz.generated.json", "utf8"));
    const contract = sdk.defineReceizApp(JSON.parse(readFileSync("receiz.app.json", "utf8")));
    const generatedFile = sdk.generateNextjsAppRouterFiles(contract)
      .find((file) => file.path === "receiz.generated.json");

    assert.equal(generated.adapterCreated, true);
    assert.equal(generated.recordBeforeSeal, true);
    assert.equal(generated.proofMemoryPersistence, "durable");
    assert.equal(generated.webhookVerification, false);
    assert.equal(generated.continuityVerification, true);
    assert.equal(generated.idempotency, true);
    assert.equal(generated.serverSecretsBrowserSafe, true);
    assert.ok(generatedFile);
    assert.deepEqual(generated, JSON.parse(generatedFile.content));

    const result = await sdk.checkReceizIntegration({
      root: process.cwd(),
      targetSdkVersion: "104.0.0"
    });
    assert.deepEqual(result.blockingFindings, []);
    assert.equal(result.ok, true);
  });

  it("enforces the v104 checker and browser compiler guard in release configuration", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const releaseCheck = readFileSync("scripts/release-check.mjs", "utf8");
    const nextConfig = readFileSync("next.config.mjs", "utf8");

    assert.equal(pkg.scripts?.["receiz:check"], "receiz app check --target 104.0.0 --json");
    assert.match(releaseCheck, /["']receiz:check["']/);
    assert.match(nextConfig, /NormalModuleReplacementPlugin/);
    for (const moduleName of ["assert", "crypto", "fs", "path", "test"]) {
      assert.match(nextConfig, new RegExp(`${moduleName.replace("/", "\\/")}\\s*:\\s*false`));
    }
  });
});
