import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WildsCrewCreatureControls } from "../src/features/play/WildsCrewCreatureControls";
import type { PortableCardAsset } from "../src/features/play/portable-card";
import type { WildsCrewMode } from "../src/features/play/wilds-crew-preferences";

const card = { id: "crew-one", manifest: { name: "Ember", ownerReceizId: "owner-one" }, proof: { digest: "proof-one" } } as PortableCardAsset;

test("exploration controls reflect supplied mode and send commands for the selected card", () => {
  const commands: [string, WildsCrewMode][] = [];
  const props = { card, mode: "roam" as const, accompanying: false, onModeChange: (id: string, mode: WildsCrewMode) => { commands.push([id, mode]); } };
  const view = WildsCrewCreatureControls(props);
  const buttons = view.props.children[1].props.children;
  assert.equal(buttons[0].props["aria-pressed"], false);
  assert.equal(buttons[1].props["aria-pressed"], true);
  buttons[0].props.onClick();
  buttons[1].props.onClick();
  assert.deepEqual(commands, [["crew-one", "follow"], ["crew-one", "roam"]]);
  const recalled = WildsCrewCreatureControls({ ...props, mode: "follow" });
  assert.equal(recalled.props.children[1].props.children[0].props["aria-pressed"], true);
});

test("completed or retired creatures retain readable journal while movement is disabled", () => {
  const html = renderToStaticMarkup(<WildsCrewCreatureControls card={card} accompanying={false} disabled
    report="Returned · 4 trail locations observed" onModeChange={() => {}}
    readHistory={async () => ({ observations: [], nextCursor: null })} />);
  assert.match(html, /Returned · 4 trail locations observed/);
  assert.match(html, /Travel journal/);
  assert.doesNotMatch(html, /<fieldset[^>]*disabled/);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
});

test("a physical blocked report remains visible even when the preference is roam", () => {
  const report = "Return paused · route blocked by closed entrance · 27m from you";
  const html = renderToStaticMarkup(<WildsCrewCreatureControls card={card} mode="roam" accompanying={false}
    report={report} onModeChange={() => {}} />);
  assert.ok(html.includes(report));
  assert.doesNotMatch(html, /Preparing this creature/);
});

test("journal reads remain scoped to the selected creature independently of movement mode", async () => {
  const calls: [string, string | undefined, number | undefined][] = [];
  const history = async (assetId: string, cursor?: string, limit?: number) => {
    calls.push([assetId, cursor, limit]);
    return { observations: [], nextCursor: "older-record-head" };
  };
  for (const mode of ["roam", "follow"] as const) {
    const view = WildsCrewCreatureControls({ card, mode, accompanying: false, onModeChange() {}, readHistory: history });
    const journal = view.props.children[3];
    assert.equal(journal.props.assetId, card.id);
    assert.equal(journal.props.readHistory, history);
    assert.deepEqual(await journal.props.readHistory(journal.props.assetId, "current-head", 24), { observations: [], nextCursor: "older-record-head" });
  }
  assert.deepEqual(calls, [[card.id, "current-head", 24], [card.id, "current-head", 24]]);
});
