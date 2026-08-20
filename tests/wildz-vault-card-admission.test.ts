import assert from "node:assert/strict";
import { test } from "node:test";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import {
  canonicalPortableCardJson,
  sealCollectedCard,
  sha256PortableBasis,
  verifyAnyWildsCard,
  type LegacyPortableCardAsset
} from "../src/features/play/portable-card";

const PLAYER = "current_keeper.receiz.id";
const CAPTURED_AT = "2026-07-16T12:00:00.000Z";

async function admissionUtility() {
  const utility = await import("../src/lib/receiz/wildz-vault-card-admission").catch(() => null);
  assert.ok(utility, "the Vault custody-membership utility must exist");
  return utility;
}

function card(ownerReceizId: string, encounterId: string) {
  return sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId,
    encounterId,
    capturedAt: CAPTURED_AT
  });
}

function withRootDigest(asset: LegacyPortableCardAsset, rootDigest: string) {
  const changed = structuredClone(asset);
  changed.manifest.lineage.rootDigest = rootDigest;
  changed.proof.digest = sha256PortableBasis(canonicalPortableCardJson(changed.manifest));
  assert.equal(verifyAnyWildsCard(changed).ok, true, "control card must remain individually verified");
  return changed;
}

test("Vault admission deterministically commits historical-owner cards and drops duplicate leaves", async () => {
  const { deriveWildzVaultCardAdmission } = await admissionUtility();
  const alpha = card("origin_alpha.receiz.id", "custody-alpha");
  const beta = card("origin_beta.receiz.id", "custody-beta");
  const playerOwned = card(PLAYER, "custody-current");

  const forward = deriveWildzVaultCardAdmission({
    cards: [alpha, playerOwned, beta, structuredClone(alpha)],
    playerHandle: PLAYER
  });
  const reversed = deriveWildzVaultCardAdmission({
    cards: [structuredClone(beta), alpha, playerOwned].reverse(),
    playerHandle: "@CURRENT_KEEPER.RECEIZ.ID"
  });

  assert.equal(forward.root, reversed.root);
  assert.match(forward.root, /^sha256:[a-f0-9]{64}$/);
  assert.equal(forward.playerHandle, PLAYER);
  assert.equal(forward.leafCount, 2);
  assert.deepEqual(
    forward.leaves.map((leaf) => ({ assetId: leaf.assetId, rootDigest: leaf.rootDigest })),
    [alpha, beta]
      .map((asset) => ({ assetId: asset.id, rootDigest: asset.manifest.lineage.rootDigest }))
      .sort((left, right) => left.assetId.localeCompare(right.assetId))
  );
  assert.equal(forward.leaves.some((leaf) => leaf.assetId === playerOwned.id), false);
});

test("one Vault admission retains exact proof-object authority for downstream publication", async () => {
  const utility = await admissionUtility() as Record<string, unknown>;
  const admit = utility.admitWildzVaultProofObjects as ((input: {
    cards: ReturnType<typeof card>[];
    playerHandle: string;
  }) => { admission: { root: string }; proofObjects: unknown }) | undefined;
  const carries = utility.wildzVaultAdmissionCarriesProofObject as ((authority: unknown, asset: ReturnType<typeof card>) => boolean) | undefined;
  assert.equal(typeof admit, "function");
  assert.equal(typeof carries, "function");
  const first = card(PLAYER, "authority-first");
  const second = card("historical.receiz.id", "authority-second");

  const admitted = admit!({ cards: [first, second], playerHandle: PLAYER });

  assert.match(admitted.admission.root, /^sha256:[a-f0-9]{64}$/);
  assert.equal(carries!(admitted.proofObjects, first), true);
  assert.equal(carries!(admitted.proofObjects, second), true);
  assert.equal(carries!(admitted.proofObjects, structuredClone(first)), false);
  assert.equal(carries!({}, first), false);
});

test("a compact proof admits a legitimate later revision of a historical-owner card", async () => {
  const {
    createWildzVaultCardMembershipProof,
    deriveWildzVaultCardAdmission,
    verifyWildzVaultCardMembershipProof
  } = await admissionUtility();
  const historical = card("origin_alpha.receiz.id", "revision-stable-alpha");
  const sibling = card("origin_beta.receiz.id", "revision-stable-beta");
  const admission = deriveWildzVaultCardAdmission({ cards: [historical, sibling], playerHandle: PLAYER });
  const activeRevision = admitLegacyCard(historical, "2026-07-16T12:05:00.000Z");
  const proof = createWildzVaultCardMembershipProof(admission, activeRevision);

  assert.equal(proof.leaf.assetId, activeRevision.id);
  assert.equal(proof.leaf.rootDigest, activeRevision.manifest.lineage.rootDigest);
  assert.equal(JSON.stringify(proof).includes(activeRevision.proof.digest), false);
  assert.equal(proof.path.length, 1);
  assert.equal(verifyWildzVaultCardMembershipProof({
    expectedRoot: admission.root,
    expectedPlayerHandle: PLAYER,
    card: activeRevision,
    proof
  }), true);
});

test("membership verification rejects malformed, tampered, or unrelated proof inputs", async () => {
  const {
    createWildzVaultCardMembershipProof,
    deriveWildzVaultCardAdmission,
    verifyWildzVaultCardMembershipProof
  } = await admissionUtility();
  const historical = card("origin_alpha.receiz.id", "tamper-alpha");
  const sibling = card("origin_beta.receiz.id", "tamper-beta");
  const unrelated = card("origin_gamma.receiz.id", "tamper-unrelated");
  const admission = deriveWildzVaultCardAdmission({ cards: [historical, sibling], playerHandle: PLAYER });
  const proof = createWildzVaultCardMembershipProof(admission, historical);
  const tamperedSibling = {
    ...proof,
    path: proof.path.map((step, index) => index === 0
      ? { ...step, digest: `sha256:${"f".repeat(64)}` }
      : step)
  };

  for (const candidate of [
    null,
    {},
    { ...proof, schema: "receiz.wilds.vault_card_membership.v0" },
    { ...proof, leafIndex: proof.leafCount },
    { ...proof, leafCount: proof.leafCount + 1 },
    { ...proof, path: [{ side: "above", digest: proof.leafDigest }] },
    tamperedSibling
  ]) {
    assert.equal(verifyWildzVaultCardMembershipProof({
      expectedRoot: admission.root,
      expectedPlayerHandle: PLAYER,
      card: historical,
      proof: candidate
    }), false);
  }

  assert.equal(verifyWildzVaultCardMembershipProof({
    expectedRoot: `sha256:${"e".repeat(64)}`,
    expectedPlayerHandle: PLAYER,
    card: historical,
    proof
  }), false);
  assert.equal(verifyWildzVaultCardMembershipProof({
    expectedRoot: admission.root,
    expectedPlayerHandle: PLAYER,
    card: unrelated,
    proof
  }), false);
});

test("conflicting immutable lineage identities fail instead of depending on card order", async () => {
  const { deriveWildzVaultCardAdmission } = await admissionUtility();
  const historical = card("origin_alpha.receiz.id", "lineage-conflict");
  const conflicting = withRootDigest(historical, `sha256:${"f".repeat(64)}`);

  for (const cards of [[historical, conflicting], [conflicting, historical]]) {
    assert.throws(() => deriveWildzVaultCardAdmission({ cards, playerHandle: PLAYER }), /wildz_vault_card_lineage_conflict/);
  }
});

test("a Vault with no historical-owner cards has a deterministic empty commitment and no membership proof", async () => {
  const {
    createWildzVaultCardMembershipProof,
    deriveWildzVaultCardAdmission
  } = await admissionUtility();
  const playerOwned = card(PLAYER, "empty-current");
  const admission = deriveWildzVaultCardAdmission({ cards: [playerOwned], playerHandle: PLAYER });

  assert.equal(admission.leafCount, 0);
  assert.deepEqual(admission.leaves, []);
  assert.match(admission.root, /^sha256:[a-f0-9]{64}$/);
  assert.throws(
    () => createWildzVaultCardMembershipProof(admission, playerOwned),
    /wildz_vault_card_membership_missing/
  );
});

test("verified legacy placeholder owners remain historical custody instead of blocking the whole Vault", async () => {
  const {
    createWildzVaultCardMembershipProof,
    deriveWildzVaultCardAdmission,
    verifyWildzVaultCardMembershipProof
  } = await admissionUtility();
  const legacyPlaceholder = card("wilds.player.receiz.id", "legacy-placeholder-owner");
  const admission = deriveWildzVaultCardAdmission({
    cards: [legacyPlaceholder],
    playerHandle: PLAYER
  });
  const proof = createWildzVaultCardMembershipProof(admission, legacyPlaceholder);

  assert.equal(admission.leafCount, 1);
  assert.equal(verifyWildzVaultCardMembershipProof({
    expectedRoot: admission.root,
    expectedPlayerHandle: PLAYER,
    card: legacyPlaceholder,
    proof
  }), true);
});
