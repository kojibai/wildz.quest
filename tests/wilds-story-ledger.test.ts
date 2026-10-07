import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WildsStoryLedger } from "../src/features/play/WildsStoryLedger";
import { WildsPersonalStory } from "../src/features/play/WildsPersonalStory";
import { indexWildsStoryLedger, pageWildsStoryLedger } from "../src/features/play/wilds-story-ledger";
import type { WildsActivityEntry } from "../src/features/play/wallet/wilds-activity-history";
import { ledgerKaiTime } from "../src/features/play/wallet/wilds-activity-history";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import { projectWildsSaga } from "../src/features/play/wilds-saga-director";
import { wildsSagaFramework } from "../src/features/play/wilds-saga-content";
import type { WildsJourneyMemory } from "../src/features/play/wilds-journey";

const activities: WildsActivityEntry[] = Array.from({ length: 10000 }, (_, index) => ({ id: `action:${index}`, kind: "activity", title: `Work ${index}`, detail: `Recorded action ${index}`, authority: index % 2 ? "local" : "world", uPulse: 14_000_000_000_000 + index }));

test("every entry of a large story ledger is reachable in chronological pages with bounded visible work", () => {
  const ordered = indexWildsStoryLedger(activities);
  assert.equal(ordered[0]?.id, "action:9999");
  assert.equal(activities[0]?.id, "action:0");
  const seen = new Set<string>();
  const first = pageWildsStoryLedger(ordered, 0);
  for (let page = 0; page < first.pageCount; page++) {
    const result = pageWildsStoryLedger(ordered, page);
    assert.ok(result.entries.length <= 12);
    for (const entry of result.entries) { assert.ok(!seen.has(entry.id)); seen.add(entry.id); }
  }
  assert.equal(seen.size, activities.length);
  assert.equal(pageWildsStoryLedger(ordered, Number.MAX_SAFE_INTEGER).end, 10000);
  assert.equal(pageWildsStoryLedger(ordered, -1).page, 0);
  assert.equal(pageWildsStoryLedger([], NaN).start, 0);
});

test("the story ledger renders real action details, source and original Kai time for only its visible page", () => {
  const markup = renderToStaticMarkup(createElement(WildsStoryLedger, { entries: activities }));
  assert.equal([...markup.matchAll(/class="wilds-story-ledger-entry"/g)].length, 12);
  assert.match(markup, /Showing 1–12 of 10000/);
  assert.match(markup, /Recorded action 9999/);
  assert.ok(markup.includes(ledgerKaiTime({ uPulse: activities[9999]!.uPulse }).timing));
  assert.match(markup, /Your action/);
  assert.match(markup, /World event/);
  assert.match(markup, /No world-law decision is attached/);
  assert.ok(!markup.includes("Recorded action 9987"));
});

test("personal story follows actual remembered places and updates when a later real action arrives", () => {
  const saga = projectWildsSaga({ moment: deriveKaiKlokMoment({ occurredAt: "2026-10-06T00:00:00.000Z", authority: "local" }), framework: wildsSagaFramework(), memories: [] });
  const memories: WildsJourneyMemory[] = [
    { id: "meeting", kind: "met", subjectId: "companion", companionId: "companion", companionName: "Aryzoup", label: "Joined your trail", position: { x: -45, z: -6 }, timestamp: Date.parse("2026-10-05T00:00:00.000Z") },
    { id: "shelter", kind: "built", subjectId: "shelter", label: "Built a trail shelter", position: { x: 12, z: 18 }, timestamp: Date.parse("2026-10-06T00:00:00.000Z") }
  ];
  const render = (entries: readonly WildsActivityEntry[]) => renderToStaticMarkup(createElement(WildsPersonalStory, { playerName: "Ari", saga, memories, activities: entries, location: { name: "Verdant Heartlands", position: { x: 12, z: 18 } } }));
  const before = render([{ ...activities[0]!, title: "Gathered timber", detail: "Gathered two timber lots", uPulse: 100 }]);
  assert.match(before, /Ari’s living trail/);
  assert.match(before, /Aryzoup/);
  assert.match(before, /Built a trail shelter/);
  assert.match(before, /Verdant Heartlands/);
  assert.match(before, /X -45 · Z -6/);
  const after = render([{ ...activities[0]!, title: "Rested at home", detail: "Recovered beside your shelter", uPulse: 101 }, { ...activities[1]!, title: "Gathered timber", detail: "Gathered two timber lots", uPulse: 100 }]);
  assert.match(after, /Rested at home/);
  assert.match(after, /Recovered beside your shelter/);
  assert.doesNotMatch(after, /Gathered two timber lots/);
});

test("an unknown journal time stays unknown instead of crashing or acquiring the current time", () => {
  const saga = projectWildsSaga({ moment: deriveKaiKlokMoment({ occurredAt: "2026-10-06T00:00:00.000Z", authority: "local" }), framework: wildsSagaFramework(), memories: [] });
  const markup = renderToStaticMarkup(createElement(WildsPersonalStory, { playerName: "Ari", saga, activities: [], memories: [{ id: "unknown", kind: "discovered", subjectId: "place", label: "Discovered a place", position: { x: 0, z: 0 }, timestamp: 1e20 }] }));
  assert.match(markup, /source has no valid time/);
});

test("an older imported activity with partial world-law evidence opens without inventing missing fields", () => {
  const entry = { ...activities[0]!, constitution: { schema: "wildz.constitutional-decision.v1", rulesApplied: ["WORLD-01"], result: "VALID", actor: "ari" } as unknown as WildsActivityEntry["constitution"] };
  const markup = renderToStaticMarkup(createElement(WildsStoryLedger, { entries: [entry] }));
  assert.match(markup, /WORLD-01/);
  assert.match(markup, /ari/);
  assert.match(markup, /Unrecorded/);
});
