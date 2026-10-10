import assert from "node:assert/strict";
import { test } from "node:test";
import { WildsInventory } from "../src/features/play/WildsInventory";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import { deriveKaiKlokMomentFromUPulse } from "../src/features/play/kai-klok-moment";
import { deriveWildzVaultCardAdmission } from "../src/lib/receiz/wildz-vault-card-admission";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { mountPanelComponent, panelElements } from "./support/panel-component-harness";

function panelFixture() {
  const owner = "panel_keeper", time = "2026-10-10T12:00:00.000Z";
  const initial = createOwnerBoundInitialPlayState(owner);
  const inventory = [...initial.inventory, ...Array.from({ length: 68 - initial.inventory.length }, (_, index) => admitLegacyCard(sealCollectedCard({
    formId: "mintcub-1", ownerReceizId: owner, encounterId: `panel-card-${index}`, capturedAt: time
  }), time))];
  const state = { ...initial, inventory, selectedAssetId: inventory[0]!.id };
  const count = { vaultPreparation: 0, cardPreparation: 0, playerSnapshots: 0, vaultSave: 0, cardSave: 0, listings: 0 };
  const props: Parameters<typeof WildsInventory>[0] = {
    state, ownerReceizId: owner, kaiMoment: deriveKaiKlokMomentFromUPulse({ uPulse: 1_000_000, authority: "local" }),
    focusedAssetId: inventory[0]!.id, cardOrder: "rarity", onCardOrderChange: () => undefined,
    vaultAdmission: deriveWildzVaultCardAdmission({ cards: inventory, playerHandle: owner }),
    playerVault: () => {
      count.playerSnapshots++;
      return createWildsPlayerVault({ playerId: owner, exportedAt: time, playState: state,
        settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [],
        canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
    },
    onPrepareVault: async () => { count.vaultPreparation++; },
    onPrepareCard: async () => { count.cardPreparation++; throw Error("export_must_require_Save"); },
    onExportVault: async () => { count.vaultSave++; },
    onExportCard: async (card, player) => {
      assert.equal(card, inventory[0]);
      assert.equal(player().playState.inventory.length, 68, "explicit export carries the complete account");
      count.cardSave++;
    },
    onInput: () => undefined,
    onListAsset: async (card, price) => {
      assert.equal(card, inventory[0]); assert.equal(price, 2500); count.listings++;
      return null;
    },
    onRestoreArtifact: async () => { throw Error("unused_restore"); }
  };
  let sequence = 0;
  const frames = new Map<number, () => void>(), tasks = new Map<number, { callback: () => void; delay: number }>();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const target = new EventTarget();
  Object.assign(target, {
    location: { origin: "https://wildz.quest" },
    localStorage: { getItem: () => null },
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: (callback: () => void) => { const id = ++sequence; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    setTimeout: (callback: () => void, delay: number) => { const id = ++sequence; tasks.set(id, { callback, delay }); return id; },
    clearTimeout: (id: number) => tasks.delete(id)
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: target });
  const panel = mountPanelComponent(WildsInventory);
  const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: async () => { throw Error("public_projection_unavailable"); } });
  return { props, count, panel,
    async afterPaint() {
      const pendingFrames = [...frames.values()]; frames.clear(); pendingFrames.forEach(callback => callback());
      const readyTasks = [...tasks].filter(([, task]) => task.delay === 0);
      readyTasks.forEach(([id, task]) => { tasks.delete(id); task.callback(); });
      for (let index = 0; index < 12; index++) await Promise.resolve();
    },
    restore() {
      panel.unmount();
      if (descriptor) Object.defineProperty(globalThis, "window", descriptor); else Reflect.deleteProperty(globalThis, "window");
      if (fetchDescriptor) Object.defineProperty(globalThis, "fetch", fetchDescriptor);
    }
  };
}

test("opening and selecting a 68-card Vault creates no unrequested export or player snapshot", async () => {
  const f = panelFixture();
  try {
    f.panel.render(f.props); f.panel.flushEffects(); await f.afterPaint();
    assert.deepEqual(f.count, { vaultPreparation: 0, cardPreparation: 0, playerSnapshots: 0, vaultSave: 0, cardSave: 0, listings: 0 });
    f.panel.render({ ...f.props, focusedAssetId: f.props.state.inventory[1]!.id });
    f.panel.flushEffects(); await f.afterPaint();
    f.panel.render({ ...f.props, focusedAssetId: f.props.state.inventory[1]!.id });
    f.panel.flushEffects(); await f.afterPaint();
    assert.equal(f.count.cardPreparation, 0);
    assert.equal(f.count.playerSnapshots, 0);
  } finally { f.restore(); }
});

test("explicit Vault and card Save retain their export rails while listing does not prepare a backup", async () => {
  const f = panelFixture();
  try {
    const tree = f.panel.render(f.props);
    const elements = panelElements(tree);
    const click = (label: string) => {
      const button = elements.find(element => element.type === "button" && (element.props["aria-label"] === label || element.props.children === label));
      assert.ok(button, `missing ${label}`);
      return (button.props.onClick as () => unknown)();
    };
    click("Save verified vault");
    click("Save verified card");
    await f.afterPaint();
    await click("Verify + list on Exchange");
    assert.deepEqual(f.count, { vaultPreparation: 0, cardPreparation: 0, playerSnapshots: 1, vaultSave: 1, cardSave: 1, listings: 1 });
  } finally { f.restore(); }
});
