import assert from "node:assert/strict";
import test from "node:test";
import type { ReactNode, ReactElement } from "react";
import { WildsCardBack } from "../src/features/play/WildsCardBack";
import { projectLivingCardDossier } from "../src/features/play/living-card-dossier";
import { projectCreatureBrain } from "../src/features/play/creature-consciousness";
import { admitLegacyCard, appendLivingCardHistory } from "../src/features/play/living-card-proof";
import { canonicalPortableCardJson, sealCollectedCard, type PortableCardAsset } from "../src/features/play/portable-card";
import { verifyAndAdmitWildsCard } from "../src/features/play/admitted-inventory";
import { mountPanelComponent, panelElements } from "./support/panel-component-harness";

function cardFixture(encounterId = "vault-proof-details") {
  const owner = "proof_details_keeper", capturedAt = "2026-10-10T12:00:00.000Z";
  let card = admitLegacyCard(sealCollectedCard({ formId: "mintcub-1", ownerReceizId: owner, encounterId, capturedAt }), capturedAt);
  for (let index = 0; index < 8; index++) {
    const occurredAt = `2026-10-10T12:${String(index + 1).padStart(2, "0")}:00.000Z`;
    card = appendLivingCardHistory({ asset: card, event: {
      eventId: `${encounterId}:training:${index}`, rulesetVersion: "wildz.progression.v1", occurredAt,
      source: { mode: "training", activityId: `${encounterId}:practice:${index}`, actorId: owner, authority: "local" },
      evidence: {}, effects: [{ kind: "progress", xpDelta: 1, growthEvents: [] }]
    } });
  }
  assert.equal(verifyAndAdmitWildsCard(card), true);
  return card;
}

/** Count the real whole-card JSON boundary without replacing its encoder or
 * verification. Brain/dossier summaries have different shapes and do not count. */
function trackCompleteProofJson<T>(cards: readonly PortableCardAsset[], run: (work: { serialized: number; parsed: number }) => T): T {
  const stringify = JSON.stringify, parse = JSON.parse;
  const ids = new Set(cards.map(card => card.id));
  const work = { serialized: 0, parsed: 0 };
  JSON.stringify = ((value: unknown, replacer: unknown, space: unknown) => {
    if (value && typeof value === "object" && "id" in value && ids.has(String(value.id)) && "manifest" in value && "proof" in value) work.serialized++;
    return Reflect.apply(stringify, JSON, [value, replacer, space]);
  }) as typeof JSON.stringify;
  JSON.parse = ((text: string, reviver: unknown) => {
    if (cards.some(card => text.includes(card.id)) && text.includes('"manifest"') && text.includes('"proof"')) work.parsed++;
    return Reflect.apply(parse, JSON, [text, reviver]);
  }) as typeof JSON.parse;
  try { return run(work); }
  finally { JSON.stringify = stringify; JSON.parse = parse; }
}

function element(tree: ReactNode, type: string, matches: (props: Record<string, unknown>) => boolean): ReactElement<Record<string, unknown>> {
  const found = panelElements(tree).find(value => value.type === type && matches(value.props));
  assert.ok(found, `missing ${type}`);
  return found;
}

function proofText(tree: ReactNode) {
  return panelElements(tree).find(value => value.type === "pre" && value.props["aria-label"] === "Complete canonical card proof")?.props.children ?? "";
}

test("dossier and Consciousness projection do not encode unrequested full proof text", () => {
  const asset = cardFixture(), expected = canonicalPortableCardJson(asset);
  trackCompleteProofJson([asset], work => {
    const dossier = projectLivingCardDossier(asset, "https://wildz.quest");
    const brain = projectCreatureBrain(asset);
    assert.equal(dossier.gameplay.historyEvents, 9);
    assert.equal(brain.memory.eventLedger.length, 9);
    assert.deepEqual(work, { serialized: 0, parsed: 0 }, "summary projection must not serialize or clone the complete proof");
    assert.equal(dossier.canonicalProofJson, expected);
    assert.equal(dossier.canonicalProofJson, expected);
    assert.deepEqual(work, { serialized: 1, parsed: 0 }, "proof text is encoded once on demand without parsing another card copy");
  });
});

test("closed card-back details do not retain or encode complete proof text", () => {
  const asset = cardFixture("closed-proof-details");
  const panel = mountPanelComponent(WildsCardBack);
  try {
    trackCompleteProofJson([asset], work => {
      const tree = panel.render({ asset, origin: "https://wildz.quest", qr: "" });
      assert.ok(proofText(tree) === "", "closed details must not hold a complete proof text node");
      assert.deepEqual(work, { serialized: 0, parsed: 0 });
      assert.ok(element(tree, "summary", props => Array.isArray(props.children) && props.children[0] === "Complete offline proof "));
    });
  } finally { panel.unmount(); }
});

test("proof details reveal every history event and use the current card after selection changes", () => {
  const asset = cardFixture("first-proof-details"), next = cardFixture("next-proof-details");
  const expected = canonicalPortableCardJson(asset), expectedNext = canonicalPortableCardJson(next);
  const panel = mountPanelComponent(WildsCardBack);
  try {
    trackCompleteProofJson([asset, next], work => {
      const props = { asset, origin: "https://wildz.quest", qr: "" };
      let tree = panel.render(props);
      const toggle = (open: boolean) => (element(tree, "details", props => props.className === "wilds-card-proof-dossier").props.onToggle as (event: { currentTarget: { open: boolean } }) => void)({ currentTarget: { open } });
      toggle(true);
      tree = panel.render(props);
      assert.equal(proofText(tree), expected);
      assert.equal(JSON.parse(String(proofText(tree))).manifest.history.events.length, 9);
      const afterFirstOpen = work.serialized;
      toggle(false);
      tree = panel.render(props);
      assert.equal(proofText(tree), "", "closing details releases their large rendered text node");
      toggle(true);
      tree = panel.render(props);
      assert.equal(proofText(tree), expected);
      assert.equal(work.serialized, afterFirstOpen, "reopening reuses exact already prepared proof text");
      tree = panel.render({ ...props, asset: next });
      assert.equal(proofText(tree), expectedNext);
      assert.notEqual(proofText(tree), expected);
    });
  } finally { panel.unmount(); }
});

test("copying before opening details obtains the full exact proof on demand", async () => {
  const asset = cardFixture("copy-proof-details"), expected = canonicalPortableCardJson(asset);
  const panel = mountPanelComponent(WildsCardBack);
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let copied = "";
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (text: string) => { copied = text; } } } });
  try {
    const tree = panel.render({ asset, origin: "https://wildz.quest", qr: "" });
    assert.ok(proofText(tree) === "", "copy demand must not require opening proof details");
    await (element(tree, "button", props => props.children === "Copy canonical proof").props.onClick as () => Promise<void>)();
    assert.equal(copied, expected);
    assert.equal(JSON.parse(copied).manifest.history.events.length, 9);
    assert.equal(proofText(panel.render({ asset, origin: "https://wildz.quest", qr: "" })), "");
  } finally {
    panel.unmount();
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});

test("closed proof details retain the existing exact prepared Save handler", async () => {
  const asset = cardFixture("save-proof-details"), panel = mountPanelComponent(WildsCardBack);
  let saved = 0;
  try {
    const tree = panel.render({ asset, origin: "https://wildz.quest", qr: "", onSaveProof: async () => { saved++; } });
    await (element(tree, "button", props => props.children === "Download canonical proof").props.onClick as () => void)();
    assert.equal(saved, 1);
  } finally { panel.unmount(); }
});
