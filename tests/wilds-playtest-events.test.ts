import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emitWildsPlaytestEvent, listenWildsPlaytestEvents } from "../src/features/play/wilds-playtest-events.js";
import type { WildsPlaytestAction, WildsPlaytestOutcome } from "../src/features/play/wilds-playtest.js";

describe("local playtest marker bridge", () => {
  it("receives allowlisted marks only while subscribed", () => {
    const target = new EventTarget();
    const received: unknown[] = [];
    emitWildsPlaytestEvent("identity-save", "start", target);
    const stop = listenWildsPlaytestEvents(target, (action, outcome) => received.push({ action, outcome }));
    emitWildsPlaytestEvent("card-save", "success", target);
    emitWildsPlaytestEvent("user-name" as WildsPlaytestAction, "success", target);
    emitWildsPlaytestEvent("profile", "private-note" as WildsPlaytestOutcome, target);
    stop();
    emitWildsPlaytestEvent("market", "start", target);
    assert.deepEqual(received, [{ action: "card-save", outcome: "success" }]);
  });
  it("drops malformed external signals and strips extra data", () => {
    const target = new EventTarget();
    const received: unknown[] = [];
    const stop = listenWildsPlaytestEvents(target, (...args) => received.push(args));
    for (const detail of [null, "private text", { action: "location", outcome: "success" }, { get action() { throw Error("bad getter"); } }]) {
      target.dispatchEvent(new CustomEvent("wildz:local-playtest-mark:v1", { detail }));
    }
    target.dispatchEvent(new CustomEvent("wildz:local-playtest-mark:v1", { detail: { action: "profile", outcome: "success", secret: "discard" } }));
    assert.deepEqual(received, [["profile", "success"]]);
    stop();
  });
});
