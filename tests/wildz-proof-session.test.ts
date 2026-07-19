import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildReceizIdContinueRequest,
  createReceizIdIdentity
} from "@receiz/sdk";
import {
  WILDZ_PROOF_SESSION_COOKIE,
  createWildzReceizIdProofSession,
  createWildzVaultProofSession,
  retainWildzVaultCardAdmission,
  packWildzVaultPendingAdmission,
  packWildzProofSession,
  receizIdContinuationNonceMatches,
  unpackWildzVaultPendingAdmission,
  unpackWildzProofSession,
} from "../src/lib/receiz/wildz-proof-session";
import {
  authorizeWildsMultiplayerCard,
  resolveWildsMultiplayerActor
} from "../src/lib/receiz/wilds-multiplayer-server";
import { resolveWildzCookieActor } from "../src/lib/receiz/wildz-cookie-actor";
import { sealCollectedCard } from "../src/features/play/portable-card";
import {
  createWildzVaultCardMembershipProof,
  deriveWildzVaultCardAdmission
} from "../src/lib/receiz/wildz-vault-card-admission";

const SECRET = "wildz-proof-session-test-secret-at-least-thirty-two-bytes";
const NOW = 1_784_172_800_000;

test("Receiz continuation admits only the canonical upstream account username", () => {
  const admitted = createWildzReceizIdProofSession({
    keyId: "receiz_identity_key_12345678",
    username: "canonical_owner",
    displayName: "Canonical Owner",
    issuedAt: NOW
  }, SECRET);

  assert.equal(admitted.actorId, "canonical_owner");
  assert.equal(admitted.profileHandle, "canonical_owner.receiz.id");
  assert.equal(admitted.displayName, "Canonical Owner");
  assert.equal(admitted.authority, "identity-key");
  assert.match(admitted.subjectKey, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(admitted), /email|accessToken|privateKey|localUid/);
});

test("Receiz continuation admits an SDK v104 maximum-length canonical username", () => {
  const username = "a".repeat(30);
  const admitted = createWildzReceizIdProofSession({
    keyId: "receiz_identity_key_maximum_username",
    username,
    displayName: "Maximum Username",
    issuedAt: NOW
  }, SECRET);

  assert.equal(admitted.actorId, username);
  assert.equal(admitted.profileHandle, `${username}.receiz.id`);
  assert.equal(unpackWildzProofSession(packWildzProofSession(admitted, SECRET), SECRET, NOW).actorId, username);
});

test("Receiz continuation rejects a malformed canonical account coordinate", () => {
  assert.throws(() => createWildzReceizIdProofSession({
    keyId: "receiz_identity_key_12345678",
    username: "not a profile coordinate",
    displayName: null,
    issuedAt: NOW
  }, SECRET), /wildz_receiz_id_session_invalid/);
});

test("same-origin admission binds the official SDK continuation to its one-time browser nonce", async () => {
  const identity = await createReceizIdIdentity({
    username: "local_label",
    displayName: "Local Label",
    deviceName: "Wildz test"
  });
  const nonce = "bm9uY2UtZm9yLXdpbGR6LWNvbnRpbnVhdGlvbg";
  const continuation = await buildReceizIdContinueRequest(identity, {
    nonceB64Url: nonce,
    nowMs: NOW
  });

  assert.equal(receizIdContinuationNonceMatches(continuation, nonce), true);
  assert.equal(receizIdContinuationNonceMatches(continuation, `${nonce}x`), false);
  const serialized = JSON.stringify(continuation);
  assert.doesNotMatch(serialized, /privateKey|portableState|@id\.receiz\.local/);
});

test("a fully verified recovery Vault issues the embedded identity session without fabricating a key", () => {
  const vaultCardRootSha256 = `sha256:${"7".repeat(64)}`;
  const session = createWildzVaultProofSession({
    actorId: "bjklock",
    profileHandle: "bjklock.receiz.id",
    proofBasisSha256: "a".repeat(64),
    byteDigestSha256: "b".repeat(64),
    vaultCardRootSha256,
    issuedAt: NOW
  }, SECRET);
  const packed = packWildzProofSession(session, SECRET);
  const restored = unpackWildzProofSession(packed, SECRET, NOW + 1_000);

  assert.equal(restored.actorId, "bjklock");
  assert.equal(restored.profileHandle, "bjklock.receiz.id");
  assert.equal(restored.authority, "proof-sealed-vault");
  assert.equal(restored.vaultCardRootSha256, vaultCardRootSha256);
  assert.match(restored.keyId, /^receiz_vault_[a-f0-9]{32}$/);
  assert.match(restored.subjectKey, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(restored), /privateKey|accessToken|vaultBytes/);
});

test("a Vault proof session resolves as its embedded non-practice Wildz actor", async () => {
  const prior = process.env.RECEIZ_OAUTH_STATE_SECRET;
  const priorFetch = globalThis.fetch;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  globalThis.fetch = async () => Response.json({ preferred_username: "bjklock" });
  try {
    const session = createWildzVaultProofSession({
      actorId: "bjklock",
      profileHandle: "bjklock.receiz.id",
      proofBasisSha256: "e".repeat(64),
      byteDigestSha256: "f".repeat(64),
      vaultCardRootSha256: `sha256:${"6".repeat(64)}`,
      issuedAt: Date.now()
    }, SECRET);
    const token = packWildzProofSession(session, SECRET);
    const actor = await resolveWildsMultiplayerActor({
      cookies: {
        get: (name: string) => name === "wildz_proof_session"
          ? { value: token }
          : name === "receiz_access_token"
            ? { value: "returned-connect-token" }
            : name === "receiz_session_scope"
              ? { value: "wildz.quest:v1" }
              : undefined
      }
    } as never);

    assert.deepEqual(actor, {
      playerId: `vault:${session.subjectKey}`,
      handle: "bjklock.receiz.id",
      receizActorId: "bjklock.receiz.id",
      practice: false,
      accessToken: "returned-connect-token",
      vaultCardRootSha256: session.vaultCardRootSha256
    });
  } finally {
    globalThis.fetch = priorFetch;
    if (prior === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = prior;
  }
});

test("a verified Vault custody commitment authorizes historical-owner cards without weakening direct ownership", () => {
  const handle = "vault_keeper.receiz.id";
  const currentCard = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: handle,
    encounterId: "current-card",
    capturedAt: "2026-07-16T05:00:00.000Z"
  });
  const historicalCard = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "prior_keeper.receiz.id",
    encounterId: "historical-card",
    capturedAt: "2026-07-16T05:01:00.000Z"
  });
  const admission = deriveWildzVaultCardAdmission({ cards: [currentCard, historicalCard], playerHandle: handle });
  const proof = createWildzVaultCardMembershipProof(admission, historicalCard);
  const actor = {
    playerId: "vault:session",
    handle,
    receizActorId: "vault:session",
    practice: false,
    vaultCardRootSha256: admission.root
  };

  assert.equal(authorizeWildsMultiplayerCard(actor, currentCard).assetId, currentCard.id);
  assert.equal(authorizeWildsMultiplayerCard(actor, historicalCard, proof).assetId, historicalCard.id);
  assert.throws(
    () => authorizeWildsMultiplayerCard(actor, historicalCard),
    /wilds_multiplayer_card_owner_invalid/
  );
  assert.throws(
    () => authorizeWildsMultiplayerCard(actor, historicalCard, { ...proof, root: `sha256:${"0".repeat(64)}` }),
    /wilds_multiplayer_card_owner_invalid/
  );
});

test("a matching Identity Seal keeps the server-verified Vault card commitment", () => {
  const identity = createWildzReceizIdProofSession({
    keyId: "receiz_identity_key_vault_upgrade",
    username: "vault_keeper",
    displayName: "Vault Keeper",
    issuedAt: NOW
  }, SECRET);
  const vault = createWildzVaultProofSession({
    actorId: "vault_keeper",
    profileHandle: "vault_keeper.receiz.id",
    proofBasisSha256: "4".repeat(64),
    byteDigestSha256: "5".repeat(64),
    vaultCardRootSha256: `sha256:${"6".repeat(64)}`,
    issuedAt: NOW
  }, SECRET);

  const upgraded = retainWildzVaultCardAdmission(identity, vault);
  assert.equal(upgraded.authority, "identity-key");
  assert.equal(upgraded.keyId, identity.keyId);
  assert.equal(upgraded.vaultCardRootSha256, vault.vaultCardRootSha256);
  assert.equal(unpackWildzProofSession(packWildzProofSession(upgraded, SECRET), SECRET, NOW).vaultCardRootSha256, vault.vaultCardRootSha256);
});

test("a legacy Vault recovery principal cannot claim canonical account-only writes", async () => {
  const prior = process.env.RECEIZ_OAUTH_STATE_SECRET;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  try {
    const session = createWildzVaultProofSession({
      actorId: "bjklock",
      profileHandle: "bjklock.receiz.id",
      proofBasisSha256: "8".repeat(64),
      byteDigestSha256: "9".repeat(64),
      issuedAt: Date.now()
    }, SECRET);
    const token = packWildzProofSession(session, SECRET);
    await assert.rejects(resolveWildzCookieActor({
      cookies: {
        get: (name: string) => name === WILDZ_PROOF_SESSION_COOKIE ? { value: token } : undefined
      }
    } as never), /receiz_identity_key_required/);
  } finally {
    if (prior === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = prior;
  }
});

test("proof session tokens fail closed on tampering and age", () => {
  const session = createWildzVaultProofSession({
    actorId: "bjklock",
    profileHandle: "bjklock.receiz.id",
    proofBasisSha256: "c".repeat(64),
    byteDigestSha256: "d".repeat(64),
    issuedAt: NOW
  }, SECRET);
  const packed = packWildzProofSession(session, SECRET);

  assert.throws(() => unpackWildzProofSession(`${packed.slice(0, -1)}x`, SECRET, NOW + 1_000), /wildz_proof_session_invalid/);
  assert.throws(() => unpackWildzProofSession(packed, SECRET, NOW + 31 * 24 * 60 * 60 * 1_000), /wildz_proof_session_invalid/);
});

test("verified Vault admission stays non-authorizing until the local commit exchanges it", () => {
  const session = createWildzVaultProofSession({
    actorId: "bjklock",
    profileHandle: "bjklock.receiz.id",
    proofBasisSha256: "1".repeat(64),
    byteDigestSha256: "2".repeat(64),
    issuedAt: NOW
  }, SECRET);
  const pending = packWildzVaultPendingAdmission(session, SECRET);

  assert.equal(unpackWildzVaultPendingAdmission(pending, SECRET, NOW + 1_000).actorId, "bjklock");
  assert.throws(() => unpackWildzProofSession(pending, SECRET, NOW + 1_000), /wildz_proof_session_invalid/);
  assert.throws(
    () => unpackWildzVaultPendingAdmission(pending, SECRET, NOW + 6 * 60 * 1_000),
    /wildz_vault_pending_invalid/
  );
});
