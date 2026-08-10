import assert from "node:assert/strict";
import { test } from "node:test";
import { companionCarousel, cycleCompanion } from "../src/features/play/companion-command-model";

const cards = [
  { id: "a" },
  { id: "b" },
  { id: "c" }
];

test("carousel wraps and exposes tasteful neighboring portrait peeks", () => {
  assert.deepEqual(companionCarousel(cards, "a"), {
    activeId: "a",
    previousId: "c",
    nextId: "b",
    position: 1,
    total: 3
  });
  assert.equal(cycleCompanion(cards, "c", 1), "a");
  assert.equal(cycleCompanion(cards, "a", -1), "c");
});

test("carousel falls back deterministically and handles one or zero companions", () => {
  assert.deepEqual(companionCarousel([{ id: "only" }], "missing"), {
    activeId: "only",
    previousId: null,
    nextId: null,
    position: 1,
    total: 1
  });
  assert.deepEqual(companionCarousel([], "missing"), {
    activeId: null,
    previousId: null,
    nextId: null,
    position: 0,
    total: 0
  });
  assert.equal(cycleCompanion([], "missing", 1), null);
});

test("ineligible and duplicate roster entries never enter the carousel", () => {
  const roster = [
    { id: "a" },
    { id: "retired", eligible: false },
    { id: "a" },
    { id: "b" }
  ];
  assert.deepEqual(companionCarousel(roster, "retired"), {
    activeId: "a",
    previousId: "b",
    nextId: "b",
    position: 1,
    total: 2
  });
});
