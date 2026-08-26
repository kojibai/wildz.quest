import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import {
  createReceizIdIdentity,
  projectReceizIdentityAccount,
  readReceizIdentityArtifact,
  type ReceizDeviceIdentity,
  type ReceizKeyFile
} from "@receiz/sdk";
import {
  createWildzIdentityPlayerCard,
  downloadWildzIdentitySeal
} from "../src/lib/receiz/wildz-identity-adapter";
import { createWildzIdentitySealPng } from "../src/lib/receiz/wildz-identity-seal";
import { splitWildzPngEnvelope } from "../src/lib/receiz/wildz-png-envelope";
import {
  readPortableVaultFromPng,
  readWildzPlayerVaultAppendFromPng,
  verifyPortableVaultPng
} from "../src/features/play/card-export";
import {
  applyWildsInput,
  createOwnerBoundInitialPlayState
} from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import {
  canonicalWildzActorId,
  type WildzIdentityRepository,
  type WildzIdentitySession
} from "../src/lib/receiz/wildz-identity-repository";

async function sessionFromIdentity(identity: ReceizDeviceIdentity): Promise<WildzIdentitySession> {
  const projection = await projectReceizIdentityAccount(identity.keyFile);
  return {
    schema: "receiz.wildz.identity_session.v1",
    keyId: projection.keyId,
    actorId: canonicalWildzActorId(projection),
    username: projection.owner.username,
    displayName: projection.owner.displayName,
    portableStateStatus: projection.portableStateStatus,
    localAuthority: "verified",
    remoteStatus: "unknown"
  };
}

test("Identity Seal PNG round-trips through the official SDK", async () => {
  const identity = await createReceizIdIdentity({ username: "seal.test", displayName: "Seal Test" });
  const session = await sessionFromIdentity(identity);
  const png = await createWildzIdentitySealPng(identity.keyFile, session);
  const restored = await readReceizIdentityArtifact(png);
  const projection = await projectReceizIdentityAccount(restored);
  const decoded = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(decoded.info.width, 900);
  assert.equal(decoded.info.height, 900);
  assert.equal(decoded.data.byteLength, 900 * 900 * decoded.info.channels);
  assert.equal(restored.keyId, identity.keyFile.keyId);
  assert.notEqual(projection.portableStateStatus, "invalid");
});

test("saving an Identity Seal after Vault imports carries complete game state and every newly added card", async () => {
  const identity = await createReceizIdIdentity({ username: "card_keeper", displayName: "Card Keeper" });
  const session = await sessionFromIdentity(identity);
  const assets = [0, 1].map((index) => sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "card_keeper",
    encounterId: `identity-card-${index}`,
    capturedAt: `2026-07-16T18:0${index}:00.000Z`
  }));
  const playState = assets.reduce(
    (state, asset) => applyWildsInput(state, { type: "import-card", asset }),
    createOwnerBoundInitialPlayState("card_keeper")
  );
  const player = createWildsPlayerVault({
    playerId: "card_keeper",
    exportedAt: "2026-07-16T18:10:00.000Z",
    playState,
    settings: { avatarStyle: "female", movementMode: "walk", audio: {}, cardOrder: "rarity" },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  });
  const cardBytes = await createWildzIdentityPlayerCard({
    keyFile: identity.keyFile,
    session,
    assets,
    player
  });
  const restoredIdentity = await readReceizIdentityArtifact(cardBytes);
  const account = await projectReceizIdentityAccount(restoredIdentity);
  const { pngBasis } = splitWildzPngEnvelope(cardBytes);
  const proof = readPortableVaultFromPng(pngBasis);
  const playerAppend = readWildzPlayerVaultAppendFromPng(pngBasis);
  const verified = verifyPortableVaultPng(pngBasis);

  assert.equal(restoredIdentity.keyId, identity.keyFile.keyId);
  assert.equal(account.owner.username, "card_keeper");
  assert.equal(account.portableStateStatus, "verified");
  assert.equal(proof.schema, "receiz.wilds_vault_png_proof.v2");
  assert.deepEqual(proof.assets.map((asset) => asset.id).sort(), assets.map((asset) => asset.id).sort());
  assert.equal(playerAppend.base.vaultDigest, proof.vaultDigest);
  assert.equal(playerAppend.player.playerId, "card_keeper");
  assert.deepEqual(
    playerAppend.player.playState.inventory.map((asset) => asset.id).sort(),
    playState.inventory.map((asset) => asset.id).sort()
  );
  assert.equal(playerAppend.player.playState.selectedAssetId, playState.selectedAssetId);
  assert.deepEqual(playerAppend.player.playState.explorationAtlas, playState.explorationAtlas);
  assert.equal(playerAppend.player.payloadDigest, player.payloadDigest);
  assert.equal(verified.ok, true);
  assert.equal(verified.player, null);
});

test("Identity Seal download uses protected authority and a normalized PNG filename", async () => {
  const identity = await createReceizIdIdentity({ username: "seal_download", displayName: "Seal Download" });
  const session = await sessionFromIdentity(identity);
  let requestedKeyId: string | null = null;
  const repository = {
    async withKeyFile<T>(keyId: string, operation: (keyFile: ReceizKeyFile) => Promise<T>) {
      requestedKeyId = keyId;
      return operation(identity.keyFile);
    }
  } as WildzIdentityRepository;
  const anchor = {
    download: "",
    href: "",
    rel: "",
    clicked: false,
    removed: false,
    click() { this.clicked = true; },
    remove() { this.removed = true; }
  };
  let appended = false;
  const download = { blob: null as Blob | null };
  let revokedUrl: string | null = null;
  const sourcePng = Uint8Array.from(Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  ));
  const canvasContext = {
    beginPath() {},
    closePath() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    fill() {},
    fillRect() {},
    fillText() {},
    lineCap: "butt",
    lineJoin: "miter",
    lineTo() {},
    lineWidth: 1,
    moveTo() {},
    quadraticCurveTo() {},
    stroke() {},
    strokeStyle: "",
    fillStyle: "",
    font: "",
    textAlign: "start"
  };
  const canvas = {
    height: 0,
    width: 0,
    getContext: () => canvasContext,
    toBlob: (callback: BlobCallback) => callback(new Blob([sourcePng.buffer], { type: "image/png" }))
  };
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const createObjectUrl = URL.createObjectURL;
  const revokeObjectUrl = URL.revokeObjectURL;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: { append: () => { appended = true; } },
      createElement: (tagName: string) => tagName === "canvas" ? canvas : anchor
    } as unknown as Document
  });
  URL.createObjectURL = ((blob: Blob) => {
    download.blob = blob;
    return "blob:wildz-identity-seal";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (url: string) => { revokedUrl = url; };

  try {
    await downloadWildzIdentitySeal(repository, session);
  } finally {
    URL.createObjectURL = createObjectUrl;
    URL.revokeObjectURL = revokeObjectUrl;
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else delete (globalThis as { document?: Document }).document;
  }

  assert.equal(requestedKeyId, identity.keyFile.keyId);
  assert.equal(download.blob?.type, "image/png");
  assert.equal(anchor.download, "seal_download.receiz-identity-seal.png");
  assert.equal(anchor.href, "blob:wildz-identity-seal");
  assert.equal(anchor.rel, "noopener");
  assert.equal(appended, true);
  assert.equal(anchor.clicked, true);
  assert.equal(anchor.removed, true);
  assert.equal(revokedUrl, "blob:wildz-identity-seal");
});

test("Identity Seal download rejects an invalid username before opening authority", async () => {
  const identity = await createReceizIdIdentity({ username: "seal.safe", displayName: "Seal Safe" });
  const session = { ...await sessionFromIdentity(identity), username: "../unsafe" };
  let authorityOpened = false;
  const repository = {
    async withKeyFile<T>(_keyId: string, operation: (keyFile: ReceizKeyFile) => Promise<T>) {
      authorityOpened = true;
      return operation(identity.keyFile);
    }
  } as WildzIdentityRepository;

  await assert.rejects(
    downloadWildzIdentitySeal(repository, session),
    /wildz_identity_seal_username_invalid/
  );
  assert.equal(authorityOpened, false);
});

test("Identity Seal download revokes its object URL when DOM setup throws", async () => {
  const identity = await createReceizIdIdentity({ username: "seal_cleanup", displayName: "Seal Cleanup" });
  const session = await sessionFromIdentity(identity);
  const repository = {
    async withKeyFile<T>(_keyId: string, operation: (keyFile: ReceizKeyFile) => Promise<T>) {
      return operation(identity.keyFile);
    }
  } as WildzIdentityRepository;
  const sourcePng = Uint8Array.from(Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  ));
  const canvasContext = {
    beginPath() {},
    closePath() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    fill() {},
    fillRect() {},
    fillText() {},
    lineCap: "butt",
    lineJoin: "miter",
    lineTo() {},
    lineWidth: 1,
    moveTo() {},
    quadraticCurveTo() {},
    stroke() {},
    strokeStyle: "",
    fillStyle: "",
    font: "",
    textAlign: "start"
  };
  const canvas = {
    height: 0,
    width: 0,
    getContext: () => canvasContext,
    toBlob: (callback: BlobCallback) => callback(new Blob([sourcePng.buffer], { type: "image/png" }))
  };
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const createObjectUrl = URL.createObjectURL;
  const revokeObjectUrl = URL.revokeObjectURL;
  let revokedUrl: string | null = null;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: { append() {} },
      createElement: (tagName: string) => {
        if (tagName === "canvas") return canvas;
        throw new Error("wildz_test_dom_setup_failed");
      }
    } as unknown as Document
  });
  URL.createObjectURL = (() => "blob:wildz-cleanup-failure") as typeof URL.createObjectURL;
  URL.revokeObjectURL = (url: string) => { revokedUrl = url; };

  try {
    await assert.rejects(
      downloadWildzIdentitySeal(repository, session),
      /wildz_test_dom_setup_failed/
    );
    assert.equal(revokedUrl, "blob:wildz-cleanup-failure");
  } finally {
    URL.createObjectURL = createObjectUrl;
    URL.revokeObjectURL = revokeObjectUrl;
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else delete (globalThis as { document?: Document }).document;
  }
});
