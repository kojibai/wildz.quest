# Wildz architecture

Wildz is a game product built from the Receiz Commerce Kit application kernel. This document explains the architectural fork, where to extend it, and which boundaries must remain intact.

## Architectural thesis

Receiz Commerce Kit proves that products, orders, rewards, identity, and storefront state can be carried and projected from proof-native objects. Wildz asks the harder follow-up question: can the same kernel support a persistent social game whose important objects move between applications and devices?

The answer implemented here is yes—with a deliberate separation between game computation, proof authority, shared coordination, and agent operations.

| Plane | Responsibilities | Must not become |
|---|---|---|
| Product | World rendering, input, collection, battles, profiles, market UI | Proof verifier or settlement authority |
| Game kernel | Deterministic commands, consequences, replay, ecology, progression | Network or wall-clock authority |
| Receiz adapters | Verification, custody, sessions, publications, ownership, settlement coordination | UI-specific state machine |
| Proof objects | Portable identity, card, Vault, history, and ownership evidence | A mutable database row |
| Receiz rails | Admitted shared projections and coordinated operations | A substitute for carried proof |
| MCP and AI skills | Inspection, planning, diagnosis, and authorized invocation | Independent authority or implicit consent |

## From commerce kit to living world

The source repository supplied the original application shape and proof-native commerce patterns. Wildz retained the useful kernel ideas and replaced the vertical product:

| Receiz Commerce Kit concept | Wildz expression |
|---|---|
| Customer identity and account restore | Explorer identity, Identity Seal/key continuation, and Vault recovery |
| Receized product or reward asset | Portable living creature card |
| Storefront public state | Public player profile, public card, and world projection |
| Merchant workspace | Owner-scoped collection, settings, history, and game cursor |
| Commerce event | Deterministic world, battle, social, or market command |
| Ownership and settlement rails | Listings, offers, trades, transfer proof, and admitted ownership append |
| Operator tooling | World/market/release operations through MCP and AI skills |

The result is an architectural fork, not a theme change. Game state is deterministic and event-driven; portable cards participate directly in play; an exact verified Vault can restore a complete collection; historical provenance is preserved; shared state distinguishes local projection from admitted remote truth.

## Runtime flow

1. The browser creates or restores an owner-scoped Wildz session.
2. Any carried artifact crosses the Receiz verifier before Wildz parses verified payload bytes.
3. The application projects verified owner truth immediately into the product.
4. Game commands run through deterministic domain systems and produce replayable consequences.
5. A canonical shared mutation is prepared with current history, actor, capability, expected head, commit domain, and idempotency evidence.
6. Staged bytes are independently resolved and reverified before an atomic head advance.
7. The returned receipt reports an outcome; it does not become reusable authority.

Local browser state makes the product responsive and recoverable, but it never promotes an unverified object or failed remote write into durable truth.

## Code boundaries

### Product and game systems

`src/features/play` owns the living world, exploration, cards, raids, ecology, social systems, and presentation. `src/features/games` owns deterministic reusable game kernels and Mortal Arena lifecycle. `src/features/identity`, `market`, `profile`, `pwa`, and `shell` own their corresponding product surfaces.

Keep game rules deterministic. Inject time, randomness, and external results as explicit inputs so commands can be replayed and tested.

Kai Klok is the primary temporal root for that deterministic kernel. Canonical inputs carry an exact safe-integer `uPulse`, admitted coordinate, and causal sequence. ISO timestamps are descriptive display metadata and never order game state. Descendant history advances its parent; only verified divergent siblings compare `uPulse`; an equal-`uPulse`, equal-slot disagreement fails closed.

Creature progression uses two layers: an immutable base proof object and an append-only exact-card history. History verification checks asset identity, parent linkage, idempotency, Kai chronology, bounded effects, event digest, and resulting projection digest before rebuilding level, bond, mastery, condition, record, form, and life state. A Vault transports the same verified card history; it does not flatten it into family-level state or rewrite the base proof.

Arena uses fixed rules, deterministic frame batches, pinned fighter revisions, and replayable transcripts. Practice and Adventure can run locally. Ranked settlement additionally requires verified global admission. Mortal additionally requires a verified, player-bound, match-scoped covenant. Replays, receipts, AI reviews, and MCP audits explain evidence; none can admit a result. High-frequency inputs remain in the transcript, while only admitted durable consequences append to creature history.

### Receiz integration

`src/lib/receiz` is the integration boundary. It owns complete-artifact verification, session bridging, Vault/card admission, custody and history, public repositories, world publication, market coordination, and SDK adapters.

New application code should call a domain adapter rather than importing the SDK from a React component. A new canonical mutation requires tests for stale heads, wrong actors, replay/idempotency, missing capabilities, invalid proof, and partial remote failure.

### Persistence

`src/lib/storage` holds browser persistence. IndexedDB state is owner-scoped and supports continuity, history, and first paint. It is not the authority for a public listing, ownership transfer, settlement, or global world commitment.

### Public and API surfaces

`app` contains the App Router product and route handlers. Public profile and card responses must remain sanitized. Authentication, artifact proxying, world coordination, publication, and market mutations are network-only and must not enter the service-worker document cache.

## Constitutional application contract

`receiz.app.json` declares the exact features and operation matrix for Wildz. Its key choice is:

```json
{
  "authority": {
    "mode": "artifact-first",
    "allowDatabaseAuthority": false
  }
}
```

`receiz.generated.json` is deterministic repository evidence produced from that contract. `pnpm receiz:check` validates the declaration, target release, ruleset, registry digest, operation matrix, protocol limits, and artifact laws. A passing checker confirms integration evidence; it does not prove a live rail is configured or a specific artifact is valid.

## Agent-native engineering

Wildz treats AI as an operator and proof as authority.

- Repository skills encode invariant-preserving procedures close to the code they govern.
- Receiz MCP exposes bounded inspection and invocation tools to compatible agents.
- The SDK and server re-check authority at execution time.
- Destructive, publishing, settlement, and release actions still require explicit human confirmation and the appropriate verified capability.

This makes agent assistance reproducible without creating an unreviewable privileged path.

For competitive operations, read-only MCP audits may summarize replay admission, tournament health, season integrity, publication status, and capability readiness. AI may run deterministic simulations, balance analysis, incident triage, and opt-in coaching from sanitized admitted evidence. Coaching recommendations are not gameplay or proof authority, and an agent never signs or admits an Arena envelope, covenant, result, card event, publication, or release. Every command that can publish, settle, administer a season, deploy, or release requires explicit human confirmation against the exact command or permit digest.

## Extension checklist

When building a new product or feature from Wildz:

1. Define the domain object and which evidence is authoritative.
2. Define its deterministic projection and replay behavior.
3. Add the narrow adapter method that crosses the Receiz boundary.
4. Preserve exact artifact bytes and verify before parsing.
5. Define offline behavior explicitly; never imply a queued write is committed.
6. Fail closed when remote capability or current authority is absent.
7. Add tests for success, rejection, stale/conflicting state, retry, and partial failure.
8. Update the application contract, MCP doctrine, AI skill, and release evidence when their surfaces change.
9. Run `pnpm release:check` before proposing a release.

Creature voice follows the same boundary: the exact card proof and live head remain authority; the server only verifies, observes, transports, and optionally enriches. The local v120 living-subject Twin forms the bounded proof response without network authority. An integrity-pinned local neural/WASM worker renders proof-authored phrases when ready; a compact deterministic source-filter instrument remains the zero-wait acoustic floor. Both are conditioned by proof signature, birth moment, speaking Kai moment, and Golden Breath. Model installation and initialization remain outside gameplay and response-memory paths. Voice playback cannot authorize, block, rewrite, reorder, or erase the existing proof-history conversation append. See [Receiz v120 creature voice](RECEIZ_V120_CREATURE_VOICE.md) and the [v121 SDK request](RECEIZ_V121_OFFLINE_VOICE_REQUEST.md).

## Further reading

- [Receiz rails](RECEIZ_RAILS.md)
- [Receiz v120 creature voice](RECEIZ_V120_CREATURE_VOICE.md)
- [MCP contract](MCP.md)
- [Artifact interoperability](release/artifact-interoperability.md)
- [Feature implementation map](release/feature-parity.md)
- [Release verification](release/verification.md)
- [Competitive integrity](release/competitive-integrity.md)
- [Gameplay scorecard](release/gameplay-scorecard.md)
