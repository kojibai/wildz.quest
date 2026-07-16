import assert from "node:assert/strict";
import { test } from "node:test";
import type { DocumentVerifyResponse } from "@receiz/sdk";
import { POST } from "../app/api/document-verify/route";
import { embedPortableVaultInPng } from "../src/features/play/card-export";
import { applyWildsInput, initialPlayState, type PlayState } from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import {
  WILDZ_VAULT_PENDING_COOKIE,
  unpackWildzVaultPendingAdmission
} from "../src/lib/receiz/wildz-proof-session";

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));

const verification: DocumentVerifyResponse = {
  ok: true,
  kind: "png",
  errors: [],
  warnings: [],
  bundle: {
    artifactSha256Basis: "c".repeat(64),
    signatureV4: {
      version: 1,
      alg: "Ed25519",
      cert: {
        version: 1,
        certType: "receiz.device.v1",
        certId: "document-route-device-cert",
        issuerKid: "document-route-issuer",
        alg: "Ed25519",
        subjectPublicKeyRawB64u: "A".repeat(43),
        issuedAtMs: 1_752_000_000_000,
        expiresAtMs: 1_783_536_000_000,
        sig: "A".repeat(86)
      },
      sig: "B".repeat(86),
      payloadHashSha256: "a".repeat(64),
      signedAtMs: 1_752_000_000_100
    }
  },
  assetContinuity: {
    state: "verified",
    carrier: "ownership_provenance",
    artifactId: "document-route-vault",
    headReference: "document-route-head",
    issuerKid: "document-route-issuer",
    namespace: "receiz.wildz.vault:vault_keeper",
    ownerReceizId: "vault_keeper.receiz.id",
    priorHeadReference: "genesis"
  }
};

function verifiedPlayerVault() {
  const asset = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "vault_keeper",
    encounterId: "document-route-vault",
    capturedAt: "2026-07-16T05:00:00.000Z"
  });
  const historicalAsset = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "prior_keeper.receiz.id",
    encounterId: "document-route-historical-vault",
    capturedAt: "2026-07-16T05:01:00.000Z"
  });
  const empty: PlayState = {
    ...structuredClone(initialPlayState),
    inventory: [],
    discoveredCardIds: [],
    pendingSyncAssetIds: [],
    companionProgress: {},
    livingProgress: {},
    selectedAssetId: "",
    selectedCardId: ""
  };
  const playState = applyWildsInput(
    applyWildsInput(empty, { type: "import-card", asset }),
    { type: "import-card", asset: historicalAsset }
  );
  const player = createWildsPlayerVault({
    playerId: "vault_keeper.receiz.id",
    exportedAt: "2026-07-16T05:00:00.000Z",
    playState,
    settings: { avatarStyle: "female", movementMode: "walk", audio: {} },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 1, eventId: null },
    receipts: []
  });
  return embedPortableVaultInPng(BASE_PNG, player.playState.inventory, player);
}

function request(bytes: Uint8Array, login: boolean) {
  const form = new FormData();
  form.set("file", new Blob([bytes.slice().buffer], { type: "image/png" }), "vault.receized.png");
  return new Request("https://wildz.quest/api/document-verify", {
    method: "POST",
    headers: login ? { "x-wildz-proof-login": "vault" } : undefined,
    body: form
  });
}

test("Vault login verification fails closed when pending admission cannot be issued", async () => {
  const priorStateSecret = process.env.RECEIZ_OAUTH_STATE_SECRET;
  const priorClientSecret = process.env.RECEIZ_CLIENT_SECRET;
  const priorFetch = globalThis.fetch;
  delete process.env.RECEIZ_OAUTH_STATE_SECRET;
  delete process.env.RECEIZ_CLIENT_SECRET;
  globalThis.fetch = async () => Response.json(verification);
  try {
    const bytes = verifiedPlayerVault();

    const loginResponse = await POST(request(bytes, true));
    assert.equal(loginResponse.status, 503);
    assert.deepEqual(await loginResponse.json(), {
      ...verification,
      ok: false,
      errors: ["wildz_vault_login_session_unavailable"]
    });

    const ordinaryResponse = await POST(request(bytes, false));
    assert.equal(ordinaryResponse.status, 200);
    assert.deepEqual(await ordinaryResponse.json(), verification);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorStateSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = priorStateSecret;
    if (priorClientSecret === undefined) delete process.env.RECEIZ_CLIENT_SECRET;
    else process.env.RECEIZ_CLIENT_SECRET = priorClientSecret;
  }
});

test("Vault login binds historical-card custody to the encrypted pending session", async () => {
  const secret = "document-route-vault-session-secret-at-least-thirty-two-bytes";
  const priorStateSecret = process.env.RECEIZ_OAUTH_STATE_SECRET;
  const priorFetch = globalThis.fetch;
  process.env.RECEIZ_OAUTH_STATE_SECRET = secret;
  globalThis.fetch = async () => Response.json(verification);
  try {
    const bytes = verifiedPlayerVault();
    const response = await POST(request(bytes, true));
    assert.equal(response.status, 200);
    const token = response.cookies.get(WILDZ_VAULT_PENDING_COOKIE)?.value;
    assert.ok(token);
    const pending = unpackWildzVaultPendingAdmission(token, secret);
    assert.match(pending.vaultCardRootSha256 ?? "", /^sha256:[a-f0-9]{64}$/);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorStateSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = priorStateSecret;
  }
});
