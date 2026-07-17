import assert from "node:assert/strict";
import { test } from "node:test";
import {
  downloadPortableCard,
  downloadPortableVault,
  verifyPortableVaultPng
} from "../src/features/play/card-export";
import { createPublicWildsCardRecord } from "../src/features/play/public-card-registry";
import { sealCollectedCard } from "../src/features/play/portable-card";

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));

function nativeArtifact(marker: number) {
  return Uint8Array.from([...BASE_PNG, marker]);
}

function installDownloadBrowser() {
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const remember = (key: string) => descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  for (const key of ["document", "window", "Image", "fetch"]) remember(key);
  const createObjectUrl = URL.createObjectURL;
  const revokeObjectUrl = URL.revokeObjectURL;
  let downloaded: Blob | null = null;
  let downloadedFilename = "";

  class TestImage {
    decoding = "async";
    src = "";
    async decode() {}
  }

  const documentStub = {
    createElement(tagName: string) {
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage() {} }),
          toBlob(callback: (blob: Blob | null) => void) {
            callback(new Blob([BASE_PNG.slice().buffer], { type: "image/png" }));
          }
        };
      }
      if (tagName === "a") {
        return {
          href: "",
          download: "",
          click() {
            downloadedFilename = this.download;
          }
        };
      }
      throw new Error(`unexpected_element:${tagName}`);
    }
  };

  Object.defineProperty(globalThis, "document", { configurable: true, value: documentStub });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { origin: "https://wildz.test" },
      setTimeout(callback: () => void) {
        callback();
        return 0;
      }
    }
  });
  Object.defineProperty(globalThis, "Image", { configurable: true, value: TestImage });
  URL.createObjectURL = (blob) => {
    if (blob instanceof Blob && blob.type === "image/png") downloaded = blob;
    return "blob:wildz-test";
  };
  URL.revokeObjectURL = () => {};

  return {
    downloaded: () => downloaded,
    downloadedFilename: () => downloadedFilename,
    restore() {
      URL.createObjectURL = createObjectUrl;
      URL.revokeObjectURL = revokeObjectUrl;
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    }
  };
}

function card(encounterId: string) {
  return sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "native_export_owner",
    encounterId,
    capturedAt: "2026-07-16T12:00:00.000Z"
  });
}

test("Vault download stays cross-platform when the native proof response is not a portable Wilds PNG", async () => {
  const browser = installDownloadBrowser();
  const expected = nativeArtifact(103);
  try {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: async (input: string | URL | Request) => {
        assert.equal(String(input), "/api/receiz/proof-object");
        return new Response(expected.slice().buffer, {
          status: 200,
          headers: { "content-type": "image/png" }
        });
      }
    });

    await downloadPortableVault([card("native-vault-download")]);

    const downloaded = browser.downloaded();
    assert.ok(downloaded);
    assert.equal(downloaded.type, "image/png");
    const bytes = new Uint8Array(await downloaded.arrayBuffer());
    assert.notDeepEqual(bytes, expected);
    assert.equal(verifyPortableVaultPng(bytes).ok, true);
    assert.match(browser.downloadedFilename(), /^wilds-vault-[a-f0-9]{12}\.receized\.png$/);
  } finally {
    browser.restore();
  }
});

test("v103 card download preserves the native proof artifact bytes", async () => {
  const browser = installDownloadBrowser();
  const expected = nativeArtifact(203);
  const asset = card("native-card-download");
  let requestCount = 0;
  try {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: async (input: string | URL | Request) => {
        requestCount += 1;
        if (String(input).startsWith("/api/cards/")) {
          const record = createPublicWildsCardRecord(asset, "https://wildz.test", "2026-07-16T12:01:00.000Z");
          return Response.json({ ok: true, record });
        }
        assert.equal(String(input), "/api/receiz/proof-object");
        return new Response(expected.slice().buffer, {
          status: 200,
          headers: { "content-type": "image/png" }
        });
      }
    });

    const result = await downloadPortableCard(asset);

    const downloaded = browser.downloaded();
    assert.ok(downloaded);
    assert.equal(result.published, true);
    assert.equal(requestCount, 2);
    assert.equal(downloaded.type, "image/png");
    assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), expected);
    assert.equal(browser.downloadedFilename(), "mintcub-1.receized.png");
  } finally {
    browser.restore();
  }
});
