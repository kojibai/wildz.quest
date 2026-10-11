# Wildz gameplay data products

Date: 2026-10-10. Baseline: `307c286`. Status: written design for review; production implementation and commercial qualification have not occurred.

## Intent and success

Ordinary enjoyable Wildz play supplies a useful product that outside customers purchase. Players continue exploring, building, gathering, and cooperating without performing separate work assignments. Wildz performs conversion, quality evaluation, packaging, delivery, and contribution accounting away from gameplay. The long-term objective is recurring external revenue sufficient to support meaningful player income and a sustainable platform.

The user requires Wildz-only changes, the published Receiz 128.0.0 release, no Receiz core edits or new database, preservation of the working wallet, and no additional gameplay latency or memory pressure. A proof records lawful source and history; price, demand, and usefulness must be established separately. A successful simulation or proof verification cannot be reported as a customer sale or player income.

The first deliverable is a buyer-evaluable dataset and replay package assembled from existing admitted gameplay. It must demonstrate data utility to an actual buyer before revenue claims, automatic payouts, or employment-like earning promises are enabled.

## Market selection

Three approaches were considered:

| Approach | Existing market evidence | Wildz fit and tradeoff |
| --- | --- | --- |
| Licensed structured 3D data and action/outcome evaluation packages | CGTrader sells licensed 3D datasets; Shutterstock supplies structured training examples and evaluation services to model builders | Recommended first. Existing construction/resource command history can supply structured scene changes without new player work. Dataset usefulness and willingness to pay require a pilot. |
| Robotics manipulation demonstrations | Scale sells physical-AI demonstration and annotation services | Strong commercial category, but current Wildz hands, physics, controls, and object interactions are not calibrated robot demonstrations. Defer this positioning until transfer is measured. |
| Physical building and land-use optimization | MIT CityScope evaluates urban interventions | Potential real-world benefit, but game geometry and rules do not establish engineering suitability or faithful constraints. Defer physical optimization claims. |

Primary sources inspected on 2026-10-10:

- [CGTrader datasets](https://www.cgtrader.com/discover/datasets): explicit AI-use licensing, standardized 3D datasets, scene collections, and separately qualified simulation assets. The page demonstrates an offered commercial category, not a Wildz purchase commitment or comparable contract price.
- [Shutterstock AI services, October 7, 2025](https://investor.shutterstock.com/node/14416/pdf): custom datasets, before/after pairs, metadata, annotation, and evaluation; names relationships with NVIDIA, Meta, OpenAI, and Runway. These organizations are market examples, not Wildz customers.
- [Shutterstock 2025 results, February 17, 2026](https://investor.shutterstock.com/news-releases/news-release-details/shutterstock-reports-full-year-2025-and-fourth-quarter-financial): $203.3 million from the combined Data, Distribution, and Services offering. This amount includes distribution/services and must not be described as pure AI-data revenue, one contract, or Wildz's addressable revenue.
- [DeepMind SIMA](https://deepmind.google/blog/sima-generalist-ai-agent-for-3d-virtual-environments/): human play in commercial games was used to train agents, including freely played sessions annotated afterward. This supports technical relevance, not living-wage economics or direct robotic transfer.
- [Scale physical AI](https://scale.com/physical-ai): demonstration data, grounding annotations, and performance evaluation are commercial offerings. Real-world/calibrated requirements remain distinct from Wildz simulation.

## First product: construction and resource causal evaluation package

The buyer receives selected, deterministic examples of an action changing a world under pinned rules. Initial tasks measure state-change prediction, object/state tracking, resource accounting, and prerequisite planning. They do not claim to supply photorealistic imagery, real-world physics, robot joint trajectories, CAD tolerances, human intent labels, or production construction plans.

The proposed differentiation is the combination of source provenance, exact before/action/after relationships, explicit game laws, and replay. Competitors already offer rich metadata and before/after examples. Superiority must be measured against a relevant buyer baseline; it cannot be inferred from the existence of proof objects.

Initial included action families:

- Construction project/component creation, adjustment, material contribution, work, and maintenance.
- Finite material harvesting and supported resource transformations.
- Food gathering/consumption only when their semantics are useful to the selected task and authorized for export.

Walking and camera movement are not fully recorded by these source histories. The first package must not manufacture continuous trajectories, intentions, failures, or observations absent from the admitted source. Unsupported action families are excluded with a coverage report. Any later richer capture requires a separately reviewed performance and privacy design.

## Existing authority path and native composition

The installed packages are `@receiz/sdk`, `@receiz/mcp-server`, and `@receiz/ai-skills` 128.0.0. Constitutional ruleset is 127.0.0. Registry digest is `8d0b5b839d02d9efbd4306cc99410595a183705c2670b76d2567eaaaade99065`; operation-matrix digest is `940c316b5b7d6212240e699d03b3c1fd419cbbecc6ee51ddd7aa7783d9e523b0`. Public function inventory digest inspected: `687bdd064b49bf7df1c32eb4ab3c0f1389c80c8bc90d7cfbec32147db1cc73ad`.

The application already provides the relevant path:

1. Native resource source pages preserve exact enclosing Originals, source author evidence, Kai coordinates, expected heads, append index, and causal history in `src/lib/receiz/wilds-resource-source-v128.ts`.
2. `verifyWildsResourceSourceProofV128` in `src/lib/receiz/wilds-resource-exchange-v128.ts` opens exact artifact bytes through the existing `openWildzArtifactEvidence` and SDK `artifacts.verifyAndOpen`, checks digest/payload/owner/carrier bindings, checks source continuity, replays the declared fixed law, and restores the custody Original with `domains.restoreVerifiedReplayProofObjectV124`.
3. `reduceWildsResourceJournalV128` and `replayWildsResourceJournalOwnerV128` bind commands and imports to the admitted owner/source. `replayWildsResourceGameplayV128` executes the existing game rules from the fixed source genesis. Its current bounds are 1,024 commands and 8 MiB per gameplay trace; these bounds are retained.
4. `WildsWorldService`, `reduceWildsWorldEvent`, and the existing construction progress/geometry projectors supply deterministic state mechanics. Bare `WildsWorldRecord` snapshots and the legacy public-store projection are insufficient as a proof-authenticated data source. The service's bounded event tail is not complete canonical history.

The exporter composes these existing readers/projectors. It creates no replacement verifier, signer, custody system, source journal, or financial authority. Source bytes entering another process undergo the existing exact-byte verification in that process; already admitted same-runtime history is retained and only additions are processed. No repeated world-wide historical verification is added to gameplay.

Same-release MCP schemas inspected include `receiz_source_carried_replay_open`, `receiz_v124_domain_verified_replay`, and `receiz_v124_domain_replay_proof_object_restore`. They provide operator inspection/replay, not runtime or consent authority. `receiz_capabilities` description was also inspected; availability descriptions do not establish operational readiness. MCP and AI skills never enter gameplay or buyer inference loops.

The v128 attestation lifecycle can represent evidence, evaluation, explicit consent, accepted heads, and selective presentation. Relevant published exports inspected include `createReceizAttestationApplicationV125`, `planReceizAttestationEventV125`, and `verifyReceizAttestationHistoryV125`; their plans are not authority. A production licensing agreement must first resolve actual sealed domain authority and lawful actor grants. A caller-supplied domain, `consent: true`, or cached rights flag cannot authorize disclosure.

## Processing architecture

Implement an operator-only batch processor initially. No new import from gameplay components, frame callbacks, wallet loading, Vault loading, bonding, hydration, or service-worker paths is permitted.

The batch reads an explicitly selected, authorized, retained source package. It verifies the exact source once in its own runtime, identifies the consented contribution scope, and builds selected examples through the existing reducers. Derived examples, indexes, and metrics are lower-authority application data. They cannot authorize gameplay, ownership, payment, or licensing.

A future scheduled processor reads only verified additions after its retained source head. It is a separately provisioned process, not a callback awaited by a gameplay mutation. Existing game requests are not extended with data jobs, file writes, model calls, or buyer requests. A processor failure leaves source and gameplay untouched and records an operational error below proof authority.

Use content-addressed files and the existing authorized Receiz transport where publication is later approved. No new database, provider key, background client model, external SDK, or Receiz core change is included. Production job hosting and any custom transport must be assessed against the existing v128 capabilities before implementation; this design grants no exception to the repository's capability-gap process.

## Output contract

Each package contains:

| File | Purpose |
| --- | --- |
| `manifest.json` | Format version, product scope, release/law identity, source commitments, data origin, task families, output-file digests/counts, exclusions, and rights/publication status |
| `transitions.jsonl` | Selected before/action/after examples with task labels and source-event commitments |
| `scenes.jsonl` | Allowlisted object transforms, dimensions, construction stages, and lawful rendered/collision geometry needed for included tasks |
| `tasks.jsonl` | Deterministic task definitions, withheld expected outcomes, scoring rules, and split membership |
| `quality.json` | Replay consistency, duplicates, missing evidence, task coverage, counts, and measured processing costs |
| `dataset-card.md` | Origin, collection scope, consent/use limits, known domain limitations, metrics, and buyer instructions |
| private contribution/source records | Exact source custody and contribution mapping, retained separately from buyer delivery |

Output labels must distinguish a synthetic simulation preview, a proof-authenticated historical dataset, an evaluation delivery, a commercially licensed delivery, buyer acceptance, paid invoice, and delivered player payment. These are separate facts.

Examples identify entities using package-scoped pseudonyms. A pseudonym is not a promise of anonymity. The buyer package excludes usernames, emails, profile names/images, chats, voice, identity artifacts, keys, bearer Originals, payment information, private creature memory, and unrelated namespace fields. Source Originals and the private contributor mapping stay in authorized custody. Buyer access to independent proof verification requires separately authorized source/evidence access; a dataset digest alone is never advertised as enclosing-proof verification.

Construction stage geometry must use existing projectors. A planned foundation's intended catalog geometry cannot be labeled a completed physical obstacle. Virtual units and exact rule version are declared; real-world calibration is unestablished.

Task labels are authored deterministic categories such as `construction-stage-prediction` and `resource-conservation`. Inferred goals or player preferences remain inference and cannot be labeled witnessed intent. Split by source ancestry/build family before selecting rows; successor variants from one build must not leak between training and held-out evaluation. Duplicate source events are not new paid contributions.

## Consent, delivery, and contribution accounting

Players can authorize participation once through a clear earning agreement and continue ordinary play. Operational conversion remains behind the scenes. This design does not silently authorize use of existing private histories. Private research/source custody is distinct from licensed buyer disclosure.

The agreement must bind the consenting subject, applicable source/history scope, permitted fields/uses, customer/license category, term, prospective withdrawal behavior, and revenue-sharing terms. All required contributors and underlying asset rights must be covered. A valid artifact establishes its authenticated claims/history; possession or in-game asset title alone does not establish all commercial IP rights.

For the initial technical preview, rights status remains `evaluation-only` and native proof status remains accurately labeled. Commercial delivery stays disabled until a qualified rights path and actual agreement exist. Withdrawal excludes future deliveries according to the agreement while preserving historical evidence and previously licensed obligations.

Maintain private contribution references from each exported example to its exact admitted source event/head and actor. Co-contributors must be determined from witnessed history, not inferred effort or possession of a later asset. Shared examples retain shared attribution. The first release records attribution only: it adds no wallet balance, mint, estimated income presented as money, or financial transfer.

Buyer revenue is recognized only from the actual accepted paid outcome. Platform costs/share and contributor allocation come from agreed terms; no percentage or minimum wage is invented by this design. Repeat licenses retain original contribution attribution. Payment execution, funded recovery, and player cash-out qualification are a distinct later delivery under the existing Receiz rails, with the required authority/consent. The currently connected marketplace MCP profile excludes financial execution and must not be bypassed.

## Failure and resource limits

Reject missing or invalid Originals, forged projections, foreign application/domain/law identity, missing ancestry, conflicting equal-slot history, stale expected heads, tampered bytes, unsupported action semantics, absent required rights, and incomplete reconstruction. Rejection produces no licensed output, admission, source mutation, or payment.

Historical datasets do not require current live asset ownership merely to describe a formerly lawful event. Historical source verification never becomes a current grant to publish, transfer, or license. Current rights/revocation checks remain separate.

Initial operator fixtures: 32 and 128 supported commands; benchmark the existing 1,024-command upper bound before claiming operational capacity. Stream output rows into staged files; cap one processing unit at 8 MiB of command input and the existing source reader limits. Finish file hashes/quality checks before atomically marking a package complete. A killed process leaves an incomplete staging directory; a retry of the same source head and product version must reproduce identical completed output, not duplicate contribution claims.

The client budget is zero new browser requests, worker instances, timers, retained proof buffers, event listeners, and runtime import edges. This can be established for the isolated batch version. Future client capture has no such guarantee until measured. Backend throughput and memory must be measured separately from frame performance.

## Acceptance evidence

Engineering gates:

- Valid authorized exact-source positive and an independent recipient-runtime reopen/replay; no stub verifier can supply production evidence.
- Altered source, missing ancestor, changed law, foreign owner/application, copied JSON admission, unknown namespace, source fork, duplicate, restart, and partial-write rejection cases.
- Byte-preserved original custody and consistent event/payload commitments; complete history never truncated to a presentation tail.
- Correct construction stage geometry and resource effects; no fabricated human/physical-world labels.
- Automated buyer-package checks for identity/private/bearer leakage and unlicensed fields.
- Train/evaluation split isolation across ancestry and build variants.
- Numeric processor resource results, unchanged app imports/request counts, and existing wallet/Vault/gameplay regression gates.
- `pnpm receiz:architecture-lock`, official v128 checker/conformance, appropriate tests, and full release checks before calling runtime changes release-ready.

Commercial gates:

- A named customer agrees to task definitions, format, rights, metrics, acceptance thresholds, and a paid evaluation contract.
- Customer can ingest the package and reproduce the advertised task metrics.
- Compare against its relevant current baseline for label/replay integrity, integration cost, coverage, and held-out model/evaluation usefulness. A premium claim requires measured improvement valuable to that customer.
- Record accepted and rejected outputs, external receipts, processing/delivery costs, attributable net revenue, and repeat purchases. Full-time income claims require observed earnings across all participant time, including sessions producing no accepted output.

No customer has been contacted, no private player source selected, no commercial rights admitted, no dataset sold, and no payment executed during this design work.

## Work sequence after written-design approval

1. Write and review the implementation plan for the isolated compiler, task generator, buyer verification tools, and source/rights boundaries.
2. Use the included synthetic preview as the format example, then implement the exact-source authenticated private compiler and negative tests.
3. Produce the buyer-readable technical package and a reproducible baseline evaluation. Commercial delivery remains disabled pending rights and a real customer agreement.
4. Qualify the consented source/delivery path with actual Originals and an independent receiver, then run performance and release gates.
5. Review the concrete paid pilot and publication command before external delivery. Implement financial allocation/payment qualification only after actual terms/funding exist.

Spec approval does not authorize contacting companies, sharing private history, transferring value, pushing commits, or deploying.

## Concrete format preview

[Construction preview](../../economy/samples/construction-preview.json) was generated by exercising the existing compiled `WildsWorldService`, production placement evidence/preview, construction stage projector, and independent event replay at baseline `307c286`. It contains two synthetic state-change examples and their complete two-event simulation history. Replay matches the produced world state; changing an event digest is rejected. The planned foundation has zero active physical solids, and its intended geometry is separately labeled.

This is a design/format artifact produced during read-only rule exploration, not a new production exporter. No actual player session, native enclosing proof verification, commercial right, payment, or buyer acceptance is represented. The application source and runtime remain unchanged.
