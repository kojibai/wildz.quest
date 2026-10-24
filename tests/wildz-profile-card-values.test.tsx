import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WildzProfileVaultGallery } from "../src/features/profile/WildzProfileVaultGallery";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { createPublicWildsCardRecord } from "../src/features/play/public-card-registry";
import { mountMutableReact } from "./helpers/react-mutation-renderer";
import { prepareWildzProfilePageSeed } from "../src/lib/receiz/wildz-profile-page-seed";
import { createPublicWildzProfileRecord } from "../src/lib/receiz/wildz-profile-record";
import { WildzPublicProfilePage } from "../src/features/profile/WildzPublicProfilePage";

const asset = sealCollectedCard({ capturedAt: "2026-08-11T12:00:00.000Z", encounterId: "profile-values", formId: "mintcub-1", ownerReceizId: "receiz:profile-owner" });
const card = { id: asset.id, name: asset.manifest.name, proofDigest: asset.proof.digest, visibility: "public" as const };

test("profile artwork and proof value open the Market card view without a document navigation", () => {
  const html = renderToStaticMarkup(<WildzProfileVaultGallery cards={[card]} profileHandle="profile-owner" />);
  assert.match(html, /aria-label="Open .* market card"/);
  assert.match(html, /View value chart/);
  assert.doesNotMatch(html, /href="\/cards\//);
  assert.match(html, /Proof value/);
  assert.match(html, /Open .* market card/);
  assert.doesNotMatch(html, /role="dialog"/);
});

test("every card on an owner profile can open Market before deferred previews mount", () => {
  const html = renderToStaticMarkup(<WildzProfileVaultGallery cards={[card]} ownerAssets={[asset]} profileHandle="profile-owner" />);
  assert.match(html, /aria-label="Open .* market card"/);
  assert.match(html, /data-profile-preview="deferred"/);
  assert.match(html, /Proof value/);
});

function browser() {
  const saved = new Map(["window", "document", "self", "IntersectionObserver", "Worker", "fetch"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
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
    window: { configurable: true, value: { location: { origin: "https://wildz.quest", href: "https://wildz.quest/u/profile-values" }, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setInterval: (callback: () => void) => { tick = callback; return 1; }, clearInterval: () => { cleared = true; } } },
    document: { configurable: true, value: doc },
    self: { configurable: true, value: { setTimeout } },
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
      if (node.props?.className === "wildz-profile-vault-gallery") return { querySelectorAll: () => [...badges.values()], closest: () => null };
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

test("a prepared profile's first HTML contains its cards, artwork and values without a loading pass", async () => {
  const record = createPublicWildzProfileRecord({ username: "@profile-values", displayName: "Settled Explorer", vault: [card] }, "https://wildz.quest/u/profile-values", "2026-08-11T12:01:00.000Z");
  record.vaultCards = [asset];
  const seed = await prepareWildzProfilePageSeed(record);
  assert.equal(seed.values[asset.id]?.status, "ready");
  assert.equal(seed.cards.length, 0, "the public page carries display data, not full original dossiers");
  assert.ok(JSON.stringify(seed).length < 15_000, "initial display excludes the calculation and offline replay payloads");
  const html = renderToStaticMarkup(<WildzPublicProfilePage username="@profile-values" initialSeed={seed} />);
  assert.match(html, /Settled Explorer/);
  const image = new URL(seed.artwork[asset.id]!, "https://wildz.quest");
  assert.equal(image.pathname, `/api/cards/${encodeURIComponent(asset.id)}/image`);
  assert.equal(image.searchParams.get("profile"), "@profile-values");
  assert.equal(image.searchParams.get("digest"), asset.proof.digest);
  assert.doesNotMatch(JSON.stringify(seed), /data:image\/svg\+xml/);
  assert.match(html, /Proof value/);
  assert.doesNotMatch(html, /Loading explorer|Finding explorer|Card preview|Proof value<\/span><div><strong>—/);
});

test("a prepared profile reuses its carried value when opening the chart, and reads full detail only on request", async context => {
  const record = createPublicWildzProfileRecord({ username: "@profile-values", vault: [card] }, "https://wildz.quest/u/profile-values");
  record.vaultCards = [asset];
  const seed = await prepareWildzProfilePageSeed(record);
  const env = browser();
  const view = await mountMutableReact(<WildzProfileVaultGallery cards={[card]} profileHandle="@profile-values" initialSeed={seed} />, env);
  context.after(async () => { await view.unmount(); env.restore(); });
  env.notify(true);
  await view.flush();
  const badge = view.nodes().find(node => node.props?.["data-market-value-asset"] === card.id)!;
  (badge.props!.onClick as (event: unknown) => void)({ preventDefault() {} });
  for (let frame = 0; frame < 10 && !view.nodes().some(node => node.type === "svg" && String(node.props?.["aria-label"]).includes("Recomputed proof value")); frame++) await view.flush();
  assert.ok(view.nodes().some(node => node.type === "svg" && String(node.props?.["aria-label"]).includes("Recomputed proof value")));
  assert.equal(env.workers.length, 0, "opening a carried chart must not start another valuation");
  assert.equal(env.fetches(), 0, "the front and chart do not need a full original download");
  const calculation = view.nodes().find(node => node.type === "details" && node.children.some(child => child.type === "summary" && child.children.some(text => text.text === "How this value is calculated")))!;
  (calculation.props!.onToggle as (event: unknown) => void)({ currentTarget: { open: true } });
  for (let frame = 0; frame < 20 && !env.workers.length; frame++) await view.flush();
  assert.equal(env.workers.length, 1, "the complete calculation is recovered when expanded");
});

test("the prepared chart opens from profile values and survives Back and reopening without another card read", async context => {
  const env = browser();
  const view = await mountMutableReact(<WildzProfileVaultGallery cards={[card]} profileHandle="profile-values" />, env);
  context.after(async () => { await view.unmount(); env.restore(); });
  env.notify(true);
  for (let frame = 0; frame < 20 && !view.text().includes("$123.45"); frame++) await view.flush();
  const galleryCard = view.nodes().find(node => node.props?.["aria-label"] === `Open ${card.name} market card`)!;
  const badge = view.nodes().find(node => node.props?.["data-market-value-asset"] === card.id)!;
  (badge.props!.onClick as (event: unknown) => void)({ preventDefault() {} });
  await view.flush();
  assert.ok(view.nodes().some(node => node.props?.["aria-label"] === "Live proof value"));
  assert.ok(view.nodes().some(node => node.type === "svg" && String(node.props?.["aria-label"]).includes("Recomputed proof value")));
  const detail = view.nodes().find(node => node.props?.["data-profile-market-card"] !== undefined)!;
  assert.equal(detail.props?.hidden, false);
  const back = view.nodes().find(node => node.type === "button" && node.children.some(child => child.text === "Back to profile"))!;
  (back.props!.onClick as () => void)();
  await view.flush();
  assert.equal(detail.props?.hidden, true);
  assert.ok(view.nodes().includes(galleryCard), "profile tile DOM stays mounted");
  (galleryCard.props!.onClick as (event: unknown) => void)({ currentTarget: { isConnected: false }, preventDefault() {} });
  await view.flush();
  assert.ok(view.nodes().includes(detail), "Market detail and chart DOM stay mounted");
  assert.equal(detail.props?.hidden, false);
  assert.equal(env.fetches(), 1);
});

test("the owner byline returns straight to the retained profile", async context => {
  const env = browser();
  const view = await mountMutableReact(<WildzProfileVaultGallery cards={[card]} profileHandle="@profile-values" />, env);
  context.after(async () => { await view.unmount(); env.restore(); });
  const tile = view.nodes().find(node => node.props?.["aria-label"] === `Open ${card.name} market card`)!;
  (tile.props!.onClick as (event: unknown) => void)({ currentTarget: { isConnected: false }, preventDefault() {} });
  await view.flush();
  const detail = view.nodes().find(node => node.props?.["data-profile-market-card"] !== undefined)!;
  const owner = view.nodes().find(node => node.type === "a" && node.props?.href === "/u/profile-values")!;
  assert.ok(owner, "the byline has a canonical native profile link");
  let prevented = false;
  (owner.props!.onClick as (event: unknown) => void)({ button: 0, preventDefault() { prevented = true; } });
  await view.flush();
  assert.equal(prevented, true);
  assert.equal(detail.props?.hidden, true);
  assert.ok(view.nodes().includes(tile), "the exact profile DOM is retained");
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
  assert.ok(view.nodes().some(node => node.type === "a" && node.props?.["aria-label"] === `Open ${card.name} market card`));
});

test("opening a card while its profile value is recovering shares the exact pending proof read", async context => {
  const env = browser();
  let release!: () => void, requests = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const respond = globalThis.fetch;
  globalThis.fetch = async (...args) => { requests++; await gate; return respond(...args); };
  const view = await mountMutableReact(<WildzProfileVaultGallery cards={[card]} profileHandle="profile-values-pending" />, env);
  context.after(async () => { release(); await view.unmount(); env.restore(); });
  env.notify(true);
  await view.flush();
  const tile = view.nodes().find(node => node.props?.["aria-label"] === `Open ${card.name} market card`)!;
  (tile.props!.onClick as (event: unknown) => void)({ currentTarget: { isConnected: false }, preventDefault() {} });
  for (let frame = 0; frame < 10 && !view.nodes().some(node => node.props?.["aria-label"] === `Flip ${card.name}`); frame++) await view.flush();
  const front = view.nodes().find(node => node.props?.["aria-label"] === `Flip ${card.name}`)!;
  (front.props!.onClick as (event: unknown) => void)({ detail: 0, currentTarget: { isConnected: false } });
  await view.flush();
  release();
  for (let frame = 0; frame < 30 && !view.nodes().some(node => String(node.props?.className).startsWith("wilds-card-scene")); frame++) await view.flush();
  assert.ok(view.nodes().some(node => String(node.props?.className).startsWith("wilds-card-scene")), "the verified card back becomes available");
  assert.equal(requests, 1);
});
