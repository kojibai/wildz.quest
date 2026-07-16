import { fromFixed, toFixed } from "./deterministic-number";
import { runFixedSteps } from "./fixed-step";

export { fromFixed, runFixedSteps, toFixed };

export type WildzInputFrame<Input> = {
  actorId: string;
  sequence: number;
  atTick: number;
  input: Readonly<Input>;
};

export type WildzGameSnapshot<State> = {
  moduleId: string;
  rulesVersion: string;
  tick: number;
  state: Readonly<State>;
  digest: string;
};

export type WildzGameModule<Setup, State, Input, Result, Event> = {
  id: string;
  rulesVersion: string;
  tickRate: number;
  limits: { maxTicks: number; maxInputs: number; maxEntities: number };
  create(setup: Readonly<Setup>): State;
  step(state: Readonly<State>, frames: readonly WildzInputFrame<Input>[]): State;
  complete(state: Readonly<State>): Result | null;
  propose(result: Readonly<Result>): readonly Event[];
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  return value;
}

export function deterministicDigest(value: unknown): string {
  const text = JSON.stringify(stableValue(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function replayGame<Setup, State, Input, Result, Event>(
  module: WildzGameModule<Setup, State, Input, Result, Event>,
  setup: Readonly<Setup>,
  frames: readonly WildzInputFrame<Input>[],
  ticks = module.limits.maxTicks
): { snapshot: WildzGameSnapshot<State>; result: Result | null; events: readonly Event[] } {
  if (frames.length > module.limits.maxInputs) throw new Error(`Game input cap exceeded: ${module.limits.maxInputs}`);
  if (!Number.isInteger(ticks) || ticks < 0 || ticks > module.limits.maxTicks) throw new Error(`Game tick cap exceeded: ${module.limits.maxTicks}`);
  const actors = new Set(frames.map((frame) => frame.actorId));
  if (actors.size > module.limits.maxEntities) throw new Error(`Game entity cap exceeded: ${module.limits.maxEntities}`);
  const sorted = [...frames].sort((left, right) => left.atTick - right.atTick || left.actorId.localeCompare(right.actorId) || left.sequence - right.sequence);
  sorted.forEach((frame) => {
    if (!frame.actorId || !Number.isInteger(frame.sequence) || !Number.isInteger(frame.atTick) || frame.atTick < 0 || frame.atTick > ticks) throw new Error("Invalid game input frame");
  });
  let state = module.create(setup);
  for (let tick = 1; tick <= ticks; tick += 1) {
    const atTick = sorted.filter((frame) => frame.atTick === tick);
    state = module.step(state, atTick);
  }
  const result = module.complete(state);
  const snapshot = {
    moduleId: module.id,
    rulesVersion: module.rulesVersion,
    tick: ticks,
    state,
    digest: deterministicDigest({ moduleId: module.id, rulesVersion: module.rulesVersion, tick: ticks, state })
  };
  return { snapshot, result, events: result === null ? [] : module.propose(result) };
}
