import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/auth/wildz/vault-session/route";
import {
  WILDZ_PROOF_SESSION_COOKIE,
  WILDZ_VAULT_PENDING_COOKIE,
  createWildzReceizIdProofSession,
  createWildzVaultProofSession,
  packWildzProofSession,
  packWildzVaultPendingAdmission,
  unpackWildzProofSession
} from "../src/lib/receiz/wildz-proof-session";

const SECRET = "wildz-vault-route-test-secret-at-least-thirty-two-bytes";

function vaultSession(actorId = "bjklock", byteDigest = "b".repeat(64)) {
  return createWildzVaultProofSession({
    actorId,
    profileHandle: `${actorId}.receiz.id`,
    proofBasisSha256: "a".repeat(64),
    byteDigestSha256: byteDigest
  }, SECRET);
}

function request(input: {
  actorId?: string;
  profileHandle?: string;
  pending?: string;
  current?: string;
  origin?: string;
  vaultKeyId?: string;
  requestUrl?: string;
  host?: string;
}) {
  const cookies = [
    input.pending ? `${WILDZ_VAULT_PENDING_COOKIE}=${input.pending}` : "",
    input.current ? `${WILDZ_PROOF_SESSION_COOKIE}=${input.current}` : ""
  ].filter(Boolean).join("; ");
  return new NextRequest(input.requestUrl ?? "https://wildz.quest/api/auth/wildz/vault-session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-wildz-session-intent": "vault-commit",
      origin: input.origin ?? "https://wildz.quest",
      ...(input.host ? { host: input.host } : {}),
      ...(cookies ? { cookie: cookies } : {})
    },
    body: JSON.stringify({
      actorId: input.actorId ?? "bjklock",
      profileHandle: input.profileHandle ?? "bjklock.receiz.id",
      vaultKeyId: input.vaultKeyId ?? vaultSession().keyId
    })
  });
}

test("Vault session exchange issues final authority only after a matching local commit", async () => {
  const prior = process.env.RECEIZ_OAUTH_STATE_SECRET;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  try {
    const pending = vaultSession();
    const response = await POST(request({ pending: packWildzVaultPendingAdmission(pending, SECRET) }));

    assert.equal(response.status, 200);
    assert.equal((await response.json()).authority, "proof-sealed-vault");
    const finalCookie = response.cookies.get(WILDZ_PROOF_SESSION_COOKIE);
    assert.ok(finalCookie?.value);
    assert.equal(unpackWildzProofSession(finalCookie.value, SECRET).subjectKey, pending.subjectKey);
    assert.equal(response.cookies.get(WILDZ_VAULT_PENDING_COOKIE)?.value, "");
  } finally {
    if (prior === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = prior;
  }
});

test("Vault session exchange rejects CSRF, missing proof, and a different committed actor", async () => {
  const prior = process.env.RECEIZ_OAUTH_STATE_SECRET;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  try {
    const pendingToken = packWildzVaultPendingAdmission(vaultSession(), SECRET);
    assert.equal((await POST(request({ pending: pendingToken, origin: "https://attacker.example" }))).status, 403);
    assert.equal((await POST(request({}))).status, 401);
    const mismatch = await POST(request({
      actorId: "other_player",
      profileHandle: "other_player.receiz.id",
      pending: pendingToken
    }));
    assert.equal(mismatch.status, 409);
    assert.equal(mismatch.cookies.get(WILDZ_PROOF_SESSION_COOKIE), undefined);
  } finally {
    if (prior === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = prior;
  }
});

test("Vault session exchange accepts the browser origin represented by the forwarded request host", async () => {
  const prior = process.env.RECEIZ_OAUTH_STATE_SECRET;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  try {
    const pending = vaultSession();
    const response = await POST(request({
      requestUrl: "http://localhost:3001/api/auth/wildz/vault-session",
      origin: "http://127.0.0.1:3001",
      host: "127.0.0.1:3001",
      pending: packWildzVaultPendingAdmission(pending, SECRET)
    }));

    assert.equal(response.status, 200);
    assert.equal((await response.json()).sessionKeyId, pending.keyId);
  } finally {
    if (prior === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = prior;
  }
});

test("a matching canonical Identity session is never downgraded by a Vault exchange", async () => {
  const prior = process.env.RECEIZ_OAUTH_STATE_SECRET;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  try {
    const identity = createWildzReceizIdProofSession({
      keyId: "receiz_identity_key_abcdefgh",
      username: "bjklock",
      displayName: "BJ Klock"
    }, SECRET);
    const pending = vaultSession();
    const response = await POST(request({
      pending: packWildzVaultPendingAdmission(pending, SECRET),
      current: packWildzProofSession(identity, SECRET)
    }));

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.authority, "identity-key");
    const finalCookie = response.cookies.get(WILDZ_PROOF_SESSION_COOKIE);
    assert.ok(finalCookie?.value);
    const upgraded = unpackWildzProofSession(finalCookie.value, SECRET);
    assert.equal(upgraded.keyId, identity.keyId);
    assert.equal(upgraded.vaultCardRootSha256, pending.vaultCardRootSha256);
  } finally {
    if (prior === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = prior;
  }
});

test("a stale final cookie cannot admit a different Vault carrying the same handle", async () => {
  const prior = process.env.RECEIZ_OAUTH_STATE_SECRET;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  try {
    const firstVault = vaultSession("bjklock", "b".repeat(64));
    const secondVault = vaultSession("bjklock", "c".repeat(64));
    assert.notEqual(firstVault.keyId, secondVault.keyId);

    const response = await POST(request({
      current: packWildzProofSession(firstVault, SECRET),
      vaultKeyId: secondVault.keyId
    }));

    assert.equal(response.status, 409);
    assert.equal(response.cookies.get(WILDZ_PROOF_SESSION_COOKIE), undefined);
  } finally {
    if (prior === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = prior;
  }
});
