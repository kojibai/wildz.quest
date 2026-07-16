import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWildsCivicEvent, projectWildsCivicHistory, verifyWildsCivicEvent } from "../src/features/play/wilds-civic-history";

const base = {
  settlementId: "wayfinder-hollow" as const,
  actorId: "player:keeper",
  kind: "service.completed" as const,
  sourceId: "orientation",
  occurredAt: "2026-07-15T12:00:00.000Z",
  cardProofDigest: null,
  reputation: 5
};

describe("Wilds civic history", () => {
  it("creates one deterministic self-verifying event", () => {
    const first = createWildsCivicEvent(base);
    const replay = createWildsCivicEvent(base);

    assert.deepEqual(replay, first);
    assert.match(first.eventId, /^civic:[a-f0-9]{24}$/);
    assert.deepEqual(verifyWildsCivicEvent(first), { ok: true, errors: [] });
    assert.equal(verifyWildsCivicEvent({ ...first, reputation: 99 }).ok, false);
    assert.equal(verifyWildsCivicEvent({ ...first, cardProofDigest: "bad" }).ok, false);
  });

  it("deduplicates, orders, caps each source, and derives stable ranks", () => {
    const orientation = createWildsCivicEvent(base);
    const repeatedSource = createWildsCivicEvent({ ...base, kind: "resident.met", occurredAt: "2026-07-15T12:01:00.000Z" });
    const puzzle = createWildsCivicEvent({ ...base, kind: "puzzle.completed", sourceId: "route-memory:2026-07-15", occurredAt: "2026-07-15T12:02:00.000Z" });
    const attunement = createWildsCivicEvent({ ...base, sourceId: "card-attunement:card-1", occurredAt: "2026-07-15T12:03:00.000Z", cardProofDigest: `sha256:${"a".repeat(64)}` });

    const neighbor = projectWildsCivicHistory([orientation, orientation]);
    const wayfinder = projectWildsCivicHistory([puzzle, repeatedSource, orientation, attunement, orientation]);

    assert.equal(neighbor.reputation, 5);
    assert.equal(neighbor.rank, "neighbor");
    assert.equal(wayfinder.reputation, 15);
    assert.equal(wayfinder.rank, "wayfinder");
    assert.deepEqual(wayfinder.events.map((event) => event.occurredAt), [...wayfinder.events.map((event) => event.occurredAt)].sort());
    assert.deepEqual(wayfinder.completedSourceIds, ["orientation", "route-memory:2026-07-15", "card-attunement:card-1"]);
  });

  it("drops malformed events and clamps total reputation", () => {
    const events = Array.from({ length: 30 }, (_, index) => createWildsCivicEvent({
      ...base,
      sourceId: `source-${index}`,
      occurredAt: new Date(Date.UTC(2026, 6, 15, 13, index)).toISOString()
    }));
    const malformed = { ...events[0]!, eventId: "civic:wrong" };
    const projected = projectWildsCivicHistory([...events, malformed]);

    assert.equal(projected.reputation, 100);
    assert.equal(projected.rank, "keeper");
    assert.equal(projected.events.includes(malformed), false);
  });
});
