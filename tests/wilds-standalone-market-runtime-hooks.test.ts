import assert from "node:assert/strict";
import { test } from "node:test";
import { useWildsCrewExpeditions } from "../src/features/play/use-wilds-crew-expeditions";
import { prepareWildsSiteRuntime } from "../src/features/play/wilds-site-runtime";
import { useWildsResourceGameplayCapture } from "../src/features/play/useWildsResourceGameplayCapture";
import { applyWildsInput, initialPlayState, type WildsInput } from "../src/features/play/game-state";
import { createPlayerBreaths } from "../src/features/play/player-breath-energy";
import { createWildsNourishmentState, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from "../src/features/play/wilds-nourishment";
import { defaultContinuityDatabase } from "../src/lib/receiz/wildz-active-identity";
import { readWildsResourceGameplayHistoryV128 } from "../src/lib/receiz/wilds-resource-gameplay-store-v128";
import { mountPanelComponent } from "./support/panel-component-harness";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

test("standalone commerce allocates no expedition scheduler and enabling gameplay restores that lifecycle", () => {
  const timers = new Set<number>(), descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  let sequence = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    setInterval() { const timer = ++sequence; timers.add(timer); return timer; },
    clearInterval(timer: number) { timers.delete(timer); }
  } });
  let expeditions!: ReturnType<typeof useWildsCrewExpeditions>;
  type Props = Parameters<typeof useWildsCrewExpeditions>[0] & { enabled: boolean };
  const panel = mountPanelComponent((props: Props) => { expeditions = useWildsCrewExpeditions(props); return null; });
  const props: Props = { enabled: false, owner: "market_keeper", state: initialPlayState, cards: [],
    siteRuntime: prepareWildsSiteRuntime({ version: "wildz.site-physical-neighborhood.v1", regionX: 0, regionZ: 0,
      sites: [], surfaces: [], solids: [], mountainFields: [], ceilings: [], portals: [], waterVolumes: [], encounterVolumes: [] }),
    obstacles: [], feedback() {}, onFinished() {} };
  try {
    panel.render(props); panel.flushEffects();
    assert.equal(timers.size, 0, "browsing Market must not allocate a gameplay scheduler");
    assert.equal(expeditions.activeTrips.current.size, 0);
    panel.render({ ...props, enabled: true }); panel.flushEffects();
    assert.equal(timers.size, 1, "the default gameplay lifecycle must remain available");
    panel.render({ ...props, enabled: false }); panel.flushEffects();
    assert.equal(timers.size, 0, "disabling gameplay must release its scheduler");
  } finally {
    panel.unmount();
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("standalone capture stops new automatic history while explicit wallet flush retains the captured consequence", async context => {
  const database = createMemoryWildzContinuityDatabase();
  context.mock.method(defaultContinuityDatabase, "transaction", database.transaction.bind(database));
  const owner = "market_capture_keeper.receiz.id", pulse = 100_000_000;
  const plant = Array.from({ length: 9 }, (_, index) => wildsNourishmentPlantsForTile(index - 4, -4)).flat().find(candidate => candidate.capacity >= 2)!;
  let state = { ...initialPlayState, player: { x: plant.position.x, z: plant.position.z },
    siteSpace: { ...initialPlayState.siteSpace, position: plant.position }, energy: 20,
    playerBreaths: createPlayerBreaths(pulse, 20), playerNourishment: createWildsNourishmentState(owner) };
  let capture!: ReturnType<typeof useWildsResourceGameplayCapture>;
  type Props = Parameters<typeof useWildsResourceGameplayCapture>[0] & { automatic?: boolean };
  const panel = mountPanelComponent((props: Props) => { capture = useWildsResourceGameplayCapture(props); return null; });
  const render = (automatic?: boolean) => { panel.render({ enabled: true, automatic, ownerHandle: owner, gameplayOwnerId: owner, state }); panel.flushEffects(); };
  const gather = (): Extract<WildsInput, { type: "gather-food" }> => ({ type: "gather-food", ownerReceizId: owner,
    sourceId: plant.sourceId, expectedSourceHead: wildsNourishmentSourceAt(plant, state.playerNourishment?.sources[plant.sourceId], pulse).head, kaiUPulse: pulse });
  try {
    render();
    const first = gather(), afterFirst = applyWildsInput(state, first);
    capture.captureInput(state, afterFirst, first); state = afterFirst as typeof state;
    // The already captured consequence must survive switching into standalone mode.
    render(false); await capture.flush();
    assert.equal((await readWildsResourceGameplayHistoryV128(database, owner, owner)).commands.length, 1);
    const second = gather(), afterSecond = applyWildsInput(state, second);
    capture.captureInput(state, afterSecond, second); state = afterSecond as typeof state; render(false); await capture.flush();
    assert.equal((await readWildsResourceGameplayHistoryV128(database, owner, owner)).commands.length, 1,
      "standalone commerce must not append automatic gameplay history");
  } finally { panel.unmount(); }
});
