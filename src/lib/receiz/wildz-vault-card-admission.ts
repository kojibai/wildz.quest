import {
  canonicalPortableCardJson,
  sha256PortableBasis,
  verifyAnyWildsCard,
  type PortableCardAsset
} from "../../features/play/portable-card";
import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { isAdmittedWildsCard } from "../../features/play/admitted-inventory";

const ADMISSION_SCHEMA = "receiz.wilds.vault_card_admission.v1" as const;
const MEMBERSHIP_SCHEMA = "receiz.wilds.vault_card_membership.v1" as const;
const LEAF_SCHEMA = "receiz.wilds.vault_card_admission_leaf.v1";
const PARENT_SCHEMA = "receiz.wilds.vault_card_admission_parent.v1";
const EMPTY_SCHEMA = "receiz.wilds.vault_card_admission_empty.v1";
const ROOT_SCHEMA = "receiz.wilds.vault_card_admission_root.v1";
const MAX_VAULT_CARDS = 1_000;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const ASSET_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

export type WildzVaultCardLineageIdentity = {
  assetId: string;
  rootDigest: string;
};

export type WildzVaultCardAdmissionLeaf = WildzVaultCardLineageIdentity & {
  digest: string;
};

export type WildzVaultCardAdmission = {
  schema: typeof ADMISSION_SCHEMA;
  playerHandle: string;
  root: string;
  treeRoot: string;
  leafCount: number;
  leaves: WildzVaultCardAdmissionLeaf[];
};

export type WildzAdmittedVaultProofObjects = Readonly<{
  schema: "receiz.wilds.admitted_vault_proof_objects.v1";
  admissionRoot: string;
}>;

const admittedVaultProofObjectSets = new WeakMap<WildzAdmittedVaultProofObjects, WeakSet<PortableCardAsset>>();
let verifierCalls = 0;

export function wildzVaultAdmissionDiagnostics() {
  return Object.freeze({ verifierCalls });
}

export type WildzVaultCardMembershipStep = {
  side: "left" | "right";
  digest: string;
};

export type WildzVaultCardMembershipProof = {
  schema: typeof MEMBERSHIP_SCHEMA;
  playerHandle: string;
  root: string;
  leaf: WildzVaultCardLineageIdentity;
  leafDigest: string;
  leafIndex: number;
  leafCount: number;
  path: WildzVaultCardMembershipStep[];
};

function hash(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function leafDigest(identity: WildzVaultCardLineageIdentity) {
  return hash({ schema: LEAF_SCHEMA, assetId: identity.assetId, rootDigest: identity.rootDigest });
}

function parentDigest(left: string, right: string) {
  return hash({ schema: PARENT_SCHEMA, left, right });
}

function merkleLevels(leaves: readonly string[]) {
  if (!leaves.length) return [];
  const levels: string[][] = [[...leaves]];
  while (levels.at(-1)!.length > 1) {
    const current = levels.at(-1)!;
    const next: string[] = [];
    for (let index = 0; index < current.length; index += 2) {
      next.push(parentDigest(current[index]!, current[index + 1] ?? current[index]!));
    }
    levels.push(next);
  }
  return levels;
}

function treeRoot(leaves: readonly string[]) {
  return merkleLevels(leaves).at(-1)?.[0] ?? hash({ schema: EMPTY_SCHEMA });
}

function admissionRoot(playerHandle: string, leafCount: number, merkleRoot: string) {
  return hash({ schema: ROOT_SCHEMA, playerHandle, leafCount, treeRoot: merkleRoot });
}

function lineageIdentity(card: PortableCardAsset) {
  let verified = { ok: true } as ReturnType<typeof verifyAnyWildsCard>;
  if (!isAdmittedWildsCard(card)) {
    try {
      verifierCalls += 1;
      verified = verifyAnyWildsCard(card);
    } catch {
      throw new Error("wildz_vault_card_invalid");
    }
  }
  const assetId = card?.id;
  const rootDigest = card?.manifest?.lineage?.rootDigest;
  const ownerReceizId = typeof card?.manifest?.ownerReceizId === "string"
    ? card.manifest.ownerReceizId.trim()
    : "";
  if (!verified.ok
    || typeof assetId !== "string"
    || !ASSET_ID.test(assetId)
    || typeof rootDigest !== "string"
    || !SHA256.test(rootDigest)
    || !ownerReceizId
    || ownerReceizId.length > 200
    || /[\u0000-\u001f\u007f]/.test(ownerReceizId)) {
    throw new Error("wildz_vault_card_invalid");
  }
  return {
    identity: { assetId, rootDigest },
    ownerReceizId
  };
}

function compareIdentity(left: WildzVaultCardLineageIdentity, right: WildzVaultCardLineageIdentity) {
  return left.assetId.localeCompare(right.assetId) || left.rootDigest.localeCompare(right.rootDigest);
}

export function deriveWildzVaultCardAdmission(input: {
  cards: readonly PortableCardAsset[];
  playerHandle: string;
}): WildzVaultCardAdmission {
  const player = parseWildzPlayerCoordinate(input.playerHandle);
  if (!player) throw new Error("wildz_vault_card_player_invalid");
  if (!Array.isArray(input.cards) || input.cards.length > MAX_VAULT_CARDS) {
    throw new Error("wildz_vault_card_admission_invalid");
  }

  const immutableByAssetId = new Map<string, { identity: WildzVaultCardLineageIdentity; ownerReceizId: string }>();
  for (const card of input.cards) {
    const immutable = lineageIdentity(card);
    const prior = immutableByAssetId.get(immutable.identity.assetId);
    if (prior
      && (prior.identity.rootDigest !== immutable.identity.rootDigest
        || prior.ownerReceizId !== immutable.ownerReceizId)) {
      throw new Error("wildz_vault_card_lineage_conflict");
    }
    if (!prior) immutableByAssetId.set(immutable.identity.assetId, immutable);
  }

  const leaves = [...immutableByAssetId.values()]
    .filter((value) => !sameWildzPlayerCoordinate(value.ownerReceizId, player.profileHandle))
    .map(({ identity }) => ({ ...identity, digest: leafDigest(identity) }))
    .sort(compareIdentity);
  const merkleRoot = treeRoot(leaves.map((leaf) => leaf.digest));
  return {
    schema: ADMISSION_SCHEMA,
    playerHandle: player.profileHandle,
    root: admissionRoot(player.profileHandle, leaves.length, merkleRoot),
    treeRoot: merkleRoot,
    leafCount: leaves.length,
    leaves
  };
}

export function admitWildzVaultProofObjects(input: {
  cards: readonly PortableCardAsset[];
  playerHandle: string;
}) {
  const admission = deriveWildzVaultCardAdmission(input);
  const proofObjects = Object.freeze({
    schema: "receiz.wilds.admitted_vault_proof_objects.v1" as const,
    admissionRoot: admission.root
  });
  admittedVaultProofObjectSets.set(proofObjects, new WeakSet(input.cards));
  return { admission, proofObjects };
}

export function wildzVaultAdmissionCarriesProofObject(
  proofObjects: unknown,
  asset: PortableCardAsset
) {
  return Boolean(
    proofObjects
    && typeof proofObjects === "object"
    && admittedVaultProofObjectSets.get(proofObjects as WildzAdmittedVaultProofObjects)?.has(asset)
  );
}

function assertAdmission(value: WildzVaultCardAdmission) {
  const player = parseWildzPlayerCoordinate(value?.playerHandle ?? "");
  if (!player
    || player.profileHandle !== value.playerHandle
    || value.schema !== ADMISSION_SCHEMA
    || !Number.isSafeInteger(value.leafCount)
    || value.leafCount < 0
    || value.leafCount > MAX_VAULT_CARDS
    || !Array.isArray(value.leaves)
    || value.leafCount !== value.leaves.length
    || !SHA256.test(value.treeRoot)
    || !SHA256.test(value.root)) {
    throw new Error("wildz_vault_card_admission_invalid");
  }
  let previous: WildzVaultCardAdmissionLeaf | null = null;
  for (const leaf of value.leaves) {
    if (!ASSET_ID.test(leaf.assetId)
      || !SHA256.test(leaf.rootDigest)
      || leaf.digest !== leafDigest(leaf)
      || (previous !== null && compareIdentity(previous, leaf) >= 0)) {
      throw new Error("wildz_vault_card_admission_invalid");
    }
    previous = leaf;
  }
  const recomputedTreeRoot = treeRoot(value.leaves.map((leaf) => leaf.digest));
  if (recomputedTreeRoot !== value.treeRoot
    || admissionRoot(value.playerHandle, value.leafCount, value.treeRoot) !== value.root) {
    throw new Error("wildz_vault_card_admission_invalid");
  }
  return player;
}

export function createWildzVaultCardMembershipProof(
  admission: WildzVaultCardAdmission,
  activeCard: PortableCardAsset
): WildzVaultCardMembershipProof {
  const player = assertAdmission(admission);
  const active = lineageIdentity(activeCard);
  if (sameWildzPlayerCoordinate(active.ownerReceizId, player.profileHandle)) {
    throw new Error("wildz_vault_card_membership_missing");
  }
  const leafIndex = admission.leaves.findIndex((leaf) => (
    leaf.assetId === active.identity.assetId && leaf.rootDigest === active.identity.rootDigest
  ));
  if (leafIndex < 0) throw new Error("wildz_vault_card_membership_missing");

  const levels = merkleLevels(admission.leaves.map((leaf) => leaf.digest));
  const path: WildzVaultCardMembershipStep[] = [];
  let index = leafIndex;
  for (let level = 0; level < levels.length - 1; level += 1) {
    const values = levels[level]!;
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    path.push({
      side: index % 2 === 0 ? "right" : "left",
      digest: values[siblingIndex] ?? values[index]!
    });
    index = Math.floor(index / 2);
  }
  const leaf = admission.leaves[leafIndex]!;
  return {
    schema: MEMBERSHIP_SCHEMA,
    playerHandle: admission.playerHandle,
    root: admission.root,
    leaf: { assetId: leaf.assetId, rootDigest: leaf.rootDigest },
    leafDigest: leaf.digest,
    leafIndex,
    leafCount: admission.leafCount,
    path
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function pathDepth(leafCount: number) {
  let depth = 0;
  for (let width = leafCount; width > 1; width = Math.ceil(width / 2)) depth += 1;
  return depth;
}

export function verifyWildzVaultCardMembershipProof(input: {
  expectedRoot: string;
  expectedPlayerHandle: string;
  card: PortableCardAsset;
  proof: unknown;
}) {
  try {
    const player = parseWildzPlayerCoordinate(input.expectedPlayerHandle);
    const proof = asRecord(input.proof);
    const leaf = asRecord(proof?.leaf);
    const path = proof?.path;
    if (!player
      || !SHA256.test(input.expectedRoot)
      || !proof
      || proof.schema !== MEMBERSHIP_SCHEMA
      || proof.playerHandle !== player.profileHandle
      || proof.root !== input.expectedRoot
      || !leaf
      || typeof leaf.assetId !== "string"
      || typeof leaf.rootDigest !== "string"
      || typeof proof.leafDigest !== "string"
      || !Number.isSafeInteger(proof.leafIndex)
      || !Number.isSafeInteger(proof.leafCount)
      || Number(proof.leafIndex) < 0
      || Number(proof.leafCount) < 1
      || Number(proof.leafCount) > MAX_VAULT_CARDS
      || Number(proof.leafIndex) >= Number(proof.leafCount)
      || !Array.isArray(path)
      || path.length !== pathDepth(Number(proof.leafCount))) {
      return false;
    }

    const active = lineageIdentity(input.card);
    if (sameWildzPlayerCoordinate(active.ownerReceizId, player.profileHandle)
      || leaf.assetId !== active.identity.assetId
      || leaf.rootDigest !== active.identity.rootDigest
      || !ASSET_ID.test(leaf.assetId)
      || !SHA256.test(leaf.rootDigest)) {
      return false;
    }
    const expectedLeafDigest = leafDigest(active.identity);
    if (proof.leafDigest !== expectedLeafDigest) return false;

    let current = expectedLeafDigest;
    let index = Number(proof.leafIndex);
    let width = Number(proof.leafCount);
    for (const rawStep of path) {
      const step = asRecord(rawStep);
      const expectedSide = index % 2 === 0 ? "right" : "left";
      if (!step
        || step.side !== expectedSide
        || typeof step.digest !== "string"
        || !SHA256.test(step.digest)
        || (expectedSide === "right" && index + 1 >= width && step.digest !== current)) {
        return false;
      }
      current = expectedSide === "left"
        ? parentDigest(step.digest, current)
        : parentDigest(current, step.digest);
      index = Math.floor(index / 2);
      width = Math.ceil(width / 2);
    }
    return index === 0
      && width === 1
      && admissionRoot(player.profileHandle, Number(proof.leafCount), current) === input.expectedRoot;
  } catch {
    return false;
  }
}
