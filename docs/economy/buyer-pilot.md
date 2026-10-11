# Wildz construction and resource evaluation pilot

Status: proposed product and acceptance brief, prepared 2026-10-10. No customer contract, commercial dataset, invoice, or revenue is represented by this document.

## Customer problem

An AI team needs structured examples that explain how actions change object state, construction progress, and finite resources. Video or static objects alone may not supply all of the state/action/outcome labels needed for these tasks. Existing suppliers already sell metadata, structured examples, 3D scenes, and evaluation services; Wildz must prove an advantage in the buyer's specific workflow.

## Proposed deliverable

A versioned construction/resource dataset with deterministic action/outcome examples, scene-state descriptions, source commitments, held-out tasks, a quality report, and reproducible scoring instructions. Examples originate in supported existing Wildz gameplay. An optional authorized evidence room supplies independent source verification; dataset hashes are transport integrity rather than proof admission.

The initial technical preview demonstrates the shape of these outputs using explicitly synthetic existing-rule simulations. It contains no actual user private history and is not a proof-authenticated human-play corpus. General robotics, real-world material properties, photorealistic data, and engineering-safe CAD are outside this pilot's claims.

The [construction preview](samples/construction-preview.json) contains two examples generated with the existing game reducers. Its exact event replay matches the simulated state, a changed event digest rejects, and planned construction is correctly distinguished from a completed physical obstacle. It establishes sample mechanics only; no model-quality or financial improvement has been measured.

## Why evaluate it

The proposed benefit is lower work to obtain exact state/action/outcome relationships, dependable versioned replay, and clear contribution provenance. The customer should measure these benefits against its current source. Proof authentication adds auditability; it cannot establish model improvement by itself.

## Paid pilot terms to establish

The customer defines its target tasks and relevant baseline. Both parties agree on data scope, usable formats, rights, volume, quality thresholds, held-out evaluation, delivery, accepted price, and invoicing. Pricing follows actual buyer requirements and measured utility. This brief quotes no unsupported enterprise price or guaranteed return.

Buyer acceptance records should include ingestion success, replay/label error rate, duplicate rate, task coverage, time spent integrating, baseline comparison, and held-out task results. Separate product acceptance from payment confirmation and contributor payment delivery.

## Target categories

Start with teams building/evaluating world models and agents in virtual environments, and enterprises sourcing licensed structured 3D data. Model-data suppliers may be distribution partners as well as competitors. Do not characterize NVIDIA, OpenAI, Meta, Runway, CGTrader, or Scale as Wildz customers or interested prospects without their actual response.

## Evidence behind market selection

- [CGTrader](https://www.cgtrader.com/discover/datasets) offers licensed/standardized 3D datasets and scene collections.
- [Shutterstock](https://investor.shutterstock.com/node/14416/pdf) offers structured before/after examples, metadata, annotation, and model evaluation services, and identifies existing industry relationships.
- [DeepMind SIMA](https://deepmind.google/blog/sima-generalist-ai-agent-for-3d-virtual-environments/) demonstrates technical use of human gameplay in agent training. It does not establish commercial demand for this particular Wildz dataset.

The production design and acceptance gates are in [the gameplay-data spec](../superpowers/specs/2026-10-10-gameplay-data-products-design.md).
