import assert from "node:assert/strict";
import { test } from "node:test";
import {
  downloadPortableCard,
  downloadPortableVault,
  preparePortableCardArtifact,
} from "../src/features/play/card-export";
import { createPublicWildsCardRecord } from "../src/features/play/public-card-registry";
import { sealCollectedCard } from "../src/features/play/portable-card";

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));

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
    body: { appendChild(link: { attached: boolean }) { link.attached = true; } },
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
          style: { display: "" },
          attached: false,
          remove() { this.attached = false; },
          click() {
            assert.equal(this.attached, true);
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
      setTimeout(callback: () => void, delay: number) {
        assert.ok(delay >= 60_000, "download URL must survive Safari's delayed consumption");
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

test("card and Vault saves never upload recovery payloads or download an unsealed fallback when the local signer is unavailable", async () => {
  const browser = installDownloadBrowser();
  const asset = card("local-signer-required");
  const requests: string[] = [];
  try {
    globalThis.fetch = async input => {
      requests.push(String(input));
      if (String(input).startsWith("/api/cards/")) {
        return Response.json({ ok: true, record: createPublicWildsCardRecord(asset, "https://wildz.test", "2026-07-16T12:01:00.000Z") });
      }
      throw new Error("unexpected_remote_seal");
    };
    for (const operation of [
      () => downloadPortableVault([asset]),
      () => downloadPortableCard(asset, { verifyProofObject: async () => {} }),
      () => preparePortableCardArtifact(asset)
    ]) {
      await assert.rejects(operation(), /wildz_local_signer_storage_unavailable/);
      assert.equal(browser.downloaded(), null);
      assert.equal(browser.downloadedFilename(), "");
    }
    assert.ok(requests.every(url => url.startsWith("/api/cards/")), "no payload enters a remote seal endpoint");
  } finally { browser.restore(); }
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
