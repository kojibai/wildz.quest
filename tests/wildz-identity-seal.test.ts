import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createReceizIdIdentity,
  projectReceizIdentityAccount,
  readReceizIdentityArtifact,
  type ReceizDeviceIdentity,
  type ReceizKeyFile
} from "@receiz/sdk";
import { downloadWildzIdentitySeal } from "../src/lib/receiz/wildz-identity-adapter";
import { createWildzIdentitySealPng } from "../src/lib/receiz/wildz-identity-seal";
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
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(restored.keyId, identity.keyFile.keyId);
  assert.notEqual(projection.portableStateStatus, "invalid");
});

test("Identity Seal download uses protected authority and a normalized PNG filename", async () => {
  const identity = await createReceizIdIdentity({ username: "seal.download", displayName: "Seal Download" });
  const session = {
    ...await sessionFromIdentity(identity),
    username: " @Seal.Download "
  };
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
  assert.equal(anchor.download, "seal.download.receiz-identity-seal.png");
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
