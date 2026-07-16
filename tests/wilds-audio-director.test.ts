import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectWildsAudioScene } from "../src/features/play/wilds-audio-scene";
import { selectWildsAudioProgram } from "../src/features/play/wilds-audio-director";
import { createWildsAudioRuntime } from "../src/features/play/wilds-audio";

const memory = { activeProgramId: null, enteredAt: 0, recent: [] } as const;

describe("Wilds adaptive audio director", () => {
  it("makes the center Mortal Arena the dominant final-combat score", () => {
    const scene = projectWildsAudioScene({
      position: { x: 0, z: 0 }, districtId: "dawn-commons", activity: "combat",
      threat: 1, combatPhase: "final", vitalityBand: "critical", memorial: false,
      weather: "clear", time: "day", biome: "heartwood", reducedMotion: false
    });
    assert.equal(scene.landmark, "mortal-arena");
    assert.equal(selectWildsAudioProgram(scene, memory, 9_000).id, "mortal-arena-final");
  });

  it("moves from exploration through arena approach without coordinate ambiguity", () => {
    assert.equal(projectWildsAudioScene({ position: { x: 13, z: 0 } }).landmark, null);
    assert.equal(projectWildsAudioScene({ position: { x: 12, z: 0 } }).landmark, "mortal-arena");
    const approach = projectWildsAudioScene({ position: { x: 16, z: 0 }, activity: "travel", threat: .2 });
    assert.equal(approach.arenaProximity, "near");
    assert.equal(selectWildsAudioProgram(approach, memory, 9_000).id, "mortal-arena-approach");
    assert.equal(selectWildsAudioProgram(projectWildsAudioScene({ position: { x: 0, z: 0 }, activity: "idle" }), memory, 9_000).id, "mortal-arena-idle");
  });

  it("prioritizes retirement and sacrifice memorials over combat", () => {
    const retirement = projectWildsAudioScene({ position: { x: 0, z: 0 }, activity: "combat", combatPhase: "final", vitalityBand: "retired", memorial: true });
    assert.equal(selectWildsAudioProgram(retirement, memory, 9_000).id, "canonical-retirement");
    const sacrifice = { ...retirement, vitalityBand: "critical" as const, victorySacrifice: true };
    assert.equal(selectWildsAudioProgram(sacrifice, memory, 9_000).id, "victory-sacrifice");
  });

  it("holds an equal-priority program briefly to prevent musical flicker", () => {
    const scene = projectWildsAudioScene({ position: { x: 80, z: 80 }, districtId: "mosslight-atelier", activity: "idle" });
    const held = selectWildsAudioProgram(scene, { activeProgramId: "district-dawn-commons", enteredAt: 7_000, recent: [] }, 9_000);
    assert.equal(held.id, "district-dawn-commons");
    assert.equal(selectWildsAudioProgram(scene, { activeProgramId: "district-dawn-commons", enteredAt: 1_000, recent: [] }, 9_000).id, "district-mosslight-atelier");
  });

  it("lets weather color exploration without replacing its musical identity", () => {
    const scene = projectWildsAudioScene({ position: { x: 80, z: 80 }, weather: "pollen-drift", activity: "travel" });
    const program = selectWildsAudioProgram(scene, memory, 9_000);
    assert.equal(program.id, "biome-heartwood");
    assert.deepEqual(program.layers, ["exploration-theme", "forest-ambience", "weather-pollen"]);
  });

  it("crossfades decoded location layers and leaves effects independently playable", async () => {
    const starts: string[] = [];
    const ramps: number[] = [];
    const param = {
      setValueAtTime(value: number) { ramps.push(value); },
      exponentialRampToValueAtTime(value: number) { ramps.push(value); }
    };
    const runtime = createWildsAudioRuntime(() => ({
      currentTime: 10, destination: {}, resume: async () => {}, close: async () => {},
      createOscillator: () => ({ type: "sine", frequency: param, connect() {}, disconnect() {}, start() {}, stop() {} }),
      createGain: () => ({ gain: param, connect() {}, disconnect() {} }),
      decodeAudioData: async (data) => ({ id: new Uint8Array(data)[0] }),
      createBufferSource: () => ({ buffer: null, loop: false, connect() {}, disconnect() {}, start() { starts.push("buffer"); }, stop() {} })
    }), async (path) => ({ ok: true, arrayBuffer: async () => new Uint8Array([path.includes("boss") ? 2 : 1]).buffer }));
    await runtime.unlock();
    await runtime.setScene(projectWildsAudioScene({ position: { x: 80, z: 80 } }));
    await runtime.preload(["strike-slice"]);
    runtime.play("battle-hit");
    await runtime.setScene(projectWildsAudioScene({ position: { x: 0, z: 0 }, activity: "combat", combatPhase: "final" }));
    assert.ok(starts.length >= 4);
    assert.ok(ramps.some((value) => value === .72 * .3));
    assert.equal(runtime.activeProgramId(), "mortal-arena-final");
  });
});
