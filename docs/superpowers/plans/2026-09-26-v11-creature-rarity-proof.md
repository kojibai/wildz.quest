# Wildz v11 Creature Rarity and Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Issue Trail starters, exact distance-based encounter classes, open-ended creature lineages, offline-verifiable v11 proofs, and v10 continuity upgrades.

**Architecture:** A pure law consumes v11 addresses and a uniform integer in [0, 10,000,000). An encounter authority signs one fixed player-and-site input after presence admission. New cards carry the signed birth proof; old cards keep their birth law and gain an idempotent v11 continuity envelope.

**Tech Stack:** TypeScript, browser-compatible Web Crypto for verification, server-side Node crypto for private-key use, Next.js API routes, existing Receiz card/history rails.

**Spec:** docs/superpowers/specs/2026-09-26-wildz-v11-unbounded-world-creatures-rarity-design.md

**Dependency:** Complete docs/superpowers/plans/2026-09-26-v11-world-addressing.md first.

## Global Constraints

- Origin bands use squared region-radius thresholds 25, 125, and 500.
- Frontier class odds: Rare 1/1,000; Mythic 1/100,000; Eternal 1/1,000,000; Uncommon 1/5; Trail is the remainder.
- Inner-band exact odds and all five class totals come from the spec table.
- One player and site slot has one immutable encounter result; failed capture and retries do not reroll.
- Every newly issued starter is Trail and bypasses the random encounter law.
- V10 original rarity, asset ID, birth proof, and history remain intact after resave.

## Review Focus

- A starter whose old catalog choice would have been Eternal becomes Trail only on new issuance; Task 1 test.
- Band edges and negative coordinates choose the exact row; Task 2 test.
- Repeated encounter requests, refresh, and failed capture keep one roll; Task 3 test.
- A forged signature or unknown key ID fails offline verification; Task 4 test.
- A v10 card without verified discovery location gains no fabricated origin; Task 5 test.

---

### Task 1: Guaranteed Trail starter

**Files:** Modify src/features/play/game-state.ts; Test tests/play-game-state.test.ts.

**Interfaces:** createOwnerBoundInitialPlayState(ownerReceizId, createdAt) continues to return PlayState; its newly issued starter always has manifest.rarity === 'trail' while owner/time determinism and existing saved starter proofs remain unchanged.

- [ ] Step 1: Add tests across many owners/times asserting Trail, distinct identities, and unchanged repeated issuance for equal inputs; retain a higher-rarity historical starter on restore.
- [ ] Step 2: Run pnpm test; expect the new starter assertion to fail on an old catalog selection.
- [ ] Step 3: Restrict new starter selection to stage-one Trail forms and keep the existing owner/time seed and proof construction.
- [ ] Step 4: Run pnpm test and pnpm typecheck; expect both to pass.
- [ ] Step 5: Commit starter rule and tests.

### Task 2: Pure rarity law and unbiased draw

**Files:** Create src/features/play/wilds-rarity-law-v11.ts; Test tests/wilds-rarity-law-v11.test.ts.

**Interfaces:** Consume WildsWorldAddress. Produce rarityBand(address): 'origin' | 'wilds' | 'deep-wilds' | 'frontier'; rarityClass(band, draw: number): CreatureRarity; rarityOdds(band, class): { numerator: bigint; denominator: bigint }; deriveUniformRarityDraw(signature: Uint8Array): number. Reject 64-bit values at or above floor(2^64 / 10,000,000) * 10,000,000.

- [ ] Step 1: Test every band edge, all five class counts across the 10,000,000 integer outcomes by range arithmetic, and rejection-sampling boundary fixtures.
- [ ] Step 2: Run pnpm test; expect new law tests to fail.
- [ ] Step 3: Implement the exact table and domain-separated SHA-256 block stream.
- [ ] Step 4: Run pnpm test and pnpm typecheck; expect both to pass.
- [ ] Step 5: Commit law and tests.

### Task 3: One-result encounter authority

**Files:** Create src/lib/receiz/wilds-v11-encounter-authority.ts and app/api/wilds/encounters/route.ts; Modify src/features/play/hidden-hotspots.ts, src/features/play/game-state.ts, .env.example; Test tests/wilds-v11-encounter-authority.test.ts.

**Interfaces:** issueWildsV11Encounter(actorId: string, site: WildsWorldAddress, slot: number): Promise<WildsV11EncounterResult>; result includes canonical input, key ID, Ed25519 signature, draw, and class. Server verifies player presence/site eligibility before signing; actor-site-slot is idempotent.

- [ ] Step 1: Test admitted first observation, repeat/refresh/failure returning identical bytes, wrong actor or remote site rejection, impossible position jump denial, bounded issue rate, and pending-offline replay on reconnect.
- [ ] Step 2: Run pnpm test; expect new authority tests to fail.
- [ ] Step 3: Add the public-key registry, a server-only WILDZ_V11_ENCOUNTER_SIGNING_KEY input, and a sparse idempotency record through existing Receiz persistence patterns; gate issuance on admitted movement or Rift evidence and a bounded per-actor rate; never expose a raw signing endpoint or a private key in client bundles.
- [ ] Step 4: Run pnpm test, pnpm typecheck, and pnpm secret:scan; expect all to pass.
- [ ] Step 5: Commit authority and tests.

### Task 4: V11 creature birth and portable verifier

**Files:** Create src/features/play/wilds-creature-generator-v11.ts and src/features/play/wilds-card-proof-v11.ts; Modify src/features/play/portable-card.ts, src/features/play/living-card-proof.ts, src/features/play/living-taxonomy.ts, src/features/play/creature-visual-identity.ts; Test tests/wilds-v11-card-proof.test.ts.

**Interfaces:** generateCreatureBirthV11(encounter: WildsV11EncounterResult): WildsV11Birth; sealWildsV11Card(birth, ownerId): PortableCardAsset; verifyWildsV11Card(asset, pinnedKeys): PortableCardVerification. A region-derived lineage key removes the fixed family list for new births while legacy dispatch remains version aware.

- [ ] Step 1: Test deterministic body/temperament/lineage, distinct canonical identities at different addresses, signature and trait tamper rejection, unknown key/version rejection, and legacy card acceptance.
- [ ] Step 2: Run pnpm test; expect new v11 proof tests to fail.
- [ ] Step 3: Add generation, proof envelope, and version dispatch without changing v10 manifest bytes or rules; keep the verifier in a browser-safe module so the public checker can import it.
- [ ] Step 4: Run pnpm test, pnpm typecheck, and pnpm build; expect all to pass.
- [ ] Step 5: Commit birth and proof implementation.

### Task 5: V10 continuity upgrade on save

**Files:** Create src/features/play/wilds-card-continuity-v11.ts; Modify src/features/play/game-state.ts and src/features/play/card-export.ts; Test tests/wilds-v10-card-continuity-v11.test.ts.

**Interfaces:** upgradeVerifiedV10Card(card: PortableCardAsset): WildsV11ContinuityEnvelope; envelope retains exact legacy asset ID/proof digest/head and derives presentation only from verified fields. Repeating on an unchanged source gives the same envelope.

- [ ] Step 1: Test v10 variant 1/2/3 cards, verified variant-3 discovery location, unknown location for earlier variants, exact rarity preservation, idempotent restore/resave, and export/import.
- [ ] Step 2: Run pnpm test; expect new continuity tests to fail.
- [ ] Step 3: Add the envelope and one-time save/restore projection; preserve exact source bytes and avoid per-frame re-verification.
- [ ] Step 4: Run pnpm test, pnpm typecheck, and pnpm build; expect all to pass.
- [ ] Step 5: Commit continuity migration and tests.

### Task 6: New-form consumer integration

**Files:** Create src/features/play/wilds-card-form-resolution.ts; Modify src/features/play/WildsBattle.tsx, src/features/play/WildsInventory.tsx, src/features/play/WildsWorldCanvas.tsx, src/features/play/WildsCreatureActor.tsx, src/features/play/card-export.ts, src/features/play/multiplayer-card.ts, src/features/play/creature-consciousness.ts, src/features/play/hearttree/card-capability.ts, and the remaining active creatureForm consumers in the audited inventory; Test tests/wilds-v11-card-consumers.test.ts.

**Interfaces:** resolveCardForm(card: PortableCardAsset): CreatureFormLike returns the verified procedural form for v11 births and the unchanged catalog form for v10 cards. Consumers use this card-scoped resolver rather than looking up v11 form IDs in the 250-family map.

- [ ] Step 1: Test a new procedural creature through battle, inventory, world actor, export/import, multiplayer, consciousness, ability, and evolution; repeat with a v10 fixture.
- [ ] Step 2: Run pnpm test; expect unknown-form failures on v11 cards.
- [ ] Step 3: Add the resolver and migrate every reachable creatureForm(card-derived-id) call identified by the source inventory.
- [ ] Step 4: Run pnpm test, pnpm typecheck, and pnpm build; expect all consumer paths to accept both versions.
- [ ] Step 5: Commit consumer integration and tests.
