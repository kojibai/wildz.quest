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
import { cardArtifactFingerprint } from "../src/features/play/prepared-card-artifact";

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
    playerVault: (asset) => {
      count.playerSnapshots++;
      return createWildsPlayerVault({ playerId: owner, exportedAt: time, playState: asset ? {...state,inventory:[asset]} : state,
        settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [],
        canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
    },
    onPrepareVault: async () => { count.vaultPreparation++; },
    onPrepareCard: async (asset, player) => {
      count.cardPreparation++;
      assert.equal(player.playState.inventory.length,1,"a selected-card warmup must not clone the 68-card account");
      return {assetId:asset.id,bytes:Uint8Array.of(1,2,3),filename:'synthetic-transport-only.png',mimeType:'image/png',ownerReceizId:owner,
        cardFingerprint:cardArtifactFingerprint(asset)};
    },
    onExportVault: async () => { count.vaultSave++; },
    onExportCard: async (card, player, prepared) => {
      assert.equal(card, inventory[0]);
      if(prepared) assert.equal(prepared.cardFingerprint,cardArtifactFingerprint(card));
      else assert.equal(player(card).playState.inventory.length,1,"cold card export preserves its selected-card payload");
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

test("an open 68-card Vault prepares one selected-card file and does not repeat work on presentation renders", async () => {
  const f = panelFixture();
  try {
    f.panel.render(f.props); f.panel.flushEffects(); await f.afterPaint();
    assert.deepEqual(f.count, { vaultPreparation: 1, cardPreparation: 1, playerSnapshots: 1, vaultSave: 0, cardSave: 0, listings: 0 });
    f.panel.render(f.props);
    f.panel.flushEffects(); await f.afterPaint();
    f.panel.render({...f.props,state:{...f.props.state,player:{...f.props.state.player,x:1}}});
    f.panel.flushEffects(); await f.afterPaint();
    assert.equal(f.count.cardPreparation, 1);
    assert.equal(f.count.playerSnapshots, 1);
  } finally { f.restore(); }
});

test("a prepared card Save invokes the platform handoff in the tap task without another frame or snapshot", async () => {
  const f = panelFixture();
  try {
    f.panel.render(f.props);f.panel.flushEffects();await f.afterPaint();
    const tree = f.panel.render(f.props);
    const elements = panelElements(tree);
    const click = (label: string) => {
      const button = elements.find(element => element.type === "button" && (element.props["aria-label"] === label || element.props.children === label));
      assert.ok(button, `missing ${label}`);
      return (button.props.onClick as () => unknown)();
    };
    click("Save verified vault");
    click("Save verified card");
    assert.equal(f.count.cardSave,1,"the prepared Save must reach its platform adapter before another frame or promise turn");
    await f.afterPaint();
    await click("Verify + list on Exchange");
    assert.deepEqual(f.count, { vaultPreparation: 1, cardPreparation: 1, playerSnapshots: 1, vaultSave: 1, cardSave: 1, listings: 1 });
  } finally { f.restore(); }
});

test("an unavailable warmup preserves the explicit cold Save instead of saving an unverified file", async () => {
  const f=panelFixture();
  try {
    const props={...f.props,onPrepareCard:async()=>{f.count.cardPreparation++;throw Error('offline_seal_enrollment_required');}};
    f.panel.render(props);f.panel.flushEffects();await f.afterPaint();
    const button=panelElements(f.panel.render(props)).find(element=>element.props['aria-label']==='Save verified card');
    assert.ok(button);(button.props.onClick as ()=>void)();
    assert.equal(f.count.cardSave,0,'a missing verified file must retain explicit preparation');
    await f.afterPaint();
    assert.equal(f.count.cardSave,1);
    assert.equal(f.count.playerSnapshots,2,'one warm snapshot and one explicit cold snapshot');
  }finally{f.restore();}
});
