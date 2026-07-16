# Wildz Receiz Gameplay Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the current Receiz proof-native location and minigame logic into Wildz locations while keeping Wildz visuals, buttons, and world controls unchanged.

**Architecture:** A versioned activity envelope, deterministic trace, witness, and receipt layer becomes the common authority for location modules. Each Wildz district maps one approved Receiz primitive into its own focused engine; React experiences project those engines through existing UI components rather than importing Receiz presentation code.

**Tech Stack:** TypeScript 5.6, React 19, Next.js 15 route handlers, Receiz SDK 104, Node test runner, IndexedDB/PWA.

## Global Constraints

- Preserve current Wildz visuals, HUD, buttons, control geometry, card forms, and mobile safe areas.
- Port gameplay contracts and proof semantics, not Receiz Commerce presentation code or trade dress.
- Every competitive result is deterministic, versioned, replayable, idempotent, and server-recomputable.
- Value transfer remains separate from gameplay scoring and must fail closed under ownership or settlement conflict.
- Solo-safe location activity must work offline and enqueue a bounded pending receipt.
- The Mortal Arena implementation is owned by the separate Mortal Arena plan and supersedes the old Arena parity path.

---

### Task 1: Versioned Location Activity Envelope

**Files:**
- Modify: `src/features/play/wilds-activity-core.ts`
- Create: `src/features/play/wilds-activity-proof.ts`
- Test: `tests/wilds-activity-proof.test.ts`

**Interfaces:**
- Produces: `WildsActivityEnvelopeV2`, `WildsActivityTraceFrame`, `WildsActivityWitness`, `WildsActivityReceiptProposal`, `digestWildsActivity`, and `verifyWildsActivityProposal`.

- [ ] **Step 1: Write failing replay and idempotency tests**

```ts
test("recomputes the same result from setup and ordered trace", async () => {
  const first = verifyWildsActivityProposal(proposal);
  const second = verifyWildsActivityProposal({ ...proposal, idempotencyKey: proposal.idempotencyKey });
  assert.equal(first.resultDigest, second.resultDigest);
  assert.equal(first.receiptId, second.receiptId);
});
```

- [ ] **Step 2: Implement the envelope**

```ts
export type WildsActivityEnvelopeV2<Setup, Input, Result> = {
  activityId: string; rulesVersion: string; seed: string; actorId: string;
  cardRevisionDigests: readonly string[]; setup: Setup;
  trace: readonly { sequence: number; atTick: number; input: Input }[];
  proposedResult: Result; idempotencyKey: string;
};
```

Canonical JSON sorting and SHA-256 produce setup, trace, result, and receipt digests. Verification rejects gaps, duplicates, rule mismatch, unknown card revision, cap overflow, and result disagreement.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: activity proof tests pass.

```bash
git add src/features/play/wilds-activity-core.ts src/features/play/wilds-activity-proof.ts tests/wilds-activity-proof.test.ts
git commit -m "feat: add proof-native Wildz activity envelope"
```

### Task 2: Trail Gate Routes and Return Receipts

**Files:**
- Create: `src/features/play/wilds-trail-gate.ts`
- Modify: `src/features/play/wilds-settlements.ts`
- Modify: `src/features/play/WildsSettlementExperience.tsx`
- Test: `tests/wilds-trail-gate.test.ts`

**Interfaces:**
- Produces: `createTrailRoute`, `advanceTrailRoute`, `resumeTrailRoute`, and `sealTrailReturn`.

- [ ] **Step 1: Write failing route tests**

```ts
test("resumes at the last witnessed step and seals one return", () => {
  const route = createTrailRoute({ seed: "trail-7", cardDigest: "card-a", length: 5 });
  const advanced = advanceTrailRoute(advanceTrailRoute(route, "north"), "east");
  assert.equal(resumeTrailRoute(advanced.witness).step, 2);
  assert.equal(sealTrailReturn(advanced).kind, "route-return");
});
```

- [ ] **Step 2: Implement deterministic routes**

Use route seed, step index, region hazards, discoveries, card traits, and ordered directional choices. Reject completion before all required waypoints. Project the result through existing settlement cards and contextual action.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: Trail Gate tests pass and settlement UI typechecks.

```bash
git add src/features/play/wilds-trail-gate.ts src/features/play/wilds-settlements.ts src/features/play/WildsSettlementExperience.tsx tests/wilds-trail-gate.test.ts
git commit -m "feat: add witnessed Trail Gate routes"
```

### Task 3: Dawn Commons Matchmaking and Challenges

**Files:**
- Create: `src/features/play/wilds-dawn-commons.ts`
- Modify: `src/features/play/multiplayer-challenge.ts`
- Modify: `src/features/play/WildsMultiplayer.tsx`
- Test: `tests/wilds-dawn-commons.test.ts`

**Interfaces:**
- Produces: `projectDawnPresence`, `createDawnChallenge`, `matchDawnChallenge`, and `resolveAsyncDefense`.

- [ ] **Step 1: Write failing privacy and fallback tests**

```ts
test("offers a legal NPC after the live queue deadline", () => {
  const result = matchDawnChallenge(challenge, [], challenge.createdAt + 8_001);
  assert.equal(result.opponent.kind, "npc");
  assert.equal(result.opponent.rulesVersion, challenge.rulesVersion);
});
```

- [ ] **Step 2: Implement queue matching**

Match on rules, roster power band, latency band, privacy, and rematch protection. Public activity exposes coarse status only. Async defense records a declared loadout and deterministic policy, never hidden live input.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: matchmaking and privacy tests pass.

```bash
git add src/features/play/wilds-dawn-commons.ts src/features/play/multiplayer-challenge.ts src/features/play/WildsMultiplayer.tsx tests/wilds-dawn-commons.test.ts
git commit -m "feat: deepen Dawn Commons challenges"
```

### Task 4: Mosslight Attunement and Provenance

**Files:**
- Create: `src/features/play/wilds-mosslight-atelier.ts`
- Modify: `src/features/play/wilds-crafting.ts`
- Modify: `src/features/play/WildsSettlementExperience.tsx`
- Test: `tests/wilds-mosslight-atelier.test.ts`

**Interfaces:**
- Produces: `quoteAttunement`, `applyAttunement`, `openProvenancePack`, and `verifyAtelierAppend`.

- [ ] **Step 1: Write failing provenance tests**

```ts
test("binds every output to inputs, recipe, seed, and owner", () => {
  const result = applyAttunement(quote, inventory);
  assert.deepEqual(result.append.parents.sort(), quote.inputDigests.slice().sort());
  assert.equal(verifyAtelierAppend(result.append), true);
});
```

- [ ] **Step 2: Implement quote-then-append crafting**

Quotes expire, lock exact inputs, show exact effects, and never mutate a card until confirmed. Pack opening derives contents from committed seed and pack digest. Existing Wildz card art and crafting controls render the process.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: crafting and provenance tests pass.

```bash
git add src/features/play/wilds-mosslight-atelier.ts src/features/play/wilds-crafting.ts src/features/play/WildsSettlementExperience.tsx tests/wilds-mosslight-atelier.test.ts
git commit -m "feat: add Mosslight card attunement"
```

### Task 5: Cartographer Cooperative Witnesses

**Files:**
- Create: `src/features/play/wilds-cartographer-house.ts`
- Modify: `src/features/play/wilds-route-memory.ts`
- Test: `tests/wilds-cartographer-house.test.ts`

**Interfaces:**
- Produces: `createCoopRoute`, `appendRouteWitness`, `mergeRouteWitnesses`, and `verifyPathWitness`.

- [ ] **Step 1: Write failing merge tests**

```ts
test("merges compatible cooperative observations without inventing steps", () => {
  const merged = mergeRouteWitnesses(leftWitness, rightWitness);
  assert.deepEqual(merged.steps.map((step) => step.sequence), [0, 1, 2, 3]);
  assert.equal(verifyPathWitness(merged), true);
});
```

- [ ] **Step 2: Implement causal route witnesses**

Each observation binds participant, coordinate band, event digest, previous witness digest, and sequence. Merge accepts one causal chain or compatible branches with disjoint observations; conflicting same-sequence steps require server resolution.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test`
Expected: route witness tests pass.

```bash
git add src/features/play/wilds-cartographer-house.ts src/features/play/wilds-route-memory.ts tests/wilds-cartographer-house.test.ts
git commit -m "feat: add cooperative path witnesses"
```

### Task 6: Monument Seasons, Tournaments, and Memorials

**Files:**
- Create: `src/features/play/wilds-monument-walk.ts`
- Modify: `src/features/play/wilds-competition.ts`
- Modify: `src/features/play/wilds-civic-history.ts`
- Test: `tests/wilds-monument-walk.test.ts`

**Interfaces:**
- Produces: `projectSeasonStandings`, `createTournamentBracket`, `advanceBracket`, `appendMonumentRecord`, and `projectMemorialConstellation`.

- [ ] **Step 1: Write failing canonical record tests**

```ts
test("honors a retired creature without making it playable", () => {
  const record = appendMonumentRecord(history, sacrificeRetirement);
  assert.equal(record.memorial.honor, "victorious-sacrifice");
  assert.equal(record.memorial.playable, false);
});
```

- [ ] **Step 2: Implement projections**

Standings separate skill, season, and event scopes. Brackets bind admitted roster digests. Memorials project immutable retirement records and team outcome without altering the retired card.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: competition, history, and memorial tests pass.

```bash
git add src/features/play/wilds-monument-walk.ts src/features/play/wilds-competition.ts src/features/play/wilds-civic-history.ts tests/wilds-monument-walk.test.ts
git commit -m "feat: establish Monument Walk records"
```

### Task 7: Embedded Market Settlement Continuity

**Files:**
- Create: `src/features/play/wilds-market-settlement.ts`
- Modify: `src/features/play/wilds-store-product.ts`
- Test: `tests/wilds-market-settlement.test.ts`

**Interfaces:**
- Produces: `createMarketOffer`, `placeAuctionBid`, `settleMarketOffer`, and `verifySettlementContinuity`.

- [ ] **Step 1: Write failing fail-closed tests**

```ts
test("rejects settlement when ownership changed after the offer", () => {
  assert.throws(() => settleMarketOffer(offer, { ...vault, ownerId: "other" }), /ownership continuity/i);
});
```

- [ ] **Step 2: Implement settlement continuity**

Offers bind card revision, seller, currency, amount, expiration, and ownership witness. Auction bids are monotonic and idempotent. Gameplay XP, survival, and rank never depend on purchase.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: market settlement tests pass.

```bash
git add src/features/play/wilds-market-settlement.ts src/features/play/wilds-store-product.ts tests/wilds-market-settlement.test.ts
git commit -m "feat: secure Wildz market settlement continuity"
```

### Task 8: Prism and Hearttree Proof-Native Games

**Files:**
- Modify: `src/features/play/prism-run.ts`
- Modify: `src/features/play/hearttree-trial.ts`
- Modify: `src/features/play/WildsLandmarkExperience.tsx`
- Test: `tests/wilds-landmark-activities.test.ts`

**Interfaces:**
- Consumes: `WildsActivityEnvelopeV2`.
- Produces: versioned Prism co-op traces and Hearttree care/recovery traces.

- [ ] **Step 1: Add failing replay tests**

```ts
test("replays Hearttree recovery and Prism cooperation from traces", () => {
  assert.deepEqual(replayHearttree(hearttree.setup, hearttree.trace), hearttree.proposedResult);
  assert.deepEqual(replayPrism(prism.setup, prism.trace), prism.proposedResult);
});
```

- [ ] **Step 2: Upgrade engines without redesigning UI**

Hearttree becomes the declared recovery/care location and cannot revive retired cards. Prism records cooperative timing and contribution independently. Existing landmark experience buttons dispatch versioned inputs.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: landmark tests and typecheck pass.

```bash
git add src/features/play/prism-run.ts src/features/play/hearttree-trial.ts src/features/play/WildsLandmarkExperience.tsx tests/wilds-landmark-activities.test.ts
git commit -m "feat: verify Prism and Hearttree play"
```

### Task 9: Verification API and Offline Queue

**Files:**
- Create: `app/api/wilds/activity/verify/route.ts`
- Create: `src/features/play/wilds-pending-activity.ts`
- Modify: `src/features/play/wilds-world-service.ts`
- Test: `tests/wilds-pending-activity.test.ts`

**Interfaces:**
- Produces: `enqueuePendingActivity`, `syncPendingActivities`, and POST `/api/wilds/activity/verify`.

- [ ] **Step 1: Write failing causal sync tests**

```ts
test("keeps a rejected proposal for inspection and advances compatible receipts", async () => {
  const result = await syncPendingActivities(queue, verifier);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected[0].status, "conflict");
});
```

- [ ] **Step 2: Implement bounded offline queue and server recomputation**

The queue stores envelopes, attempts, and immutable rejection reasons. The route authenticates actor/session, loads admitted card revisions, recomputes through the registered rules version, applies idempotency, and returns a signed receipt or explicit conflict.

- [ ] **Step 3: Verify the release slice and commit**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: tests, typecheck, and production build pass.

```bash
git add app/api/wilds/activity/verify/route.ts src/features/play/wilds-pending-activity.ts src/features/play/wilds-world-service.ts tests/wilds-pending-activity.test.ts
git commit -m "feat: verify Wildz location play online and offline"
```
