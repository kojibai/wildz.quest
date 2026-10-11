import assert from "node:assert/strict";
import test from "node:test";
import { WildsInventory } from "../src/features/play/WildsInventory";
import { mountPanelComponent, panelElements } from "./support/panel-component-harness";
import { initialPlayState } from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import { cardArtifactFingerprint } from "../src/features/play/prepared-card-artifact";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import type { WildzPreparedIdentityOwnedCard } from "../src/lib/receiz/wildz-identity-adapter";

const occurredAt = "2026-10-10T12:00:00.000Z";
function setup() {
  const asset = admitLegacyCard(sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: "warmup", capturedAt: occurredAt }), occurredAt);
  const state = { ...initialPlayState, inventory: [asset] };
  const raw: Parameters<typeof createWildsPlayerVault>[0] = { playerId: "keeper", exportedAt: occurredAt, playState: state,
    settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] };
  let hashes = 0, preparations = 0, saves = 0;
  const inputs: unknown[] = [];
  const artifact = { assetId: asset.id, bytes: new Uint8Array([1]), filename: "card.png", mimeType: "image/png", ownerReceizId: "keeper", cardFingerprint: cardArtifactFingerprint(asset) };
  let finish: ((value: WildzPreparedIdentityOwnedCard) => void) | undefined;
  let preparedAtSave: WildzPreparedIdentityOwnedCard | undefined;
  const props = {
    state, ownerReceizId: "keeper", kaiMoment: deriveKaiKlokMoment({ occurredAt, authority: "local" }), focusedAssetId: asset.id,
    cardOrder: "rarity", onCardOrderChange: () => {},
    playerVault: () => { hashes++; return createWildsPlayerVault(raw); },
    playerVaultInput: () => raw,
    vaultAdmission: {} as Parameters<typeof WildsInventory>[0]["vaultAdmission"],
    onPrepareCard: async (_asset: unknown, player: unknown, options?: { speculative?: boolean }) => { preparations++; inputs.push(player); assert.equal(options?.speculative, true); return new Promise<WildzPreparedIdentityOwnedCard>(resolve => { finish = resolve; }); },
    onExportCard: async (_asset: unknown, _player: unknown, prepared?: WildzPreparedIdentityOwnedCard) => { saves++; preparedAtSave = prepared; },
    onExportVault: async () => {}, onInput: () => {}, onRestoreArtifact: async () => { throw new Error("unused"); }
  } satisfies Parameters<typeof WildsInventory>[0] & { playerVaultInput: () => typeof raw };
  return { props, asset, artifact, inputs, raw, saves: () => saves, counts: () => ({ hashes, preparations }), finish: () => finish?.(artifact), saved: () => preparedAtSave };
}
function platform() {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), originalFetch = globalThis.fetch;
  let next = 0;
  const frames = new Map<number, FrameRequestCallback>(), tasks = new Map<number, () => void>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++next, callback); return next; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    setTimeout: (callback: () => void) => { tasks.set(++next, callback); return next; }, clearTimeout: (id: number) => tasks.delete(id),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    location: { origin: "https://fixture.invalid" }, localStorage: { getItem: () => null }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {}
  } });
  globalThis.fetch = async () => new Response("{}", { status: 404 });
  return { paint() { const work = [...frames.values()]; frames.clear(); work.forEach(callback => callback(0)); },
    task() { const work = [...tasks.values()]; tasks.clear(); work.forEach(callback => callback()); },
    restore() { globalThis.fetch = originalFetch; if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window"); } };
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test("Vault remounts pass raw current input without invoking the payload hasher", async () => {
  const runtime = platform(), f = setup();
  try {
    for (let i = 0; i < 3; i++) {
      const panel = mountPanelComponent(WildsInventory);
      try { panel.render(f.props); panel.flushEffects(); runtime.paint(); runtime.task(); await flush(); f.finish(); await flush(); }
      finally { panel.unmount(); }
    }
    assert.deepEqual(f.counts(), { hashes: 0, preparations: 3 });
    assert.ok(f.inputs.every(input => input === f.raw));
  } finally { runtime.restore(); }
});

test("closing before the deferred warmup prevents any payload or export work", async () => {
  const runtime = platform(), f = setup();
  try {
    for (const afterPaint of [false, true]) {
      const panel = mountPanelComponent(WildsInventory);
      panel.render(f.props); panel.flushEffects();
      if (afterPaint) runtime.paint();
      panel.unmount(); runtime.paint(); runtime.task(); await flush();
    }
    assert.deepEqual(f.counts(), { hashes: 0, preparations: 0 });
  } finally { runtime.restore(); }
});

test("an old-owner late warmup cannot become the new owner's prepared Save", async () => {
  const runtime = platform(), f = setup(), panel = mountPanelComponent(WildsInventory);
  try {
    panel.render(f.props); panel.flushEffects(); runtime.paint(); runtime.task(); await flush();
    const changed = { ...f.props, ownerReceizId: "other_keeper" };
    const tree = panel.render(changed); panel.flushEffects();
    f.finish(); await flush();
    const save = panelElements(tree).find(element => element.type === "button" && element.props["aria-label"] === "Save verified card");
    assert.ok(save);
    (save.props.onClick as () => void)();
    runtime.paint(); runtime.task(); await flush();
    assert.equal(f.saves(), 1);
    assert.equal(f.saved(), undefined);
  } finally { panel.unmount(); runtime.restore(); }
});

test("a warm exact prepared card reaches Save synchronously without another payload hash", async () => {
  const runtime = platform(), f = setup(), panel = mountPanelComponent(WildsInventory);
  try {
    panel.render(f.props); panel.flushEffects(); runtime.paint(); runtime.task(); await flush();
    f.finish(); await flush();
    const tree = panel.render(f.props);
    const save = panelElements(tree).find(element => element.type === "button" && element.props["aria-label"] === "Save verified card");
    assert.ok(save);
    (save.props.onClick as () => void)();
    assert.equal(f.saves(), 1, "the Save gesture reaches the existing prepared-file rail before yielding");
    assert.equal(f.saved(), f.artifact);
    assert.equal(f.counts().hashes, 0);
    await flush();
  } finally { panel.unmount(); runtime.restore(); }
});
