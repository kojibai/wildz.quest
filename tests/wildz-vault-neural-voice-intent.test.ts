import assert from "node:assert/strict";
import test from "node:test";
import { CreatureConsciousnessPanel } from "../src/features/play/CreatureConsciousnessPanel";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { deriveKaiKlokMomentFromUPulse } from "../src/features/play/kai-klok-moment";
import { beginCreatureVoiceStream } from "../src/features/play/creature-voice-playback";
import { localNeuralVoiceReady } from "../src/features/play/local-neural-voice";
import { wildzStreamingVoiceProfile } from "../src/lib/receiz/wildz-voice-lock";
import { mountPanelComponent, panelElements } from "./support/panel-component-harness";

/** The real panel and playback adapter run here. Only platform Worker, audio,
 * and transport boundaries are replaced, so the test observes whether browsing
 * actually asks the acoustic worker to allocate its model. */
test("Vault browsing starts no neural worker; a voice-enabled message starts its existing preparation", async () => {
  const ownerReceizId = "voice_intent_keeper", capturedAt = "2026-10-10T12:00:00.000Z";
  const card = (encounterId: string) => admitLegacyCard(sealCollectedCard({
    formId: "mintcub-1", ownerReceizId, encounterId, capturedAt
  }), capturedAt);
  const first = card("voice-intent-first"), second = card("voice-intent-second");
  const workers: { url: string; options?: WorkerOptions; messages: unknown[] }[] = [];
  const descriptors = new Map(["window", "Worker", "fetch", "navigator"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const target = new EventTarget();
  Object.assign(target, { cancelAnimationFrame() {} });
  class PlatformWorker extends EventTarget {
    readonly messages: unknown[] = [];
    constructor(url: URL, options?: WorkerOptions) {
      super();
      workers.push({ url: String(url), options, messages: this.messages });
    }
    postMessage(message: unknown) { this.messages.push(message); }
    terminate() {}
  }
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: target },
    Worker: { configurable: true, value: PlatformWorker },
    navigator: { configurable: true, value: { onLine: true } },
    // Reject before any text/audio is produced; the allocation request occurs
    // synchronously at submit, independently of observer authority or response.
    fetch: { configurable: true, value: async () => Response.json({ error: "creature_observer_card_invalid" }, { status: 403 }) }
  });
  const observed: unknown[] = [];
  const base: Parameters<typeof CreatureConsciousnessPanel>[0] = {
    asset: first, ownerReceizId,
    kaiMoment: deriveKaiKlokMomentFromUPulse({ uPulse: 1_000_000, authority: "local" }),
    playerPosition: { x: 0, z: 0 }, onObserved: turn => { observed.push(turn); }
  };
  const panel = mountPanelComponent(CreatureConsciousnessPanel);
  let props = base;
  const render = () => { const tree = panel.render(props); panel.flushEffects(); return tree; };
  const click = (label: string) => {
    const button = panelElements(render()).find(element => element.type === "button" && (element.props["aria-label"] === label || element.props.children === label));
    assert.ok(button, `missing ${label}`);
    (button.props.onClick as () => void)();
  };
  const settle = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
  try {
    render();
    assert.equal(workers.length, 0, "opening the Vault must not request the 82M acoustic model");
    target.dispatchEvent(new Event("scroll")); render();
    props = { ...base, asset: second }; render();
    target.dispatchEvent(new Event("scroll")); render();
    props = { ...base, playerPosition: { x: 1, z: 2 } }; render();
    assert.equal(workers.length, 0, "scroll, selection, and presentation updates must remain acoustic-allocation free");

    click("Turn off creature voice");
    click("How are you feeling?"); await settle();
    assert.equal(workers.length, 0, "a text-only conversation must not prepare neural voice");

    click("Turn on creature voice");
    props = { ...base, disabled: true }; render();
    click("How are you feeling?"); await settle();
    assert.equal(workers.length, 0, "a retired creature must not prepare neural voice");

    props = base; render();
    click("How are you feeling?");
    assert.equal(workers.length, 1, "an enabled spoken message must preserve local neural preparation");
    assert.equal(workers[0]!.options?.name, "wildz-proof-voice");
    assert.match(workers[0]!.url, /local-neural-voice\.worker\.ts$/);
    assert.deepEqual(workers[0]!.messages, [{ type: "prepare" }]);
    await settle();
    assert.deepEqual(observed, [], "a rejected observer request must not append a memory");
  } finally {
    panel.unmount();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("a cold spoken reply plays its existing compact proof voice without waiting for neural readiness", async () => {
  const descriptors = new Map(["window", "requestAnimationFrame", "cancelAnimationFrame"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const sources: { buffer: { getChannelData: () => Float32Array } | null; onended: (() => void) | null; startAt: number | null }[] = [];
  const engines: unknown[] = [];
  const node = () => ({ connect() {}, disconnect() {} });
  const target = new EventTarget();
  let context: PlatformAudioContext | undefined;
  class PlatformAudioContext {
    state = "running";
    currentTime = 0;
    destination = {};
    constructor() { context = this; }
    createAnalyser() { return { ...node(), fftSize: 64, getByteTimeDomainData: (bytes: Uint8Array) => bytes.fill(128) }; }
    createBiquadFilter() { return { ...node(), frequency: { value: 0 }, Q: { value: 0 }, gain: { value: 0 } }; }
    createGain() { return { ...node(), gain: { value: 0 } }; }
    createBuffer(_channels: number, samples: number, rate: number) {
      const values = new Float32Array(samples);
      return { duration: samples / rate, getChannelData: () => values };
    }
    createBufferSource() {
      const source = {
        ...node(), buffer: null as { getChannelData: () => Float32Array } | null,
        playbackRate: { value: 1 }, detune: { value: 0 }, onended: null as (() => void) | null,
        startAt: null as number | null,
        start(time: number) { source.startAt = time; }, stop() {}
      };
      sources.push(source);
      return source;
    }
  }
  Object.assign(target, { AudioContext: PlatformAudioContext });
  target.addEventListener("wildz-creature-voice-latency", event => { engines.push((event as CustomEvent).detail.engine); });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: target },
    requestAnimationFrame: { configurable: true, value: () => 1 },
    cancelAnimationFrame: { configurable: true, value: () => undefined }
  });
  const controller = new AbortController();
  const stream = beginCreatureVoiceStream("cold-proof-voice", wildzStreamingVoiceProfile("expression:0123456789abcdef"), {
    uPulse: 1_000_000, birthMomentMs: Date.parse("2026-10-10T12:00:00.000Z")
  }, controller.signal);
  try {
    assert.equal(localNeuralVoiceReady(), false, "the platform worker never reports a ready model in this test");
    stream.pushText("We can explore our trail together.");
    stream.finish();
    for (let index = 0; index < 12; index++) await Promise.resolve();
    assert.equal(sources.length, 1, "the compact acoustic floor must schedule audio with no ready model");
    assert.equal(sources[0]!.startAt, .012);
    assert.ok(sources[0]!.buffer!.getChannelData().some(sample => sample !== 0));
    assert.deepEqual(engines, ["receiz-proof-source-filter"]);
    sources[0]!.onended?.();
    assert.equal(await stream.completed, true);
  } finally {
    controller.abort();
    if (context) context.state = "closed";
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
