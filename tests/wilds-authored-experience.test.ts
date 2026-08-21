import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compileWildsAuthoredExperience, replayWildsAuthoredExperience } from "../src/features/play/wilds-authored-experience";

function validDefinition() {
  return {
    experienceId: "experience:trail",
    structureId: "structure:trail",
    structureHead: "head:structure:trail",
    nodes: [
      { id: "start", kind: "start", accessibleLabel: "Begin trail", params: {} },
      { id: "switch", kind: "switch", accessibleLabel: "Open the trail gate", params: { targetId: "door" } },
      { id: "door", kind: "door", accessibleLabel: "Trail gate", params: { initialOpen: false } },
      { id: "checkpoint", kind: "checkpoint", accessibleLabel: "Trail checkpoint", params: {} },
      { id: "score", kind: "score", accessibleLabel: "Trail score", params: { delta: 25 } },
      { id: "reward", kind: "reward", accessibleLabel: "Verified reward", params: { rewardSubjectId: "reward:one", rewardHead: "head:reward:one", capacity: 1 } },
      { id: "finish", kind: "finish", accessibleLabel: "Finish trail", params: {} }
    ],
    transitions: [
      { from: "start", event: "begin", to: "switch" },
      { from: "switch", event: "activate", to: "door" },
      { from: "door", event: "enter", to: "checkpoint" },
      { from: "checkpoint", event: "continue", to: "score" },
      { from: "score", event: "claim", to: "reward" },
      { from: "reward", event: "finish", to: "finish" }
    ],
    accessibility: { summary: "Follow the trail, open its gate, and reach the finish.", reducedMotionSafe: true, nonColorCues: true }
    ,authority: {
      rewardRefs: [{ subjectId: "reward:one", head: "head:reward:one" }],
      processorInputSubjectIds: [],
      shopListingSubjectIds: [],
      traversalCapabilities: []
    }
  } as const;
}

describe("bounded declarative Wilds gameplay", () => {
  it("compiles a reachable deterministic state machine with no executable code or authority", () => {
    const first = compileWildsAuthoredExperience(validDefinition());
    const second = compileWildsAuthoredExperience(validDefinition());
    assert.deepEqual(second, first);
    assert.equal(first.valid, true);
    assert.match(first.machineDigest, /^sha256:[a-f0-9]{64}$/);
    assert.equal(first.physical, false);
    assert.equal(first.publish, "blocked-receiz-v122");
    assert.equal(first.writes, 0);
    assert.equal(first.nodes.length, 7);
  });

  it("replays the same player actions byte-identically and emits boundary candidates without rewards", () => {
    const machine = compileWildsAuthoredExperience(validDefinition());
    const actions = [
      { nodeId: "start", event: "begin", kaiPulse: "10" },
      { nodeId: "switch", event: "activate", kaiPulse: "11" },
      { nodeId: "door", event: "enter", kaiPulse: "12" },
      { nodeId: "checkpoint", event: "continue", kaiPulse: "13" },
      { nodeId: "score", event: "claim", kaiPulse: "14" },
      { nodeId: "reward", event: "finish", kaiPulse: "15" }
    ] as const;
    const first = replayWildsAuthoredExperience(machine, actions);
    const restored = replayWildsAuthoredExperience(machine, JSON.parse(JSON.stringify(actions)));
    assert.deepEqual(restored, first);
    assert.equal(first.complete, true);
    assert.equal(first.score, 25);
    assert.equal(first.checkpointNodeId, "checkpoint");
    assert.equal(first.boundaryCandidates.length, 1);
    assert.equal(first.boundaryCandidates[0]?.kind, "reward-request");
    assert.equal(first.boundaryCandidates[0]?.physical, false);
    assert.equal(first.writes, 0);
    assert.equal("proof" in first.boundaryCandidates[0]!, false);
  });

  it("rejects arbitrary code, unreachable exits, unbounded effects, and missing accessibility metadata", () => {
    const definition = validDefinition();
    const cases = [
      { ...definition, nodes: definition.nodes.map((node) => node.id === "switch" ? { ...node, params: { ...node.params, script: "world.inventory += 100" } } : node) },
      { ...definition, transitions: definition.transitions.filter((transition) => transition.to !== "finish") },
      { ...definition, nodes: definition.nodes.map((node) => node.id === "reward" ? { ...node, params: { ...node.params, capacity: 1_000_000 } } : node) },
      { ...definition, nodes: definition.nodes.map((node) => node.id === "reward" ? { ...node, params: { ...node.params, phi: 100 } } : node) },
      { ...definition, accessibility: { ...definition.accessibility, summary: "" } }
    ];
    for (const candidate of cases) {
      const compiled = compileWildsAuthoredExperience(candidate as never);
      assert.equal(compiled.valid, false);
      assert.equal(compiled.nodes.length, 0);
      assert.equal(compiled.physical, false);
      assert.equal(compiled.writes, 0);
    }
    const hiddenHazard = compileWildsAuthoredExperience({
      ...definition,
      nodes: [...definition.nodes, { id: "hidden", kind: "hazard", accessibleLabel: "Hidden hazard", params: { damage: 25 } }]
    });
    assert.equal(hiddenHazard.valid, false);
    assert.equal(hiddenHazard.reasons.includes("node-unreachable"), true);
    const inventedEffect = compileWildsAuthoredExperience({
      ...definition,
      nodes: definition.nodes.map((node) => node.id === "start" ? { ...node, params: { manufacturePhi: 100 } } : node)
    });
    assert.equal(inventedEffect.valid, false);
    assert.equal(inventedEffect.reasons.includes("node-invalid"), true);
    const imaginarySwitchTarget = compileWildsAuthoredExperience({
      ...definition,
      nodes: definition.nodes.map((node) => node.id === "switch" ? { ...node, params: { targetId: "door:missing" } } : node)
    });
    assert.equal(imaginarySwitchTarget.valid, false);
    assert.equal(imaginarySwitchTarget.reasons.includes("target-invalid"), true);
    const nonterminalFinish = compileWildsAuthoredExperience({
      ...definition,
      transitions: [...definition.transitions, { from: "finish", event: "again", to: "start" }]
    });
    assert.equal(nonterminalFinish.valid, false);
    assert.equal(nonterminalFinish.reasons.includes("finish-not-terminal"), true);
    const executable = compileWildsAuthoredExperience({
      ...definition,
      nodes: definition.nodes.map((node) => node.id === "start" ? { ...node, params: { action: () => "invent authority" } } : node)
    } as never);
    assert.equal(executable.valid, false);
    assert.equal(executable.reasons.includes("node-invalid"), true);
  });

  it("rejects nondeterministic, out-of-order, unknown, and noncanonical replay actions", () => {
    const machine = compileWildsAuthoredExperience(validDefinition());
    assert.throws(() => replayWildsAuthoredExperience(machine, [{ nodeId: "switch", event: "activate", kaiPulse: "10" }]), /action_order_invalid/);
    assert.throws(() => replayWildsAuthoredExperience(machine, [{ nodeId: "start", event: "unknown", kaiPulse: "10" }]), /transition_invalid/);
    assert.throws(() => replayWildsAuthoredExperience(machine, [{ nodeId: "start", event: "begin", kaiPulse: "not-kai" }]), /kai_invalid/);
    assert.throws(() => replayWildsAuthoredExperience(machine, [{ nodeId: "start", event: "begin", kaiPulse: `1${"0".repeat(80)}` }]), /kai_invalid/);
  });

  it("enforces timer, door, puzzle, traversal, and referenced-subject semantics", () => {
    const timerDefinition = {
      ...validDefinition(),
      nodes: [
        { id: "start", kind: "start", accessibleLabel: "Begin", params: {} },
        { id: "timer", kind: "kai-timer", accessibleLabel: "Wait for the tide", params: { durationPulses: 1000 } },
        { id: "reward", kind: "reward", accessibleLabel: "Tide reward", params: { rewardSubjectId: "reward:one", rewardHead: "head:reward:one", capacity: 1 } },
        { id: "finish", kind: "finish", accessibleLabel: "Finish", params: {} }
      ],
      transitions: [
        { from: "start", event: "begin", to: "timer" },
        { from: "timer", event: "ready", to: "reward" },
        { from: "reward", event: "finish", to: "finish" }
      ]
    } as const;
    const timer = compileWildsAuthoredExperience(timerDefinition);
    assert.equal(timer.valid, true);
    assert.throws(() => replayWildsAuthoredExperience(timer, [
      { nodeId: "start", event: "begin", kaiPulse: "100" },
      { nodeId: "timer", event: "ready", kaiPulse: "100" }
    ]), /timer_not_ready/);
    assert.equal(replayWildsAuthoredExperience(timer, [
      { nodeId: "start", event: "begin", kaiPulse: "100" },
      { nodeId: "timer", event: "ready", kaiPulse: "1100" }
    ]).boundaryCandidates.length, 1);

    const unboundReward = compileWildsAuthoredExperience({
      ...validDefinition(),
      nodes: validDefinition().nodes.map((node) => node.id === "reward" ? { ...node, params: { rewardSubjectId: "reward:foreign", rewardHead: "head:foreign", capacity: 1 } } : node)
    } as never);
    assert.equal(unboundReward.valid, false);
    assert.equal(unboundReward.reasons.includes("authority-reference-invalid"), true);

    const closedDoorDefinition = {
      ...validDefinition(),
      nodes: [
        { id: "start", kind: "start", accessibleLabel: "Begin", params: {} },
        { id: "door", kind: "door", accessibleLabel: "Closed gate", params: { initialOpen: false } },
        { id: "finish", kind: "finish", accessibleLabel: "Finish", params: {} }
      ],
      transitions: [{ from: "start", event: "begin", to: "door" }, { from: "door", event: "enter", to: "finish" }]
    } as const;
    const closedDoor = compileWildsAuthoredExperience(closedDoorDefinition);
    assert.equal(closedDoor.valid, false);
    assert.equal(closedDoor.reasons.includes("finish-semantically-unreachable"), true);

    const puzzleDefinition = {
      ...validDefinition(),
      nodes: [
        { id: "start", kind: "start", accessibleLabel: "Begin", params: {} },
        { id: "puzzle", kind: "puzzle", accessibleLabel: "Align two stones", params: { tokenCount: 2 } },
        { id: "finish", kind: "finish", accessibleLabel: "Finish", params: {} }
      ],
      transitions: [{ from: "start", event: "begin", to: "puzzle" }, { from: "puzzle", event: "skip", to: "finish" }]
    } as const;
    assert.equal(compileWildsAuthoredExperience(puzzleDefinition).reasons.includes("transition-semantic-invalid"), true);
    const playablePuzzle = compileWildsAuthoredExperience({
      ...puzzleDefinition,
      transitions: [{ from: "start", event: "begin", to: "puzzle" }, { from: "puzzle", event: "solve:2", to: "finish" }]
    });
    const puzzleActions = [{ nodeId: "start", event: "begin", kaiPulse: "1" }, { nodeId: "puzzle", event: "solve:2", kaiPulse: "2" }] as const;
    assert.throws(() => replayWildsAuthoredExperience(playablePuzzle, puzzleActions), /puzzle_evidence_invalid/);
    assert.equal(replayWildsAuthoredExperience(playablePuzzle, [puzzleActions[0], { ...puzzleActions[1], puzzleTokens: ["stone:a", "stone:b"] }]).complete, true);

    const gateDefinition = {
      ...validDefinition(),
      authority: { ...validDefinition().authority, traversalCapabilities: ["flight"] },
      nodes: [
        { id: "start", kind: "start", accessibleLabel: "Begin", params: {} },
        { id: "gate", kind: "traversal-gate", accessibleLabel: "Cross the wind gap", params: { capability: "flight" } },
        { id: "finish", kind: "finish", accessibleLabel: "Finish", params: {} }
      ],
      transitions: [{ from: "start", event: "begin", to: "gate" }, { from: "gate", event: "cross", to: "finish" }]
    } as const;
    const gate = compileWildsAuthoredExperience(gateDefinition);
    const gateActions = [{ nodeId: "start", event: "begin", kaiPulse: "1" }, { nodeId: "gate", event: "cross", kaiPulse: "2" }] as const;
    assert.throws(() => replayWildsAuthoredExperience(gate, gateActions), /traversal_capability_required/);
    assert.equal(replayWildsAuthoredExperience(gate, gateActions, { capabilities: ["flight"] }).complete, true);

    const arbitraryAuthorities = [
      { kind: "processor", params: { inputSubjectId: "resource:foreign", maxCapacity: 1, outputKind: "fiber" } },
      { kind: "shop", params: { listingSubjectIds: ["listing:foreign"] } }
    ] as const;
    for (const replacement of arbitraryAuthorities) {
      const compiled = compileWildsAuthoredExperience({
        ...validDefinition(),
        nodes: validDefinition().nodes.map((node) => node.id === "reward" ? { ...node, ...replacement, accessibleLabel: "Boundary" } : node)
      } as never);
      assert.equal(compiled.reasons.includes("authority-reference-invalid"), true);
    }
  });

  it("bounds accessibility and authority inputs before compiling", () => {
    const definition = validDefinition();
    assert.equal(compileWildsAuthoredExperience({ ...definition, accessibility: { ...definition.accessibility, summary: "x".repeat(241) } }).valid, false);
    assert.throws(() => compileWildsAuthoredExperience({ ...definition, authority: { ...definition.authority, rewardRefs: Array.from({ length: 33 }, (_, index) => ({ subjectId: `reward:${index}`, head: `head:${index}` })) } } as never), /bounds_exceeded/);
    const malformedShop = compileWildsAuthoredExperience({
      ...definition,
      nodes: definition.nodes.map((node) => node.id === "reward" ? { ...node, kind: "shop", params: {} } : node)
    } as never);
    assert.equal(malformedShop.valid, false);
    assert.equal(malformedShop.reasons.includes("node-invalid"), true);
  });

  it("rejects forged or deserialized machine envelopes before replay", () => {
    const machine = compileWildsAuthoredExperience(validDefinition());
    const actions = [{ nodeId: "start", event: "begin", kaiPulse: "1" }] as const;
    assert.throws(() => replayWildsAuthoredExperience(JSON.parse(JSON.stringify(machine)), actions), /machine_integrity_invalid/);
    assert.throws(() => replayWildsAuthoredExperience({ ...machine, machineDigest: "sha256:forged" }, actions), /machine_integrity_invalid/);
  });
});
