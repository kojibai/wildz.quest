# Wildz v3 release verification

Date: 2026-07-20. Target version: `3.0.0`.

## Qualification status

The exact local candidate passed the repository release gate and is qualified for commit. Production activation still requires the production Receiz environment, a successful authorized strict-live run, and the external interoperability and remote-mutation gates described below. This document does not declare the candidate deployed, tagged, pushed, strict-live qualified, or externally published.

## Versioned toolchain

| Package | Requested version | Installed version | Role |
|---|---|---|---|
| `@receiz/sdk` | `113.0.0` | `113.0.0` | Application identity, artifact, native proof-object, constitutional compiler, command admission, causal replay, checker, and remote-rail client |
| `@receiz/mcp-server` | `113.0.0` | `113.0.0` | Operator tooling; never application authority |
| `@receiz/ai-skills` | `113.0.0` | `113.0.0` | V113 operator procedure guidance; never proof authority |

The finalized v113 SDK, MCP, and AI-skills packages resolve directly from the official npm registry, with their published integrity values pinned by the lockfile. `receiz.app.json` declares artifact-first authority with database authority disabled; the v113 compiler and `pnpm receiz:check` validate the repository integration plan, release identity, ruleset, registry digest `4c4aa85f9785d205dcf7e4e5109837a83f8c3bf8e166130ae7e87353f299c637`, operation-matrix digest `091ab9e6b3acb05283510a19754e53c637dbd96b47b499a524dc44c34f8e783b`, 30 artifact laws, and protocol/runtime limits.

## Local evidence

| Gate | Result |
|---|---|
| `pnpm release:check` | Pass: v113 repository integration and release-identity checker, all 941 Node tests, typecheck, MCP conformance, lint, full tracked/untracked text secret scan, production build, and default Receiz doctor |
| Historical migration compatibility | Pass: forward-only checkpoint retained; sealed artifacts, receipts, and heads preserved; current execution remains v113-only |
| V113 offline authority | Pass: a queued proposal is not a global commitment; divergence resolution is structural-only |
| Proof/Vault regressions | Pass in the full suite, including complete 97/98-card restore, canonical Identity Seal/key continuation, scoped legacy Vault recovery, compact historical-card custody admission, duplicate drops, revision reconciliation, pending-to-final admission, and atomic fork rejection |
| Native proof-object continuity | Pass: v113 Record → Seal artifact, owner, record, claim, verify path, Signature V4, exact download digest, and exact-file reopen; `wildz-v113` retries bind to the payload digest |
| Artifact transitions and reconciliation | Pass: admission is non-authoritative, planning is zero-write, capability is plan-bound, staging is immutable, commit independently resolves bytes and atomically advances one named domain, receipts are report-only, and the nine MCP tools match AI doctrine |
| Legacy compatibility | Pass: strict bounded app-owned reader plus payload digest, owner, namespace, prior-head, and revision checks |
| Owner continuity | Pass: bearer claims consume only an SDK-opened complete artifact, return and reopen a native claimed artifact, exact duplicates drop, and divergent immutable origins or proof forks fail |
| Public-profile continuity | Pass: verified cards publish before a non-empty owner profile; only marked sanitized anonymous profile JSON is cached by exact URL |
| V3 ecology lifecycle | Pass: activation, resolution, historicization, expiry, cap release, causal replay, and retry idempotency |
| Market settlement coordinator | Pass with local contract doubles: admitted trade, Receiz Connect transfer proof, corroborating wallet ledger event, conditional ownership append, and idempotent recovery; v113 exposes no Wildz-specific conditional append, so the live adapter remains fail-closed without that capability |
| Bearer claim product flow | Pass: the explicit online action requires the active proof session and player confirmation, submits the complete artifact to the v113 ownership route, independently reopens the returned artifact, downloads the exact admitted bytes, and only then projects verified cards locally; ordinary Vault restore remains independent of this online claim |
| Mobile entry | Chromium and WebKit pass: one-line Genesis copy, no horizontal overflow, and clean entry logs |
| Gameplay presentation | Chromium mobile smoke passed; WebKit mobile world render was visually inspected at the release viewport |
| PWA boundary | Real Chromium worker activation and offline navigation passed; an unvisited public route rendered offline guidance without leaking another page |

The supplied production-shaped Vault was historically inspected without recording private bytes, paths, identity values, hashes, or card identifiers. It decoded to 98 cards with an embedded player. That result remains compatibility evidence, not a fresh v113 qualification. The server commits the historical-owner portion of an exact verified collection into the encrypted session, and gameplay accepts an older-owner card only with its compact membership proof. An artifact without an Identity Seal or v113 owner-continuity binding leaves canonical account-only writes Identity Seal/key-gated.

## Pending external evidence

The following remain production or externally authorized gates and were not rewritten as local passes:

- `pnpm receiz:doctor:strict` was attempted and failed closed before live probes because the production credentials and configuration were absent; strict-live qualification remains pending.
- Remote world, public-profile, market, payment, transfer, settlement, and publication mutations remain pending. The shared-world bootstrap is implemented and fail-closed, but requires the server-only `RECEIZ_CONNECT_ACCESS_TOKEN` and authorized production qualification. V113 does not expose the Wildz-specific conditional market ownership append, and the local paths fail closed until the configured Receiz deployment admits every required capability.
- The external six-writer artifact exercise remains pending; its six-writer local fixtures passed.
- Deployment, tag, push, and production publication were not performed.

## Offline verification contract

The worker may cache the versioned app shell, previously visited public profile and card documents, and successful allowlisted card GET responses. Authentication, live world, social presence, market, Receiz, artifact-proxy, personalized, failed, and mutation responses are network-only. An unvisited public document falls back to `/offline`, never the cached root document.

## Remote verification contract

There is no external database added by Wildz. Browser owner state is local IndexedDB state; durable shared state depends on configured Receiz rails. Those rails fail closed when missing, stale, unverifiable, or unreachable. A checkout session is not settlement, and ownership never transfers without admitted settlement evidence.

## Release decision

Version `3.0.0` is locally qualified for commit. Production activation is conditional on the supplied environment, the strict-live doctor, and the remaining authorized external gates.
