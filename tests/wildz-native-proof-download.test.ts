import assert from "node:assert/strict";
import { test } from "node:test";
import {
  downloadPortableCard,
  downloadPortableVault,
  readPortableCardFromPng
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

test("Vault download preserves the SDK native Record/Seal artifact byte-exact", async () => {
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
    assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), expected);
    assert.match(browser.downloadedFilename(), /^wilds-vault-[a-f0-9]{12}\.receized\.png$/);
  } finally {
    browser.restore();
  }
});

test("Vault export never downgrades a player Vault to an unsealed inner PNG", async () => {
  const browser = installDownloadBrowser();
  try {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: async () => new Response(null, { status: 503 })
    });

    await assert.rejects(
      downloadPortableVault([card("native-vault-required")]),
      /receiz_proof_object_unavailable/
    );
    assert.equal(browser.downloaded(), null);
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
    assert.equal(requestCount, 3);
    assert.equal(downloaded.type, "image/png");
    assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), expected);
    assert.equal(browser.downloadedFilename(), "mintcub-1.receized.png");
  } finally {
    browser.restore();
  }
});

test("Card export is blocked unless the exact card is readable without owner credentials", async () => {
  const browser = installDownloadBrowser();
  const asset = card("anonymous-card-required");
  let anonymousRequest: RequestInit | undefined;
  try {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: async (input: string | URL | Request, init?: RequestInit) => {
        if (!String(input).startsWith("/api/cards/")) return new Response(null, { status: 500 });
        if (init?.method === "POST") {
          const record = createPublicWildsCardRecord(asset, "https://wildz.quest", "2026-07-16T12:03:00.000Z");
          return Response.json({ ok: true, record });
        }
        anonymousRequest = init;
        return Response.json({ ok: false, error: "wildz_public_card_not_found" }, { status: 404 });
      }
    });

    await assert.rejects(downloadPortableCard(asset), /wildz_public_card_anonymous_read_required/);
    assert.equal(anonymousRequest?.credentials, "omit");
    assert.equal(browser.downloaded(), null);
  } finally {
    browser.restore();
  }
});

test("Card export falls back to its offline-verifiable portable PNG when Receiz proof service is unavailable", async () => {
  const browser = installDownloadBrowser();
  const asset = card("native-card-required");
  try {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: async (input: string | URL | Request) => {
        if (String(input).startsWith("/api/cards/")) {
          const record = createPublicWildsCardRecord(asset, "https://wildz.test", "2026-07-16T12:02:00.000Z");
          return Response.json({ ok: true, record });
        }
        return new Response(null, { status: 401 });
      }
    });

    await downloadPortableCard(asset);
    const downloaded = browser.downloaded();
    assert.ok(downloaded);
    const proof = readPortableCardFromPng(new Uint8Array(await downloaded.arrayBuffer()));
    assert.equal(proof.asset.id, asset.id);
    assert.equal(browser.downloadedFilename(), "mintcub-1.wildz-card.png");
  } finally {
    browser.restore();
  }
});
