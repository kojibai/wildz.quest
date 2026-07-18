import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment.js";
import { wildsSagaFramework } from "../src/features/play/wilds-saga-content.js";
import { projectWildsSaga, wildsSagaInstanceIds } from "../src/features/play/wilds-saga-director.js";

const moment = deriveKaiKlokMoment({ occurredAt: "2026-07-16T22:00:00.000Z", authority: "world" });

describe("Kai saga director", () => {
  it("derives stable day, week, month, and year instances from geometry", () => {
    const ids = wildsSagaInstanceIds(moment);
    assert.deepEqual(ids, wildsSagaInstanceIds(moment));
    assert.match(ids.dayId, /^saga:day:Y-?\d+:M\d+:D\d+$/);
    assert.match(ids.weekId, /^saga:week:/);
    assert.match(ids.monthId, /^saga:month:/);
    assert.match(ids.yearId, /^saga:year:/);
  });

  it("uses the current Ark and prior settlement hook without changing Kai geometry", () => {
    const base = projectWildsSaga({ moment, framework: wildsSagaFramework(), memories: [] });
    const changed = projectWildsSaga({
      moment,
      framework: wildsSagaFramework(),
      memories: [{ chapterId: "prior", dayId: "prior-day", outcome: "failure", hookId: "route-damaged", settledEventId: "wve:prior", settledAt: "2026-07-16T00:00:00.000Z" }]
    });
    assert.equal(base.act.ark, moment.ark);
    assert.equal(changed.act.ark, moment.ark);
    assert.equal(changed.momentCoordinate, base.momentCoordinate);
    assert.notDeepEqual(changed.activeConsequences, base.activeConsequences);
  });
});
