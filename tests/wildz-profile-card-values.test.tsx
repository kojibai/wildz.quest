import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WildzProfileVaultGallery } from "../src/features/profile/WildzProfileVaultGallery";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { createPublicWildsCardRecord } from "../src/features/play/public-card-registry";
import { mountMutableReact } from "./helpers/react-mutation-renderer";

const asset = sealCollectedCard({ capturedAt: "2026-08-11T12:00:00.000Z", encounterId: "profile-values", formId: "mintcub-1", ownerReceizId: "receiz:profile-owner" });
const card = { id: asset.id, name: asset.manifest.name, proofDigest: asset.proof.digest, visibility: "public" as const };

test("profile artwork and proof value link to the exact standalone card without waiting for recovery", () => {
  const html = renderToStaticMarkup(<WildzProfileVaultGallery cards={[card]} profileHandle="profile-owner" />);
  const path = `/cards/${encodeURIComponent(asset.id)}`;
  assert.equal((html.match(new RegExp(`href="${path}"`, "g")) ?? []).length, 2);
  assert.match(html, /Proof value/);
  assert.match(html, /Open .* standalone card/);
  assert.doesNotMatch(html, /role="dialog"/);
});

test("every card on an owner profile keeps its standalone link before deferred previews mount", () => {
  const html = renderToStaticMarkup(<WildzProfileVaultGallery cards={[card]} ownerAssets={[asset]} profileHandle="profile-owner" />);
  assert.match(html, new RegExp(`href="/cards/${encodeURIComponent(asset.id)}"`));
  assert.match(html, /data-profile-preview="deferred"/);
  assert.match(html, /Proof value/);
});

function browser() {
  const saved = new Map(["window", "document", "IntersectionObserver", "Worker", "fetch"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const badges = new Map<string, { dataset: { marketValueAsset: string } }>();
  const observations: { notify: IntersectionObserverCallback; target: Element }[] = [];
  const workers: ValueWorker[] = [];
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  let tick = () => {}, cleared = false, fetches = 0;
  class ValueWorker extends EventTarget {
    stopped = false;
    constructor() { super(); workers.push(this); queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: { type: "value-ready" } }))); }
    postMessage(request: { requestId: number; assetId: string; card: typeof asset; evaluation: { valuationKaiUPulse: string } }) {
      this.dispatchEvent(new MessageEvent("message", { data: { type: "value-result", requestId: request.requestId, result: { status: "ready", value: {
        assetId: request.assetId, proofDigest: request.card.proof.digest, historyHead: null, algorithm: "worker-test", policyChecksum: "test", projectionDigest: "test", originKaiUPulse: null,
        valuationKaiUPulse: request.evaluation.valuationKaiUPulse, proofValuePhiMicro: "123450000", marketReferenceValuePhiMicro: null, displayUsdCents: "12345", priceBasisDigest: null,
        samples: [{ kaiUPulse: "1", phiMicro: "100000000", usdCents: "10000" }, { kaiUPulse: "2", phiMicro: "123450000", usdCents: "12345" }], calculation: []
      } } } }));
    }
    terminate() { this.stopped = true; }
  }
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: { location: { origin: "https://wildz.quest", href: "https://wildz.quest/u/profile-values" }, setInterval: (callback: () => void) => { tick = callback; return 1; }, clearInterval: () => { cleared = true; } } },
    document: { configurable: true, value: doc },
    Worker: { configurable: true, value: ValueWorker },
    IntersectionObserver: { configurable: true, value: class {
      constructor(private notify: IntersectionObserverCallback) {}
      observe(target: Element) { observations.push({ notify: this.notify, target }); }
      disconnect() {}
    } },
    fetch: { configurable: true, value: async () => {
      fetches++;
      return Response.json({ ok: true, record: createPublicWildsCardRecord(asset, "https://wildz.quest/cards/test", "2026-08-11T12:01:00.000Z") });
    } }
  });
  return {
    restore() { for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } },
    workers, doc, tick: () => tick(), fetches: () => fetches, cleared: () => cleared,
    notify(visible: boolean) { for (const { notify, target } of observations) notify([{ target, isIntersecting: visible } as IntersectionObserverEntry], {} as IntersectionObserver); },
    publicInstance(node: { type?: string; props?: Record<string, unknown> }) {
      const id = node.props?.["data-market-value-asset"];
      if (typeof id === "string") { const badge = { dataset: { marketValueAsset: id } }; badges.set(id, badge); return badge; }
      if (node.props?.className === "wildz-profile-vault-gallery") return { querySelectorAll: () => [...badges.values()] };
      return null;
    }
  };
}

test("profile uses Market values for visible cards and pauses reads and workers when inactive", async context => {
  const env = browser();
  const view = await mountMutableReact(<WildzProfileVaultGallery cards={[card]} profileHandle="profile-values" />, env);
  context.after(async () => { await view.unmount(); env.restore(); });
  assert.equal(env.fetches(), 0);
  env.notify(true);
  for (let frame = 0; frame < 20 && !view.text().includes("$123.45"); frame++) await view.flush();
  assert.match(view.text(), /\$123\.45/);
  assert.match(view.text(), /\+23\.45%/);
  assert.equal(env.fetches(), 1);
  env.notify(false);
  env.tick();
  await view.flush();
  assert.equal(env.fetches(), 1);
  await view.update(<WildzProfileVaultGallery cards={[card]} profileHandle="profile-values" active={false} />);
  assert.ok(env.workers.every(worker => worker.stopped));
  assert.equal(env.cleared(), true);
});

test("a revised profile never shows the previous proof's value and retains navigation when recovery fails", async context => {
  const env = browser();
  const view = await mountMutableReact(<WildzProfileVaultGallery cards={[card]} profileHandle="profile-values-revision" />, env);
  context.after(async () => { await view.unmount(); env.restore(); });
  env.notify(true);
  for (let frame = 0; frame < 20 && !view.text().includes("$123.45"); frame++) await view.flush();
  assert.match(view.text(), /\$123\.45/);
  const revised = { ...card, proofDigest: `sha256:${"0".repeat(64)}` };
  await view.update(<WildzProfileVaultGallery cards={[revised]} profileHandle="profile-values-revision" />);
  assert.doesNotMatch(view.text(), /\$123\.45/);
  env.notify(true);
  for (let frame = 0; frame < 20 && !view.text().includes("Value unavailable"); frame++) await view.flush();
  assert.match(view.text(), /Value unavailable/);
  assert.equal(view.nodes().filter(node => node.type === "a" && node.props?.href === `/cards/${encodeURIComponent(asset.id)}`).length, 2);
});
