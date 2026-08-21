import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

// Bounded preview compiler/replayer only. Boundary candidates are not rewards,
// battle results, inventory, Phi, or world authority.

export type WildsAuthoredNodeKind = "start" | "finish" | "checkpoint" | "door" | "switch" | "pressure-plate" | "key" | "kai-timer" | "puzzle" | "traversal-gate" | "habitat" | "battle-arena" | "race" | "hazard" | "processor" | "shop" | "reward" | "score" | "reset";

export type WildsAuthoredNode = Readonly<{
  id: string;
  kind: WildsAuthoredNodeKind;
  accessibleLabel: string;
  params: Readonly<Record<string, unknown>>;
}>;

export type WildsAuthoredTransition = Readonly<{ from: string; event: string; to: string }>;
export type WildsAuthoredAuthorityPreview = Readonly<{
  rewardRefs: readonly Readonly<{ subjectId: string; head: string }>[];
  processorInputSubjectIds: readonly string[];
  shopListingSubjectIds: readonly string[];
  traversalCapabilities: readonly string[];
}>;

export type WildsAuthoredExperienceMachine = Readonly<{
  schema: "wildz.authored-experience-preview.v1";
  experienceId: string;
  structureId: string;
  structureHead: string;
  machineDigest: string;
  valid: boolean;
  reasons: readonly string[];
  nodes: readonly WildsAuthoredNode[];
  transitions: readonly WildsAuthoredTransition[];
  startNodeId: string | null;
  finishNodeIds: readonly string[];
  authority: WildsAuthoredAuthorityPreview;
  accessibility: Readonly<{ summary: string; reducedMotionSafe: boolean; nonColorCues: boolean }>;
  physical: false;
  publish: "blocked-receiz-v122";
  writes: 0;
}>;

const KINDS = new Set<WildsAuthoredNodeKind>(["start", "finish", "checkpoint", "door", "switch", "pressure-plate", "key", "kai-timer", "puzzle", "traversal-gate", "habitat", "battle-arena", "race", "hazard", "processor", "shop", "reward", "score", "reset"]);
const FORBIDDEN_KEYS = new Set(["code", "script", "javascript", "function", "handler", "eval", "module", "import"]);

function freeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const entry of value) freeze(entry);
    return Object.freeze(value);
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) freeze(entry);
    return Object.freeze(value);
  }
  return value;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function containsExecutable(value: unknown): boolean {
  if (typeof value === "function") return true;
  if (Array.isArray(value)) return value.some(containsExecutable);
  const object = record(value);
  if (!object) return false;
  return Object.entries(object).some(([key, child]) => FORBIDDEN_KEYS.has(key.toLowerCase()) || containsExecutable(child));
}

function validId(value: unknown) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9:._-]{0,95}$/i.test(value);
}

function validNodeParams(node: WildsAuthoredNode) {
  if (containsExecutable(node.params)) return false;
  const params = node.params;
  const keys = Object.keys(params).sort();
  const exactKeys = (...allowed: string[]) => keys.length === allowed.length && allowed.sort().every((key, index) => keys[index] === key);
  if (node.kind === "reward") return exactKeys("capacity", "rewardHead", "rewardSubjectId") && validId(params.rewardSubjectId) && validId(params.rewardHead) && Number.isSafeInteger(params.capacity) && Number(params.capacity) > 0 && Number(params.capacity) <= 100;
  if (node.kind === "score") return exactKeys("delta") && Number.isSafeInteger(params.delta) && Math.abs(Number(params.delta)) <= 100;
  if (node.kind === "hazard") return exactKeys("damage") && Number.isFinite(params.damage) && Number(params.damage) >= 0 && Number(params.damage) <= 25;
  if (node.kind === "kai-timer") return exactKeys("durationPulses") && Number.isSafeInteger(params.durationPulses) && Number(params.durationPulses) >= 1 && Number(params.durationPulses) <= 10_000;
  if (node.kind === "door") return (exactKeys("initialOpen") || exactKeys("initialOpen", "requiredKeyId"))
    && typeof params.initialOpen === "boolean" && (params.requiredKeyId === undefined || validId(params.requiredKeyId));
  if (node.kind === "switch" || node.kind === "pressure-plate") return exactKeys("targetId") && validId(params.targetId);
  if (node.kind === "key") return exactKeys("keyId") && validId(params.keyId);
  if (node.kind === "puzzle") return exactKeys("tokenCount") && Number.isSafeInteger(params.tokenCount) && Number(params.tokenCount) >= 1 && Number(params.tokenCount) <= 16;
  if (node.kind === "traversal-gate") return exactKeys("capability") && validId(params.capability);
  if (node.kind === "processor") return exactKeys("inputSubjectId", "maxCapacity", "outputKind") && validId(params.inputSubjectId) && validId(params.outputKind) && Number.isSafeInteger(params.maxCapacity) && Number(params.maxCapacity) >= 1 && Number(params.maxCapacity) <= 100;
  if (node.kind === "shop") return exactKeys("listingSubjectIds") && Array.isArray(params.listingSubjectIds) && params.listingSubjectIds.length <= 16 && params.listingSubjectIds.every(validId);
  return keys.length === 0;
}

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

export function compileWildsAuthoredExperience(input: Readonly<{
  experienceId: string;
  structureId: string;
  structureHead: string;
  nodes: readonly WildsAuthoredNode[];
  transitions: readonly WildsAuthoredTransition[];
  accessibility: Readonly<{ summary: string; reducedMotionSafe: boolean; nonColorCues: boolean }>;
  authority: WildsAuthoredAuthorityPreview;
}>): WildsAuthoredExperienceMachine {
  if (input.nodes.length > 64 || input.transitions.length > 128
    || input.authority.rewardRefs.length > 32 || input.authority.processorInputSubjectIds.length > 32
    || input.authority.shopListingSubjectIds.length > 32 || input.authority.traversalCapabilities.length > 32) throw new Error("wilds_authored_experience_bounds_exceeded");
  const reasons: string[] = [];
  if (!validId(input.experienceId) || !validId(input.structureId) || !validId(input.structureHead)) reasons.push("identity-invalid");
  if (!input.accessibility.summary.trim() || input.accessibility.summary.length > 240 || !input.accessibility.reducedMotionSafe || !input.accessibility.nonColorCues) reasons.push("accessibility-required");
  const rewardRefs = new Set(input.authority.rewardRefs.map((value) => `${value.subjectId}\u0000${value.head}`));
  const processorInputs = new Set(input.authority.processorInputSubjectIds);
  const shopListings = new Set(input.authority.shopListingSubjectIds);
  const traversalCapabilities = new Set(input.authority.traversalCapabilities);
  const authorityValues = [...input.authority.rewardRefs.flatMap((value) => [value.subjectId, value.head]), ...processorInputs, ...shopListings, ...traversalCapabilities];
  if (authorityValues.some((value) => !validId(value))
    || rewardRefs.size !== input.authority.rewardRefs.length
    || processorInputs.size !== input.authority.processorInputSubjectIds.length
    || shopListings.size !== input.authority.shopListingSubjectIds.length
    || traversalCapabilities.size !== input.authority.traversalCapabilities.length) reasons.push("authority-invalid");
  const ids = new Set<string>();
  for (const node of input.nodes) {
    if (!validId(node.id) || ids.has(node.id) || !KINDS.has(node.kind) || !node.accessibleLabel.trim() || node.accessibleLabel.length > 120 || !validNodeParams(node)) reasons.push("node-invalid");
    ids.add(node.id);
  }
  const starts = input.nodes.filter((node) => node.kind === "start");
  const finishes = input.nodes.filter((node) => node.kind === "finish");
  const nodesById = new Map(input.nodes.map((node) => [node.id, node]));
  if (input.nodes.some((node) => (node.kind === "switch" || node.kind === "pressure-plate")
    && nodesById.get(String(node.params.targetId))?.kind !== "door")) reasons.push("target-invalid");
  if (input.nodes.some((node) => node.kind === "reward" && !rewardRefs.has(`${String(node.params.rewardSubjectId)}\u0000${String(node.params.rewardHead)}`))
    || input.nodes.some((node) => node.kind === "processor" && !processorInputs.has(String(node.params.inputSubjectId)))
    || input.nodes.some((node) => node.kind === "shop" && (!Array.isArray(node.params.listingSubjectIds) || !node.params.listingSubjectIds.every((value) => shopListings.has(String(value)))))
    || input.nodes.some((node) => node.kind === "traversal-gate" && !traversalCapabilities.has(String(node.params.capability)))) reasons.push("authority-reference-invalid");
  if (starts.length !== 1) reasons.push("single-start-required");
  if (finishes.length === 0) reasons.push("finish-required");
  for (const transition of input.transitions) {
    if (!ids.has(transition.from) || !ids.has(transition.to) || !validId(transition.event)) reasons.push("transition-invalid");
    const source = nodesById.get(transition.from);
    if (source?.kind === "puzzle" && transition.event !== `solve:${String(source.params.tokenCount)}`) reasons.push("transition-semantic-invalid");
  }
  if (input.transitions.some((transition) => finishes.some((finish) => finish.id === transition.from))) reasons.push("finish-not-terminal");
  if (new Set(input.transitions.map((transition) => `${transition.from}:${transition.event}`)).size !== input.transitions.length) reasons.push("transition-nondeterministic");
  if (starts.length === 1) {
    const reached = new Set<string>([starts[0]!.id]);
    for (let pass = 0; pass < input.nodes.length; pass += 1) {
      for (const transition of input.transitions) if (reached.has(transition.from)) reached.add(transition.to);
    }
    if (!finishes.some((finish) => reached.has(finish.id))) reasons.push("finish-unreachable");
    if (reached.size !== input.nodes.length) reasons.push("node-unreachable");
    const reachesFinish = new Set(finishes.map((finish) => finish.id));
    for (let pass = 0; pass < input.nodes.length; pass += 1) {
      for (const transition of input.transitions) if (reachesFinish.has(transition.to)) reachesFinish.add(transition.from);
    }
    if (input.nodes.some((node) => !reachesFinish.has(node.id))) reasons.push("node-dead-end");

    const semanticReached = new Set<string>();
    const queue: Array<{ nodeId: string; flags: Set<string> }> = [{ nodeId: starts[0]!.id, flags: new Set() }];
    const visitedStates = new Set<string>();
    while (queue.length > 0 && visitedStates.size <= 4096) {
      const state = queue.shift()!;
      const stateKey = `${state.nodeId}\u0000${[...state.flags].sort().join("\u0000")}`;
      if (visitedStates.has(stateKey)) continue;
      visitedStates.add(stateKey);
      semanticReached.add(state.nodeId);
      const source = nodesById.get(state.nodeId)!;
      if (source.kind === "door" && source.params.initialOpen !== true
        && !state.flags.has(`active:${source.id}`)
        && !(typeof source.params.requiredKeyId === "string" && state.flags.has(`key:${source.params.requiredKeyId}`))) continue;
      for (const transition of input.transitions) {
        if (transition.from !== state.nodeId) continue;
        const flags = new Set(state.flags);
        if ((source.kind === "switch" || source.kind === "pressure-plate") && typeof source.params.targetId === "string") flags.add(`active:${source.params.targetId}`);
        const destination = nodesById.get(transition.to)!;
        if (destination.kind === "key" && typeof destination.params.keyId === "string") flags.add(`key:${destination.params.keyId}`);
        if (destination.kind === "reset") flags.clear();
        queue.push({ nodeId: transition.to, flags });
      }
    }
    if (visitedStates.size > 4096) reasons.push("semantic-state-limit");
    if (!finishes.some((finish) => semanticReached.has(finish.id))) reasons.push("finish-semantically-unreachable");
    if (semanticReached.size !== input.nodes.length) reasons.push("node-semantically-unreachable");
  }
  const valid = reasons.length === 0;
  const basis = { schema: "wildz.authored-experience-preview.v1", ...input };
  return freeze({
    schema: "wildz.authored-experience-preview.v1",
    experienceId: input.experienceId,
    structureId: input.structureId,
    structureHead: input.structureHead,
    machineDigest: digest(basis),
    valid,
    reasons: [...new Set(reasons)],
    nodes: valid ? input.nodes.map((node) => ({ ...node, params: { ...node.params } })) : [],
    transitions: valid ? input.transitions.map((transition) => ({ ...transition })) : [],
    startNodeId: valid ? starts[0]!.id : null,
    finishNodeIds: valid ? finishes.map((node) => node.id) : [],
    authority: freeze({
      rewardRefs: input.authority.rewardRefs.map((value) => ({ ...value })),
      processorInputSubjectIds: [...input.authority.processorInputSubjectIds],
      shopListingSubjectIds: [...input.authority.shopListingSubjectIds],
      traversalCapabilities: [...input.authority.traversalCapabilities]
    }),
    accessibility: freeze({ ...input.accessibility }),
    physical: false,
    publish: "blocked-receiz-v122",
    writes: 0
  });
}

export function replayWildsAuthoredExperience(
  machine: WildsAuthoredExperienceMachine,
  actions: readonly Readonly<{ nodeId: string; event: string; kaiPulse: string; puzzleTokens?: readonly string[] }>[],
  context: Readonly<{ capabilities: readonly string[] }> = { capabilities: [] }
) {
  if (!machine.valid || !machine.startNodeId) throw new Error("wilds_authored_experience_invalid");
  if (!Object.isFrozen(machine) || !Object.isFrozen(machine.nodes) || !Object.isFrozen(machine.transitions)) throw new Error("wilds_authored_machine_integrity_invalid");
  const canonicalMachine = compileWildsAuthoredExperience({
    experienceId: machine.experienceId,
    structureId: machine.structureId,
    structureHead: machine.structureHead,
    nodes: machine.nodes,
    transitions: machine.transitions,
    accessibility: machine.accessibility,
    authority: machine.authority
  });
  if (!canonicalMachine.valid || canonicalPortableCardJson(canonicalMachine) !== canonicalPortableCardJson(machine)) throw new Error("wilds_authored_machine_integrity_invalid");
  if (actions.length > 256 || context.capabilities.length > 32) throw new Error("wilds_authored_replay_bounds_exceeded");
  if (context.capabilities.some((value) => !validId(value) || !machine.authority.traversalCapabilities.includes(value))) throw new Error("wilds_authored_capability_invalid");
  const byId = new Map(machine.nodes.map((node) => [node.id, node]));
  let currentNodeId = machine.startNodeId;
  let priorKai = -1n;
  let score = 0;
  let checkpointNodeId: string | null = null;
  const flags = new Set<string>();
  let enteredAtKaiPulse: bigint | null = null;
  const boundaryCandidates: Readonly<{
    kind: "reward-request";
    nodeId: string;
    rewardSubjectId: string;
    rewardHead: string;
    capacity: number;
    physical: false;
    publish: "blocked-receiz-v122";
  }>[] = [];
  const mutableBoundaries = boundaryCandidates as unknown as Array<(typeof boundaryCandidates)[number]>;
  for (const action of actions) {
    if (action.nodeId !== currentNodeId) throw new Error("wilds_authored_action_order_invalid");
    if (!/^(?:0|[1-9]\d{0,77})$/.test(action.kaiPulse)) throw new Error("wilds_authored_kai_invalid");
    const actionKai = BigInt(action.kaiPulse);
    if (actionKai < priorKai) throw new Error("wilds_authored_kai_invalid");
    priorKai = actionKai;
    const transition = machine.transitions.find((candidate) => candidate.from === currentNodeId && candidate.event === action.event);
    if (!transition) throw new Error("wilds_authored_transition_invalid");
    const source = byId.get(currentNodeId)!;
    if (source.kind === "kai-timer" && (enteredAtKaiPulse === null || actionKai - enteredAtKaiPulse < BigInt(Number(source.params.durationPulses)))) throw new Error("wilds_authored_timer_not_ready");
    if (source.kind === "door" && source.params.initialOpen !== true
      && !flags.has(`active:${source.id}`)
      && !(typeof source.params.requiredKeyId === "string" && flags.has(`key:${source.params.requiredKeyId}`))) throw new Error("wilds_authored_door_closed");
    if (source.kind === "traversal-gate" && !context.capabilities.includes(String(source.params.capability))) throw new Error("wilds_authored_traversal_capability_required");
    if (source.kind === "puzzle") {
      const tokens = action.puzzleTokens;
      if (!tokens || tokens.length !== Number(source.params.tokenCount) || tokens.length > 16
        || tokens.some((value) => !validId(value)) || new Set(tokens).size !== tokens.length) throw new Error("wilds_authored_puzzle_evidence_invalid");
    }
    if ((source.kind === "switch" || source.kind === "pressure-plate") && typeof source.params.targetId === "string") flags.add(`active:${source.params.targetId}`);
    currentNodeId = transition.to;
    const destination = byId.get(currentNodeId)!;
    enteredAtKaiPulse = destination.kind === "kai-timer" ? actionKai : null;
    if (destination.kind === "checkpoint") checkpointNodeId = destination.id;
    if (destination.kind === "score") score = Math.max(-10_000, Math.min(10_000, score + Number(destination.params.delta)));
    if (destination.kind === "key" && typeof destination.params.keyId === "string") flags.add(`key:${destination.params.keyId}`);
    if (destination.kind === "reset") {
      flags.clear();
      score = 0;
      checkpointNodeId = null;
    }
    if (destination.kind === "reward") {
      mutableBoundaries.push(freeze({
        kind: "reward-request",
        nodeId: destination.id,
        rewardSubjectId: String(destination.params.rewardSubjectId),
        rewardHead: String(destination.params.rewardHead),
        capacity: Number(destination.params.capacity),
        physical: false,
        publish: "blocked-receiz-v122"
      }));
    }
  }
  return freeze({
    schema: "wildz.authored-experience-replay-preview.v1" as const,
    machineDigest: machine.machineDigest,
    currentNodeId,
    complete: machine.finishNodeIds.includes(currentNodeId),
    score,
    checkpointNodeId,
    flags: [...flags].sort(),
    boundaryCandidates: mutableBoundaries,
    physical: false as const,
    publish: "blocked-receiz-v122" as const,
    writes: 0 as const
  });
}
