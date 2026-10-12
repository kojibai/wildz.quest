# Receiz v129: offline proof valuation and collectible history

This is the requested SDK contract for Wildz's collectible Market. The export names below are **proposed new names**, not exports that already exist in v128. This valuation addition is separate from the registered OIDC application-binding fix needed for native purchases.

## Existing implementations to reuse

The Receiz application already contains the relevant calculations:

- `app/utils/valuation.ts`: `computeIntrinsicUnsigned`, algorithm `phi/kosmos-vφ-5`, policy checksum, input diagnostics and canonical stamp payload. Its published formula is `valuePhi = rarityFloor + premiumBandBase × combinedOsc + pv_phi`, with one coherent breath as the base unit of one Phi. Preserve the existing policy, supported inputs, rounding and compatibility behavior.
- `app/lib/game/sportsArenaCardValue.ts`: the sports-card base/floor, acquisition basis and recorded performance breakdown.
- `app/lib/game/sportsArenaLiveValueMotion.ts`: the sports-card live projection and chart presentation pattern.
- `app/lib/game/sportsArenaValue.ts`: the deterministic Kai-based USD/Phi conversion used by sports cards.
- `app/api/game/sports/conformance/route.ts`: the published algorithm description, reconstructable inputs, source hashes and offline replay checks.

The sports model is an example of an explainable display projection. Wildz creatures do not have pack prices, sports scores or player-selection odds. Do not fabricate those inputs, silently apply sports-specific multipliers, or import simulated volume/holders/history from Market display helpers.

## 1. Export the existing pure Kai-sigil calculator

Expose the existing calculator through the SDK in a browser-safe, Node-safe entry point. Also export its metadata types, algorithm version, policy specification/checksum, canonical serialization and rounding rules. It must work without a server, OAuth session, access token or network request.

The low-level calculator may accept explicit metadata for reproducibility. A separate admission wrapper must bind the displayed inputs to the exact verified proof object and verified carried history. Caller-supplied metadata alone must never establish proof, ownership or spendable-value authority.

Do not default a missing creation moment to the current evaluation moment in this wrapper. Return an explicit unavailable/unsupported result when the proof lacks required inputs. Record which legacy metadata defaults the policy applies.

## 2. Provide a proof-bound value projection

Proposed export: `projectReceizProofValueV129`.

Inputs:

- An SDK-admitted proof/artifact runtime, with its actual artifact digest and admitted history head.
- An explicit valuation Kai uPulse as a canonical decimal string. Derive the whole-pulse projection using the SDK's exact bridge when the existing valuation law operates on whole pulses.
- The selected published valuation policy/version.
- Verified sale and ownership-history runtimes, where present. Raw peer messages, unsigned prices, listing drafts and local clock timestamps are insufficient history authority.
- A canonical USD conversion basis and its algorithm/version/digest, if USD display is requested.

The SDK must read creation/claim coordinates, sigil metadata and applicable lineage inputs from the admitted proof. Never substitute an OIDC login time, upload time, `Date.now()`, rounded ownership pulse or a fabricated micro-pulse.

Return at least:

```ts
type ProofValueProjectionV129 = Readonly<{
  algorithm: string;
  policyChecksum: string;
  proofDigest: string;
  historyHead: string;
  originKaiUPulse: string | null; // null when a legacy proof lacks exact precision
  originKaiPulse: string;
  valuationKaiUPulse: string;
  valuationKaiPulse: string;
  proofValuePhiMicro: string;
  marketReferenceValuePhiMicro: string | null;
  lastExecutedPricePhiMicro: string | null;
  displayUsdCents: string | null;
  priceBasisDigest: string | null;
  inputs: Readonly<Record<string, unknown>>;
  calculation: readonly CalculationTerm[];
  projectionDigest: string;
}>;

type CalculationTerm = Readonly<{
  id: string;
  label: string;
  formula: string;
  operands: Readonly<Record<string, string>>;
  result: string;
  unit: string;
  sourceReferences: readonly string[];
}>;
```

Keep the existing intrinsic proof valuation distinct from the market reference projection and actual executed price. If a market projection uses executed sales as inputs, export and version that exact rule and its complete operands. Do not silently make the last sale, asking price or an arbitrary multiplier redefine the intrinsic value law.

A valuation projection must not mint value, create an admission membership, move a wallet balance, approve a purchase or become a settlement receipt. Existing SDK source/head and settlement admission remain authoritative.

## 3. Expose the complete calculation

Return the complete original input diagnostics, intermediate results, policy constants and formula dependencies. At minimum this includes the base unit, origin moment, age, geometry/moment terms, rarity floor, premium band, live oscillation terms and optional present-value term actually used by `phi/kosmos-vφ-5`.

If a verified transaction contributes to a market reference value, include its receipt digest, exact amount, pinned rate and the precise contribution rule. Unknown inputs stay explicitly unknown; do not display invented reputation, verified-creator status, scores or cashflows.

This output supplies Wildz's expandable “How this value is calculated” panel. The panel may simplify labels, but the exported replay data must preserve every input needed for the full math.

Wildz defaults the value display and chart to USD, with a one-tap Phi view. Visible time labels use the whole Kai pulse with `☤KAI`; ownership ordering, transaction references, chart inputs and exported replay packages retain the exact canonical Kai uPulse string. A presentation label never replaces the exact coordinate.

## 4. Provide deterministic chart sampling

Proposed export: `sampleReceizProofValueV129`. Accept the same admitted basis plus an explicit bounded list of Kai uPulse coordinates. Return the projection at each coordinate, using the same calculator as the current-value display.

Samples must not depend on prior calls, browser session state, server cache, randomness or an implicit current time. Identify them as recomputed model samples. They are not executed prices or measured historical observations.

Keep actual sale and transfer events separately typed so the chart can overlay them. A gift/claim transfer has a null payment amount, not a fictional zero-dollar sale. An incomplete payment or pending delivery is not a completed sale.

Use bounded caches and bounded sampling so chart calculations do not add gameplay frame pressure. Sampling is a local read and grants no write authority.

## 5. Export an offline replay package

Proposed exports: `exportReceizProofValueReplayV129` and `verifyReceizProofValueReplayV129`.

The package must carry the exact public proof and admitted history needed for this valuation, the selected policy/version and checksum, evaluation coordinates, exact conversion basis, transaction references and expected projection digest. Supply the verification roots or explicitly identify the pinned roots the existing SDK verifier requires.

Anyone with the package and SDK must be able to verify the proof, replay the history and reproduce the same value and chart points offline. A checksum on unverified JSON is insufficient. Do not include identity private keys, access tokens or private conversation history.

## 6. Preserve exact ownership timing and transfer history

Carry exact Kai uPulse in the sealed proof/history coordinate where it is available and expose it after SDK admission. Do not discard it when building the sealed bundle. Whole-pulse fields remain explicit compatibility projections.

Return deduplicated ownership changes with the asset/proof coordinate, previous/current owner, exact admitted claim head and Kai uPulse. Do not use append count, upload wall time or array arrival order to choose the latest owner. Preserve legacy proof verification without claiming micro-pulse precision absent from its original bytes.

For completed sales, expose the independently verified payment and accepted-delivery references, named participants, exact Phi amount and the receipt's pinned USD display basis. Preserve carried older history when active journals are compacted.

## 7. Release SDK, MCP and AI skills together

Ship matching v129 versions of `@receiz/sdk`, `@receiz/mcp-server` and `@receiz/ai-skills`.

- MCP should expose read-only valuation inspection, chart sampling and replay verification through these same SDK functions. No separate MCP math or server-only implementation.
- AI skills should document the actual new exports, required proof admission, exact coordinate bridge, policy/version selection, full calculation trace, sale-versus-transfer handling, replay package and distinction between displayed valuation and moved Phi authority.
- Publish browser and Node usage examples plus machine-readable conformance fixtures. Update package exports/types and capability discovery to match the released implementation.

## Acceptance checks

1. Same admitted proof, head, policy, Kai coordinate and conversion basis produce the same canonical projection and digest in browser, Node and MCP.
2. A no-network replay verifies and recomputes the displayed value and every chart sample.
3. Existing Kai-sigil calculator fixtures retain their existing outputs. Version any intentional math change rather than silently rewriting prior valuations.
4. Missing, altered or foreign proof/head bindings are rejected; unsupported legacy precision is explicit.
5. A verified transfer changes ownership once without creating a second value origin. A completed sale appears once, with its actual receipt-pinned amount.
6. Pending, failed, cancelled, self-authored-message-only and paid-but-undelivered attempts do not become completed sales.
7. Listing/editing an asking price does not alter the intrinsic value. Any executed-sale effect on market reference value is fully specified and reproducible.
8. Sampling and inspection perform zero custody, payment, admission or approval writes.
9. No simulated transaction rows, volume, holders or fabricated micro-pulse increments.
10. Preserve the existing Wallet, Profile, Build, artifact verification and purchase-recovery behavior while completing the separate registered application-binding fix.
