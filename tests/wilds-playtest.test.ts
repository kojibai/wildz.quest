import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWildsPlaytestRecording, exportWildsPlaytest, markWildsPlaytest, recordWildsPlaytestFrame, recordWildsPlaytestLongTask, summarizeWildsPlaytest, WILDS_PLAYTEST_EVENT_LIMIT, WILDS_PLAYTEST_SAMPLE_LIMIT, type WildsPlaytestAction } from "../src/features/play/wilds-playtest.js";

describe("local playtest recording", () => {
  it("bounds retained samples and events while keeping full-session counts", () => {
    const recording = createWildsPlaytestRecording(100);
    for (let index = 0; index < 1500; index++) {
      recordWildsPlaytestFrame(recording, index === 0 ? 110 : 16);
      markWildsPlaytest(recording, "panel", "success", 100 + index);
    }
    assert.equal(recording.frames.length, WILDS_PLAYTEST_SAMPLE_LIMIT);
    assert.equal(recording.events.length, WILDS_PLAYTEST_EVENT_LIMIT);
    assert.deepEqual(summarizeWildsPlaytest(recording), {
      sampledFrames: 1500, frameGapsOver50ms: 1, worstFrameMs: 110, recentFrameP95Ms: 16,
      longTasks: 0, worstLongTaskMs: 0, events: 1500, delighted: 0, hesitations: 0
    });
  });
  it("measures completed or failed action spans without inventing missing starts", () => {
    const recording = createWildsPlaytestRecording(100);
    markWildsPlaytest(recording, "harvest", "start", 150);
    markWildsPlaytest(recording, "harvest", "success", 355);
    markWildsPlaytest(recording, "placement", "start", 400);
    markWildsPlaytest(recording, "placement", "failure", 500);
    markWildsPlaytest(recording, "home", "success", 550);
    assert.equal(recording.events[1].durationMs, 205);
    assert.equal(recording.events[3].durationMs, 100);
    assert.equal(recording.events[4].durationMs, undefined);
    assert.deepEqual(recording.pending, {});
  });
  it("exports only a fixed vocabulary and relative timing, with detached event copies", () => {
    const recording = createWildsPlaytestRecording(998000);
    markWildsPlaytest(recording, "private-user-id" as WildsPlaytestAction, "success", 998100);
    markWildsPlaytest(recording, "delight", "success", 998200);
    markWildsPlaytest(recording, "hesitation", "success", 998250);
    const evidence = exportWildsPlaytest(recording, false);
    assert.equal(evidence.summary.delighted, 1);
    assert.equal(evidence.summary.hesitations, 1);
    assert.equal(evidence.events.length, 2);
    assert.equal(evidence.events[0].elapsedMs, 200);
    assert.equal(JSON.stringify(evidence).includes("998000"), false);
    assert.equal(JSON.stringify(evidence).includes("private-user-id"), false);
    evidence.events[0].elapsedMs = 0;
    assert.equal(recording.events[0].elapsedMs, 200);
    assert.equal(evidence.longTasksSupported, false);
  });
  it("rejects invalid timings and separates long tasks from frame gaps", () => {
    const recording = createWildsPlaytestRecording(100);
    for (const duration of [NaN, Infinity, -1, 0]) recordWildsPlaytestFrame(recording, duration);
    for (const duration of [NaN, Infinity, -1, 49]) recordWildsPlaytestLongTask(recording, duration);
    recordWildsPlaytestLongTask(recording, 75);
    markWildsPlaytest(recording, "panel", "success", 90);
    const summary = summarizeWildsPlaytest(recording);
    assert.equal(summary.sampledFrames, 0);
    assert.equal(summary.recentFrameP95Ms, 0);
    assert.equal(summary.longTasks, 1);
    assert.equal(summary.worstLongTaskMs, 75);
    assert.equal(summary.events, 0);
  });
});
