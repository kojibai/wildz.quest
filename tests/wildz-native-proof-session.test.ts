import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  consumeWildzNativeProofResume,
  ensureWildzNativeProofSession
} from "../src/lib/receiz/wildz-native-proof-session";

const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

function installWindow(href = "https://wildz.quest/world") {
  let currentHref = href;
  let assigned = "";
  const location = {
    get href() { return currentHref; },
    set href(value: string) { currentHref = value; },
    get origin() { return new URL(currentHref).origin; },
    assign(value: string) { assigned = value; }
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location,
      history: { replaceState: (_state: unknown, _title: string, url: string) => { currentHref = new URL(url, currentHref).toString(); } }
    }
  });
  return { assigned: () => assigned, href: () => currentHref };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

test("unknown session enters the SDK tenant-session route and never grants authority", async () => {
  const browser = installWindow("https://wildz.quest/world?tab=vault");
  globalThis.fetch = async () => Response.json({ status: "unknown", profileHandle: null });

  const admitted = await ensureWildzNativeProofSession("@Cialelo", {
    kind: "card",
    assetId: "wilds:0123456789abcdef01234567"
  });

  assert.equal(admitted, false);
  const redirect = new URL(browser.assigned());
  assert.equal(redirect.pathname, "/api/auth/receiz/start");
  assert.equal(redirect.searchParams.get("usernameHint"), "cialelo");
  assert.equal(
    redirect.searchParams.get("returnTo"),
    "/world?tab=vault&receizResume=card&receizAssetId=wilds%3A0123456789abcdef01234567"
  );
});

test("only a connected matching Receiz ID admits native proof creation", async () => {
  installWindow();
  globalThis.fetch = async () => Response.json({ status: "connected", profileHandle: "@Cialelo" });
  assert.equal(await ensureWildzNativeProofSession("cialelo", { kind: "vault" }), true);

  globalThis.fetch = async () => Response.json({ status: "connected", profileHandle: "@different" });
  await assert.rejects(
    ensureWildzNativeProofSession("cialelo", { kind: "vault" }),
    /wildz_proof_object_owner_mismatch/
  );
});

test("successful callback consumes the resume marker without treating it as authority", () => {
  const browser = installWindow("https://wildz.quest/world?receiz=connected&receizResume=vault&tab=collection");
  assert.deepEqual(consumeWildzNativeProofResume(), { kind: "vault" });
  assert.equal(browser.href(), "https://wildz.quest/world?tab=collection");
});
