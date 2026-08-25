# Living-World Capability Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every proof-derived creature capability an always-present, truthful HUD control that performs a real local living-world action or deterministic guidance at Level 1.

**Architecture:** A frozen exhaustive registry maps canonical creature specialty families to presentation and action metadata. A pure bounded context projector derives per-control state from warmed local projections, and a typed dispatcher routes requests into existing traversal, work, excavation, discovery, condition, and world authorities without moving proof or network work into gameplay hot paths.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Three.js/React Three Fiber, Node test runner, Playwright CLI.

**Spec:** `docs/superpowers/specs/2026-08-25-living-world-capability-controls-design.md`

## Global Constraints

- The admitted creature proof and current living revision determine capability identity.
- Every displayed control has a meaningful tap result in every state.
- All innate special abilities are usable at Level 1; progression only improves their parameters.
- Missing remote transport never turns a valid local capability into an unavailable local action.
- Baseline explorer actions remain available where already designed; companions improve them instead of creating permission walls.
- Ordinary movement and rendering perform no proof verification, network work, sorting, terrain generation, timer creation, or React-state churn.
- Source proof admits durable mutations locally; SDK/API/MCP/public projections only distribute admitted results.
- Touch targets remain at least 44 CSS pixels at all supported viewport sizes.

## File Structure

- Create `src/features/play/wilds-world-capability-registry.ts`: exhaustive static family definitions, stable icon keys, cost model, progression dimensions, and action kinds.
- Create `src/features/play/wilds-world-capability-controls.ts`: proof-derived, deduplicated visible-control projection.
- Create `src/features/play/wilds-world-capability-context.ts`: pure bounded candidate ordering and five-state context projection.
- Create `src/features/play/wilds-world-capability-action.ts`: typed request resolution into immediate action, sustained toggle, source preview, or guidance.
- Create `src/features/play/WildsCapabilityControls.tsx`: accessible responsive HUD cluster with meters and stable family glyphs.
- Create `src/features/play/wilds-capability-runtime.ts`: transient sustained state and exact condition/cost transitions.
- Create `src/features/play/wilds-capability-presentation.ts`: actor pose, highlight, ribbon, envelope, and effect projections.
- Modify `src/features/play/PlayCampaign.tsx`: compose warmed context, dispatch resolved intents, commit through exact domain adapters, and emit fresh feedback.
- Modify `src/features/play/WildzWorldControls.tsx`: replace separate flight/work/climb controls with the unified cluster while retaining vertical traversal and construction controls.
- Modify `src/features/play/WildsWorldCanvas.tsx`: consume transient presentation projections without React work in the frame loop.
- Modify `src/features/play/WildsCreatureActor.tsx`: apply bounded capability pose/effect inputs to the existing companion actor.
- Modify `src/features/play/living-card-dossier.ts`: expose present function, capacity, growth, and next improvement for every canonical family.
- Modify `src/components/icons.tsx` and `app/globals.css`: stable family glyphs, compact meters, five-state styling, safe-area wrapping, and reduced-motion behavior.

---

### Task 1: Exhaustive Registry and Proof-Derived Control Projection

**Files:**
- Create: `src/features/play/wilds-world-capability-registry.ts`
- Create: `src/features/play/wilds-world-capability-controls.ts`
- Test: `tests/wilds-world-capability-registry.test.ts`
- Test: `tests/wilds-world-capability-controls.test.ts`

**Interfaces:**
- Consumes: `CreatureSpecialtyFamily`, `CreatureCapabilityIdentity`, `CreatureRuntimeCapabilities`, `WildsTraversalCapability`, and `WildsVisibleWorkFamily`.
- Produces: `WILDS_WORLD_CAPABILITY_REGISTRY`, `WildsWorldCapabilityFamily`, `WildsCapabilityDefinition`, and `projectWildsCapabilityControls(asset, condition)`.

- [ ] **Step 1: Write failing registry and control-projection tests**

```ts
it("defines a real world action for every canonical specialty family", () => {
  const families = ["flight", "glide", "swim", "dive", "current", "climb", "burrow", "balance", "light", "camouflage", "track", "break", "resist", "anchor", "rescue"] as const;
  assert.deepEqual(Object.keys(WILDS_WORLD_CAPABILITY_REGISTRY).sort(), [...families].sort());
  for (const family of families) assert.notEqual(WILDS_WORLD_CAPABILITY_REGISTRY[family].actionKind, "none");
});

it("projects only the active proof's deduplicated Level-1 controls", () => {
  const controls = projectWildsCapabilityControls(card("voltray-1"), emptyAdventureCondition("asset:1"));
  assert.equal(new Set(controls.map((entry) => entry.family)).size, controls.length);
  assert.equal(controls.every((entry) => entry.unlockLevel === 1), true);
  assert.equal(controls.some((entry) => entry.family === "flight"), true);
  assert.equal(controls.some((entry) => entry.family === "swim"), false);
});
```

- [ ] **Step 2: Run the focused tests and verify the missing-module failure**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json`

Expected: FAIL because the two capability modules do not exist.

- [ ] **Step 3: Implement the exhaustive definitions and projection**

```ts
export type WildsWorldCapabilityFamily = CreatureSpecialtyFamily | WildsVisibleWorkFamily;
export type WildsCapabilityActionKind = "aerial" | "aquatic" | "route" | "sustained" | "source" | "support";

export type WildsCapabilityDefinition = Readonly<{
  family: WildsWorldCapabilityFamily;
  label: string;
  icon: WildsCapabilityIconKey;
  actionKind: WildsCapabilityActionKind;
  contextKind: WildsCapabilityContextKind;
  baseCost: number;
  progression: readonly WildsCapabilityProgressionDimension[];
}>;

export const WILDS_WORLD_CAPABILITY_REGISTRY = Object.freeze({
  flight: define("flight", "Flight", "flight", "aerial", "open-air", 3, ["duration", "lift", "recovery"]),
  glide: define("glide", "Glide", "glide", "aerial", "launch", 1, ["duration", "control", "range"]),
  swim: define("swim", "Swim", "swim", "aquatic", "deep-water", 2, ["duration", "speed", "recovery"]),
  dive: define("dive", "Dive", "dive", "aquatic", "water-column", 3, ["depth", "duration", "pressure"]),
  current: define("current", "Read current", "current", "route", "water-flow", 2, ["range", "speed", "control"]),
  climb: define("climb", "Climb", "climb", "route", "climb-face", 3, ["height", "grip", "recovery"]),
  burrow: define("burrow", "Burrow", "burrow", "source", "excavation", 4, ["depth", "precision", "efficiency"]),
  balance: define("balance", "Balance", "balance", "support", "narrow-crossing", 2, ["stability", "range", "recovery"]),
  light: define("light", "Living light", "light", "sustained", "darkness", 1, ["radius", "duration", "clarity"]),
  camouflage: define("camouflage", "Camouflage", "camouflage", "sustained", "cover", 1, ["duration", "blend", "recovery"]),
  track: define("track", "Track", "track", "route", "trace", 1, ["range", "precision", "clarity"]),
  break: define("break", "Break", "break", "source", "breakable", 4, ["force", "precision", "efficiency"]),
  resist: define("resist", "Resist", "resist", "sustained", "hazard", 2, ["strength", "duration", "range"]),
  anchor: define("anchor", "Anchor", "anchor", "sustained", "force", 2, ["strength", "duration", "range"]),
  rescue: define("rescue", "Rescue", "rescue", "support", "emergency", 4, ["range", "margin", "recovery"]),
  lumber: define("lumber", "Gather timber", "timber", "source", "tree", 3, ["yield", "efficiency", "recovery"]),
  quarry: define("quarry", "Gather stone", "quarry", "source", "stone", 3, ["yield", "precision", "recovery"])
} satisfies Record<WildsWorldCapabilityFamily, WildsCapabilityDefinition>);
```

- [ ] **Step 4: Run the focused tests and confirm both pass**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-world-capability-registry.test.js .test-build/tests/wilds-world-capability-controls.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the registry boundary**

```bash
git add src/features/play/wilds-world-capability-registry.ts src/features/play/wilds-world-capability-controls.ts tests/wilds-world-capability-registry.test.ts tests/wilds-world-capability-controls.test.ts
git commit -m "Add exhaustive living capability registry"
```

### Task 2: Bounded Context and Deterministic Target Selection

**Files:**
- Create: `src/features/play/wilds-world-capability-context.ts`
- Test: `tests/wilds-world-capability-context.test.ts`

**Interfaces:**
- Consumes: `WildsProjectedCapabilityControl` and warmed `WildsCapabilityCandidate` summaries.
- Produces: `projectWildsCapabilityContext(input): ReadonlyMap<WildsWorldCapabilityFamily, WildsCapabilityContext>`.

- [ ] **Step 1: Write failing behavior tests for ordering, state, and bounded work**

```ts
it("orders eligible targets by urgency, distance, then stable id", () => {
  const context = projectWildsCapabilityContext(inputWithCandidates([
    candidate("far", 4, 9), candidate("near-b", 4, 2), candidate("near-a", 4, 2), candidate("urgent", 9, 8)
  ])).get("rescue")!;
  assert.deepEqual(context.candidateIds, ["urgent", "near-a", "near-b", "far"]);
  assert.equal(context.primaryTargetId, "urgent");
  assert.equal(context.state, "awakened");
});

it("returns guidance without fetching or mutating when no target exists", () => {
  const result = projectWildsCapabilityContext(inputWithCandidates([])).get("track")!;
  assert.equal(result.state, "guidance");
  assert.equal(result.intent.kind, "highlight-route");
});
```

- [ ] **Step 2: Run the test and verify it fails because the projector is missing**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json`

Expected: FAIL on the missing context module.

- [ ] **Step 3: Implement a pure capped projector**

```ts
const MAX_CANDIDATES_PER_FAMILY = 8;

export function projectWildsCapabilityContext(input: WildsCapabilityContextInput) {
  const output = new Map<WildsWorldCapabilityFamily, WildsCapabilityContext>();
  for (const control of input.controls) {
    const ordered = input.candidates
      .filter((candidate) => candidate.family === control.family && candidate.eligible)
      .sort(compareCandidate)
      .slice(0, MAX_CANDIDATES_PER_FAMILY);
    output.set(control.family, projectFamilyContext(control, ordered, input.activeActions));
  }
  return output;
}
```

- [ ] **Step 4: Run the context test and confirm it passes**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-world-capability-context.test.js`

Expected: PASS.

- [ ] **Step 5: Commit deterministic context projection**

```bash
git add src/features/play/wilds-world-capability-context.ts tests/wilds-world-capability-context.test.ts
git commit -m "Project bounded living capability context"
```

### Task 3: Universal Request Pipeline and Runtime Condition

**Files:**
- Create: `src/features/play/wilds-world-capability-action.ts`
- Create: `src/features/play/wilds-capability-runtime.ts`
- Test: `tests/wilds-world-capability-action.test.ts`
- Test: `tests/wilds-capability-runtime.test.ts`

**Interfaces:**
- Consumes: current projected context, active asset ID, exact target/source head, and adventure condition.
- Produces: `resolveWildsCapabilityRequest(request, context)` and `applyWildsCapabilityCost(condition, family, amount)`.

- [ ] **Step 1: Write failing tests for every request result and source precedence**

```ts
it("resolves every visible control to action, toggle, preview, or guidance", () => {
  for (const context of representativeContexts()) {
    const result = resolveWildsCapabilityRequest({ family: context.family, assetId: "asset:1" }, context);
    assert.equal(["immediate", "sustained", "source-preview", "guidance"].includes(result.kind), true);
  }
});

it("does not let missing distribution cancel a locally admitted transition", () => {
  const next = completeWildsCapabilityAdmission(admittedFixture(), { distribution: "offline" });
  assert.equal(next.localStatus, "admitted");
  assert.equal(next.distributionStatus, "pending");
});
```

- [ ] **Step 2: Run focused compilation and verify the missing implementations fail**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json`

Expected: FAIL on missing action/runtime exports.

- [ ] **Step 3: Implement typed results, idempotent source previews, sustained toggles, and bounded cost**

```ts
export type WildsCapabilityRequestResult =
  | Readonly<{ kind: "immediate"; family: WildsWorldCapabilityFamily; targetId: string | null }>
  | Readonly<{ kind: "sustained"; family: WildsWorldCapabilityFamily; active: boolean }>
  | Readonly<{ kind: "source-preview"; family: WildsWorldCapabilityFamily; targetId: string; expectedHead: string; idempotencyKey: string }>
  | Readonly<{ kind: "guidance"; family: WildsWorldCapabilityFamily; message: string; targetId: string | null }>;

export function applyWildsCapabilityCost(condition: AdventureCardCondition, family: WildsWorldCapabilityFamily, amount: number) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("wilds_capability_cost_invalid");
  return applyAdventureConditionDelta(condition, capabilityConditionDelta(condition, family, amount));
}
```

- [ ] **Step 4: Run both tests and confirm they pass**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-world-capability-action.test.js .test-build/tests/wilds-capability-runtime.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the request pipeline**

```bash
git add src/features/play/wilds-world-capability-action.ts src/features/play/wilds-capability-runtime.ts tests/wilds-world-capability-action.test.ts tests/wilds-capability-runtime.test.ts
git commit -m "Add source-first capability request pipeline"
```

### Task 4: Existing Traversal, Harvest, and Excavation Adapters

**Files:**
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/wilds-aerial-traversal.ts`
- Modify: `src/features/play/wilds-vertical-traversal.ts`
- Modify: `src/features/play/wilds-excavation.ts`
- Modify: `src/features/play/wilds-work-capability.ts`
- Test: `tests/wilds-capability-existing-adapters.test.ts`

**Interfaces:**
- Consumes: `WildsCapabilityRequestResult` from Task 3.
- Produces: `executeWildsExistingCapabilityAdapter(...)` behavior for flight, glide, swim, dive, climb, burrow, lumber, and quarry.

- [ ] **Step 1: Write failing adapter tests using real domain functions**

```ts
it("executes every existing family at Level 1 through its real authority", async () => {
  assert.equal(runFlight(levelOneWinged()).mode, "flight");
  assert.equal(runDive(levelOneAquatic()).verticalIntent, -1);
  assert.equal(runClimb(levelOneGrip(), climbFace()).started, true);
  assert.equal((await runLumber(levelOneGrove(), treeSource())).source.integrity < 1, true);
  assert.equal(runBurrow(levelOneBurrower(), soilSource()).kind, "source-preview");
});
```

- [ ] **Step 2: Run the test and confirm missing adapter behavior fails**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json`

Expected: FAIL on missing adapter exports or unmet assertions.

- [ ] **Step 3: Route each family into the existing real authority**

```ts
switch (request.family) {
  case "flight": case "glide": return toggleAerialTraversal();
  case "swim": return enterOrGuideDeepWater(context);
  case "dive": return requestVerticalTraversal(-1, context);
  case "climb": return beginOrGuideClimb(context);
  case "burrow": return beginExcavationPreview(context);
  case "lumber": case "quarry": return gatherNearestStewardResource(request.family);
}
```

- [ ] **Step 4: Run adapter and existing traversal/work suites**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-capability-existing-adapters.test.js .test-build/tests/wilds-aerial-traversal.test.js .test-build/tests/wilds-vertical-traversal.test.js .test-build/tests/wilds-excavation.test.js .test-build/tests/wilds-resource-authority.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the existing-family adapters**

```bash
git add src/features/play/PlayCampaign.tsx src/features/play/wilds-aerial-traversal.ts src/features/play/wilds-vertical-traversal.ts src/features/play/wilds-excavation.ts src/features/play/wilds-work-capability.ts tests/wilds-capability-existing-adapters.test.ts
git commit -m "Connect traversal and work capability actions"
```

### Task 5: Discovery and Environmental Capability Adapters

**Files:**
- Create: `src/features/play/wilds-environment-capabilities.ts`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/wilds-discovery-sites.ts`
- Modify: `src/features/play/wilds-surface-interaction.ts`
- Test: `tests/wilds-environment-capabilities.test.ts`

**Interfaces:**
- Consumes: warmed water-flow, route, darkness, cover, trace, and crossing candidates.
- Produces: current ride/ribbon, balance crossing, bounded light, camouflage, and private-safe track results.

- [ ] **Step 1: Write failing real-output tests**

```ts
it("projects current, balance, light, camouflage, and track without inventing world facts", () => {
  assert.deepEqual(beginCurrentRide(flowFixture()).velocity, { x: 0.8, z: -0.2 });
  assert.equal(beginBalanceCrossing(ledgeFixture()).stability > 0, true);
  assert.equal(toggleLivingLight(darkFixture(), false).active, true);
  assert.equal(toggleCamouflage(coverFixture(), false).detectionScale < 1, true);
  assert.equal(projectTrackTrail(privateSafeTraceFixture()).targetId, "trace:public:near");
});
```

- [ ] **Step 2: Run the test and verify the missing module fails**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json`

Expected: FAIL on missing environmental capability exports.

- [ ] **Step 3: Implement exact transient world results and break conditions**

```ts
export function reduceWildsSustainedEnvironment(state: WildsSustainedCapabilityState, event: WildsSustainedEvent) {
  if (event.type === "movement" && state.family === "anchor") return IDLE_SUSTAINED_CAPABILITY;
  if (["sprint", "attack", "harvest", "construction"].includes(event.type) && state.family === "camouflage") return IDLE_SUSTAINED_CAPABILITY;
  return state;
}
```

- [ ] **Step 4: Run environmental and discovery suites**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-environment-capabilities.test.js .test-build/tests/wilds-discovery-sites.test.js .test-build/tests/wilds-surface-interaction.test.js`

Expected: PASS.

- [ ] **Step 5: Commit environmental capabilities**

```bash
git add src/features/play/wilds-environment-capabilities.ts src/features/play/PlayCampaign.tsx src/features/play/wilds-discovery-sites.ts src/features/play/wilds-surface-interaction.ts tests/wilds-environment-capabilities.test.ts
git commit -m "Add living environmental capability actions"
```

### Task 6: Force, Protection, and Rescue Capability Adapters

**Files:**
- Create: `src/features/play/wilds-support-capabilities.ts`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/wilds-terrain-obstacles.ts`
- Modify: `src/features/play/wilds-construction-site.ts`
- Test: `tests/wilds-support-capabilities.test.ts`

**Interfaces:**
- Consumes: explicit breakable integrity, exact hazard family, force vector, emergency urgency, and source ownership flags.
- Produces: bounded break progress, resist envelope, anchor hold, and rescue safe-position result.

- [ ] **Step 1: Write failing protection and property-boundary tests**

```ts
it("changes only explicitly compatible force and rescue targets", () => {
  assert.equal(applyBreakCapability(crackedBarrier()).integrity, 0.6);
  assert.throws(() => applyBreakCapability(healthyLivingTree()), /protected_source/);
  assert.equal(beginResistanceEnvelope(coldHazard(), "cold").active, true);
  assert.equal(beginAnchorHold(windForce()).counterForce.x, -windForce().force.x);
  assert.deepEqual(applyRescueCapability(trappedCompanion()).position, trappedCompanion().safeAnchor);
});
```

- [ ] **Step 2: Run the test and verify missing functions fail**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json`

Expected: FAIL on missing support capability exports.

- [ ] **Step 3: Implement eligibility-first bounded transitions**

```ts
export function applyBreakCapability(target: WildsBreakTarget) {
  if (!target.breakable || target.protected || target.privateOwnerId) throw new Error("wilds_break_protected_source");
  return { ...target, integrity: Math.max(0, target.integrity - target.admittedImpact) };
}
```

- [ ] **Step 4: Run support, obstacle, and construction tests**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-support-capabilities.test.js .test-build/tests/wilds-terrain-obstacles.test.js .test-build/tests/wilds-construction-site.test.js`

Expected: PASS.

- [ ] **Step 5: Commit support capabilities**

```bash
git add src/features/play/wilds-support-capabilities.ts src/features/play/PlayCampaign.tsx src/features/play/wilds-terrain-obstacles.ts src/features/play/wilds-construction-site.ts tests/wilds-support-capabilities.test.ts
git commit -m "Add force protection and rescue capabilities"
```

### Task 7: Unified Responsive HUD and Input Safety

**Files:**
- Create: `src/features/play/WildsCapabilityControls.tsx`
- Modify: `src/features/play/WildzWorldControls.tsx`
- Modify: `src/components/icons.tsx`
- Modify: `app/globals.css`
- Test: `tests/wilds-capability-controls-ui.test.tsx`
- Test: `tests/wilds-capability-input-safety.test.ts`

**Interfaces:**
- Consumes: projected controls and contexts plus `onRequest(family)`.
- Produces: accessible 44-pixel controls, meters, state shapes, and cleanup-safe pointer behavior.

- [ ] **Step 1: Write failing UI behavior tests**

```tsx
it("renders every active proof-derived control and dispatches its family", () => {
  const requests: string[] = [];
  render(<WildsCapabilityControls controls={fixtures} onRequest={(family) => requests.push(family)} />);
  fireEvent.click(screen.getByRole("button", { name: /living light/i }));
  assert.deepEqual(requests, ["light"]);
  assert.equal(screen.queryByRole("button", { name: /swim/i }), null);
});

it("clears sustained press state on cancel, lost capture, blur, and visibility change", () => {
  const state = runCapabilityPointerSafetySequence(["pointerdown", "pointercancel", "blur", "visibilitychange"]);
  assert.equal(state.pressedFamily, null);
});
```

- [ ] **Step 2: Run the tests and verify the component is missing**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json`

Expected: FAIL on missing component and safety reducer.

- [ ] **Step 3: Implement the unified cluster and remove duplicate flight/work/climb controls**

```tsx
export function WildsCapabilityControls({ controls, enabled, onRequest }: Props) {
  return <div className="wilds-capability-controls" aria-label="Companion capabilities">
    {controls.map((control) => <button
      aria-label={`${control.label}. ${control.context.explanation}. Capacity ${control.capacity} percent`}
      className={`wilds-capability-control is-${control.context.state}`}
      disabled={!enabled}
      key={control.family}
      onClick={() => onRequest(control.family)}
      style={{ "--wilds-capability-capacity": `${control.capacity}%` } as CSSProperties}
      type="button"
    ><WildsCapabilityIcon family={control.family} /><i aria-hidden="true" /></button>)}
  </div>;
}
```

- [ ] **Step 4: Run UI/input tests and TypeScript**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-capability-controls-ui.test.js .test-build/tests/wilds-capability-input-safety.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the capability HUD**

```bash
git add src/features/play/WildsCapabilityControls.tsx src/features/play/WildzWorldControls.tsx src/components/icons.tsx app/globals.css tests/wilds-capability-controls-ui.test.tsx tests/wilds-capability-input-safety.test.ts
git commit -m "Unify companion capability controls"
```

### Task 8: Actor Poses, World Effects, and Card Dossier

**Files:**
- Create: `src/features/play/wilds-capability-presentation.ts`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/WildsCreatureActor.tsx`
- Modify: `src/features/play/living-card-dossier.ts`
- Test: `tests/wilds-capability-presentation.test.ts`
- Test: `tests/wilds-capability-dossier.test.ts`

**Interfaces:**
- Consumes: admitted/transient active capability state and runtime ability power.
- Produces: `projectWildsCapabilityPresentation(...)` and dossier capability entries with present function and next improvement.

- [ ] **Step 1: Write failing projection tests**

```ts
it("keeps actor pose, world effect, meter, and dossier on the same family", () => {
  const presentation = projectWildsCapabilityPresentation(activeFixture("track"));
  assert.equal(presentation.actorPose, "track-read");
  assert.equal(presentation.worldEffect, "trace-ribbon");
  assert.equal(presentation.family, "track");
  const dossier = projectLivingCardDossier(card("tracker-1"), condition()).capabilities.find((entry) => entry.family === "track")!;
  assert.match(dossier.presentFunction, /trace/i);
  assert.ok(dossier.nextImprovement.length > 0);
});
```

- [ ] **Step 2: Run the tests and verify missing projections fail**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json`

Expected: FAIL on missing presentation and dossier fields.

- [ ] **Step 3: Implement frozen pose/effect plans and dossier growth copy**

```ts
export function projectWildsCapabilityPresentation(active: WildsActiveCapability): WildsCapabilityPresentation {
  const definition = WILDS_WORLD_CAPABILITY_REGISTRY[active.family];
  return Object.freeze({ family: active.family, actorPose: definition.actorPose, worldEffect: definition.worldEffect, targetId: active.targetId });
}
```

- [ ] **Step 4: Run presentation, actor, and dossier suites**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-capability-presentation.test.js .test-build/tests/wilds-capability-dossier.test.js .test-build/tests/wilds-creature-capability-identity.test.js`

Expected: PASS.

- [ ] **Step 5: Commit presentation and dossier integration**

```bash
git add src/features/play/wilds-capability-presentation.ts src/features/play/WildsWorldCanvas.tsx src/features/play/WildsCreatureActor.tsx src/features/play/living-card-dossier.ts tests/wilds-capability-presentation.test.ts tests/wilds-capability-dossier.test.ts
git commit -m "Show living capability action and growth"
```

### Task 9: Performance, Refresh/Switch Stability, and Release Verification

**Files:**
- Modify: `src/features/play/wilds-world-capability-context.ts`
- Modify: `src/features/play/PlayCampaign.tsx`
- Test: `tests/wilds-capability-performance.test.ts`
- Test: `tests/wilds-capability-integration.test.ts`
- Create: `output/playwright/wilds-capabilities-320x568.png`
- Create: `output/playwright/wilds-capabilities-390x844.png`
- Create: `output/playwright/wilds-capabilities-844x390.png`

**Interfaces:**
- Consumes: the complete capability system.
- Produces: diagnostics proving no hot-path accumulation and release evidence for real browser inputs.

- [ ] **Step 1: Write failing stability and mutation-path tests**

```ts
it("does no new slow work across ten thousand warmed movement reads", () => {
  const warm = projectWildsCapabilityContext(input);
  const before = wildsCapabilityDiagnostics();
  for (let index = 0; index < 10_000; index += 1) assert.equal(projectWildsCapabilityContext(input), warm);
  assert.deepEqual(wildsCapabilityDiagnostics(), before);
});

it("refresh and creature switching retain no listeners, intervals, or stale target", () => {
  const result = runCapabilityLifecycleSequence(["mount", "switch", "refresh", "switch", "unmount"]);
  assert.deepEqual(result, { listeners: 0, intervals: 0, activeTargetId: null });
});
```

- [ ] **Step 2: Run the tests and verify cache/lifecycle assertions fail before instrumentation**

Run: `node scripts/clean-test-build.mjs && ./node_modules/.bin/tsc -p tsconfig.test.json`

Expected: FAIL on missing diagnostics or identity reuse.

- [ ] **Step 3: Add keyed memoization and explicit lifecycle cleanup**

```ts
if (lastInput === input) return lastOutput;
const projected = buildWildsCapabilityContext(input);
lastInput = input;
lastOutput = projected;
diagnostics.slowBuilds += 1;
return projected;
```

- [ ] **Step 4: Run focused suites, full suite, and production build**

Run: `pnpm test`

Expected: all tests PASS.

Run: `pnpm run build`

Expected: production build PASS with no new warning category.

- [ ] **Step 5: Verify real mobile/landscape browser paths**

Run the local production server, then use the Playwright CLI at 320×568, 390×844, 430×932, 844×390, tablet, and desktop. For each representative family: select a creature owning it, tap its visible control, assert execution/guidance feedback changes, assert the canvas is nonblank, and assert no console error. Capture the three named screenshots and confirm controls never overlap the D-pad, construction control, bottom browser safe area, or each other.

- [ ] **Step 6: Commit verified release state**

```bash
git add src/features/play tests app/globals.css output/playwright/wilds-capabilities-320x568.png output/playwright/wilds-capabilities-390x844.png output/playwright/wilds-capabilities-844x390.png
git commit -m "Complete living-world creature capabilities"
```

## Self-Review Results

- Spec coverage: all 17 world families, Level-1 access, source precedence, deterministic context, five HUD states, real adapters, condition costs, actor/world agreement, dossier growth, responsive layout, input cleanup, and performance/release gates map to Tasks 1–9.
- Placeholder scan: the plan contains no deferred implementation markers; each task defines exact files, interfaces, failing behavior, implementation boundary, command, expected result, and commit.
- Type consistency: `WildsWorldCapabilityFamily`, `WildsCapabilityDefinition`, `WildsCapabilityContext`, and `WildsCapabilityRequestResult` are introduced once and consumed under the same names throughout later tasks.
