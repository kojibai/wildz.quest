import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReactNode, SyntheticEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WildsCreationPanel, type CreationPanelProps } from "../src/features/play/creation/WildsCreationPanel";
import { initialCreationConversation, type CreationConversationEvent } from "../src/features/play/creation/conversation";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { mountPanelComponent, panelElements } from "./support/panel-component-harness";
import { defaultIdentityRepository } from "../src/lib/receiz/wildz-active-identity";

test("preloading the Build component starts no workers, identity recovery, or transport", async context => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  let workers = 0, identityReads = 0, requests = 0;
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: class {
    constructor() { workers++; throw Error("unexpected_preload_worker"); }
  } });
  context.mock.method(defaultIdentityRepository, "active", async () => { identityReads++; return null; });
  context.mock.method(globalThis, "fetch", async () => { requests++; return Response.json({}, { status: 403 }); });
  try {
    await import("../src/features/play/creation/CreationSession");
    assert.deepEqual({ workers, identityReads, requests }, { workers: 0, identityReads: 0, requests: 0 });
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "Worker", descriptor); else Reflect.deleteProperty(globalThis, "Worker");
  }
});

test("Build mounts creature artwork only while its crew menu is expanded and preserves exact worker selection", () => {
  const descriptors = new Map(["window", "document"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: Object.assign(new EventTarget(), { innerWidth: 390, innerHeight: 844 }) },
    document: { configurable: true, value: new EventTarget() }
  });
  const owner = "build_panel_keeper", cards = Array.from({ length: 68 }, (_, index) => sealCollectedCard({
    formId: "mintcub-1", ownerReceizId: owner, encounterId: `build-panel-${index}`, capturedAt: "2026-10-10T12:00:00.000Z"
  }));
  const changes: CreationConversationEvent[] = [];
  const props: CreationPanelProps = {
    state: { ...initialCreationConversation(owner, "wildz.space.outer.v1", { position: { x: 0, y: 0, z: 0 }, yaw: 0 }), open: true, workerIds: [cards[0]!.id] },
    cards, workers: cards.map(card => ({ assetId: card.id, subjectId: `creature:${card.id}`, head: card.proof.digest,
      proofDigest: card.proof.digest, techniques: ["assemble"], ready: true, reasons: [] })),
    materialCounts: { hay: 0, timber: 0, stone: 0 }, onChange: event => { changes.push(event); },
    onAsk() {}, onBuild() {}, onClose() {}, onManualBuild() {}, canBuild: false
  };
  const panel = mountPanelComponent(WildsCreationPanel);
  const render = () => { const tree = panel.render(props); panel.flushEffects(); return tree; };
  const crewMenu = (tree: ReactNode) => panelElements(tree).find(element => element.type === "details"
    && panelElements(element.props.children as ReactNode).some(child => child.props["aria-label"] === "Choose creatures"));
  const toggle = (open: boolean) => {
    const menu = crewMenu(render()); assert.ok(menu);
    (menu.props.onToggle as (event: SyntheticEvent<HTMLDetailsElement>) => void)({ currentTarget: { open } } as SyntheticEvent<HTMLDetailsElement>);
  };
  try {
    const opening = render();
    assert.equal((renderToStaticMarkup(opening).match(/data-identity-signature=/g) ?? []).length, 0,
      "opening Build must not generate every creature portrait in a closed menu");
    assert.ok(panelElements(opening).some(element => element.props["aria-label"] === "1 creatures selected"));
    toggle(true);
    const expanded = render();
    assert.equal((renderToStaticMarkup(expanded).match(/data-identity-signature=/g) ?? []).length, 68);
    const buttons = panelElements(crewMenu(expanded)).filter(element => element.type === "button");
    assert.equal(buttons.length, 68); assert.equal(buttons[0]!.props["aria-pressed"], true);
    (buttons[1]!.props.onClick as () => void)();
    assert.deepEqual(changes, [{ type: "workers", ids: [cards[0]!.id, cards[1]!.id] }]);
    toggle(false);
    assert.equal((renderToStaticMarkup(render()).match(/data-identity-signature=/g) ?? []).length, 0);
    toggle(true);
    assert.equal(panelElements(crewMenu(render())).filter(element => element.type === "button")[0]!.props["aria-pressed"], true);
  } finally {
    panel.unmount();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
